// DayaCID Bot — New Member Captcha Verification

import {
  sendMessageWithKeyboard, deleteMessage, banUser,
  restrictUser, unrestrictUser, answerCallbackQuery, logToAdmin, escapeHtml
} from './telegram.js';
import { pendingVerifications, incrementStat, addNewMember } from './state.js';
import { checkCAS } from './cas.js';
import { CAPTCHA_TIMEOUT_MS, CAPTCHA_OPTIONS_COUNT } from './config.js';

// Safety-net mute duration. The captcha mute is normally lifted on a correct
// answer (or the user is banned on timeout), but pendingVerifications is
// in-memory, so on a serverless cold start that state can be lost. Bounding the
// mute means a user can never be left muted forever — it auto-expires here.
const CAPTCHA_MUTE_SECONDS = Math.ceil(CAPTCHA_TIMEOUT_MS / 1000) + 180;

// Start the verification flow for one user: CAS check, mute, send captcha,
// register pending state. Deduplicates so the chat_member and new_chat_members
// paths can't both challenge the same joiner.
async function startVerification(chatId, user) {
  const userId = user.id;
  const firstName = user.first_name || 'User';
  const key = `${chatId}_${userId}`;

  if (user.is_bot) return;
  // Already being verified (e.g. both chat_member and new_chat_members fired).
  if (pendingVerifications.has(key)) return;

  // Check CAS blacklist first
  const isCASBanned = await checkCAS(userId);
  if (isCASBanned) {
    console.log(`CAS banned user detected: ${firstName} (${userId})`);
    const banResult = await banUser(chatId, userId);
    if (banResult?.ok) {
      logToAdmin('CAS BAN', chatId, userId, firstName, 'User is CAS-banned (known spammer)');
      await incrementStat(chatId, 'banned');
    } else {
      // Ban failed — fall through to mute+captcha so the user is still gated.
      logToAdmin('CAS BAN FAILED', chatId, userId, firstName, 'CAS-banned but ban call failed; applying captcha');
    }
    if (banResult?.ok) return;
  }

  // Mute the new member (bounded — see CAPTCHA_MUTE_SECONDS).
  const until = Math.floor(Date.now() / 1000) + CAPTCHA_MUTE_SECONDS;
  const muteResult = await restrictUser(chatId, userId, { canSend: false }, until);
  if (!muteResult?.ok) {
    logToAdmin('CAPTCHA MUTE FAILED', chatId, userId, firstName, 'Could not mute new member; captcha not enforced');
  }

  // Generate math challenge
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const correctAnswer = a + b;
  const options = generateOptions(correctAnswer);

  const keyboard = {
    inline_keyboard: [
      options.map(opt => ({
        text: String(opt),
        callback_data: `verify_${userId}_${opt}`
      }))
    ]
  };

  const msg = await sendMessageWithKeyboard(chatId,
    `👋 Welcome <b>${escapeHtml(firstName)}</b>!\n\n` +
    `🔒 Please verify you're human.\n` +
    `What is <b>${a} + ${b}</b>?\n\n` +
    `<i>You have 2 minutes to answer.</i>`,
    keyboard
  );

  if (msg?.ok) {
    pendingVerifications.set(key, {
      messageId: msg.result.message_id,
      answer: correctAnswer,
      joinedAt: Date.now(),
      firstName
    });
  }
}

// Generate answer options (1 correct + N-1 wrong)
function generateOptions(correctAnswer) {
  const options = new Set([correctAnswer]);
  while (options.size < CAPTCHA_OPTIONS_COUNT) {
    // Generate wrong answers within reasonable range of correct answer
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = correctAnswer + offset;
    if (wrong !== correctAnswer && wrong > 0) {
      options.add(wrong);
    }
  }
  // Shuffle
  return [...options].sort(() => Math.random() - 0.5);
}

// Handle new member joining (from chat_member update)
export async function handleChatMember(chatMember, res) {
  const { chat, new_chat_member, old_chat_member } = chatMember;

  const oldStatus = old_chat_member?.status;
  const newStatus = new_chat_member?.status;

  // Only treat left/kicked -> member as a genuine new join. 'restricted' is
  // intentionally excluded: the bot's own unmute (and any spam/forward mute
  // expiry) produces restricted -> member, which previously re-triggered the
  // whole join/captcha flow in a loop against already-verified users.
  if (!['left', 'kicked'].includes(oldStatus) || newStatus !== 'member') {
    return res.status(200).json({ ok: true });
  }

  const user = new_chat_member.user;
  console.log(`New member: ${user.first_name || 'User'} (${user.id}) in chat ${chat.id}`);
  await startVerification(chat.id, user);

  return res.status(200).json({ ok: true });
}

// Handle new_chat_members service message (fallback for groups without chat_member updates)
export async function handleNewChatMembers(message) {
  const chatId = message.chat.id;
  const members = message.new_chat_members || [];

  for (const user of members) {
    console.log(`New member (service msg): ${user.first_name || 'User'} (${user.id}) in chat ${chatId}`);
    await startVerification(chatId, user);
  }
}

// Handle callback query (button press)
export async function handleCallbackQuery(callbackQuery, res) {
  const { id, from, message, data } = callbackQuery;

  if (!data || !data.startsWith('verify_')) {
    return res.status(200).json({ ok: true });
  }

  const parts = data.split('_');
  if (parts.length !== 3) {
    return res.status(200).json({ ok: true });
  }

  const [, targetUserIdStr, answerStr] = parts;
  const targetUserId = Number(targetUserIdStr);
  const chatId = message.chat.id;
  const key = `${chatId}_${targetUserId}`;

  // Only the target user can answer their own captcha
  if (from.id !== targetUserId) {
    await answerCallbackQuery(id, 'This verification is not for you!');
    return res.status(200).json({ ok: true });
  }

  const pending = pendingVerifications.get(key);
  if (!pending) {
    // State was lost (e.g. serverless cold start). Unmute as a safety net so the
    // user isn't stuck muted, rather than telling them to leave and rejoin.
    await unrestrictUser(chatId, targetUserId);
    await answerCallbackQuery(id, '✅ You can now chat.');
    return res.status(200).json({ ok: true });
  }

  if (Number(answerStr) === pending.answer) {
    // Correct answer — unmute and welcome
    await unrestrictUser(chatId, targetUserId);
    await deleteMessage(chatId, pending.messageId);
    await answerCallbackQuery(id, '✅ Verified! Welcome to the group!');
    pendingVerifications.delete(key);
    addNewMember(chatId, targetUserId); // Grace period: reduced spam sensitivity for 30 min
    await incrementStat(chatId, 'captchaPassed');
    console.log(`Captcha passed: ${from.first_name} (${targetUserId})`);
  } else {
    // Wrong answer — ban
    await deleteMessage(chatId, pending.messageId);
    const banResult = await banUser(chatId, targetUserId);
    pendingVerifications.delete(key);
    await incrementStat(chatId, 'captchaFailed');
    if (banResult?.ok) {
      await answerCallbackQuery(id, '❌ Wrong answer. You have been banned.');
      await incrementStat(chatId, 'banned');
      logToAdmin('CAPTCHA FAIL', chatId, targetUserId, pending.firstName,
        `Wrong captcha answer (answered: ${answerStr}, correct: ${pending.answer})`);
    } else {
      await answerCallbackQuery(id, '❌ Wrong answer.');
      logToAdmin('CAPTCHA FAIL BAN FAILED', chatId, targetUserId, pending.firstName,
        'Wrong answer but ban call failed');
    }
    console.log(`Captcha failed: ${from.first_name} (${targetUserId})`);
  }

  return res.status(200).json({ ok: true });
}

// Lazy cleanup: called on every webhook invocation
// Bans users who didn't answer captcha within the timeout
export async function cleanupExpiredVerifications() {
  const now = Date.now();
  const expired = [];

  for (const [key, data] of pendingVerifications) {
    if (now - data.joinedAt > CAPTCHA_TIMEOUT_MS) {
      expired.push({ key, ...data });
    }
  }

  for (const { key, messageId, firstName } of expired) {
    const [chatId, userId] = key.split('_');
    pendingVerifications.delete(key);

    // Delete the captcha message
    await deleteMessage(chatId, messageId);
    // Ban the user who didn't verify
    await banUser(chatId, Number(userId));
    await incrementStat(chatId, 'captchaFailed');
    await incrementStat(chatId, 'banned');
    logToAdmin('CAPTCHA TIMEOUT', chatId, userId, firstName,
      'Did not answer captcha within 2 minutes');
    console.log(`Captcha timeout: ${firstName} (${userId}) in chat ${chatId}`);
  }
}
