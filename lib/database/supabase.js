import { createClient } from '@supabase/supabase-js';

let supabase = null;

export async function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not provided');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Create tables if they don't exist
  await ensureTables();
  
  return {
    // User operations
    async getUser(userId, chatId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error getting user:', error);
      }
      
      return data;
    },

    async createUser(userId, chatId, userData = {}) {
      const user = {
        user_id: userId,
        chat_id: chatId,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        message_count: 0,
        restriction_count: 0,
        spam_score: 0,
        trusted: false,
        restricted: false,
        verified: false,
        ...userData
      };
      
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user:', error);
        throw error;
      }
      
      return data;
    },

    async updateUser(userId, chatId, updates) {
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, last_seen: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating user:', error);
      }
      
      return data;
    },

    // Message operations
    async addMessage(userId, chatId, message) {
      const messageData = {
        user_id: userId,
        chat_id: chatId,
        message_id: message.message_id,
        content: message.text || message.caption || '',
        timestamp: new Date().toISOString(),
        has_links: Boolean(message.entities?.some(e => e.type === 'url')),
        has_media: Boolean(message.photo || message.document || message.video)
      };
      
      const { error } = await supabase
        .from('messages')
        .insert(messageData);
      
      if (error) {
        console.error('Error adding message:', error);
      }
      
      // Clean old messages
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 1); // 24 hours ago
      
      await supabase
        .from('messages')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());
      
      return true;
    },

    async getRecentMessages(userId, chatId, limit = 10) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Error getting messages:', error);
        return [];
      }
      
      return data.reverse(); // Return in chronological order
    },

    // CAPTCHA operations
    async storeCaptcha(userId, chatId, answer, messageId) {
      const { error } = await supabase
        .from('captchas')
        .upsert({
          user_id: userId,
          chat_id: chatId,
          answer,
          message_id: messageId,
          expires_at: new Date(Date.now() + 120000).toISOString() // 2 minutes
        });
      
      if (error) {
        console.error('Error storing captcha:', error);
      }
    },

    async getCaptcha(userId, chatId) {
      const { data, error } = await supabase
        .from('captchas')
        .select('*')
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting captcha:', error);
      }
      
      return data;
    },

    async deleteCaptcha(userId, chatId) {
      await supabase
        .from('captchas')
        .delete()
        .eq('user_id', userId)
        .eq('chat_id', chatId);
    },

    // Rate limiting
    async checkRateLimit(userId, chatId, maxRequests, windowMs) {
      const windowStart = new Date(Date.now() - windowMs).toISOString();
      
      const { count, error } = await supabase
        .from('rate_limits')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .gt('timestamp', windowStart);
      
      if (error) {
        console.error('Error checking rate limit:', error);
        return false;
      }
      
      // Add current request
      await supabase
        .from('rate_limits')
        .insert({
          user_id: userId,
          chat_id: chatId,
          timestamp: new Date().toISOString()
        });
      
      // Clean old entries
      await supabase
        .from('rate_limits')
        .delete()
        .lt('timestamp', windowStart);
      
      return count >= maxRequests;
    },

    // Settings
    async getSetting(chatId, key) {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('chat_id', chatId)
        .eq('key', key)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting setting:', error);
      }
      
      return data?.value;
    },

    async setSetting(chatId, key, value) {
      await supabase
        .from('settings')
        .upsert({
          chat_id: chatId,
          key,
          value
        });
    },

    // Spam channels
    async isSpamChannel(channelId) {
      const { data } = await supabase
        .from('spam_channels')
        .select('channel_id')
        .eq('channel_id', channelId)
        .single();
      
      return Boolean(data);
    },

    async addSpamChannel(channelId) {
      await supabase
        .from('spam_channels')
        .upsert({ channel_id: channelId });
    },

    // Trusted users
    async isTrustedUser(userId, chatId) {
      const { data } = await supabase
        .from('trusted_users')
        .select('user_id')
        .eq('user_id', userId)
        .eq('chat_id', chatId)
        .single();
      
      return Boolean(data);
    },

    async setTrustedUser(userId, chatId, trusted = true) {
      if (trusted) {
        await supabase
          .from('trusted_users')
          .upsert({ user_id: userId, chat_id: chatId });
      } else {
        await supabase
          .from('trusted_users')
          .delete()
          .eq('user_id', userId)
          .eq('chat_id', chatId);
      }
    }
  };
}

async function ensureTables() {
  // Note: In production, you should create these tables via Supabase dashboard
  // or migration files. This is just for reference.
  
  const tables = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      first_seen TIMESTAMP DEFAULT NOW(),
      last_seen TIMESTAMP DEFAULT NOW(),
      message_count INTEGER DEFAULT 0,
      restriction_count INTEGER DEFAULT 0,
      spam_score INTEGER DEFAULT 0,
      trusted BOOLEAN DEFAULT FALSE,
      restricted BOOLEAN DEFAULT FALSE,
      verified BOOLEAN DEFAULT FALSE,
      UNIQUE(user_id, chat_id)
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      message_id INTEGER NOT NULL,
      content TEXT,
      timestamp TIMESTAMP DEFAULT NOW(),
      has_links BOOLEAN DEFAULT FALSE,
      has_media BOOLEAN DEFAULT FALSE
    );

    -- Captchas table
    CREATE TABLE IF NOT EXISTS captchas (
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      answer VARCHAR(255) NOT NULL,
      message_id INTEGER NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      PRIMARY KEY (user_id, chat_id)
    );

    -- Rate limits table
    CREATE TABLE IF NOT EXISTS rate_limits (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      chat_id BIGINT NOT NULL,
      key VARCHAR(255) NOT NULL,
      value TEXT,
      PRIMARY KEY (chat_id, key)
    );

    -- Spam channels table
    CREATE TABLE IF NOT EXISTS spam_channels (
      channel_id BIGINT PRIMARY KEY
    );

    -- Trusted users table
    CREATE TABLE IF NOT EXISTS trusted_users (
      user_id BIGINT NOT NULL,
      chat_id BIGINT NOT NULL,
      PRIMARY KEY (user_id, chat_id)
    );
  `;
  
  console.log('Supabase tables schema ready. Create these tables in your Supabase dashboard.');
}