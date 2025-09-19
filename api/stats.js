import { initializeDatabase } from '../lib/database/index.js';

// Helper to initialize extended database
async function initializeExtendedDatabase() {
    const baseDb = await initializeDatabase();

    // If KV database is available, use extended version
    if (process.env.KV_REST_API_URL) {
        try {
            const { initializeKVExtended } = await import('../lib/database/vercel-kv-extended.js');
            return await initializeKVExtended();
        } catch (error) {
            console.error('Failed to initialize extended KV:', error);
        }
    }

    return baseDb;
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = await initializeExtendedDatabase();

        // Get statistics from database
        const stats = await getStatistics(db);

        return res.status(200).json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}

async function getStatistics(db) {
    // Check if we have the extended KV database with dashboard methods
    if (db.getDashboardStats) {
        try {
            // Get real statistics from database
            return await db.getDashboardStats();
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            // Fall back to basic stats if extended methods not available
        }
    }

    // Fallback: Generate basic stats for demo/development
    const now = Date.now();
    const stats = {
        totalMessages: 0,
        spamDetected: 0,
        activeUsers: 0,
        detectionRate: 0,
        weeklyActivity: {
            spam: [0, 0, 0, 0, 0, 0, 0],
            total: [0, 0, 0, 0, 0, 0, 0]
        },
        patternDistribution: {
            CRYPTO_SCAMS: 0,
            PUMP_DUMP: 0,
            CONTACT_HARVEST: 0,
            FAKE_TESTIMONIALS: 0,
            OTHER: 0
        },
        recentActivity: []
    };

    // Try to get real data from basic database methods
    if (db.getStat) {
        try {
            stats.totalMessages = await db.getStat('total_messages') || 0;
            stats.spamDetected = await db.getStat('spam_detected') || 0;
            stats.activeUsers = await db.getActiveUserCount ? await db.getActiveUserCount() : 0;
            stats.detectionRate = stats.totalMessages > 0
                ? Math.round((stats.spamDetected / stats.totalMessages) * 100)
                : 0;

            if (db.getWeeklyStats) {
                stats.weeklyActivity.total = await db.getWeeklyStats('total_messages');
                stats.weeklyActivity.spam = await db.getWeeklyStats('spam_detected');
            }

            if (db.getPatternDistribution) {
                const patterns = await db.getPatternDistribution();
                if (patterns && Object.keys(patterns).length > 0) {
                    stats.patternDistribution = patterns;
                }
            }

            if (db.getRecentActivity) {
                stats.recentActivity = await db.getRecentActivity(20);
            }
        } catch (error) {
            console.error('Error fetching stats from database:', error);
        }
    }

    // If no real data available, generate demo data
    if (stats.totalMessages === 0 && process.env.NODE_ENV !== 'production') {
        stats.totalMessages = Math.floor(Math.random() * 1000) + 500;
        stats.spamDetected = Math.floor(Math.random() * 100) + 20;
        stats.activeUsers = Math.floor(Math.random() * 200) + 50;
        stats.detectionRate = Math.floor(Math.random() * 20) + 80;

        for (let i = 0; i < 7; i++) {
            stats.weeklyActivity.total[i] = Math.floor(Math.random() * 200) + 100;
            stats.weeklyActivity.spam[i] = Math.floor(Math.random() * 50) + 10;
        }

        stats.patternDistribution = {
            CRYPTO_SCAMS: Math.floor(Math.random() * 30) + 10,
            PUMP_DUMP: Math.floor(Math.random() * 25) + 5,
            CONTACT_HARVEST: Math.floor(Math.random() * 20) + 10,
            FAKE_TESTIMONIALS: Math.floor(Math.random() * 20) + 5,
            OTHER: Math.floor(Math.random() * 15) + 5
        };

        const actions = ['deleted', 'restricted', 'allowed'];
        const usernames = ['CryptoKing', 'TradeMaster', 'JohnDoe', 'SpamBot123', 'Alice'];
        const messages = [
            'Guaranteed 100% profit! Join now',
            'Hey everyone, how are you?',
            'Click here for free bitcoin',
            'Good morning all',
            'DM me for exclusive signals'
        ];

        for (let i = 0; i < 10; i++) {
            const isSpam = Math.random() > 0.5;
            stats.recentActivity.push({
                timestamp: now - (i * 5 * 60 * 1000),
                username: usernames[Math.floor(Math.random() * usernames.length)],
                message: messages[Math.floor(Math.random() * messages.length)],
                score: isSpam ? Math.floor(Math.random() * 7) + 3 : Math.floor(Math.random() * 3),
                action: isSpam ?
                    (Math.random() > 0.5 ? 'deleted' : 'restricted') :
                    'allowed'
            });
        }
    }

    return stats;
}