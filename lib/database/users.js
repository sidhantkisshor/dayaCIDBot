import { getDatabase } from './index.js';

export async function getUserData(userId, chatId) {
  const db = getDatabase();
  let user = await db.getUser(userId, chatId);
  
  if (!user) {
    // Create new user record
    user = await db.createUser(userId, chatId);
  }
  
  return user;
}

export async function createUser(userId, chatId, additionalData = {}) {
  const db = getDatabase();
  return await db.createUser(userId, chatId, additionalData);
}

export async function updateUserActivity(userId, chatId) {
  const db = getDatabase();
  const user = await getUserData(userId, chatId);
  
  return await db.updateUser(userId, chatId, {
    last_seen: Date.now(),
    message_count: (user.message_count || 0) + 1
  });
}

export async function markUserVerified(userId, chatId) {
  const db = getDatabase();
  return await db.updateUser(userId, chatId, {
    verified: true,
    verified_at: Date.now()
  });
}

export async function updateUserSpamScore(userId, chatId, score) {
  const db = getDatabase();
  const user = await getUserData(userId, chatId);
  
  return await db.updateUser(userId, chatId, {
    spam_score: score,
    restriction_count: score >= 7 ? (user.restriction_count || 0) + 1 : user.restriction_count
  });
}

export async function setUserRestriction(userId, chatId, restricted = true) {
  const db = getDatabase();
  return await db.updateUser(userId, chatId, {
    restricted,
    restricted_at: restricted ? Date.now() : null
  });
}

export async function isUserTrusted(userId, chatId) {
  const db = getDatabase();
  return await db.isTrustedUser(userId, chatId);
}

export async function setUserTrusted(userId, chatId, trusted = true) {
  const db = getDatabase();
  await db.setTrustedUser(userId, chatId, trusted);
  return await db.updateUser(userId, chatId, { trusted });
}