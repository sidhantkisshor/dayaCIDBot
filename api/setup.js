// DayaCID Bot — One-time Webhook Setup Endpoint
// GET /api/setup?secret=<SETUP_SECRET> — configures webhook with correct allowed_updates
// Protected: requires the SETUP_SECRET env var to be set (fails closed otherwise).

import { timingSafeEqual } from 'node:crypto';
import { setWebhook, getWebhookInfo, getMe } from '../lib/telegram.js';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export default async function handler(req, res) {
  // Fail closed: this endpoint can repoint the bot's webhook, so it must not be
  // usable without an explicitly configured secret. No bot-token fallback.
  const expectedSecret = process.env.SETUP_SECRET;
  if (!expectedSecret) {
    return res.status(503).json({ error: 'SETUP_SECRET is not configured' });
  }

  const secret = req.query?.secret || req.headers['x-setup-secret'];
  if (!secret || !safeEqual(secret, expectedSecret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Get bot info
    const botInfo = await getMe();
    if (!botInfo?.ok) {
      return res.status(200).json({ error: 'Invalid bot token', botInfo });
    }

    // Webhook URL: prefer the operator-set PUBLIC_URL (stable production domain);
    // fall back to request headers only if it isn't configured. This prevents a
    // spoofed Host header from repointing the webhook.
    let webhookUrl;
    if (process.env.PUBLIC_URL) {
      webhookUrl = `${process.env.PUBLIC_URL.replace(/\/+$/, '')}/api/webhook`;
    } else {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'https';
      webhookUrl = `${proto}://${host}/api/webhook`;
    }

    // Set webhook with the correct allowed_updates
    const allowedUpdates = [
      'message',
      'callback_query',
      'chat_member',
      'chat_join_request'
    ];

    // Pass the webhook secret if configured, so Telegram signs every call.
    const result = await setWebhook(webhookUrl, allowedUpdates, process.env.WEBHOOK_SECRET || null);

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
      webhookSecretActive: Boolean(process.env.WEBHOOK_SECRET),
      publicUrlUsed: Boolean(process.env.PUBLIC_URL),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
