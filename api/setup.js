// DayaCID Bot — One-time Webhook Setup Endpoint
// GET /api/setup?secret=<SETUP_SECRET> — configures webhook with correct allowed_updates
// Protected: requires SETUP_SECRET env var or TELEGRAM_BOT_TOKEN as query param

import { timingSafeEqual } from 'node:crypto';
import { setWebhook, getWebhookInfo, getMe } from '../lib/telegram.js';
import { TOKEN } from '../lib/config.js';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export default async function handler(req, res) {
  // Protect this endpoint — require a secret to prevent unauthorized reconfiguration
  const secret = req.query?.secret || req.headers['x-setup-secret'];
  const expectedSecret = process.env.SETUP_SECRET || TOKEN;

  if (!secret || !safeEqual(secret, expectedSecret)) {
    return res.status(403).json({
      error: 'Forbidden',
      hint: 'Pass ?secret=<SETUP_SECRET> or ?secret=<TELEGRAM_BOT_TOKEN>'
    });
  }

  try {
    // Get bot info
    const botInfo = await getMe();
    if (!botInfo?.ok) {
      return res.status(200).json({ error: 'Invalid bot token', botInfo });
    }

    // Determine webhook URL from request headers
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const webhookUrl = `${proto}://${host}/api/webhook`;

    // Set webhook with the correct allowed_updates
    const allowedUpdates = [
      'message',
      'callback_query',
      'chat_member',
      'chat_join_request'
    ];

    const result = await setWebhook(webhookUrl, allowedUpdates);

    // Get current webhook info for verification
    const webhookInfo = await getWebhookInfo();

    return res.status(200).json({
      status: result?.ok ? 'configured' : 'failed',
      bot: {
        id: botInfo.result.id,
        username: botInfo.result.username,
        first_name: botInfo.result.first_name,
      },
      webhookUrl,
      setWebhookResult: result,
      currentWebhook: {
        url: webhookInfo?.result?.url,
        pending_update_count: webhookInfo?.result?.pending_update_count,
        allowed_updates: webhookInfo?.result?.allowed_updates,
        last_error_message: webhookInfo?.result?.last_error_message,
      },
      configuredUpdates: allowedUpdates,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
