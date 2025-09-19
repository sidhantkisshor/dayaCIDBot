import { getDatabase } from '../lib/database/index.js';
import { initializeDatabase } from '../lib/database/index.js';

// Initialize database
await initializeDatabase();

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
        const db = getDatabase();

        // Get statistics from database
        const stats = await getStatistics(db);

        return res.status(200).json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}

async function getStatistics(db) {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Default stats structure
    const stats = {
        totalMessages: 0,
        spamDetected: 0,
        activeUsers: 0,
        detectionRate: 0,
        weeklyActivity: {
            spam: [],
            total: []
        },
        patternDistribution: {
            cryptoScams: 0,
            pumpDump: 0,
            contactHarvest: 0,
            fakeTestimonials: 0,
            other: 0
        },
        recentActivity: []
    };

    // If using in-memory database
    if (db.getUser) {
        // Get mock data for demonstration
        stats.totalMessages = Math.floor(Math.random() * 1000) + 500;
        stats.spamDetected = Math.floor(Math.random() * 100) + 20;
        stats.activeUsers = Math.floor(Math.random() * 200) + 50;
        stats.detectionRate = Math.floor(Math.random() * 20) + 80;

        // Generate weekly activity data
        for (let i = 0; i < 7; i++) {
            stats.weeklyActivity.total.push(Math.floor(Math.random() * 200) + 100);
            stats.weeklyActivity.spam.push(Math.floor(Math.random() * 50) + 10);
        }

        // Pattern distribution (mock data)
        stats.patternDistribution = {
            cryptoScams: Math.floor(Math.random() * 30) + 10,
            pumpDump: Math.floor(Math.random() * 25) + 5,
            contactHarvest: Math.floor(Math.random() * 20) + 10,
            fakeTestimonials: Math.floor(Math.random() * 20) + 5,
            other: Math.floor(Math.random() * 15) + 5
        };

        // Recent activity (mock data)
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
                timestamp: now - (i * 5 * 60 * 1000), // 5 minutes apart
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