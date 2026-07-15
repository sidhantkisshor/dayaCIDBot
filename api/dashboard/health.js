// api/dashboard/health.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { TOKEN, KV_REST_API_URL, KV_REST_API_TOKEN } from '../../lib/config.js';
import { getActiveChats } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  let botInfo = null;
  let webhookInfo = null;

  try {
    const [botResp, webhookResp] = await Promise.all([
      fetch(`https://api.telegram.org/bot${TOKEN}/getMe`),
      fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`)
    ]);
    botInfo = await botResp.json();
    webhookInfo = await webhookResp.json();
  } catch {
    // Handled below
  }

  // Test KV connectivity
  let kvStatus = 'not_configured';
  if (KV_REST_API_URL) {
    try {
      const resp = await fetch(`${KV_REST_API_URL}/ping`, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
      const data = await resp.json();
      kvStatus = data.result === 'PONG' ? 'connected' : 'error';
    } catch {
      kvStatus = 'error';
    }
  }

  const webhook = webhookInfo?.result;
  const activeChats = await getActiveChats();

  return res.status(200).json({
    bot: {
      status: botInfo?.ok ? 'online' : 'offline',
      info: botInfo?.result || null,
    },
    webhook: {
      url: webhook?.url || null,
      pendingUpdates: webhook?.pending_update_count || 0,
      lastError: webhook?.last_error_message || null,
      lastErrorDate: webhook?.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : null,
    },
    kv: { status: kvStatus },
    activeChats: Object.keys(activeChats).length,
    activeChatList: activeChats,
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasKV: !!KV_REST_API_URL,
      hasAdminChannel: !!process.env.ADMIN_CHANNEL_ID,
      hasDashboardSecret: !!process.env.DASHBOARD_SECRET,
    },
    timestamp: new Date().toISOString(),
  });
});
