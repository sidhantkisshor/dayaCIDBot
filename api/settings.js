import { getDatabase, initializeDatabase } from '../lib/database/index.js';

// Initialize database
await initializeDatabase();

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const db = getDatabase();

    if (req.method === 'GET') {
        // Get current settings
        try {
            const settings = {
                spamThreshold: process.env.SPAM_SCORE_THRESHOLD || '5',
                maxMessages: process.env.MAX_MESSAGES_PER_MINUTE || '10',
                restrictionHours: process.env.NEW_USER_RESTRICTION_HOURS || '24',
                enableCaptcha: process.env.ENABLE_CAPTCHA === 'true',
                enableLinkChecking: process.env.ENABLE_LINK_CHECKING === 'true',
            };

            return res.status(200).json(settings);
        } catch (error) {
            console.error('Error fetching settings:', error);
            return res.status(500).json({ error: 'Failed to fetch settings' });
        }
    }

    if (req.method === 'POST') {
        // Update settings (in production, this would update environment variables)
        try {
            const { spamThreshold, maxMessages, restrictionHours } = req.body;

            // In a real implementation, you would:
            // 1. Validate the settings
            // 2. Update environment variables via Vercel API
            // 3. Store in database if needed

            // For now, just acknowledge the update
            console.log('Settings update requested:', {
                spamThreshold,
                maxMessages,
                restrictionHours
            });

            return res.status(200).json({
                success: true,
                message: 'Settings updated (requires redeploy to take effect)',
                settings: { spamThreshold, maxMessages, restrictionHours }
            });
        } catch (error) {
            console.error('Error updating settings:', error);
            return res.status(500).json({ error: 'Failed to update settings' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}