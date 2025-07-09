import { getDatabase } from '../database/index.js';

export async function checkRateLimit(userId, chatId) {
  const db = getDatabase();
  const maxMessages = parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '10');
  const windowMs = 60000; // 1 minute
  
  return await db.checkRateLimit(userId, chatId, maxMessages, windowMs);
}

export async function checkJoinRateLimit(chatId) {
  const db = getDatabase();
  // Check for mass joins (potential raid)
  const maxJoins = 5; // Max 5 joins per minute
  const windowMs = 60000;
  
  return await db.checkRateLimit('joins', chatId, maxJoins, windowMs);
}