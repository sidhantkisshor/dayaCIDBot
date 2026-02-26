// DayaCID Bot — Spam Detection Engine

import { normalizeText, hasObfuscation, extractHiddenUrls, extractEntityInfo } from './normalize.js';
import { recordMessageTime, pruneMessageTimes, isTrusted } from './state.js';
import {
  SPAM_THRESHOLD, FLOOD_WINDOW_MS, FLOOD_THRESHOLD,
  BURST_WINDOW_MS, BURST_THRESHOLD, getThreshold
} from './config.js';

// ── Pattern Definitions ──

export const SPAM_PATTERNS = [
  // Crypto & Trading
  /\b(free\s+crypto|airdrop|100x\s+guaranteed|pump\s+signal)/i,
  /\b(bitcoin\s+doubler|ethereum\s+giveaway|crypto\s+investment)/i,
  /\b(gold\s+sell|gold\s+buy|forex\s+signal|binary\s+option)/i,
  /\b(pump\s*spin|pumpspin|claim\s+pump|pump\s+and\s+dump)/i,
  /\b(trading\s+bot|signal\s+bot|profit\s+bot)/i,
  /\b(signal|signals)\s+(group|channel|free|vip|premium)/i,
  /\b(nft\s+mint|nft\s+drop|free\s+nft)/i,
  /\b(defi|yield\s+farming|liquidity\s+pool)\s+\d+%/i,
  /\b(btc|eth|usdt|bnb)\s+giveaway/i,

  // Forex/Commodity Trading Symbols
  /\b(XAUUSD|XAGUSD|EURUSD|GBPUSD|USDJPY|USDCAD|AUDUSD|NZDUSD)/i,
  /\b(EUR\/USD|GBP\/USD|USD\/JPY|USD\/CAD|AUD\/USD|NZD\/USD)/i,
  /\b(gold|silver|oil|crude)\s+(buy|sell|short|long)/i,
  /\b(buy|sell|short|long)\s+\d{3,5}/i,

  // Financial Scams
  /\b(guaranteed\s+profit|daily\s+income|passive\s+income)/i,
  /\b(make\s+\$?\d+\s+(daily|hourly|weekly))/i,
  /\b(earn\s+from\s+home|work\s+from\s+home\s+\$)/i,
  /\b(loan\s+offer|instant\s+loan|quick\s+loan)/i,
  /\b(credit\s+card\s+hack|free\s+money|cash\s+app\s+flip)/i,
  /\b(investment\s+opportunity|roi\s+guaranteed)/i,

  // Trading Indicators
  /\b(tp|sl|take\s+profit|stop\s+loss)\s+\d+/i,
  /✔️\s*(tp|sl)\s+\d+/i,
  /🚫\s*(stop|sl)\s+\d+/i,
  /\b(entry|exit)\s+@?\s*\d+/i,
  /\b(leverage|margin)\s+\d+x/i,
  /\b(bull\s+run|bear\s+market|to\s+the\s+moon)/i,
  /\bnew\s+(buy|sell|long|short)/i,

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
  /\bt\.me\/[a-zA-Z0-9_]+/i,
  /\bhttps?:\/\/t\.me\/[a-zA-Z0-9_]+/i,

  // Urgency Tactics
  /\b(hurry\s+up|limited\s+time|act\s+now|don't\s+miss)/i,
  /\b(only\s+\d+\s+spots|last\s+chance|ending\s+soon)/i,
  /\b(register\s+now|sign\s+up\s+fast)/i,

  // Repetitive Characters
  /(.)\1{5,}/i,
  /(\b\w+\b)(\s+\1){3,}/i,

  // Repetitive mentions/usernames
  /(@\w+[\s\n]*){3,}/i,
  /(@trading_|@forex_|@signal_|@crypto_|@gold_|@invest_|@profit_)/i,
  /(@\w+_master|@\w+_expert|@\w+_guru|@\w+_pro)/i,

  // Phone Numbers & Contacts
  /\+\d{10,15}/,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,

  // Emoji Spam Patterns
  /💰{3,}|💵{3,}|💸{3,}|🤑{3,}/,
  /🔥{5,}|💯{5,}|🚀{5,}/,

  // Quote/Copy patterns
  /^(RT|Repost|Via|From)[\s:]/i,
  /[\[\]]{2,}/,
  /^["'\u201C].*["'\u201D]$/s,
  /^\d+\.\s+.*\n\d+\.\s+/m,

  // Specific contact spam
  /\b(contact|dm|inbox)\s+(me|us)\s+for\s+(signal|profit|earning)/i,
  /\bcall\s+\+?\d{10,}/i,
];

export const SUSPICIOUS_KEYWORDS = [
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

const SUSPICIOUS_URL_PATTERNS = /\.(fun|club|click|xyz|tk|ml|ga|cf|link|top|buzz|icu|cam)\b/i;

// ── Behavior Analysis ──

export function analyzeUserBehavior(userId, chatId) {
  recordMessageTime(chatId, userId);
  const recentMessages = pruneMessageTimes(chatId, userId, FLOOD_WINDOW_MS);

  if (recentMessages.length > FLOOD_THRESHOLD) {
    return { isFlooding: true, messageCount: recentMessages.length };
  }

  const now = Date.now();
  const burst = recentMessages.filter(t => now - t < BURST_WINDOW_MS);
  if (burst.length >= BURST_THRESHOLD) {
    return { isBursting: true, burstCount: burst.length };
  }

  return { isFlooding: false, isBursting: false };
}

// ── Main Spam Detection ──

export async function isSpam(text, userId, chatId, username, message = null, hasUsername = true) {
  if (!text) return { isSpam: false, score: 0, reasons: [] };

  // Skip trusted users
  if (await isTrusted(chatId, userId)) {
    return { isSpam: false, score: 0, reasons: ['Trusted user'] };
  }

  let score = 0;
  const reasons = [];

  // Normalize text to defeat zero-width char evasion
  const normalizedText = normalizeText(text);

  // Flag obfuscation attempts
  if (hasObfuscation(text)) {
    score += 2;
    reasons.push('Unicode obfuscation detected');
  }

  // Check behavior patterns
  const behavior = analyzeUserBehavior(userId, chatId);
  if (behavior.isFlooding) {
    score += 6;
    reasons.push(`Flooding: ${behavior.messageCount} msgs/min`);
  }
  if (behavior.isBursting) {
    score += 4;
    reasons.push(`Burst messaging: ${behavior.burstCount} msgs/3s`);
  }

  // Check spam patterns (against normalized text)
  let patternMatches = 0;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalizedText)) {
      score += 3;
      patternMatches++;
      reasons.push(`Pattern: ${pattern.source.substring(0, 30)}...`);
    }
  }

  if (patternMatches >= 3) {
    score += 4;
    reasons.push('Multiple spam patterns detected');
  }
  if (patternMatches >= 4) {
    score += 3;
    reasons.push('High spam pattern concentration');
  }

  // Check suspicious keywords (against normalized text)
  const lowerText = normalizedText.toLowerCase();
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

  // Entity-based detection (more reliable than regex for URLs/phones)
  let entityInfo = null;
  if (message) {
    entityInfo = extractEntityInfo(message);
    const hiddenUrls = extractHiddenUrls(message);

    // Hidden text_link URLs are highly suspicious
    if (entityInfo.hiddenLinkCount > 0) {
      score += 2;
      reasons.push(`${entityInfo.hiddenLinkCount} hidden link(s)`);

      // Check if hidden URLs point to suspicious domains
      for (const { url } of hiddenUrls.filter(u => u.hidden)) {
        if (SUSPICIOUS_URL_PATTERNS.test(url)) {
          score += 4;
          reasons.push(`Suspicious hidden URL: ${url.substring(0, 40)}`);
        }
      }
    }

    // Multiple URLs via entities
    const totalUrls = entityInfo.urlCount + entityInfo.hiddenLinkCount;
    if (totalUrls > 2) {
      score += 2;
      reasons.push(`${totalUrls} URLs detected (entities)`);
    }

    // Blockquotes (common in copy-pasted content)
    if (entityInfo.blockquoteCount > 0) {
      score += 1;
      reasons.push('Contains blockquote (possible copy-paste)');
    }
  }

  // Trading signal patterns with multiple price levels
  const priceMatches = normalizedText.match(/\d{3,5}/g) || [];
  if (priceMatches.length >= 3) {
    score += 4;
    reasons.push(`Multiple price levels: ${priceMatches.length}`);
  }

  // Trading emojis combined with numbers
  if (/[✔️📊🚫💹📈📉]\s*\d{3,5}/i.test(normalizedText) || /\d{3,5}\s*[✔️📊🚫💹📈📉]/i.test(normalizedText)) {
    score += 3;
    reasons.push('Trading emojis with prices');
  }

  // Excessive caps (more than 70% capitals)
  if (normalizedText.length > 10) {
    const capsRatio = (normalizedText.match(/[A-Z]/g) || []).length / normalizedText.length;
    if (capsRatio > 0.7) {
      score += 2;
      reasons.push('Excessive capitals');
    }
  }

  // Excessive emojis
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 5) {
    score += 1;
    reasons.push(`${emojiCount} emojis`);
  }
  if (emojiCount > 10) {
    score += 2;
    reasons.push('Excessive emoji usage');
  }

  // Fallback regex URL count (when entities not available)
  if (!message) {
    const urlCount = (normalizedText.match(/https?:\/\/[^\s]+/gi) || []).length;
    if (urlCount > 2) {
      score += 2;
      reasons.push(`${urlCount} URLs detected`);
    }
    if (normalizedText.length < 50 && urlCount > 0) {
      score += 2;
      reasons.push('Short message with URL');
    }
  } else {
    const totalUrls = entityInfo.urlCount + entityInfo.hiddenLinkCount;
    if (normalizedText.length < 50 && totalUrls > 0) {
      score += 2;
      reasons.push('Short message with URL');
    }
  }

  // Long message check
  if (normalizedText.length > 1000) {
    score += 2;
    reasons.push('Very long message (possible copy-paste)');
    const financeWordCount = ['market', 'finance', 'investment', 'capital', 'equity', 'trading', 'portfolio', 'leverage']
      .filter(word => lowerText.includes(word)).length;
    if (financeWordCount >= 3) {
      score += 3;
      reasons.push('Long financial article');
    }
  }

  // No username + URL
  if (!hasUsername && (normalizedText.match(/https?:\/\/[^\s]+/gi) || []).length > 0) {
    score += 3;
    reasons.push('No username + URL');
  }

  // Long number sequences
  if ((normalizedText.match(/\d{6,}/g) || []).length > 0) {
    score += 1;
    reasons.push('Long number sequences');
  }

  // Excessive punctuation
  if (/[!?]{3,}/.test(normalizedText)) {
    score += 1;
    reasons.push('Excessive punctuation');
  }

  // Forwarded from text
  if (normalizedText.includes('Forwarded from')) {
    score += 1;
    reasons.push('Forwarded message text');
  }

  // Repeated username mentions
  const mentionMatches = normalizedText.match(/@\w+/g) || [];
  if (mentionMatches.length >= 3) {
    const uniqueMentions = new Set(mentionMatches);
    if (uniqueMentions.size === 1) {
      score += 5;
      reasons.push(`Username spamming: ${mentionMatches[0]} x${mentionMatches.length}`);
    } else if (mentionMatches.length >= 5) {
      score += 3;
      reasons.push(`Excessive mentions: ${mentionMatches.length}`);
    }
  }

  // Message is ONLY mentions
  const textWithoutMentions = normalizedText.replace(/@\w+/g, '').trim();
  if (mentionMatches.length > 0 && textWithoutMentions.length < 5) {
    score += 3;
    reasons.push('Message contains only mentions');
  }

  console.log(`Spam analysis for ${username || 'Unknown'}: Score=${score}, Reasons=${reasons.join(', ')}`);

  return {
    isSpam: score >= getThreshold('SPAM_THRESHOLD'),
    score,
    reasons
  };
}
