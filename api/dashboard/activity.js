// api/dashboard/activity.js
import { withAuth } from '../../lib/dashboardAuth.js';
import { getActivity } from '../../lib/state.js';

export default withAuth(async (req, res) => {
  const limit = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  const activity = await getActivity(limit);

  return res.status(200).json({
    activity,
    count: activity.length,
    timestamp: new Date().toISOString(),
  });
});
