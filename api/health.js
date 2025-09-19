export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  let botInfo = null;
  let webhookInfo = null;
  let error = null;

  try {
    // Check bot info
    const botResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    botInfo = await botResponse.json();

    // Check webhook info
    const webhookResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    webhookInfo = await webhookResponse.json();
  } catch (e) {
    error = e.message;
  }

  return res.status(200).json({
    status: botInfo?.ok ? 'connected' : 'disconnected',
    bot: botInfo?.result,
    webhook: webhookInfo?.result,
    error,
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      tokenLength: process.env.TELEGRAM_BOT_TOKEN?.length
    }
  });
}