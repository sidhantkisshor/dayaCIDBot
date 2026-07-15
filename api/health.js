// DayaCID Bot — Health Check with Permission Self-Check

import { getMe, getWebhookInfo } from '../lib/telegram.js';

export default async function handler(req, res) {
  let botInfo = null;
  let webhookInfo = null;
  let error = null;

  try {
    botInfo = await getMe();
    webhookInfo = await getWebhookInfo();
  } catch (e) {
    error = e.message;
  }

  const webhook = webhookInfo?.result;
  const allowedUpdates = webhook?.allowed_updates || [];
  const requiredUpdates = ['message', 'callback_query', 'chat_member'];
  const missingUpdates = requiredUpdates.filter(u => !allowedUpdates.includes(u));

  return res.status(200).json({
    status: botInfo?.ok ? 'connected' : 'disconnected',
    bot: botInfo?.result,
    webhook: {
      url: webhook?.url,
      has_custom_certificate: webhook?.has_custom_certificate,
      pending_update_count: webhook?.pending_update_count,
      last_error_date: webhook?.last_error_date,
      last_error_message: webhook?.last_error_message,
      max_connections: webhook?.max_connections,
      allowed_updates: allowedUpdates,
    },
    checks: {
      tokenValid: botInfo?.ok || false,
      webhookSet: Boolean(webhook?.url),
      allowedUpdatesConfigured: missingUpdates.length === 0,
      missingUpdates: missingUpdates.length > 0 ? missingUpdates : undefined,
      kvConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
      adminChannelConfigured: Boolean(process.env.ADMIN_CHANNEL_ID),
    },
    hint: missingUpdates.length > 0
      ? 'Run GET /api/setup to configure webhook with correct allowed_updates'
      : undefined,
    error,
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasKV: !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
      hasAdminChannel: !!process.env.ADMIN_CHANNEL_ID,
    }
  });
}
