// Comprehensive spam and scam detection patterns

// ============ SPAM PATTERNS ============
export const SPAM_PATTERNS = {
  // Crypto/Trading Scams
  CRYPTO_SCAMS: [
    { regex: /guaranteed\s+(profit|return|income|money|gains?)/gi, score: 5 },
    { regex: /\b\d{2,3}%\s*(daily|weekly|monthly|hourly)\s*(profit|return|gain|income)/gi, score: 5 },
    { regex: /risk[\s-]*free\s*(trading|investment|profit|income)/gi, score: 4 },
    { regex: /(double|triple|10x|100x)\s*your\s*(money|investment|capital|btc|eth)/gi, score: 5 },
    { regex: /passive\s*income\s*\$?\d+/gi, score: 4 },
    { regex: /earn\s*\$?\d+\s*(daily|per\s*day|weekly|monthly)/gi, score: 4 },
    { regex: /minimum\s*(investment|deposit)\s*\$?\d+/gi, score: 4 },
  ],

  // Pump & Dump Schemes
  PUMP_DUMP: [
    { regex: /pump\s*(and\s*)?dump/gi, score: 5 },
    { regex: /moon\s*soon|to\s*the\s*moon|mooning/gi, score: 3 },
    { regex: /buy\s*(now|the\s*dip)\s*before/gi, score: 3 },
    { regex: /last\s*chance|don'?t\s*miss\s*out?|final\s*opportunity/gi, score: 3 },
    { regex: /🚀{3,}|💎{3,}|🌙{3,}|🔥{3,}|💰{3,}/g, score: 3 },
    { regex: /HODL|diamond\s*hands?|paper\s*hands?/gi, score: 2 },
  ],

  // Signal/Group Scams
  SIGNAL_SCAMS: [
    { regex: /vip\s*(signal|group|channel|membership|access)/gi, score: 4 },
    { regex: /(premium|paid|exclusive)\s*(signal|group|channel|membership)/gi, score: 4 },
    { regex: /free\s*signals?\s*(group|channel)?/gi, score: 3 },
    { regex: /accuracy\s*\d{2,3}%|win\s*rate\s*\d{2,3}%|success\s*rate\s*\d{2,3}%/gi, score: 4 },
    { regex: /profitable\s*signals?|guaranteed\s*signals?/gi, score: 4 },
    { regex: /join\s*(my|our)\s*(whatsapp|telegram|discord)\s*(group|channel)/gi, score: 3 },
  ],

  // Investment/Trading Bots
  BOT_SCAMS: [
    { regex: /(forex|crypto|trading)\s*(robot|bot|ea|expert\s*advisor)/gi, score: 4 },
    { regex: /automated\s*trading\s*(system|software|bot)/gi, score: 3 },
    { regex: /account\s*management\s*service/gi, score: 4 },
    { regex: /(copy|mirror)\s*trading\s*service/gi, score: 3 },
    { regex: /ai\s*trading\s*(bot|system)|trading\s*ai/gi, score: 3 },
  ],

  // Urgency/Pressure Tactics
  URGENCY: [
    { regex: /limited\s*(time|offer|spots?|seats?|availability)/gi, score: 3 },
    { regex: /act\s*now|hurry\s*up?|don'?t\s*wait|quick|fast/gi, score: 2 },
    { regex: /only\s*\d+\s*(spots?|slots?|seats?|members?)\s*(left|remaining|available)/gi, score: 3 },
    { regex: /expires?\s*(in|soon|today|tonight|tomorrow)/gi, score: 2 },
    { regex: /(first|next)\s*\d+\s*(people|members?|users?)/gi, score: 2 },
  ],

  // Contact Solicitation
  CONTACT_HARVEST: [
    { regex: /dm\s*me|message\s*me\s*(privately|directly)/gi, score: 3 },
    { regex: /contact\s*(me|admin|support)\s*(on|via)?/gi, score: 3 },
    { regex: /add\s*me\s*on\s*(whatsapp|telegram|wechat|line)/gi, score: 4 },
    { regex: /text\s*me\s*@|reach\s*out\s*to\s*@/gi, score: 3 },
    { regex: /for\s*more\s*info(rmation)?\s*(dm|message|contact)/gi, score: 3 },
  ],

  // Fake Testimonials
  FAKE_TESTIMONIALS: [
    { regex: /made\s*\$?\d+k?\s*in\s*\d+\s*(days?|weeks?|months?|hours?)/gi, score: 4 },
    { regex: /withdrew\s*\$?\d+\s*(successfully|today|yesterday)/gi, score: 3 },
    { regex: /thank\s*you\s*(admin|sir|ma'?am|boss)/gi, score: 3 },
    { regex: /best\s*(signal|admin|group|channel)\s*(provider|ever)?/gi, score: 2 },
    { regex: /legit\s*(100%|platform|admin|trader)/gi, score: 3 },
    { regex: /paying\s*(platform|site|admin)|payment\s*received/gi, score: 3 },
  ],

  // Recovery Scams
  RECOVERY_SCAMS: [
    { regex: /recover\s*(your\s*)?(lost|stolen)\s*(funds?|crypto|money|bitcoin|assets?)/gi, score: 5 },
    { regex: /hack(ed|er)?\s*accounts?\s*recovery/gi, score: 5 },
    { regex: /funds?\s*recovery\s*(service|expert|specialist)/gi, score: 5 },
    { regex: /get\s*back\s*your\s*(lost|stolen)\s*(funds?|money|crypto)/gi, score: 5 },
  ],

  // Phone Numbers & Emails
  CONTACT_INFO: [
    { regex: /\+?\d{10,15}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, score: 2 },
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, score: 2 },
    { regex: /whatsapp\.com\/|wa\.me\/\d+/gi, score: 4 },
    { regex: /call\s*me\s*on\s*\+?\d+/gi, score: 3 },
  ],

  // Giveaway Scams
  GIVEAWAY_SCAMS: [
    { regex: /(free|exclusive)\s*giveaway/gi, score: 3 },
    { regex: /claim\s*your\s*(free|prize|reward|bonus)/gi, score: 4 },
    { regex: /you\s*(won|win|selected|chosen)/gi, score: 4 },
    { regex: /congratulations?\s*you/gi, score: 3 },
    { regex: /click\s*(here|link|below)\s*to\s*(claim|receive|get)/gi, score: 4 },
  ],

  // Adult/Dating Scams
  ADULT_CONTENT: [
    { regex: /hot\s*(girls?|women|ladies)|sexy\s*(girls?|pics?|videos?)/gi, score: 5 },
    { regex: /only\s*fans?|onlyfans/gi, score: 4 },
    { regex: /nude|naked|xxx|porn/gi, score: 5 },
    { regex: /dating\s*(site|app)|meet\s*(girls?|women|singles)/gi, score: 3 },
    { regex: /click\s*to\s*see\s*(more|pics?|photos?|videos?)/gi, score: 3 },
  ],

  // Loan/Credit Scams
  LOAN_SCAMS: [
    { regex: /instant\s*(loan|credit|approval)|loan\s*approved/gi, score: 4 },
    { regex: /no\s*(credit\s*check|collateral|documents?)/gi, score: 4 },
    { regex: /get\s*\$?\d+\s*(loan|credit)\s*(today|now|instantly)/gi, score: 4 },
    { regex: /loan\s*offer|we\s*offer\s*loans?/gi, score: 3 },
  ],

  // MLM/Pyramid Schemes
  MLM_SCHEMES: [
    { regex: /recruit\s*\d+\s*(people|members?|friends?)/gi, score: 4 },
    { regex: /multi[\s-]*level\s*marketing|mlm/gi, score: 5 },
    { regex: /pyramid\s*scheme|ponzi/gi, score: 5 },
    { regex: /refer\s*(and\s*)?earn|referral\s*bonus/gi, score: 3 },
    { regex: /downline|upline|binary\s*matrix/gi, score: 4 },
  ],
};

// ============ URL PATTERNS ============
export const SUSPICIOUS_URLS = {
  // URL Shorteners
  SHORTENERS: [
    'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
    'short.link', 'tiny.cc', 'lnkd.in', 'db.tt', 'qr.ae', 'adf.ly',
    'bc.vc', 'bit.do', 'mcaf.ee', 'su.pr', 'po.st', 'bl.ink'
  ],

  // Suspicious Domains
  SUSPICIOUS_DOMAINS: [
    'wa.me', // WhatsApp
    't.me/joinchat', // Telegram private groups
    'discord.gg', // Discord invites
    'telegram.me', 'telegram.dog', // Alternative Telegram domains
  ],

  // Common Scam Keywords in URLs
  SCAM_URL_KEYWORDS: [
    'get-rich-quick', 'easy-money', 'guaranteed-profit',
    'free-bitcoin', 'crypto-giveaway', 'investment-opportunity',
    'make-money-online', 'work-from-home', 'passive-income',
    'financial-freedom', 'binary-options', 'forex-signals'
  ],

  // Phishing Patterns (typosquatting)
  PHISHING_PATTERNS: [
    /b[il1]nance/gi, // Binance typos
    /co[il1]nbase/gi, // Coinbase typos
    /krak[e3]n/gi, // Kraken typos
    /[il1]nstagram/gi, // Instagram typos
    /whatsa[p]+/gi, // WhatsApp typos
    /tel[e3]gram/gi, // Telegram typos
  ],
};

// ============ HELPER FUNCTIONS ============
export function checkPatterns(content, patterns) {
  let totalScore = 0;
  const matches = [];

  for (const category in patterns) {
    for (const pattern of patterns[category]) {
      if (pattern.regex.test(content)) {
        totalScore += pattern.score;
        matches.push({
          category,
          pattern: pattern.regex.source,
          score: pattern.score
        });
      }
    }
  }

  return { totalScore, matches };
}

export function checkSuspiciousUrl(url) {
  const lowerUrl = url.toLowerCase();

  // Check URL shorteners
  for (const shortener of SUSPICIOUS_URLS.SHORTENERS) {
    if (lowerUrl.includes(shortener)) {
      return { suspicious: true, reason: 'URL shortener detected', score: 3 };
    }
  }

  // Check suspicious domains
  for (const domain of SUSPICIOUS_URLS.SUSPICIOUS_DOMAINS) {
    if (lowerUrl.includes(domain)) {
      return { suspicious: true, reason: 'Suspicious domain', score: 3 };
    }
  }

  // Check scam keywords
  for (const keyword of SUSPICIOUS_URLS.SCAM_URL_KEYWORDS) {
    if (lowerUrl.includes(keyword)) {
      return { suspicious: true, reason: 'Scam keyword in URL', score: 4 };
    }
  }

  // Check phishing patterns
  for (const pattern of SUSPICIOUS_URLS.PHISHING_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      return { suspicious: true, reason: 'Possible phishing URL', score: 5 };
    }
  }

  return { suspicious: false, score: 0 };
}

// ============ USERNAME/DISPLAY NAME PATTERNS ============
export const SUSPICIOUS_USERNAMES = {
  patterns: [
    /admin|support|official|help|service/gi,
    /trader\d+|signal\d+|profit\d+/gi,
    /ceo|founder|manager|expert/gi,
    /^(binance|coinbase|kraken|telegram)/gi,
    /customer[\s_-]?(service|support)/gi,
    /verified[\s_-]?account/gi,
  ],
  score: 2
};

// ============ EMOJI SPAM PATTERNS ============
export const EMOJI_SPAM = {
  // Excessive use of specific emojis
  patterns: [
    { regex: /[🚀💎🌙🔥💰💸💵💴💶💷]{5,}/g, score: 3 },
    { regex: /[❤️😍🥰😘💋]{5,}/g, score: 2 },
    { regex: /[⚠️🚨⛔️🔴❗️]{3,}/g, score: 2 },
  ],
  // Overall emoji density check
  maxEmojiRatio: 0.3, // More than 30% emojis is suspicious
  excessiveEmojiScore: 3
};