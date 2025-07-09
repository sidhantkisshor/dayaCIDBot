import crypto from 'crypto';

export function verifyWebhookSecret(req, secret) {
  // Telegram sends the secret in X-Telegram-Bot-Api-Secret-Token header
  const providedSecret = req.headers['x-telegram-bot-api-secret-token'];
  return providedSecret === secret;
}

export function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

export function hashUserId(userId) {
  return crypto.createHash('sha256').update(String(userId)).digest('hex');
}

export function sanitizeText(text) {
  if (!text) return '';
  
  // Remove zero-width characters and other invisible Unicode
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\u2060\u2061\u2062\u2063\u2064]/g, '') // Invisible characters
    .trim();
}

export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return null;
  }
}