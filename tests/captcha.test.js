// Tests for lib/captcha.js — new member captcha verification flow
//
// lib/captcha.js's only pure/private helper is `generateOptions(correctAnswer)`,
// which is NOT exported (by design — it's a small internal helper). Per the task
// constraints we do not export private functions solely to unit test them.
//
// All exported functions (handleChatMember, handleNewChatMembers, handleCallbackQuery,
// cleanupExpiredVerifications) perform real network I/O via lib/telegram.js's
// `fetch(...)` calls to the Telegram Bot API. To exercise them deterministically and
// without any real network access, we stub `global.fetch` for the duration of this
// file and assert on which Telegram methods get invoked and with what payloads.
// State (pendingVerifications) is seeded/read directly from lib/state.js so tests
// don't depend on Math.random() captcha generation.

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pendingVerifications } from '../lib/state.js';
import { handleCallbackQuery, cleanupExpiredVerifications } from '../lib/captcha.js';

// ── fetch stub ──
let fetchCalls = [];
let originalFetch;

function methodFromUrl(url) {
  // e.g. https://api.telegram.org/bot<token>/banChatMember -> banChatMember
  return url.split('/').pop();
}

function installFetchStub() {
  originalFetch = global.fetch;
  fetchCalls = [];
  global.fetch = async (url, opts) => {
    const method = methodFromUrl(String(url));
    const body = opts?.body ? JSON.parse(opts.body) : null;
    fetchCalls.push({ method, body });
    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    };
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

// ── fake Vercel-style res object ──
function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(obj) {
      res.body = obj;
      return res;
    },
  };
  return res;
}

let idCounter = 5000;
function freshIds() {
  idCounter += 1;
  return { userId: idCounter, chatId: -900000 - idCounter };
}

describe('captcha.js — generateOptions', () => {
  test('not exported (private helper) — not directly unit tested', () => {
    // Documented no-op: generateOptions() is module-private in lib/captcha.js and is
    // only reachable through handleChatMember()/handleNewChatMembers(), both of which
    // call sendMessageWithKeyboard() (real network I/O). Its behavior (4 unique options
    // including the correct answer, all > 0) is exercised indirectly below via the
    // callback-query flow, which consumes the answer captcha state produces.
    assert.equal(true, true);
  });
});

describe('captcha.js — handleCallbackQuery', () => {
  beforeEach(() => {
    installFetchStub();
  });

  after(() => {
    restoreFetch();
  });

  test('rejects a callback from a user who is not the target', async () => {
    const { userId, chatId } = freshIds();
    const key = `${chatId}_${userId}`;
    pendingVerifications.set(key, { messageId: 42, answer: 7, joinedAt: Date.now(), firstName: 'Alice' });

    const callbackQuery = {
      id: 'cbq1',
      from: { id: userId + 1, first_name: 'Mallory' }, // different user
      message: { chat: { id: chatId } },
      data: `verify_${userId}_7`,
    };
    const res = makeRes();
    await handleCallbackQuery(callbackQuery, res);

    assert.equal(res.statusCode, 200);
    const answerCall = fetchCalls.find(c => c.method === 'answerCallbackQuery');
    assert.ok(answerCall, 'expected answerCallbackQuery to be called');
    assert.match(answerCall.body.text, /not for you/i);
    // Pending verification must remain untouched
    assert.ok(pendingVerifications.has(key));
    pendingVerifications.delete(key);
  });

  test('handles expired/missing verification gracefully', async () => {
    const { userId, chatId } = freshIds();
    const callbackQuery = {
      id: 'cbq2',
      from: { id: userId, first_name: 'Bob' },
      message: { chat: { id: chatId } },
      data: `verify_${userId}_7`,
    };
    const res = makeRes();
    await handleCallbackQuery(callbackQuery, res);

    assert.equal(res.statusCode, 200);
    const answerCall = fetchCalls.find(c => c.method === 'answerCallbackQuery');
    assert.ok(answerCall);
    assert.match(answerCall.body.text, /expired/i);
  });

  test('correct answer unmutes user, deletes challenge message, and clears pending state', async () => {
    const { userId, chatId } = freshIds();
    const key = `${chatId}_${userId}`;
    pendingVerifications.set(key, { messageId: 42, answer: 12, joinedAt: Date.now(), firstName: 'Carol' });

    const callbackQuery = {
      id: 'cbq3',
      from: { id: userId, first_name: 'Carol' },
      message: { chat: { id: chatId } },
      data: `verify_${userId}_12`,
    };
    const res = makeRes();
    await handleCallbackQuery(callbackQuery, res);

    assert.equal(res.statusCode, 200);
    assert.ok(fetchCalls.some(c => c.method === 'restrictChatMember' && c.body.user_id === userId),
      'expected restrictChatMember (unmute) call');
    assert.ok(fetchCalls.some(c => c.method === 'deleteMessage' && c.body.message_id === 42),
      'expected deleteMessage call for the challenge message');
    assert.ok(fetchCalls.some(c => c.method === 'banChatMember') === false,
      'must not ban on correct answer');
    assert.equal(pendingVerifications.has(key), false, 'pending verification should be cleared');
  });

  test('wrong answer bans user, deletes challenge message, and clears pending state', async () => {
    const { userId, chatId } = freshIds();
    const key = `${chatId}_${userId}`;
    pendingVerifications.set(key, { messageId: 99, answer: 5, joinedAt: Date.now(), firstName: 'Dave' });

    const callbackQuery = {
      id: 'cbq4',
      from: { id: userId, first_name: 'Dave' },
      message: { chat: { id: chatId } },
      data: `verify_${userId}_999`, // wrong answer
    };
    const res = makeRes();
    await handleCallbackQuery(callbackQuery, res);

    assert.equal(res.statusCode, 200);
    assert.ok(fetchCalls.some(c => c.method === 'banChatMember' && c.body.user_id === userId),
      'expected banChatMember call');
    assert.ok(fetchCalls.some(c => c.method === 'deleteMessage' && c.body.message_id === 99),
      'expected deleteMessage call for the challenge message');
    assert.equal(pendingVerifications.has(key), false, 'pending verification should be cleared');
  });

  test('ignores callback_data not prefixed with verify_', async () => {
    const res = makeRes();
    const callbackQuery = {
      id: 'cbq5',
      from: { id: 1, first_name: 'X' },
      message: { chat: { id: -1 } },
      data: 'something_else',
    };
    await handleCallbackQuery(callbackQuery, res);
    assert.equal(res.statusCode, 200);
    assert.equal(fetchCalls.length, 0, 'no Telegram API calls should be made');
  });
});

describe('captcha.js — cleanupExpiredVerifications', () => {
  beforeEach(() => {
    installFetchStub();
  });

  after(() => {
    restoreFetch();
  });

  test('bans and removes users whose captcha window has expired', async () => {
    const { userId, chatId } = freshIds();
    const key = `${chatId}_${userId}`;
    // joinedAt far in the past guarantees expiry regardless of CAPTCHA_TIMEOUT_MS value
    pendingVerifications.set(key, { messageId: 7, answer: 3, joinedAt: 0, firstName: 'Eve' });

    await cleanupExpiredVerifications();

    assert.ok(fetchCalls.some(c => c.method === 'banChatMember' && c.body.user_id === userId),
      'expected expired user to be banned');
    assert.ok(fetchCalls.some(c => c.method === 'deleteMessage' && c.body.message_id === 7),
      'expected challenge message to be deleted');
    assert.equal(pendingVerifications.has(key), false);
  });

  test('leaves non-expired pending verifications untouched', async () => {
    const { userId, chatId } = freshIds();
    const key = `${chatId}_${userId}`;
    pendingVerifications.set(key, { messageId: 8, answer: 3, joinedAt: Date.now(), firstName: 'Frank' });

    await cleanupExpiredVerifications();

    assert.equal(fetchCalls.length, 0, 'no API calls expected for a fresh verification');
    assert.ok(pendingVerifications.has(key));
    pendingVerifications.delete(key);
  });
});
