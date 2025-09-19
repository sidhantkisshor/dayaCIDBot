import TelegramBot from 'node-telegram-bot-api';
import { initializeDatabase } from '../lib/database/index.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const health = {
            status: 'unknown',
            bot: {
                connected: false,
                username: null,
                webhook: false
            },
            database: {
                connected: false,
                type: null
            },
            timestamp: Date.now()
        };

        // Check bot status
        try {
            if (!process.env.TELEGRAM_BOT_TOKEN) {
                health.bot.error = 'No bot token configured';
            } else {
                // Create temporary bot instance for health check
                const tempBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
                // Try to get bot info
                const botInfo = await tempBot.getMe();
                if (botInfo) {
                    health.bot.connected = true;
                    health.bot.username = botInfo.username;
                    health.bot.id = botInfo.id;
                }

                // Check webhook status
                const webhookInfo = await tempBot.getWebhookInfo();
                if (webhookInfo && webhookInfo.url) {
                    health.bot.webhook = true;
                    health.bot.webhookUrl = webhookInfo.url;
                    health.bot.pendingUpdates = webhookInfo.pending_update_count || 0;

                    if (webhookInfo.last_error_date) {
                        health.bot.lastError = {
                            date: new Date(webhookInfo.last_error_date * 1000).toISOString(),
                            message: webhookInfo.last_error_message
                        };
                    }
                }
            }
        } catch (error) {
            health.bot.error = error.message;
            console.error('Bot health check failed:', error);
        }

        // Check database status
        try {
            const db = await initializeDatabase();
            if (db) {
                health.database.connected = true;
                health.database.type = process.env.KV_REST_API_URL ? 'vercel-kv' :
                                       process.env.SUPABASE_URL ? 'supabase' : 'memory';

                // Test database connection
                if (db.getStat) {
                    const testStat = await db.getStat('health_check');
                    health.database.operational = true;
                }
            }
        } catch (error) {
            health.database.error = error.message;
            console.error('Database health check failed:', error);
        }

        // Overall status
        if (health.bot.connected && health.database.connected) {
            health.status = 'healthy';
        } else if (health.bot.connected || health.database.connected) {
            health.status = 'degraded';
        } else {
            health.status = 'unhealthy';
        }

        // Add environment info
        health.environment = {
            nodeEnv: process.env.NODE_ENV || 'development',
            vercelEnv: process.env.VERCEL_ENV || 'development',
            hasKV: !!process.env.KV_REST_API_URL,
            hasSupabase: !!process.env.SUPABASE_URL,
            hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
            spamThreshold: process.env.SPAM_SCORE_THRESHOLD || '5'
        };

        return res.status(200).json(health);
    } catch (error) {
        console.error('Health check error:', error);
        return res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: Date.now()
        });
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};