// Trading-specific scam patterns
const SCAM_PATTERNS = [
  // Guaranteed profits
  { regex: /guaranteed\s+(profit|return|income|money)/i, score: 4 },
  { regex: /\b\d+%\s*(daily|weekly|monthly)\s*(profit|return|gain)/i, score: 4 },
  { regex: /risk[\s-]*free\s*(trading|investment|profit)/i, score: 3 },
  
  // Pump and dump
  { regex: /pump\s*(and\s*dump)?|moon\s*soon|to\s*the\s*moon/i, score: 3 },
  { regex: /buy\s*now\s*before|last\s*chance|don't\s*miss/i, score: 2 },
  { regex: /🚀{3,}|💎{3,}|🌙{3,}/i, score: 2 },
  
  // Fake signals/groups
  { regex: /vip\s*(signal|group|channel)|premium\s*(signal|membership)/i, score: 3 },
  { regex: /free\s*signal|accuracy\s*\d+%|win\s*rate\s*\d+%/i, score: 3 },
  { regex: /(whatsapp|telegram)\s*(group|channel)\s*link/i, score: 2 },
  
  // Investment scams
  { regex: /forex\s*robot|trading\s*bot\s*for\s*sale/i, score: 3 },
  { regex: /account\s*management|manage\s*your\s*(account|portfolio)/i, score: 3 },
  { regex: /send\s*(btc|eth|usdt|crypto)|deposit\s*required/i, score: 4 },
  
  // Urgency/pressure
  { regex: /limited\s*(time|offer|spots)|act\s*now|hurry\s*up/i, score: 2 },
  { regex: /only\s*\d+\s*(spots|slots|members)\s*left/i, score: 2 },
  
  // Contact solicitation
  { regex: /dm\s*me|message\s*me\s*privately|contact\s*admin/i, score: 2 },
  { regex: /wa\.me\/|t\.me\/joinchat|bit\.ly|tinyurl/i, score: 3 },
  
  // Fake testimonials
  { regex: /made\s*\$?\d+k?\s*in\s*\d+\s*(day|week|month)/i, score: 3 },
  { regex: /thank\s*you\s*admin|best\s*signal\s*provider/i, score: 2 },
  
  // Recovery scams
  { regex: /recover\s*(your\s*)?(lost|stolen)\s*(funds|crypto|money)/i, score: 4 },
  { regex: /hack(ed)?\s*account\s*recovery/i, score: 4 }
];

// Financial terms that need context checking
const FINANCIAL_TERMS = [
  'profit', 'signal', 'trading', 'investment', 'forex', 'crypto',
  'btc', 'eth', 'usdt', 'binance', 'coinbase', 'wallet'
];

export async function checkScam(message, userData) {
  let score = 0;
  const { text, caption, entities } = message;
  const content = (text || caption || '').toLowerCase();
  
  // 1. Check against scam patterns
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.regex.test(content)) {
      score += pattern.score;
    }
  }
  
  // 2. Context analysis for financial terms
  const financialTermCount = FINANCIAL_TERMS.filter(term => 
    content.includes(term)
  ).length;
  
  // High concentration of financial terms in short message
  if (content.length < 100 && financialTermCount > 3) {
    score += 2;
  }
  
  // 3. Check for number patterns (phone, account numbers)
  const numberPatterns = content.match(/\+?\d{10,}/g) || [];
  if (numberPatterns.length > 0) {
    score += 1;
    // Multiple numbers increase suspicion
    if (numberPatterns.length > 2) {
      score += 2;
    }
  }
  
  // 4. Username patterns
  const username = message.from.username || '';
  if (username) {
    // Common scammer username patterns
    if (/admin|support|official|trader\d+|signal/i.test(username)) {
      score += 1;
    }
  }
  
  // 5. Check for impersonation
  const displayName = message.from.first_name + (message.from.last_name || '');
  if (/admin|support|official|ceo|founder/i.test(displayName)) {
    score += 2;
  }
  
  // 6. Media with suspicious captions
  if (message.photo || message.document) {
    if (/proof|payment|screenshot|evidence/i.test(content)) {
      score += 1;
    }
  }
  
  // 7. New user with high-risk content
  const accountAge = Date.now() - (userData.first_seen || Date.now());
  const hoursOld = accountAge / (1000 * 60 * 60);
  
  if (hoursOld < 48 && score > 0) {
    // Amplify score for very new users
    score = Math.floor(score * 1.5);
  }
  
  // 8. Check message entities for suspicious links
  if (entities) {
    const links = entities.filter(e => e.type === 'url' || e.type === 'text_link');
    for (const link of links) {
      const url = link.url || content.substring(link.offset, link.offset + link.length);
      if (await isSuspiciousUrl(url)) {
        score += 3;
      }
    }
  }
  
  return Math.min(score, 10); // Cap at 10
}

async function isSuspiciousUrl(url) {
  const suspicious = [
    // URL shorteners
    'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
    // Suspicious domains
    'wa.me', // WhatsApp
    't.me/joinchat', // Telegram private groups
    // Common scam domains (this would be a larger list in production)
    'get-rich-quick', 'easy-money', 'guaranteed-profit'
  ];
  
  return suspicious.some(domain => url.includes(domain));
}