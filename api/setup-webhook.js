// Using native fetch in Node.js 18+

export default async function handler(req, res) {
  // Only allow POST requests from authorized users
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.TELEGRAM_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = `${process.env.VERCEL_URL}/api/telegram-webhook`;

  if (!botToken || !webhookUrl) {
    return res.status(500).json({ error: 'Missing configuration' });
  }

  try {
    // Set webhook
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query', 'inline_query', 'chat_member'],
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET
        })
      }
    );

    const result = await response.json();

    if (result.ok) {
      return res.status(200).json({ 
        success: true, 
        webhook_url: webhookUrl,
        message: 'Webhook configured successfully' 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: result.description 
      });
    }
  } catch (error) {
    console.error('Setup webhook error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}