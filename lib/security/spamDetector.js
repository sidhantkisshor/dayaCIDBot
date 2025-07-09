import { getRecentMessages } from '../database/messages.js';
import { checkRateLimit } from '../utils/rateLimit.js';
import { scanLinks } from './linkScanner.js';

export async function checkSpam(message, userData) {
  let score = 0;
  const { from, text, entities, caption } = message;
  const content = text || caption || '';
  
  // 1. Rate limiting check
  const rateLimitExceeded = await checkRateLimit(from.id, message.chat.id);
  if (rateLimitExceeded) {
    score += 3;
  }

  // 2. New user checks
  const accountAge = Date.now() - (userData.first_seen || Date.now());
  const hoursSinceJoined = accountAge / (1000 * 60 * 60);
  
  if (hoursSinceJoined < parseInt(process.env.NEW_USER_RESTRICTION_HOURS || '24')) {
    // New user penalties
    score += 1;
    
    // New user with links
    if (entities && entities.some(e => e.type === 'url' || e.type === 'text_link')) {
      score += 3;
    }
    
    // New user with mentions
    if (entities && entities.some(e => e.type === 'mention' || e.type === 'text_mention')) {
      score += 2;
    }
  }

  // 3. Content repetition check
  const recentMessages = await getRecentMessages(from.id, message.chat.id, 10);
  const similarMessages = recentMessages.filter(msg => {
    const similarity = calculateSimilarity(content, msg.content);
    return similarity > 0.8;
  });
  
  if (similarMessages.length >= parseInt(process.env.REPEATED_MESSAGE_LIMIT || '3')) {
    score += 4;
  }

  // 4. Link analysis
  if (entities) {
    const links = entities.filter(e => e.type === 'url' || e.type === 'text_link');
    if (links.length > 0) {
      const linkScore = await scanLinks(message, links);
      score += linkScore;
    }
  }

  // 5. Mention spam
  const mentions = entities ? entities.filter(e => 
    e.type === 'mention' || e.type === 'text_mention'
  ).length : 0;
  
  const maxMentions = parseInt(process.env.MAX_MENTIONS_PER_MESSAGE || '3');
  if (mentions > maxMentions) {
    score += 2 * (mentions - maxMentions);
  }

  // 6. ALL CAPS detection
  if (content.length > 10) {
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7) {
      score += 2;
    }
  }

  // 7. Emoji spam
  const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 10) {
    score += Math.floor(emojiCount / 10);
  }

  // 8. Forward from suspicious channels
  if (message.forward_from_chat) {
    score += 1;
    // Check if it's from a known spam channel
    if (await isKnownSpamChannel(message.forward_from_chat.id)) {
      score += 3;
    }
  }

  return Math.min(score, 10); // Cap at 10
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

async function isKnownSpamChannel(channelId) {
  // This would check against a database of known spam channels
  // For now, return false
  return false;
}