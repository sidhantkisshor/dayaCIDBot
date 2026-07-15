// Tests for lib/spam.js — spam scoring engine
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isSpam } from '../lib/spam.js';

// Use unique userId/chatId per test so flood/burst state (recorded per user+chat
// in lib/state.js's in-memory Maps) never bleeds across test cases.
let idCounter = 1000;
function freshIds() {
  idCounter += 1;
  return { userId: idCounter, chatId: -100000 - idCounter };
}

const HAM_SAMPLES = [
  'Hello friends, how is everyone?',
  'Good morning everyone, hope you have a great day!',
  'Can someone help me set up my trading journal spreadsheet?',
  'Thanks for the help yesterday, really appreciate it',
  'Does anyone know what time the market opens today?',
];

const SPAM_SAMPLES = [
  // Crypto/airdrop + urgency + group promo + suspicious short link
  'Free crypto airdrop live now! Join our group for guaranteed profit! bit.ly/claim2024 hurry up limited time',
  // Forex signal spam with price levels and trading emojis
  'XAUUSD BUY NOW Entry 1985 TP 2010 SL 1975 ✔️ 2010 guaranteed profit daily income signal group vip',
  // Adult content spam with contact request
  'Hot pics nude leaked content dm me for signal inbox me privately xxx cam girl 18+ nsfw',
  // Group/channel promotion with phishing style urgency
  'Join our telegram channel now for free money and giveaway bonus reward register now sign up fast limited time',
  // Repeated username spam
  '@cryptoguru123 @cryptoguru123 @cryptoguru123 @cryptoguru123 join vip group premium group',
];

describe('isSpam — benign messages', () => {
  for (const text of HAM_SAMPLES) {
    test(`classifies as ham: "${text.slice(0, 40)}..."`, async () => {
      const { userId, chatId } = freshIds();
      const result = await isSpam(text, userId, chatId, 'realuser', null, true);
      assert.equal(result.isSpam, false, `expected ham, got score=${result.score} reasons=${result.reasons.join('; ')}`);
      assert.ok(result.score < 6, `expected score < 6, got ${result.score}`);
    });
  }
});

describe('isSpam — obvious spam messages', () => {
  for (const text of SPAM_SAMPLES) {
    test(`classifies as spam: "${text.slice(0, 40)}..."`, async () => {
      const { userId, chatId } = freshIds();
      const result = await isSpam(text, userId, chatId, 'spammer', null, true);
      assert.equal(result.isSpam, true, `expected spam, got score=${result.score} reasons=${result.reasons.join('; ')}`);
      assert.ok(result.score >= 6, `expected score >= 6, got ${result.score}`);
    });
  }
});

describe('isSpam — return shape', () => {
  test('returns { isSpam, score, reasons } for a spam message', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam(SPAM_SAMPLES[0], userId, chatId, 'spammer', null, true);
    assert.equal(typeof result.isSpam, 'boolean');
    assert.equal(typeof result.score, 'number');
    assert.ok(Array.isArray(result.reasons));
    assert.ok(result.reasons.length > 0);
  });

  test('returns { isSpam: false, score: 0, reasons: [] } for a single empty-text (captionless media) message', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam('', userId, chatId, 'user', null, true);
    assert.deepEqual(result, { isSpam: false, score: 0, reasons: [] });
  });

  // Regression for H6: captionless media (empty text) must still run flood/burst
  // detection so a sticker/photo flood is caught.
  test('captionless media flood is detected (behavior analysis runs on empty text)', async () => {
    const { userId, chatId } = freshIds();
    let result;
    for (let i = 0; i < 6; i++) {
      result = await isSpam('', userId, chatId, 'user', null, true);
    }
    assert.equal(result.isSpam, true, `expected media flood to be flagged, got score=${result.score}`);
    assert.ok(result.reasons.some(r => r.includes('Flooding')), 'expected a Flooding reason');
  });
});

describe('isSpam — specific scoring behaviors', () => {
  test('excessive caps alone contributes but does not necessarily cross threshold', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam('THIS IS A COMPLETELY NORMAL SENTENCE IN CAPS', userId, chatId, 'user', null, true);
    assert.ok(result.reasons.some(r => r.includes('Excessive capitals')));
  });

  test('no username + URL adds suspicion (hasUsername=false)', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam('check this out https://example.com', userId, chatId, null, null, false);
    assert.ok(result.reasons.some(r => r.includes('No username + URL')));
  });

  test('multiple price levels pattern triggers on 3+ numeric price-like tokens', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam('levels 1985 1990 2010 2015', userId, chatId, 'user', null, true);
    assert.ok(result.reasons.some(r => r.includes('Multiple price levels')));
  });

  test('repeated identical @mention triggers username spam scoring', async () => {
    const { userId, chatId } = freshIds();
    const result = await isSpam('@spamuser @spamuser @spamuser @spamuser', userId, chatId, 'user', null, true);
    assert.ok(result.reasons.some(r => r.startsWith('Username spamming')));
    assert.equal(result.isSpam, true);
  });

  test('hidden text_link to a suspicious TLD scores via entity-based detection', async () => {
    const { userId, chatId } = freshIds();
    const message = {
      text: 'Click here for a special offer',
      entities: [
        { type: 'text_link', offset: 0, length: 10, url: 'https://free-money-now.xyz/claim' }
      ]
    };
    const result = await isSpam(message.text, userId, chatId, 'user', message, true);
    assert.ok(result.reasons.some(r => r.includes('hidden link')));
    assert.ok(result.reasons.some(r => r.includes('Suspicious hidden URL')));
  });

  test('trusted user always returns isSpam=false regardless of content', async () => {
    // lib/state.js isTrusted() checks in-memory trustedUsers Set which we can't
    // populate without KV or exported setter side effects reaching into state;
    // trust bypass is exercised indirectly: trusted key format is `${chatId}_${userId}`.
    // We import state directly to set up the trust flag deterministically.
    const { trustedUsers } = await import('../lib/state.js');
    const { userId, chatId } = freshIds();
    trustedUsers.add(`${chatId}_${userId}`);
    const result = await isSpam(SPAM_SAMPLES[0], userId, chatId, 'trusteduser', null, true);
    assert.deepEqual(result, { isSpam: false, score: 0, reasons: ['Trusted user'] });
    trustedUsers.delete(`${chatId}_${userId}`);
  });
});
