import { kv } from '@vercel/kv';

export async function initializeKV() {
  // Test connection
  try {
    await kv.ping();
    console.log('Vercel KV connected successfully');
  } catch (error) {
    console.error('Vercel KV connection failed:', error);
    throw error;
  }

  return {
    // User operations
    async getUser(userId, chatId) {
      const key = `user:${chatId}:${userId}`;
      return await kv.get(key);
    },

    async createUser(userId, chatId, userData = {}) {
      const key = `user:${chatId}:${userId}`;
      const user = {
        user_id: userId,
        chat_id: chatId,
        first_seen: Date.now(),
        last_seen: Date.now(),
        message_count: 0,
        restriction_count: 0,
        spam_score: 0,
        trusted: false,
        restricted: false,
        verified: false,
        ...userData
      };
      await kv.set(key, user);
      return user;
    },

    async updateUser(userId, chatId, updates) {
      const key = `user:${chatId}:${userId}`;
      const user = await kv.get(key);
      if (user) {
        const updatedUser = { ...user, ...updates, last_seen: Date.now() };
        await kv.set(key, updatedUser);
        return updatedUser;
      }
      return null;
    },

    // Message operations
    async addMessage(userId, chatId, message) {
      const key = `messages:${chatId}:${userId}`;
      const messages = (await kv.get(key)) || [];
      
      messages.push({
        message_id: message.message_id,
        content: message.text || message.caption || '',
        timestamp: Date.now(),
        has_links: Boolean(message.entities?.some(e => e.type === 'url')),
        has_media: Boolean(message.photo || message.document || message.video)
      });
      
      // Keep only last 50 messages
      if (messages.length > 50) {
        messages.shift();
      }
      
      await kv.set(key, messages, { ex: 86400 }); // Expire after 24 hours
      return true;
    },

    async getRecentMessages(userId, chatId, limit = 10) {
      const key = `messages:${chatId}:${userId}`;
      const messages = (await kv.get(key)) || [];
      return messages.slice(-limit);
    },

    // CAPTCHA operations
    async storeCaptcha(userId, chatId, answer, messageId) {
      const key = `captcha:${chatId}:${userId}`;
      await kv.set(key, {
        answer,
        message_id: messageId,
        timestamp: Date.now()
      }, { ex: 120 }); // Expire after 2 minutes
    },

    async getCaptcha(userId, chatId) {
      const key = `captcha:${chatId}:${userId}`;
      return await kv.get(key);
    },

    async deleteCaptcha(userId, chatId) {
      const key = `captcha:${chatId}:${userId}`;
      await kv.del(key);
    },

    // Rate limiting
    async checkRateLimit(userId, chatId, maxRequests, windowMs) {
      const key = `ratelimit:${chatId}:${userId}`;
      const current = await kv.incr(key);
      
      if (current === 1) {
        // First request in window, set expiry
        await kv.expire(key, Math.ceil(windowMs / 1000));
      }
      
      return current > maxRequests;
    },

    // Settings
    async getSetting(chatId, key) {
      const settingKey = `settings:${chatId}:${key}`;
      return await kv.get(settingKey);
    },

    async setSetting(chatId, key, value) {
      const settingKey = `settings:${chatId}:${key}`;
      await kv.set(settingKey, value);
    },

    // Spam channels
    async isSpamChannel(channelId) {
      return await kv.sismember('spam_channels', channelId);
    },

    async addSpamChannel(channelId) {
      await kv.sadd('spam_channels', channelId);
    },

    // Trusted users
    async isTrustedUser(userId, chatId) {
      const key = `trusted:${chatId}`;
      return await kv.sismember(key, userId);
    },

    async setTrustedUser(userId, chatId, trusted = true) {
      const key = `trusted:${chatId}`;
      if (trusted) {
        await kv.sadd(key, userId);
      } else {
        await kv.srem(key, userId);
      }
    }
  };
}