// Dashboard authentication — validates DASHBOARD_SECRET Bearer token

export function validateDashboardAuth(req) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return { ok: false, error: 'DASHBOARD_SECRET not configured', status: 503 };

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing authorization header', status: 401 };
  }

  const token = auth.slice(7);
  if (token !== secret) {
    return { ok: false, error: 'Invalid token', status: 403 };
  }

  return { ok: true };
}

// Helper: wrap handler with auth check, returns JSON error if invalid
export function withAuth(handlerFn) {
  return async (req, res) => {
    // No CORS headers — dashboard is same-origin
    const auth = validateDashboardAuth(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    return handlerFn(req, res);
  };
}
