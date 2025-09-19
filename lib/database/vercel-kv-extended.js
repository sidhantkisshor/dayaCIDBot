import { kv } from '@vercel/kv';

// Extended KV operations for dashboard statistics
export async function initializeKVExtended() {
  const base = await import('./vercel-kv.js').then(m => m.initializeKV());

  return {
    ...base,

    // Statistics operations
    async incrementStat(statKey, increment = 1) {
      const today = new Date().toISOString().split('T')[0];
      const key = `stats:${today}:${statKey}`;
      await kv.incrby(key, increment);
      // Expire after 30 days
      await kv.expire(key, 30 * 86400);
    },

    async getStat(statKey, date = null) {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const key = `stats:${targetDate}:${statKey}`;
      return (await kv.get(key)) || 0;
    },

    async getWeeklyStats(statKey) {
      const stats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const value = await this.getStat(statKey, dateStr);
        stats.push(value);
      }
      return stats;
    },

    // Activity logging
    async logActivity(activity) {
      const key = `activity:${new Date().toISOString().split('T')[0]}`;
      const activities = (await kv.get(key)) || [];

      activities.unshift({
        ...activity,
        timestamp: Date.now()
      });

      // Keep only last 100 activities per day
      if (activities.length > 100) {
        activities.pop();
      }

      await kv.set(key, activities, { ex: 7 * 86400 }); // Keep for 7 days
      return true;
    },

    async getRecentActivity(limit = 20) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      const todayActivities = (await kv.get(`activity:${today}`)) || [];
      const yesterdayActivities = (await kv.get(`activity:${yesterday}`)) || [];

      const combined = [...todayActivities, ...yesterdayActivities];
      return combined.slice(0, limit);
    },

    // Pattern statistics
    async incrementPatternMatch(patternCategory) {
      const key = `patterns:${new Date().toISOString().split('T')[0]}`;
      const patterns = (await kv.get(key)) || {};
      patterns[patternCategory] = (patterns[patternCategory] || 0) + 1;
      await kv.set(key, patterns, { ex: 30 * 86400 });
    },

    async getPatternDistribution() {
      const key = `patterns:${new Date().toISOString().split('T')[0]}`;
      return (await kv.get(key)) || {};
    },

    // User statistics
    async getActiveUserCount() {
      const key = `active_users:${new Date().toISOString().split('T')[0]}`;
      const users = (await kv.get(key)) || new Set();
      return users.size;
    },

    async markUserActive(userId, chatId) {
      const key = `active_users:${new Date().toISOString().split('T')[0]}`;
      const users = new Set((await kv.get(key)) || []);
      users.add(`${chatId}:${userId}`);
      await kv.set(key, Array.from(users), { ex: 86400 });
    },

    // Dashboard-specific stats
    async getDashboardStats() {
      const today = new Date().toISOString().split('T')[0];

      // Get today's stats
      const totalMessages = await this.getStat('total_messages');
      const spamDetected = await this.getStat('spam_detected');
      const activeUsers = await this.getActiveUserCount();

      // Calculate detection rate
      const detectionRate = totalMessages > 0
        ? Math.round((spamDetected / totalMessages) * 100)
        : 0;

      // Get weekly activity
      const weeklyTotal = await this.getWeeklyStats('total_messages');
      const weeklySpam = await this.getWeeklyStats('spam_detected');

      // Get pattern distribution
      const patternDistribution = await this.getPatternDistribution();

      // Get recent activity
      const recentActivity = await this.getRecentActivity();

      return {
        totalMessages,
        spamDetected,
        activeUsers,
        detectionRate,
        weeklyActivity: {
          total: weeklyTotal,
          spam: weeklySpam
        },
        patternDistribution,
        recentActivity
      };
    },

    // Event publishing for real-time updates
    async publishEvent(eventType, data) {
      const key = `events:stream`;
      const event = {
        type: eventType,
        data,
        timestamp: Date.now()
      };

      // Store in a list for SSE streaming
      await kv.lpush(key, JSON.stringify(event));
      // Keep only last 100 events
      await kv.ltrim(key, 0, 99);

      return event;
    },

    async getEventStream(since = 0) {
      const key = `events:stream`;
      const events = await kv.lrange(key, 0, -1);
      return events
        .map(e => JSON.parse(e))
        .filter(e => e.timestamp > since)
        .reverse();
    }
  };
}