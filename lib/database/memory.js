// In-memory database for development/testing
// Data structure to simulate a real database

const data = {
  users: new Map(),
  messages: new Map(),
  captchas: new Map(),
  rateLimit: new Map(),
  settings: new Map(),
  spamChannels: new Set(),
  trustedUsers: new Set()
};

export async function initializeMemory() {
  return {
    // User operations
    async getUser(userId, chatId) {
      const key = `${chatId}:${userId}`;
      return data.users.get(key) || null;
    },

    async createUser(userId, chatId, userData = {}) {
      const key = `${chatId}:${userId}`;
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
      data.users.set(key, user);
      return user;
    },

    async updateUser(userId, chatId, updates) {
      const key = `${chatId}:${userId}`;
      const user = data.users.get(key);
      if (user) {
        Object.assign(user, updates, { last_seen: Date.now() });
        data.users.set(key, user);
      }
      return user;
    },

    // Message operations
    async addMessage(userId, chatId, message) {
      const key = `${chatId}:${userId}`;
      if (!data.messages.has(key)) {
        data.messages.set(key, []);
      }
      const messages = data.messages.get(key);
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
      return true;
    },

    async getRecentMessages(userId, chatId, limit = 10) {
      const key = `${chatId}:${userId}`;
      const messages = data.messages.get(key) || [];
      return messages.slice(-limit);
    },

    // CAPTCHA operations
    async storeCaptcha(userId, chatId, answer, messageId) {
      const key = `${chatId}:${userId}`;
      data.captchas.set(key, {
        answer,
        message_id: messageId,
        timestamp: Date.now()
      });
    },

    async getCaptcha(userId, chatId) {
      const key = `${chatId}:${userId}`;
      return data.captchas.get(key);
    },

    async deleteCaptcha(userId, chatId) {
      const key = `${chatId}:${userId}`;
      data.captchas.delete(key);
    },

    // Rate limiting
    async checkRateLimit(userId, chatId, maxRequests, windowMs) {
      const key = `${chatId}:${userId}`;
      const now = Date.now();
      const userLimits = data.rateLimit.get(key) || [];
      
      // Remove old entries
      const validEntries = userLimits.filter(time => now - time < windowMs);
      
      if (validEntries.length >= maxRequests) {
        return true; // Rate limit exceeded
      }
      
      validEntries.push(now);
      data.rateLimit.set(key, validEntries);
      return false;
    },

    // Settings
    async getSetting(chatId, key) {
      const chatSettings = data.settings.get(chatId) || {};
      return chatSettings[key];
    },

    async setSetting(chatId, key, value) {
      const chatSettings = data.settings.get(chatId) || {};
      chatSettings[key] = value;
      data.settings.set(chatId, chatSettings);
    },

    // Spam channels
    async isSpamChannel(channelId) {
      return data.spamChannels.has(channelId);
    },

    async addSpamChannel(channelId) {
      data.spamChannels.add(channelId);
    },

    // Trusted users
    async isTrustedUser(userId, chatId) {
      const key = `${chatId}:${userId}`;
      return data.trustedUsers.has(key);
    },

    async setTrustedUser(userId, chatId, trusted = true) {
      const key = `${chatId}:${userId}`;
      if (trusted) {
        data.trustedUsers.add(key);
      } else {
        data.trustedUsers.delete(key);
      }
    }
  };
}