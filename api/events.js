// Server-Sent Events for real-time updates

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    res.write('data: {"type":"connected","message":"Connected to event stream"}\n\n');

    // Send periodic updates (mock data for demonstration)
    const interval = setInterval(() => {
        // Random event types
        const eventTypes = ['message', 'user', 'spam'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

        let data;
        switch (eventType) {
            case 'message':
                data = {
                    type: 'message',
                    timestamp: Date.now(),
                    username: `User${Math.floor(Math.random() * 100)}`,
                    message: 'Sample message content',
                    score: Math.floor(Math.random() * 10),
                    spam: Math.random() > 0.7,
                    action: Math.random() > 0.5 ? 'deleted' : 'allowed'
                };
                break;

            case 'user':
                data = {
                    type: 'user',
                    count: Math.floor(Math.random() * 200) + 50
                };
                break;

            case 'spam':
                data = {
                    type: 'spam',
                    detected: true,
                    pattern: 'CRYPTO_SCAMS',
                    score: Math.floor(Math.random() * 5) + 5
                };
                break;
        }

        res.write(`data: ${JSON.stringify(data)}\n\n`);
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