// DayaCID Bot — Telegram API Helpers

import { TOKEN, AUTO_DELETE_DELAY_MS, ADMIN_CHANNEL_ID } from './config.js';
import { appendActivity, scheduleAutoDelete } from './state.js';

const API_BASE = `https://api.telegram.org/bot${TOKEN}`;

async function callTelegram(method, body) {
  try {
    const response = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await response.json();
  } catch (error) {
    console.error(`Telegram API error (${method}):`, error);
    return null;
  }
}

// Send message with optional auto-delete and forum topic support
export async function sendMessage(chatId, text, autoDelete = false, threadId = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  if (threadId) body.message_thread_id = threadId;

  const result = await callTelegram('sendMessage', body);

  if (autoDelete && result?.ok && result.result.message_id) {
    // Schedule for lazy deletion on next webhook call (setTimeout doesn't survive Vercel's 10s timeout)
    scheduleAutoDelete(chatId, result.result.message_id);
  }

  return result;
}

// Send message with inline keyboard (for captcha buttons)
export async function sendMessageWithKeyboard(chatId, text, keyboard, threadId = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: keyboard
  };
  if (threadId) body.message_thread_id = threadId;

  return await callTelegram('sendMessage', body);
}

// Delete a single message
export async function deleteMessage(chatId, messageId) {
  return await callTelegram('deleteMessage', {
    chat_id: chatId,
    message_id: messageId
  });
}

// Bulk delete up to 100 messages
export async function deleteMessages(chatId, messageIds) {
  if (!messageIds || messageIds.length === 0) return null;
  // API supports max 100 per call
  const batch = messageIds.slice(0, 100);
  return await callTelegram('deleteMessages', {
    chat_id: chatId,
    message_ids: batch
  });
}

// Ban user and revoke their messages from the last 48 hours
export async function banUser(chatId, userId) {
  return await callTelegram('banChatMember', {
    chat_id: chatId,
    user_id: userId,
    revoke_messages: true
  });
}

// Unban user (allows them to rejoin)
export async function unbanUser(chatId, userId) {
  return await callTelegram('unbanChatMember', {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: true
  });
}

// Restrict user permissions (mute)
export async function restrictUser(chatId, userId, permissions, untilDate = 0) {
  return await callTelegram('restrictChatMember', {
    chat_id: chatId,
    user_id: userId,
    permissions: {
      can_send_messages: permissions.canSend ?? false,
      can_send_audios: permissions.canMedia ?? false,
      can_send_documents: permissions.canMedia ?? false,
      can_send_photos: permissions.canMedia ?? false,
      can_send_videos: permissions.canMedia ?? false,
      can_send_video_notes: permissions.canMedia ?? false,
      can_send_voice_notes: permissions.canMedia ?? false,
      can_send_polls: false,
      can_send_other_messages: permissions.canOther ?? false,
      can_add_web_page_previews: permissions.canPreview ?? false,
      can_change_info: false,
      can_invite_users: permissions.canInvite ?? false,
      can_pin_messages: false,
      can_manage_topics: false,
    },
    use_independent_chat_permissions: true,
    until_date: untilDate || undefined
  });
}

// Unmute user — restore all standard permissions
export async function unrestrictUser(chatId, userId) {
  return await restrictUser(chatId, userId, {
    canSend: true,
    canMedia: true,
    canOther: true,
    canPreview: true,
    canInvite: true,
  });
}

// Check if user is admin or creator
export async function isAdmin(chatId, userId) {
  const result = await callTelegram('getChatMember', {
    chat_id: chatId,
    user_id: userId
  });
  if (result?.ok) {
    return ['administrator', 'creator'].includes(result.result.status);
  }
  return false;
}

// Get bot's own chat member info (for permission self-check)
export async function getBotMember(chatId) {
  const meResult = await callTelegram('getMe', {});
  if (!meResult?.ok) return null;
  const botId = meResult.result.id;
  const result = await callTelegram('getChatMember', {
    chat_id: chatId,
    user_id: botId
  });
  return result?.ok ? result.result : null;
}

// Answer callback query (dismiss button loading indicator)
export async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return await callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert
  });
}

// Set webhook with allowed_updates
export async function setWebhook(url, allowedUpdates) {
  return await callTelegram('setWebhook', {
    url: url,
    allowed_updates: allowedUpdates
  });
}

// Get current webhook info
export async function getWebhookInfo() {
  try {
    const response = await fetch(`${API_BASE}/getWebhookInfo`);
    return await response.json();
  } catch (error) {
    console.error('getWebhookInfo error:', error);
    return null;
  }
}

// Get bot info
export async function getMe() {
  try {
    const response = await fetch(`${API_BASE}/getMe`);
    return await response.json();
  } catch (error) {
    console.error('getMe error:', error);
    return null;
  }
}

// Log action to admin channel (fire-and-forget)
export function logToAdmin(action, chatId, userId, username, details) {
  // Write to KV activity log (fire-and-forget)
  appendActivity({ action, chatId, userId, username, details }).catch(() => {});

  if (!ADMIN_CHANNEL_ID) return;
  const text =
    `<b>[${action}]</b>\n` +
    `User: ${username} (<code>${userId}</code>)\n` +
    `Chat: <code>${chatId}</code>\n` +
    `${details}`;
  sendMessage(ADMIN_CHANNEL_ID, text, false).catch(() => {});
}
