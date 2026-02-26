// DayaCID Bot — New Member Captcha Verification

import {
  sendMessageWithKeyboard, deleteMessage, banUser,
  restrictUser, unrestrictUser, answerCallbackQuery, logToAdmin
} from './telegram.js';
import { pendingVerifications, incrementStat } from './state.js';
import { checkCAS } from './cas.js';
import { CAPTCHA_TIMEOUT_MS, CAPTCHA_OPTIONS_COUNT } from './config.js';

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

  // Only handle new joins (status changed to 'member')
  const oldStatus = old_chat_member?.status;
  const newStatus = new_chat_member?.status;

  if (!['left', 'kicked', 'restricted'].includes(oldStatus) || newStatus !== 'member') {
    return res.status(200).json({ ok: true });
  }

  const chatId = chat.id;
  const user = new_chat_member.user;
  const userId = user.id;
  const firstName = user.first_name || 'User';

  // Skip bots
  if (user.is_bot) {
    return res.status(200).json({ ok: true });
  }

  console.log(`New member: ${firstName} (${userId}) in chat ${chatId}`);

  // Check CAS blacklist first
  const isCASBanned = await checkCAS(userId);
  if (isCASBanned) {
    console.log(`CAS banned user detected: ${firstName} (${userId})`);
    await banUser(chatId, userId);
    logToAdmin('CAS BAN', chatId, userId, firstName, 'User is CAS-banned (known spammer)');
    await incrementStat(chatId, 'banned');
    return res.status(200).json({ ok: true });
  }

  // Mute the new member immediately
  await restrictUser(chatId, userId, { canSend: false });

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
    `👋 Welcome <b>${firstName}</b>!\n\n` +
    `🔒 Please verify you're human.\n` +
    `What is <b>${a} + ${b}</b>?\n\n` +
    `<i>You have 2 minutes to answer.</i>`,
    keyboard
  );

  if (msg?.ok) {
    pendingVerifications.set(`${chatId}_${userId}`, {
      messageId: msg.result.message_id,
      answer: correctAnswer,
      joinedAt: Date.now(),
      firstName
    });
  }

  return res.status(200).json({ ok: true });
}

// Handle new_chat_members service message (fallback for groups without chat_member updates)
export async function handleNewChatMembers(message) {
  const chatId = message.chat.id;
  const members = message.new_chat_members || [];

  for (const user of members) {
    if (user.is_bot) continue;

    const userId = user.id;
    const firstName = user.first_name || 'User';

    console.log(`New member (service msg): ${firstName} (${userId}) in chat ${chatId}`);

    // Check CAS blacklist
    const isCASBanned = await checkCAS(userId);
    if (isCASBanned) {
      console.log(`CAS banned user: ${firstName} (${userId})`);
      await banUser(chatId, userId);
      logToAdmin('CAS BAN', chatId, userId, firstName, 'User is CAS-banned (known spammer)');
      await incrementStat(chatId, 'banned');
      continue;
    }

    // Mute immediately
    await restrictUser(chatId, userId, { canSend: false });

    // Generate captcha
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
      `👋 Welcome <b>${firstName}</b>!\n\n` +
      `🔒 Please verify you're human.\n` +
      `What is <b>${a} + ${b}</b>?\n\n` +
      `<i>You have 2 minutes to answer.</i>`,
      keyboard
    );

    if (msg?.ok) {
      pendingVerifications.set(`${chatId}_${userId}`, {
        messageId: msg.result.message_id,
        answer: correctAnswer,
        joinedAt: Date.now(),
        firstName
      });
    }
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
    await answerCallbackQuery(id, 'Verification expired. Please leave and rejoin.');
    return res.status(200).json({ ok: true });
  }

  if (Number(answerStr) === pending.answer) {
    // Correct answer — unmute and welcome
    await unrestrictUser(chatId, targetUserId);
    await deleteMessage(chatId, pending.messageId);
    await answerCallbackQuery(id, '✅ Verified! Welcome to the group!');
    pendingVerifications.delete(key);
    await incrementStat(chatId, 'captchaPassed');
    console.log(`Captcha passed: ${from.first_name} (${targetUserId})`);
  } else {
    // Wrong answer — ban
    await deleteMessage(chatId, pending.messageId);
    await banUser(chatId, targetUserId);
    await answerCallbackQuery(id, '❌ Wrong answer. You have been banned.');
    pendingVerifications.delete(key);
    await incrementStat(chatId, 'captchaFailed');
    await incrementStat(chatId, 'banned');
    logToAdmin('CAPTCHA FAIL', chatId, targetUserId, pending.firstName,
      `Wrong captcha answer (answered: ${answerStr}, correct: ${pending.answer})`);
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
