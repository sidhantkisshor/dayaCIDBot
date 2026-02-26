// DayaCID Bot — Webhook Handler (Thin Router)
// All logic lives in lib/ modules. This file routes Telegram updates.

import { sendMessage, deleteMessage, banUser, restrictUser, isAdmin, logToAdmin } from '../lib/telegram.js';
import { isSpam } from '../lib/spam.js';
import { handleCommand } from '../lib/commands.js';
import { handleChatMember, handleCallbackQuery, handleNewChatMembers, cleanupExpiredVerifications } from '../lib/captcha.js';
import { checkCAS } from '../lib/cas.js';
import { getWarnings, setWarnings, deleteWarnings, incrementStat, isTrusted, addReport, getReportCount, clearReports, registerActiveChat } from '../lib/state.js';
import {
  SPAM_THRESHOLD, INSTANT_BAN_THRESHOLD,
  USER_REPORT_ACTION_THRESHOLD, USER_REPORT_BAN_THRESHOLD, USER_REPORT_BONUS,
  MUTE_DURATION_1ST, MUTE_DURATION_2ND, MAX_WARNINGS_BEFORE_BAN,
  REPORTS_FOR_AUTO_ACTION
} from '../lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;

    // Lazy cleanup: expire captcha verifications on every request
    await cleanupExpiredVerifications();

    // ── Route by update type ──

    // 1. Chat member updates (new joins/leaves)
    if (update.chat_member) {
      return handleChatMember(update.chat_member, res);
    }

    // 2. Callback queries (captcha button presses)
    if (update.callback_query) {
      return handleCallbackQuery(update.callback_query, res);
    }

    // 3. Messages
    if (update.message) {
      return handleMessage(update.message, res);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}

// ── Message Handler ──

async function handleMessage(message, res) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || message.caption || '';
  const username = message.from.username || message.from.first_name || 'User';
  const hasUsername = !!message.from.username;
  const threadId = message.message_thread_id || null;
  const isForwarded = message.forward_origin || message.forward_from || message.forward_from_chat || message.forward_date;

  // Register this chat for dashboard tracking
  registerActiveChat(chatId, message.chat.title).catch(() => {});

  // ── Handle new_chat_members service message (fallback) ──
  if (message.new_chat_members && message.new_chat_members.length > 0) {
    await handleNewChatMembers(message);
    // Don't return — continue processing in case the join message has other content
  }

  // ── User report check (bot mentioned in a reply) ──
  if (text && text.toLowerCase().includes('@dayacidbot')) {
    if (message.reply_to_message) {
      await handleUserReport(message, res);
      return;
    }
  }

  // ── Command handling ──
  if (text && text.startsWith('/')) {
    const handled = await handleCommand(message);
    if (handled) return res.status(200).json({ ok: true });
  }

  // ── Skip bots ──
  if (message.from.is_bot) {
    return res.status(200).json({ ok: true });
  }

  // ── Skip channel posts ──
  if (message.sender_chat) {
    return res.status(200).json({ ok: true });
  }

  // ── Skip admins ──
  if (await isAdmin(chatId, userId)) {
    return res.status(200).json({ ok: true });
  }

  // ── Forwarded message handling ──
  if (isForwarded) {
    const forwardFromChat = message.forward_from_chat || message.forward_origin?.chat;

    // Forwarded from a channel/group → delete + ban
    if (forwardFromChat) {
      console.log(`Forward from channel/group by ${username}: ${forwardFromChat.title || forwardFromChat.id}`);
      await deleteMessage(chatId, message.message_id);
      const banResult = await banUser(chatId, userId);
      if (banResult?.ok) {
        await sendMessage(chatId,
          `🚫 <b>Tod diya isko! ${username}</b>\n` +
          `<i>Forwarding from channels/groups is not allowed</i>`,
          true, threadId
        );
        logToAdmin('FORWARD BAN', chatId, userId, username,
          `Forwarded from: ${forwardFromChat.title || forwardFromChat.id}`);
        await incrementStat(chatId, 'banned');
      }
      return res.status(200).json({ ok: true });
    }

    // Forwarded from another user → delete + graduated enforcement
    if (message.forward_from || message.forward_date || message.forward_origin) {
      console.log(`Forwarded message from user by ${username}`);
      await deleteMessage(chatId, message.message_id);
      await incrementStat(chatId, 'deleted');

      const warnings = (await getWarnings(chatId, userId)) + 1;
      await setWarnings(chatId, userId, warnings);

      if (warnings >= 2) {
        const banResult = await banUser(chatId, userId);
        if (banResult?.ok) {
          await sendMessage(chatId,
            `🚫 <b>Tod diya isko! ${username}</b>\n` +
            `<i>Repeated forwarding violations</i>`,
            true, threadId
          );
          logToAdmin('FORWARD BAN', chatId, userId, username, 'Repeated forwarding');
          await incrementStat(chatId, 'banned');
        }
        await deleteWarnings(chatId, userId);
      } else {
        await sendMessage(chatId,
          `⚠️ <b>${username}</b> - Forwarding messages is not allowed! Last warning.`,
          true, threadId
        );
        await incrementStat(chatId, 'warned');
      }
      return res.status(200).json({ ok: true });
    }
  }

  // ── Spam detection ──
  const spamCheck = await isSpam(text, userId, chatId, username, message, hasUsername);

  if (spamCheck.isSpam) {
    console.log(`SPAM DETECTED from ${username}: Score=${spamCheck.score}, Reasons=${spamCheck.reasons.join(', ')}`);
    await deleteMessage(chatId, message.message_id);
    await incrementStat(chatId, 'deleted');
    await enforceSpam(chatId, userId, username, spamCheck.score, threadId);
    return res.status(200).json({ ok: true });
  }

  // ── Media caption spam check (only if caption wasn't already checked as text) ──
  if ((message.photo || message.video || message.document) && message.caption && message.text) {
    // message.text was checked above; now also check the caption separately
    const captionCheck = await isSpam(message.caption, userId, chatId, username, message, hasUsername);
    if (captionCheck.isSpam) {
      console.log(`CAPTION SPAM from ${username}: Score=${captionCheck.score}`);
      await deleteMessage(chatId, message.message_id);
      await incrementStat(chatId, 'deleted');
      await enforceSpam(chatId, userId, username, captionCheck.score, threadId);
    }
  }

  return res.status(200).json({ ok: true });
}

// ── Graduated Enforcement ──

async function enforceSpam(chatId, userId, username, score, threadId) {
  const warnings = (await getWarnings(chatId, userId)) + 1;
  await setWarnings(chatId, userId, warnings);

  // Immediate ban for very high scores or 3rd offense
  if (score >= INSTANT_BAN_THRESHOLD || warnings >= MAX_WARNINGS_BEFORE_BAN) {
    const banResult = await banUser(chatId, userId);
    if (banResult?.ok) {
      await sendMessage(chatId, `🚫 <b>Tod diya isko! ${username}</b>`, true, threadId);
      logToAdmin('SPAM BAN', chatId, userId, username,
        `Score: ${score}, Warnings: ${warnings}`);
      await incrementStat(chatId, 'banned');
    }
    await deleteWarnings(chatId, userId);
    return;
  }

  // 2nd offense → 24-hour mute
  if (warnings === 2) {
    const until = Math.floor(Date.now() / 1000) + MUTE_DURATION_2ND;
    await restrictUser(chatId, userId, { canSend: false }, until);
    await sendMessage(chatId,
      `🔇 <b>${username}</b> muted for 24 hours.\n` +
      `<i>Next offense = permanent ban</i>`,
      true, threadId
    );
    logToAdmin('SPAM MUTE 24H', chatId, userId, username, `Score: ${score}`);
    await incrementStat(chatId, 'muted');
    return;
  }

  // 1st offense → 1-hour mute
  const until = Math.floor(Date.now() / 1000) + MUTE_DURATION_1ST;
  await restrictUser(chatId, userId, { canSend: false }, until);
  await sendMessage(chatId,
    `🔇 <b>${username}</b> muted for 1 hour.\n` +
    `<i>Warning 1/${MAX_WARNINGS_BEFORE_BAN - 1} — repeated violations will result in a ban</i>`,
    true, threadId
  );
  logToAdmin('SPAM MUTE 1H', chatId, userId, username, `Score: ${score}`);
  await incrementStat(chatId, 'muted');
}

// ── User Report Handler ──

async function handleUserReport(message, res) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username || message.from.first_name || 'User';
  const threadId = message.message_thread_id || null;
  const reportedMessage = message.reply_to_message;
  const reportedUserId = reportedMessage.from.id;
  const reportedUsername = reportedMessage.from.username || reportedMessage.from.first_name || 'User';
  const reportedHasUsername = !!reportedMessage.from.username;
  const reportedText = reportedMessage.text || reportedMessage.caption || '';

  console.log(`User ${username} reported ${reportedUsername}: ${reportedText.substring(0, 100)}`);

  // Don't process if reported user is admin or bot
  if (reportedMessage.from.is_bot || await isAdmin(chatId, reportedUserId)) {
    await sendMessage(chatId, `⚠️ Cannot take action on this user`, true, threadId);
    await deleteMessage(chatId, message.message_id);
    return res.status(200).json({ ok: true });
  }

  // Track unique reporters for community-driven moderation
  const reportCount = addReport(chatId, reportedUserId, userId);
  console.log(`Report from ${username} against ${reportedUsername}: ${reportCount}/${REPORTS_FOR_AUTO_ACTION} unique reporters`);

  // AUTO-ACTION: 3 unique reporters → auto-restrict 24h (or ban if restrict fails)
  if (reportCount >= REPORTS_FOR_AUTO_ACTION) {
    await deleteMessage(chatId, reportedMessage.message_id);
    const until = Math.floor(Date.now() / 1000) + MUTE_DURATION_2ND;
    const restrictResult = await restrictUser(chatId, reportedUserId, { canSend: false }, until);
    if (restrictResult?.ok) {
      await sendMessage(chatId,
        `🔇 <b>${reportedUsername}</b> restricted for 24 hours.\n` +
        `<i>Reported by ${reportCount} members</i>`,
        true, threadId
      );
      logToAdmin('REPORT RESTRICT', chatId, reportedUserId, reportedUsername,
        `${reportCount} unique reports, restricted 24h`);
      await incrementStat(chatId, 'muted');
    } else {
      // Fallback to ban if restrict fails
      const banResult = await banUser(chatId, reportedUserId);
      if (banResult?.ok) {
        await sendMessage(chatId,
          `🚫 <b>Tod diya isko! ${reportedUsername}</b>\n` +
          `<i>Reported by ${reportCount} members</i>`,
          true, threadId
        );
        logToAdmin('REPORT BAN', chatId, reportedUserId, reportedUsername,
          `${reportCount} unique reports, ban (restrict failed)`);
        await incrementStat(chatId, 'banned');
      }
    }
    clearReports(chatId, reportedUserId);
    await deleteWarnings(chatId, reportedUserId);
  } else {
    // Analyze the reported message with user report bonus
    const spamCheck = await isSpam(reportedText, reportedUserId, chatId, reportedUsername, reportedMessage, reportedHasUsername);
    spamCheck.score += USER_REPORT_BONUS;
    spamCheck.reasons.push(`User reported (+${USER_REPORT_BONUS})`);

    console.log(`Report score: ${spamCheck.score} for ${reportedUsername}`);

    if (spamCheck.score >= USER_REPORT_BAN_THRESHOLD) {
      // High score with report → immediate ban
      await deleteMessage(chatId, reportedMessage.message_id);
      const banResult = await banUser(chatId, reportedUserId);
      if (banResult?.ok) {
        await sendMessage(chatId,
          `🚫 <b>Tod diya isko! ${reportedUsername}</b>\n` +
          `<i>Reported by ${username}</i>`,
          true, threadId
        );
        logToAdmin('REPORT BAN', chatId, reportedUserId, reportedUsername,
          `Reported by ${username}, Score: ${spamCheck.score}`);
        await incrementStat(chatId, 'banned');
      }
      clearReports(chatId, reportedUserId);
      await deleteWarnings(chatId, reportedUserId);
    } else if (spamCheck.score >= USER_REPORT_ACTION_THRESHOLD) {
      // Moderate score → delete + mute
      await deleteMessage(chatId, reportedMessage.message_id);
      await incrementStat(chatId, 'deleted');

      const warnings = (await getWarnings(chatId, reportedUserId)) + 1;
      await setWarnings(chatId, reportedUserId, warnings);

      if (warnings >= 2) {
        const banResult = await banUser(chatId, reportedUserId);
        if (banResult?.ok) {
          await sendMessage(chatId,
            `🚫 <b>Tod diya isko! ${reportedUsername}</b>\n` +
            `<i>Multiple violations</i>`,
            true, threadId
          );
          logToAdmin('REPORT BAN', chatId, reportedUserId, reportedUsername,
            `Multiple violations, reported by ${username}`);
          await incrementStat(chatId, 'banned');
        }
        clearReports(chatId, reportedUserId);
        await deleteWarnings(chatId, reportedUserId);
      } else {
        const until = Math.floor(Date.now() / 1000) + MUTE_DURATION_1ST;
        await restrictUser(chatId, reportedUserId, { canSend: false }, until);
        await sendMessage(chatId,
          `🔇 <b>${reportedUsername}</b> muted for 1 hour.\n` +
          `<i>Reported by ${username} (${reportCount}/${REPORTS_FOR_AUTO_ACTION} reports)</i>`,
          true, threadId
        );
        logToAdmin('REPORT MUTE', chatId, reportedUserId, reportedUsername,
          `Reported by ${username}, Score: ${spamCheck.score}`);
        await incrementStat(chatId, 'muted');
      }
    } else {
      // Not enough evidence — show report progress
      await sendMessage(chatId,
        `📋 Report noted. Monitoring <b>${reportedUsername}</b> (${reportCount}/${REPORTS_FOR_AUTO_ACTION} reports)`,
        true, threadId
      );
    }
  }

  // Delete the reporting message to keep chat clean
  await deleteMessage(chatId, message.message_id);
  return res.status(200).json({ ok: true });
}
