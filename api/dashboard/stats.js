// api/dashboard/stats.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { getStats, getDailyStats, getActiveChats } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const activeChats = await getActiveChats();
  const chatIds = Object.keys(activeChats);

  // Aggregate stats across all chats
  const totals = { deleted: 0, banned: 0, muted: 0, warned: 0, captchaPassed: 0, captchaFailed: 0 };
  const perChat = {};

  for (const chatId of chatIds) {
    const stats = await getStats(chatId);
    perChat[chatId] = {
      title: activeChats[chatId]?.title || `Chat ${chatId}`,
      ...stats,
    };
    for (const key of Object.keys(totals)) {
      totals[key] += stats[key] || 0;
    }
  }

  // Daily trends (aggregate across all chats, last 7 days)
  const dailyTotals = [];
  if (chatIds.length > 0) {
    const allDaily = await Promise.all(chatIds.map(id => getDailyStats(id, 7)));
    const dateMap = {};
    for (const chatDaily of allDaily) {
      for (const day of chatDaily) {
        if (!dateMap[day.date]) {
          dateMap[day.date] = { date: day.date, deleted: 0, banned: 0, muted: 0, captchaPassed: 0, captchaFailed: 0 };
        }
        for (const k of ['deleted', 'banned', 'muted', 'captchaPassed', 'captchaFailed']) {
          dateMap[day.date][k] += day[k] || 0;
        }
      }
    }
    dailyTotals.push(...Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)));
  }

  return res.status(200).json({
    totals,
    perChat,
    daily: dailyTotals,
    captchaPassRate: totals.captchaPassed + totals.captchaFailed > 0
      ? Math.round((totals.captchaPassed / (totals.captchaPassed + totals.captchaFailed)) * 100)
      : null,
    timestamp: new Date().toISOString(),
  });
});
