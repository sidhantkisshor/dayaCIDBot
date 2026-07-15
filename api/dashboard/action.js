// api/dashboard/action.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { banUser, unbanUser } from '../../lib/telegram.js';
import { setTrusted, deleteWarnings, clearReports, setConfigOverride, getConfigOverrides, getWarnings, isTrusted, getReportCount, getTrustedList } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { action, chatId, userId, key, value } = req.body || {};

  // Validate numeric IDs for user-targeting actions
  const ALLOWED_CONFIG_KEYS = ['SPAM_THRESHOLD', 'INSTANT_BAN_THRESHOLD', 'MAX_WARNINGS_BEFORE_BAN', 'FLOOD_THRESHOLD', 'BURST_THRESHOLD'];
  const CONFIG_KEY_RANGES = {
    SPAM_THRESHOLD: [1, 20],
    INSTANT_BAN_THRESHOLD: [1, 30],
    MAX_WARNINGS_BEFORE_BAN: [1, 10],
    FLOOD_THRESHOLD: [2, 20],
    BURST_THRESHOLD: [2, 10],
  };
  function validateIds() {
    const cid = Number(chatId);
    const uid = Number(userId);
    if (!Number.isFinite(cid) || !Number.isFinite(uid) || cid === 0 || uid === 0) {
      return null;
    }
    return { cid, uid };
  }

  switch (action) {
    case 'ban': {
      const ids = validateIds();
      if (!ids) return res.status(400).json({ error: 'Valid numeric chatId and userId required' });
      const result = await banUser(ids.cid, ids.uid);
      return res.status(200).json({ ok: result?.ok || false, action: 'ban' });
    }

    case 'unban': {
      const ids = validateIds();
      if (!ids) return res.status(400).json({ error: 'Valid numeric chatId and userId required' });
      const result = await unbanUser(ids.cid, ids.uid);
      if (result?.ok) {
        await deleteWarnings(ids.cid, ids.uid);
        clearReports(ids.cid, ids.uid);
      }
      return res.status(200).json({
        ok: result?.ok || false,
        action: 'unban',
        ...(result?.description ? { description: result.description } : {}),
      });
    }

    case 'trust': {
      const ids = validateIds();
      if (!ids) return res.status(400).json({ error: 'Valid numeric chatId and userId required' });
      await setTrusted(ids.cid, ids.uid, true);
      await deleteWarnings(ids.cid, ids.uid);
      clearReports(ids.cid, ids.uid);
      return res.status(200).json({ ok: true, action: 'trust' });
    }

    case 'untrust': {
      const ids = validateIds();
      if (!ids) return res.status(400).json({ error: 'Valid numeric chatId and userId required' });
      await setTrusted(ids.cid, ids.uid, false);
      return res.status(200).json({ ok: true, action: 'untrust' });
    }

    case 'setConfig': {
      if (!key || !ALLOWED_CONFIG_KEYS.includes(key)) {
        return res.status(400).json({ error: `Invalid config key. Allowed: ${ALLOWED_CONFIG_KEYS.join(', ')}` });
      }
      const numValue = Number(value);
      const [min, max] = CONFIG_KEY_RANGES[key];
      if (!Number.isFinite(numValue) || numValue < min || numValue > max) {
        return res.status(400).json({ error: `Value for ${key} must be a number between ${min} and ${max}` });
      }
      await setConfigOverride(key, numValue);
      return res.status(200).json({ ok: true, action: 'setConfig', key, value: numValue });
    }

    case 'getConfig': {
      const config = await getConfigOverrides();
      return res.status(200).json({ ok: true, config });
    }

    case 'getUser': {
      const ids = validateIds();
      if (!ids) return res.status(400).json({ error: 'Valid numeric chatId and userId required' });
      const [warnings, trusted] = await Promise.all([
        getWarnings(ids.cid, ids.uid),
        isTrusted(ids.cid, ids.uid),
      ]);
      // reports is in-memory + per-instance, so it's best-effort (may read 0 on a
      // cold serverless instance even if reports exist elsewhere).
      const reports = getReportCount(ids.cid, ids.uid);
      return res.status(200).json({ ok: true, action: 'getUser', warnings, trusted, reports });
    }

    case 'listTrusted': {
      const trusted = await getTrustedList();
      return res.status(200).json({ ok: true, action: 'listTrusted', trusted });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }
});
