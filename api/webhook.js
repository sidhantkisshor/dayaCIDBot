import crypto from 'crypto';
import { handleUpdate } from '../lib/handlers/index.js';
import { initializeDatabase } from '../lib/database/index.js';
import { verifyWebhookSecret } from '../lib/utils/security.js';

// Initialize database connection
await initializeDatabase();

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook secret if configured
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && !verifyWebhookSecret(req, secret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the update from Telegram
    const update = req.body;

    // Validate update structure
    if (!update || (!update.message && !update.callback_query && !update.inline_query)) {
      return res.status(400).json({ error: 'Invalid update format' });
    }

    // Process the update
    await handleUpdate(update);

    // Always return 200 OK to Telegram
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Telegram from retrying
    return res.status(200).json({ ok: true, error: 'Internal error' });
  }
}

// Vercel configuration
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};