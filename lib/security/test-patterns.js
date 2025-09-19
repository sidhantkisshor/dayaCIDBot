#!/usr/bin/env node

// Test script to validate spam/scam patterns
import { SPAM_PATTERNS, checkPatterns, checkSuspiciousUrl } from './patterns.js';

const TEST_MESSAGES = [
  // Crypto scams
  "💰 Guaranteed 100% daily profit! Join our VIP signal group",
  "🚀🚀🚀 TO THE MOON! Buy now before it's too late! 💎💎💎",
  "Earn $5000 weekly with our forex trading bot",
  "Risk-free investment opportunity - double your bitcoin in 24 hours",

  // Contact harvesting
  "DM me for more information about passive income",
  "Add me on WhatsApp +1234567890 for exclusive signals",
  "Contact admin @crypto_expert for account management",

  // Fake testimonials
  "I made $10k in just 3 days! Thank you admin!",
  "Best signal provider ever! 98% accuracy rate",
  "Withdrew $5000 successfully today. This platform is legit 100%",

  // Recovery scams
  "We can recover your lost crypto funds",
  "Hacked account recovery service available",

  // Giveaways
  "Congratulations! You won 1 BTC. Click here to claim",
  "Free giveaway - claim your prize now",

  // Adult content
  "Hot girls waiting for you, click to see more",
  "OnlyFans exclusive content",

  // MLM/Pyramid
  "Recruit 5 friends and earn $1000 bonus",
  "Multi-level marketing opportunity",

  // Normal messages (should have low scores)
  "Hey, how's the market today?",
  "Bitcoin is trading at $50,000",
  "I think we should wait for a better entry point",
  "The Fed meeting is tomorrow",
];

const TEST_URLS = [
  "https://bit.ly/get-rich-quick",
  "http://tinyurl.com/crypto-signals",
  "https://wa.me/1234567890",
  "https://t.me/joinchat/ABC123",
  "https://b1nance.com/trade", // Typosquatting
  "https://guaranteed-profit.com",
  "https://google.com", // Normal URL
  "https://bitcoin.org", // Normal URL
];

console.log("🔍 Testing Spam/Scam Patterns\n");
console.log("=" .repeat(60));

// Test messages
console.log("\n📝 Testing Messages:\n");
for (const message of TEST_MESSAGES) {
  const result = checkPatterns(message, SPAM_PATTERNS);
  const severity = result.totalScore >= 7 ? "🔴 HIGH" :
                   result.totalScore >= 5 ? "🟠 MEDIUM" :
                   result.totalScore >= 3 ? "🟡 LOW" : "🟢 SAFE";

  console.log(`${severity} [Score: ${result.totalScore}]`);
  console.log(`Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

  if (result.matches.length > 0) {
    console.log(`Matches: ${result.matches.map(m => m.category).join(', ')}`);
  }
  console.log("-".repeat(40));
}

// Test URLs
console.log("\n🔗 Testing URLs:\n");
for (const url of TEST_URLS) {
  const result = checkSuspiciousUrl(url);
  const status = result.suspicious ? `🔴 SUSPICIOUS [Score: ${result.score}]` : "🟢 SAFE";

  console.log(`${status}: ${url}`);
  if (result.suspicious) {
    console.log(`Reason: ${result.reason}`);
  }
  console.log("-".repeat(40));
}

console.log("\n✅ Pattern testing complete!");
console.log("\nThreshold recommendations:");
console.log("  Score >= 7: High confidence spam/scam - DELETE & RESTRICT");
console.log("  Score >= 5: Medium confidence - DELETE message");
console.log("  Score >= 3: Low confidence - Monitor user");
console.log("  Score < 3:  Likely safe - No action");