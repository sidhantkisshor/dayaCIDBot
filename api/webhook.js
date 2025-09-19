// Simple webhook without library - just direct API calls
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7660494644:AAE1U_K5IXqGoQQ2NbrqXJkQaonRm9z2KpU';

// Send message using Telegram API
async function sendMessage(chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    console.log('Send message result:', result);
    return result;
  } catch (error) {
    console.error('Failed to send message:', error);
    return null;
  }
}

// Delete message
async function deleteMessage(chatId, messageId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to delete message:', error);
    return null;
  }
}

// Ban user
async function banUser(chatId, userId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/banChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to ban user:', error);
    return null;
  }
}

// Check if user is admin
async function isAdmin(chatId, userId) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId
      })
    });
    const result = await response.json();
    if (result.ok) {
      return ['administrator', 'creator'].includes(result.result.status);
    }
    return false;
  } catch (error) {
    console.error('Failed to check admin:', error);
    return false;
  }
}

// Spam patterns
const SPAM_PATTERNS = [
  /\b(free\s+crypto|airdrop|100x\s+guaranteed|pump\s+signal)/i,
  /\b(bitcoin\s+doubler|ethereum\s+giveaway|crypto\s+investment)/i,
  /\b(t\.me\/joinchat|wa\.me|bit\.ly|tinyurl)/i,
  /\b(guaranteed\s+profit|forex\s+signal|binary\s+option)/i,
  /\b(make\s+\$?\d+\s+daily|earn\s+from\s+home)/i,
  /\b(onlyfans|adult\s+content|18\+|nsfw|xxx|porn)/i,
  /\b(verify\s+your\s+account|suspended\s+account)/i,
];

// Check if message is spam
function isSpam(text) {
  if (!text) return false;

  let score = 0;

  // Check patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      score += 3;
      console.log('Pattern matched:', pattern);
    }
  }

  // Check excessive caps
  if (text.length > 10) {
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7) {
      score += 2;
      console.log('Excessive caps detected');
    }
  }

  // Check excessive emojis
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 5) {
    score += 2;
    console.log('Excessive emojis detected');
  }

  console.log('Spam score:', score);
  return score >= 5;
}

// Main webhook handler
export default async function handler(req, res) {
  console.log('=== Webhook Request ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));

  // Only process POST requests
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;

    // Handle different update types
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text;
      const username = message.from.username || message.from.first_name || 'User';

      console.log(`Message from ${username} (${userId}) in chat ${chatId}: ${text}`);

      // Handle commands
      if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].toLowerCase();

        switch (command) {
          case '/start':
          case '/help':
            await sendMessage(chatId,
              '🛡️ <b>DayaCID Bot - Spam Blocker</b>\n\n' +
              'I automatically detect and ban spammers.\n\n' +
              'Commands:\n' +
              '/help - Show this message\n' +
              '/ban - Ban user (admin only, reply to message)\n' +
              '/test - Test if bot is working'
            );
            break;

          case '/test':
            await sendMessage(chatId, '✅ Bot is working!');
            break;

          case '/ban':
            if (await isAdmin(chatId, userId)) {
              if (message.reply_to_message) {
                const targetUser = message.reply_to_message.from;
                const banResult = await banUser(chatId, targetUser.id);
                if (banResult && banResult.ok) {
                  await sendMessage(chatId, `🚫 Banned ${targetUser.first_name || 'user'}`);
                } else {
                  await sendMessage(chatId, '❌ Failed to ban user');
                }
              } else {
                await sendMessage(chatId, 'Reply to a message to ban the user');
              }
            } else {
              await sendMessage(chatId, '❌ Admin only command');
            }
            break;
        }

        return res.status(200).json({ ok: true });
      }

      // Skip bot messages and admin messages
      if (message.from.is_bot) {
        return res.status(200).json({ ok: true });
      }

      if (await isAdmin(chatId, userId)) {
        return res.status(200).json({ ok: true });
      }

      // Check for spam
      if (text && isSpam(text)) {
        console.log(`SPAM DETECTED from ${username}`);

        // Delete message
        const deleteResult = await deleteMessage(chatId, message.message_id);
        console.log('Delete result:', deleteResult);

        // Ban user
        const banResult = await banUser(chatId, userId);
        console.log('Ban result:', banResult);

        // Notify
        if (banResult && banResult.ok) {
          await sendMessage(chatId, `🚫 Banned ${username} for spam`);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true, error: error.message });
  }
}