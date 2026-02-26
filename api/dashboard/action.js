// api/dashboard/action.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { banUser, unbanUser } from '../../lib/telegram.js';
import { setTrusted, deleteWarnings, clearReports, setConfigOverride, getConfigOverrides } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { action, chatId, userId, key, value } = req.body || {};

  switch (action) {
    case 'ban': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      const result = await banUser(chatId, userId);
      return res.status(200).json({ ok: result?.ok || false, action: 'ban' });
    }

    case 'unban': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      const result = await unbanUser(chatId, userId);
      await deleteWarnings(chatId, userId);
      clearReports(chatId, userId);
      return res.status(200).json({ ok: result?.ok || false, action: 'unban' });
    }

    case 'trust': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      await setTrusted(chatId, userId, true);
      await deleteWarnings(chatId, userId);
      clearReports(chatId, userId);
      return res.status(200).json({ ok: true, action: 'trust' });
    }

    case 'untrust': {
      if (!chatId || !userId) return res.status(400).json({ error: 'chatId and userId required' });
      await setTrusted(chatId, userId, false);
      return res.status(200).json({ ok: true, action: 'untrust' });
    }

    case 'setConfig': {
      if (!key) return res.status(400).json({ error: 'key required' });
      await setConfigOverride(key, value);
      return res.status(200).json({ ok: true, action: 'setConfig', key, value });
    }

    case 'getConfig': {
      const config = await getConfigOverrides();
      return res.status(200).json({ ok: true, config });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});
