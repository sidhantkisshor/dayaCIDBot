import { extractDomain } from '../utils/security.js';

// Known suspicious domains and URL shorteners
const SUSPICIOUS_DOMAINS = new Set([
  // URL Shorteners (often used to hide malicious links)
  'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'short.link', 'shorte.st', 'adf.ly', 'bc.vc', 'soo.gd',
  
  // Messaging platforms (often used for off-platform scams)
  'wa.me', 'wa.link', 't.me/joinchat', 'discord.gg',
  
  // Known scam patterns
  'get-rich-quick', 'easy-money', 'guaranteed-profit',
  'free-signals', 'vip-signals', 'premium-signals'
]);

// Legitimate trading/finance domains
const WHITELIST_DOMAINS = new Set([
  // Major exchanges
  'binance.com', 'coinbase.com', 'kraken.com', 'ftx.com',
  'kucoin.com', 'huobi.com', 'okex.com', 'gate.io',
  
  // Trading platforms
  'tradingview.com', 'investing.com', 'bloomberg.com',
  'reuters.com', 'coinmarketcap.com', 'coingecko.com',
  
  // Social platforms (base domains)
  'twitter.com', 'youtube.com', 'medium.com', 'reddit.com'
]);

export async function scanLinks(message, linkEntities) {
  let totalScore = 0;
  const { text, caption } = message;
  const content = text || caption || '';
  
  for (const entity of linkEntities) {
    let url;
    
    if (entity.type === 'url') {
      // Extract URL from text
      url = content.substring(entity.offset, entity.offset + entity.length);
    } else if (entity.type === 'text_link') {
      // URL is in the entity
      url = entity.url;
    }
    
    if (!url) continue;
    
    // Normalize URL
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    const domain = extractDomain(url);
    if (!domain) continue;
    
    // Check whitelist first
    if (WHITELIST_DOMAINS.has(domain)) {
      continue; // No penalty for whitelisted domains
    }
    
    // Check suspicious domains
    if (SUSPICIOUS_DOMAINS.has(domain)) {
      totalScore += 3;
      continue;
    }
    
    // Check for suspicious patterns in domain
    if (domain.includes('-') && domain.split('-').length > 3) {
      // Many hyphens often indicate suspicious domains
      totalScore += 1;
    }
    
    // Check for IP addresses (often suspicious)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain)) {
      totalScore += 2;
    }
    
    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      totalScore += 2;
    }
    
    // Check URL path for suspicious patterns
    const urlPath = url.toLowerCase();
    const suspiciousPatterns = [
      'join', 'register', 'signup', 'promo', 'bonus',
      'ref=', 'referral', 'invite', 'aff='
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (urlPath.includes(pattern)) {
        totalScore += 1;
        break;
      }
    }
  }
  
  // New users posting links get extra scrutiny
  if (process.env.NEW_USER_LINK_BLOCK === 'true') {
    const accountAge = Date.now() - (message.from.created_at || 0);
    if (accountAge < 48 * 60 * 60 * 1000) { // 48 hours
      totalScore += 2;
    }
  }
  
  return Math.min(totalScore, 5); // Cap link score at 5
}

export async function checkUrlSafety(url) {
  // This could integrate with services like Google Safe Browsing API
  // or VirusTotal API for real-time URL checking
  // For now, we use our local checks
  
  const domain = extractDomain(url);
  if (!domain) return { safe: false, reason: 'Invalid URL' };
  
  if (WHITELIST_DOMAINS.has(domain)) {
    return { safe: true };
  }
  
  if (SUSPICIOUS_DOMAINS.has(domain)) {
    return { safe: false, reason: 'Known suspicious domain' };
  }
  
  return { safe: true }; // Default to safe if unknown
}