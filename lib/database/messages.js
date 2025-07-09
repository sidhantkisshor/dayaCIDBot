import { getDatabase } from './index.js';

export async function addToMessageHistory(userId, chatId, message) {
  const db = getDatabase();
  return await db.addMessage(userId, chatId, message);
}

export async function getRecentMessages(userId, chatId, limit = 10) {
  const db = getDatabase();
  return await db.getRecentMessages(userId, chatId, limit);
}

export async function checkMessageSimilarity(userId, chatId, newMessage) {
  const recentMessages = await getRecentMessages(userId, chatId, 5);
  const newContent = (newMessage.text || newMessage.caption || '').toLowerCase().trim();
  
  if (!newContent || newContent.length < 10) {
    return { isSimilar: false, count: 0 };
  }
  
  let similarCount = 0;
  for (const msg of recentMessages) {
    const similarity = calculateSimilarity(newContent, msg.content.toLowerCase().trim());
    if (similarity > 0.8) {
      similarCount++;
    }
  }
  
  return {
    isSimilar: similarCount >= 3,
    count: similarCount
  };
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Quick exact match check
  if (str1 === str2) return 1;
  
  // Length difference check
  const lengthDiff = Math.abs(str1.length - str2.length);
  if (lengthDiff > str1.length * 0.5) return 0;
  
  // Use Jaccard similarity for performance
  const set1 = new Set(str1.split(/\s+/));
  const set2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}