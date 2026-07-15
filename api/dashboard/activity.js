// api/dashboard/activity.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { getActivity } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  let limit = parseInt(req.query?.limit || '50', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 200);
  const activity = await getActivity(limit);

  return res.status(200).json({
    activity,
    count: activity.length,
    timestamp: new Date().toISOString(),
  });
});
