// Advanced Anti-Spam Bot with comprehensive detection
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7660494644:AAE1U_K5IXqGoQQ2NbrqXJkQaonRm9z2KpU';

// User tracking for behavior analysis
const userWarnings = new Map();
const userMessageTimes = new Map();
const trustedUsers = new Set();

// Send message using Telegram API with auto-delete option
async function sendMessage(chatId, text, autoDelete = false) {
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

    // Auto-delete bot message after 60 seconds
    if (autoDelete && result.ok && result.result.message_id) {
      setTimeout(async () => {
        try {
          await deleteMessage(chatId, result.result.message_id);
          console.log('Auto-deleted bot message after 60s');
        } catch (err) {
          console.error('Failed to auto-delete message:', err);
        }
      }, 60000); // 60 seconds
    }

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

// Comprehensive spam patterns
const SPAM_PATTERNS = [
  // Crypto & Trading
  /\b(free\s+crypto|airdrop|100x\s+guaranteed|pump\s+signal)/i,
  /\b(bitcoin\s+doubler|ethereum\s+giveaway|crypto\s+investment)/i,
  /\b(gold\s+sell|gold\s+buy|forex\s+signal|binary\s+option)/i,
  /\b(pump\s*spin|pumpspin|claim\s+pump|pump\s+and\s+dump)/i,
  /\b(trading\s+bot|signal\s+bot|profit\s+bot)/i,
  /\b(nft\s+mint|nft\s+drop|free\s+nft)/i,
  /\b(defi|yield\s+farming|liquidity\s+pool)\s+\d+%/i,
  /\b(btc|eth|usdt|bnb)\s+giveaway/i,

  // Forex/Commodity Trading Symbols
  /\b(XAUUSD|XAGUSD|EURUSD|GBPUSD|USDJPY|USDCAD|AUDUSD|NZDUSD)/i,
  /\b(EUR\/USD|GBP\/USD|USD\/JPY|USD\/CAD|AUD\/USD|NZD\/USD)/i,
  /\b(gold|silver|oil|crude)\s+(buy|sell|short|long)/i,
  /\b(buy|sell|short|long)\s+\d{3,5}/i, // Buy/Sell with price levels

  // Financial Scams
  /\b(guaranteed\s+profit|daily\s+income|passive\s+income)/i,
  /\b(make\s+\$?\d+\s+(daily|hourly|weekly))/i,
  /\b(earn\s+from\s+home|work\s+from\s+home\s+\$)/i,
  /\b(loan\s+offer|instant\s+loan|quick\s+loan)/i,
  /\b(credit\s+card\s+hack|free\s+money|cash\s+app\s+flip)/i,
  /\b(investment\s+opportunity|roi\s+guaranteed)/i,

  // Trading Indicators
  /\b(tp|sl|take\s+profit|stop\s+loss)\s+\d+/i,
  /✔️\s*(tp|sl)\s+\d+/i, // TP/SL with checkmarks
  /🚫\s*(stop|sl)\s+\d+/i, // Stop with emoji
  /\b(entry|exit)\s+@?\s*\d+/i,
  /\b(leverage|margin)\s+\d+x/i,
  /\b(bull\s+run|bear\s+market|to\s+the\s+moon)/i,
  /\bnew\s+(buy|sell|long|short)/i, // "New Buy", "New Sell" etc.

  // Group/Channel Promotion
  /\b(vip\s+group|premium\s+group|paid\s+group)/i,
  /\b(join\s+my\s+channel|join\s+our\s+group)/i,
  /\b(telegram\s+channel|whatsapp\s+group)/i,
  /\b(add\s+you\s+for\s+free|send\s+me\s+a\s+message)/i,
  /\b(dm\s+me|message\s+me\s+privately|inbox\s+me)/i,

  // Adult Content
  /\b(onlyfans|adult\s+content|18\+|nsfw)/i,
  /\b(xxx|porn|sex\s+chat|cam\s+girl)/i,
  /\b(hot\s+pics|nude|leaked\s+content)/i,

  // Fake Services
  /\b(hack\s+account|instagram\s+followers|tiktok\s+likes)/i,
  /\b(free\s+followers|buy\s+followers|boost\s+your)/i,
  /\b(netflix\s+account|spotify\s+premium|free\s+subscription)/i,
  /\b(gift\s+card|redeem\s+code|promo\s+code\s+free)/i,

  // Phishing
  /\b(verify\s+your\s+account|suspended\s+account|account\s+blocked)/i,
  /\b(click\s+here\s+immediately|urgent\s+action\s+required)/i,
  /\b(confirm\s+your\s+identity|update\s+payment)/i,

  // Suspicious URLs
  /\b(t\.me\/joinchat|wa\.me|bit\.ly|tinyurl|short\.link)/i,
  /\b(telegram\.me|telegra\.ph\/\w+-\d+)/i,
  /\bhttps?:\/\/[^\s]+\.(fun|club|click|xyz|tk|ml|ga|cf|link)/i,
  /\bt\.me\/[a-zA-Z0-9_]+/i, // Any Telegram group/channel link
  /\bhttps?:\/\/t\.me\/[a-zA-Z0-9_]+/i, // Full Telegram URLs

  // Urgency Tactics
  /\b(hurry\s+up|limited\s+time|act\s+now|don't\s+miss)/i,
  /\b(only\s+\d+\s+spots|last\s+chance|ending\s+soon)/i,
  /\b(register\s+now|sign\s+up\s+fast)/i,

  // Repetitive Characters
  /(.)\1{5,}/i, // Same character repeated 6+ times
  /(\b\w+\b)(\s+\1){3,}/i, // Same word repeated 4+ times

  // Repetitive mentions/usernames
  /(@\w+[\s\n]*){3,}/i, // Multiple @mentions repeated 3+ times
  /(@trading_|@forex_|@signal_|@crypto_|@gold_|@invest_|@profit_)/i, // Suspicious trading usernames
  /(@\w+_master|@\w+_expert|@\w+_guru|@\w+_pro)/i, // Suspicious "expert" usernames

  // Phone Numbers & Contacts
  /\+\d{10,15}/, // International phone numbers
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // US phone format

  // Emoji Spam Patterns
  /💰{3,}|💵{3,}|💸{3,}|🤑{3,}/, // Money emojis repeated
  /🔥{5,}|💯{5,}|🚀{5,}/, // Hype emojis repeated

  // Quote/Copy patterns
  /^(RT|Repost|Via|From)[\s:]/i, // Starts with repost indicators
  /[\[\]]{2,}/, // Multiple brackets (often in quotes)
  /^["'"].*["'"]$/s, // Entire message in quotes
  /^\d+\.\s+.*\n\d+\.\s+/m, // Numbered list format (often copy-paste)
];

// Suspicious keywords that increase spam score
const SUSPICIOUS_KEYWORDS = [
  'profit', 'income', 'earn', 'money', 'cash', 'dollar', 'usd',
  'guarantee', 'certified', 'proven', 'trusted', 'legit',
  'admin', 'ceo', 'founder', 'expert', 'guru',
  'winner', 'selected', 'chosen', 'congratulations',
  'double', 'triple', '10x', '100x', '1000x',
  'free', 'giveaway', 'bonus', 'reward', 'prize',
  'limited', 'exclusive', 'special', 'premium', 'vip',
  'click', 'join', 'register', 'signup', 'subscribe',
  'hack', 'leaked', 'cracked', 'bypass', 'unlimited'
];

// Check user behavior patterns
function analyzeUserBehavior(userId, chatId) {
  const now = Date.now();
  const userKey = `${chatId}_${userId}`;

  // Check message frequency (flood detection)
  if (!userMessageTimes.has(userKey)) {
    userMessageTimes.set(userKey, []);
  }

  const messageTimes = userMessageTimes.get(userKey);
  messageTimes.push(now);

  // Keep only messages from last 60 seconds
  const recentMessages = messageTimes.filter(time => now - time < 60000);
  userMessageTimes.set(userKey, recentMessages);

  // Check for flooding
  if (recentMessages.length > 5) { // More than 5 messages per minute
    return { isFlooding: true, messageCount: recentMessages.length };
  }

  // Check for burst messaging (3+ messages in 5 seconds)
  const burst = messageTimes.filter(time => now - time < 5000);
  if (burst.length >= 3) {
    return { isBursting: true, burstCount: burst.length };
  }

  return { isFlooding: false, isBursting: false };
}

// Advanced spam detection
function isSpam(text, userId, chatId, username) {
  if (!text) return { isSpam: false, score: 0, reasons: [] };

  let score = 0;
  const reasons = [];

  // Skip trusted users
  if (trustedUsers.has(`${chatId}_${userId}`)) {
    return { isSpam: false, score: 0, reasons: ['Trusted user'] };
  }

  // Check behavior patterns
  const behavior = analyzeUserBehavior(userId, chatId);
  if (behavior.isFlooding) {
    score += 5;
    reasons.push(`Flooding: ${behavior.messageCount} msgs/min`);
  }
  if (behavior.isBursting) {
    score += 3;
    reasons.push(`Burst messaging: ${behavior.burstCount} msgs/5s`);
  }

  // Check spam patterns
  let patternMatches = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      score += 3;
      patternMatches++;
      reasons.push(`Pattern: ${pattern.source.substring(0, 30)}...`);
    }
  }

  // Multiple pattern matches indicate higher spam probability
  if (patternMatches >= 3) {
    score += 5;
    reasons.push('Multiple spam patterns detected');
  }

  // Check suspicious keywords
  const lowerText = text.toLowerCase();
  let keywordCount = 0;
  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      keywordCount++;
    }
  }
  if (keywordCount >= 3) {
    score += 2;
    reasons.push(`${keywordCount} suspicious keywords`);
  }
  if (keywordCount >= 5) {
    score += 3;
    reasons.push('High concentration of spam keywords');
  }

  // Check for trading signal patterns with multiple price levels
  const priceMatches = text.match(/\d{3,5}/g) || [];
  if (priceMatches.length >= 3) {
    // Multiple price levels (likely TP/SL levels)
    score += 4;
    reasons.push(`Multiple price levels: ${priceMatches.length}`);
  }

  // Check for trading emojis combined with numbers
  if (/[✔️📊🚫💹📈📉]\s*\d{3,5}/i.test(text) || /\d{3,5}\s*[✔️📊🚫💹📈📉]/i.test(text)) {
    score += 3;
    reasons.push('Trading emojis with prices');
  }

  // Check excessive caps (more than 70% capitals)
  if (text.length > 10) {
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7) {
      score += 2;
      reasons.push('Excessive capitals');
    }
  }

  // Check excessive emojis
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 5) {
    score += 1;
    reasons.push(`${emojiCount} emojis`);
  }
  if (emojiCount > 10) {
    score += 2;
    reasons.push('Excessive emoji usage');
  }

  // Check for multiple URLs
  const urlCount = (text.match(/https?:\/\/[^\s]+/gi) || []).length;
  if (urlCount > 2) {
    score += 2;
    reasons.push(`${urlCount} URLs detected`);
  }

  // Check message length (very short messages with URLs are suspicious)
  if (text.length < 50 && urlCount > 0) {
    score += 2;
    reasons.push('Short message with URL');
  }

  // Check for copy-pasted long articles/quotes (suspiciously long messages)
  if (text.length > 1000) {
    score += 2;
    reasons.push('Very long message (possible copy-paste)');

    // Extra penalty if it looks like financial/trading content
    const financeWordCount = ['market', 'finance', 'investment', 'capital', 'equity', 'trading', 'portfolio', 'leverage']
      .filter(word => text.toLowerCase().includes(word)).length;
    if (financeWordCount >= 3) {
      score += 3;
      reasons.push('Long financial article');
    }
  }

  // New user posting URLs immediately
  if (!username && urlCount > 0) {
    score += 3;
    reasons.push('No username + URL');
  }

  // Check for number sequences (phone numbers, codes)
  const numberSequences = text.match(/\d{6,}/g) || [];
  if (numberSequences.length > 0) {
    score += 1;
    reasons.push('Long number sequences');
  }

  // Check for repeated exclamation marks or question marks
  if (/[!?]{3,}/.test(text)) {
    score += 1;
    reasons.push('Excessive punctuation');
  }

  // Forward detection (messages that start with "Forwarded from")
  if (text.includes('Forwarded from')) {
    score += 1;
    reasons.push('Forwarded message');
  }

  // Check for repeated username mentions (exact same username multiple times)
  const mentionMatches = text.match(/@\w+/g) || [];
  if (mentionMatches.length >= 3) {
    const uniqueMentions = new Set(mentionMatches);
    if (uniqueMentions.size === 1) {
      // Same username repeated multiple times
      score += 5;
      reasons.push(`Username spamming: ${mentionMatches[0]} x${mentionMatches.length}`);
    } else if (mentionMatches.length >= 5) {
      // Multiple different mentions (still spam)
      score += 3;
      reasons.push(`Excessive mentions: ${mentionMatches.length}`);
    }
  }

  // Check if message is ONLY username mentions (no other content)
  const textWithoutMentions = text.replace(/@\w+/g, '').trim();
  if (mentionMatches.length > 0 && textWithoutMentions.length < 5) {
    score += 3;
    reasons.push('Message contains only mentions');
  }

  console.log(`Spam analysis for ${username || 'Unknown'}: Score=${score}, Reasons=${reasons.join(', ')}`);

  return {
    isSpam: score >= 5,
    score: score,
    reasons: reasons
  };
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
      const text = message.text || message.caption || '';
      const username = message.from.username || message.from.first_name || 'User';
      const userKey = `${chatId}_${userId}`;
      const isForwarded = message.forward_from || message.forward_from_chat || message.forward_date;

      console.log(`Message from ${username} (${userId}) in chat ${chatId}: ${text}`);
      if (isForwarded) {
        console.log('Message is forwarded');
      }

      // Handle commands
      if (text && text.startsWith('/')) {
        const [command, ...args] = text.split(' ');
        const lowerCommand = command.toLowerCase();

        switch (lowerCommand) {
          case '/start':
          case '/help':
            await sendMessage(chatId,
              '🛡️ <b>Advanced Anti-Spam Bot</b>\n\n' +
              'I automatically detect and remove spam with:\n' +
              '• Pattern matching\n' +
              '• Behavior analysis\n' +
              '• Keyword detection\n' +
              '• Flood protection\n\n' +
              'Commands:\n' +
              '/help - Show this message\n' +
              '/ban @user - Ban user (admin only)\n' +
              '/trust @user - Trust user (admin only)\n' +
              '/untrust @user - Remove trust (admin only)\n' +
              '/stats - Show spam statistics\n' +
              '/test - Test bot status'
            );
            break;

          case '/test':
            await sendMessage(chatId, '✅ Bot is working and protecting your chat!');
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
              } else if (args[0]) {
                await sendMessage(chatId, 'Please reply to a message from the user you want to ban');
              } else {
                await sendMessage(chatId, 'Usage: /ban @username or reply to a message');
              }
            } else {
              await sendMessage(chatId, '❌ Admin only command');
            }
            break;

          case '/trust':
            if (await isAdmin(chatId, userId)) {
              if (message.reply_to_message) {
                const targetUser = message.reply_to_message.from;
                const targetKey = `${chatId}_${targetUser.id}`;
                trustedUsers.add(targetKey);
                await sendMessage(chatId, `✅ ${targetUser.first_name || 'User'} is now trusted`);
              } else {
                await sendMessage(chatId, 'Reply to a message from the user you want to trust');
              }
            } else {
              await sendMessage(chatId, '❌ Admin only command');
            }
            break;

          case '/untrust':
            if (await isAdmin(chatId, userId)) {
              if (message.reply_to_message) {
                const targetUser = message.reply_to_message.from;
                const targetKey = `${chatId}_${targetUser.id}`;
                trustedUsers.delete(targetKey);
                await sendMessage(chatId, `⚠️ ${targetUser.first_name || 'User'} is no longer trusted`);
              } else {
                await sendMessage(chatId, 'Reply to a message from the user you want to untrust');
              }
            } else {
              await sendMessage(chatId, '❌ Admin only command');
            }
            break;

          case '/stats':
            const warningCount = userWarnings.size;
            const trustedCount = trustedUsers.size;
            await sendMessage(chatId,
              `📊 <b>Bot Statistics</b>\n\n` +
              `⚠️ Users with warnings: ${warningCount}\n` +
              `✅ Trusted users: ${trustedCount}\n` +
              `🛡️ Protection: Active`
            );
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

      // Check for forwarded messages without context
      if (isForwarded && !text.includes('@' + username)) {
        // Forwarded message from another source
        const behavior = analyzeUserBehavior(userId, chatId);

        // If user is flooding with forwards or it looks like spam content
        if (behavior.isFlooding || behavior.isBursting ||
            (text && (text.match(/https?:\/\/[^\s]+/gi) || []).length > 0)) {
          console.log(`Suspicious forward from ${username}`);

          // Delete forwarded spam
          await deleteMessage(chatId, message.message_id);
          await sendMessage(chatId,
            `⚠️ <b>${username}</b> - No forwarding spam!`,
            true
          );
          return res.status(200).json({ ok: true });
        }
      }

      // Check for spam
      const spamCheck = isSpam(text, userId, chatId, username);

      if (spamCheck.isSpam) {
        console.log(`SPAM DETECTED from ${username}: Score=${spamCheck.score}, Reasons=${spamCheck.reasons.join(', ')}`);

        // Delete message
        const deleteResult = await deleteMessage(chatId, message.message_id);
        console.log('Delete result:', deleteResult);

        // Check warning count (1 warning system)
        const warnings = (userWarnings.get(userKey) || 0) + 1;
        userWarnings.set(userKey, warnings);

        if (warnings >= 2) {
          // Ban after 1 warning (2nd offense)
          const banResult = await banUser(chatId, userId);
          console.log('Ban result:', banResult);

          if (banResult && banResult.ok) {
            await sendMessage(chatId,
              `🚫 <b>Tod diya isko! ${username}</b>`,
              true // Auto-delete after 60 seconds
            );
          }
          userWarnings.delete(userKey);
        } else {
          // First warning message
          await sendMessage(chatId,
            `⚠️ <b>${username}</b> - Last warning!`,
            true // Auto-delete after 60 seconds
          );
        }
      }

      // Check for media spam (photos, videos with suspicious captions)
      if ((message.photo || message.video || message.document) && message.caption) {
        const captionCheck = isSpam(message.caption, userId, chatId, username);
        if (captionCheck.isSpam) {
          await deleteMessage(chatId, message.message_id);
          await sendMessage(chatId, `🚫 Media spam detected from ${username}`, true); // Auto-delete after 60 seconds
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true, error: error.message });
  }
}