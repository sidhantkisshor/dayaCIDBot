// Server-Sent Events for real-time updates
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
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Initialize database
    const db = await initializeExtendedDatabase();

    // Send initial connection message
    res.write('data: {"type":"connected","message":"Connected to event stream"}\n\n');

    // Track last event timestamp
    let lastEventTime = Date.now();

    // Send periodic updates
    const interval = setInterval(async () => {
        try {
            // Check for new events from database
            if (db.getEventStream) {
                const events = await db.getEventStream(lastEventTime);

                for (const event of events) {
                    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
                    lastEventTime = Math.max(lastEventTime, event.timestamp);
                }
            }

            // Send heartbeat to keep connection alive
            res.write(`:heartbeat\n\n`);

            // If no real events and in development, send mock data occasionally
            if (!db.getEventStream || process.env.NODE_ENV !== 'production') {
                if (Math.random() < 0.1) { // 10% chance per interval
                    const mockData = {
                        type: 'message',
                        timestamp: Date.now(),
                        username: `User${Math.floor(Math.random() * 100)}`,
                        message: 'Sample message content',
                        score: Math.floor(Math.random() * 10),
                        spam: Math.random() > 0.7,
                        action: Math.random() > 0.5 ? 'deleted' : 'allowed'
                    };
                    res.write(`data: ${JSON.stringify(mockData)}\n\n`);
                }
            }
        } catch (error) {
            console.error('Error sending events:', error);
        }
    }, 5000); // Send update every 5 seconds

    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
}

// Vercel configuration for streaming
export const config = {
    runtime: 'nodejs',
    api: {
        bodyParser: false,
    },
};