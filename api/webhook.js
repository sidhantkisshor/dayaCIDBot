import TelegramBot from 'node-telegram-bot-api';

// Create bot instance
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Spam patterns
const SPAM_PATTERNS = [
  // Crypto scams
  /\b(free\s+crypto|airdrop|100x\s+guaranteed|pump\s+signal|get\s+rich\s+quick)/i,
  /\b(bitcoin\s+doubler|ethereum\s+giveaway|crypto\s+investment)/i,

  // Links and promotions
  /\b(t\.me\/joinchat|wa\.me|bit\.ly|tinyurl|click\s+here\s+now)/i,
  /\b(join\s+my\s+channel|check\s+out|promo\s+code|discount\s+offer)/i,

  // Trading scams
  /\b(guaranteed\s+profit|forex\s+signal|binary\s+option|trading\s+bot\s+free)/i,
  /\b(make\s+\$?\d+\s+daily|earn\s+from\s+home|passive\s+income)/i,

  // Adult content
  /\b(onlyfans|adult\s+content|18\+|nsfw|xxx|porn)/i,

  // Phishing
  /\b(verify\s+your\s+account|suspended\s+account|click\s+to\s+verify)/i,
];

// Check if message is spam
function isSpam(text) {
  if (!text) return false;

  let score = 0;

  // Check patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      score += 3;
    }
  }

  // Check for excessive caps
  if (text.length > 10) {
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7) score += 2;
  }

  // Check for excessive emojis
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 5) score += 2;

  // Check for suspicious links
  const linkCount = (text.match(/https?:\/\//gi) || []).length;
  if (linkCount > 2) score += 2;

  return score >= 5;
}

// Main webhook handler
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const { message, edited_message } = req.body;
    const msg = message || edited_message;

    if (!msg) {
      return res.status(200).json({ ok: true });
    }

    const { chat, from, text, new_chat_members } = msg;

    // Handle new members
    if (new_chat_members && new_chat_members.length > 0) {
      for (const member of new_chat_members) {
        if (member.is_bot) continue;

        // Restrict new members initially
        try {
          await bot.restrictChatMember(chat.id, member.id, {
            can_send_messages: false,
            until_date: Math.floor(Date.now() / 1000) + 60 // 1 minute
          });

          await bot.sendMessage(
            chat.id,
            `👋 Welcome ${member.first_name}! Please wait 1 minute before sending messages.`
          );
        } catch (err) {
          console.error('Failed to restrict new member:', err);
        }
      }
      return res.status(200).json({ ok: true });
    }

    // Handle commands
    if (text && text.startsWith('/')) {
      const [command] = text.split(' ');

      switch (command) {
        case '/start':
        case '/help':
          await bot.sendMessage(
            chat.id,
            `🛡️ DayaCID Bot - Spam Blocker\n\n` +
            `I automatically detect and ban spammers.\n\n` +
            `Admin commands:\n` +
            `/ban - Ban user (reply to message)\n` +
            `/stats - View statistics`
          );
          break;

        case '/ban':
          // Check if user is admin
          try {
            const member = await bot.getChatMember(chat.id, from.id);
            if (member.status === 'administrator' || member.status === 'creator') {
              if (msg.reply_to_message) {
                const targetUser = msg.reply_to_message.from;
                await bot.banChatMember(chat.id, targetUser.id);
                await bot.sendMessage(chat.id, `🚫 Banned ${targetUser.first_name}`);
              } else {
                await bot.sendMessage(chat.id, 'Reply to a message to ban user');
              }
            }
          } catch (err) {
            console.error('Ban command error:', err);
          }
          break;

        case '/stats':
          await bot.sendMessage(
            chat.id,
            `📊 Bot Statistics\n\n` +
            `Status: ✅ Active\n` +
            `Spam Detection: Enabled\n` +
            `Auto-ban: Enabled`
          );
          break;
      }

      return res.status(200).json({ ok: true });
    }

    // Check for spam
    if (text && from && !from.is_bot) {
      // Skip admins
      try {
        const member = await bot.getChatMember(chat.id, from.id);
        if (member.status === 'administrator' || member.status === 'creator') {
          return res.status(200).json({ ok: true });
        }
      } catch (err) {
        // Continue checking if can't get member status
      }

      if (isSpam(text)) {
        console.log(`Spam detected from ${from.id}: ${text.substring(0, 50)}`);

        try {
          // Delete the spam message
          await bot.deleteMessage(chat.id, msg.message_id);

          // Ban the spammer
          await bot.banChatMember(chat.id, from.id);

          // Notify the group
          await bot.sendMessage(
            chat.id,
            `🚫 Banned ${from.first_name || 'user'} for sending spam.`
          );
        } catch (err) {
          console.error('Failed to ban spammer:', err);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}