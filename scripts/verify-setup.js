#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Verifying Bot Setup...\n');

// Check environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'BOT_USERNAME'
];

let allPresent = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar} is set`);
  } else {
    console.log(`❌ ${envVar} is missing`);
    allPresent = false;
  }
}

if (!allPresent) {
  console.log('\n❌ Missing required environment variables');
  process.exit(1);
}

// Verify webhook secret format
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
console.log(`\n🔐 Webhook Secret: ${webhookSecret}`);
console.log(`   Length: ${webhookSecret.length} characters`);
console.log(`   Format: ${/^[a-zA-Z0-9_]+$/.test(webhookSecret) ? 'Valid' : 'Contains special characters'}`);

// Test bot token
const botToken = process.env.TELEGRAM_BOT_TOKEN;
console.log('\n🤖 Testing Bot Connection...');

try {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
  const data = await response.json();
  
  if (data.ok) {
    console.log(`✅ Bot connected successfully!`);
    console.log(`   Name: ${data.result.first_name}`);
    console.log(`   Username: @${data.result.username}`);
    console.log(`   Can join groups: ${data.result.can_join_groups}`);
    console.log(`   Can read messages: ${data.result.can_read_all_group_messages}`);
  } else {
    console.log(`❌ Bot connection failed: ${data.description}`);
  }
} catch (error) {
  console.log(`❌ Bot connection error: ${error.message}`);
}

// Check webhook status
console.log('\n🌐 Checking Webhook Status...');
try {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const data = await response.json();
  
  if (data.ok) {
    const webhook = data.result;
    if (webhook.url) {
      console.log(`✅ Webhook is set to: ${webhook.url}`);
      console.log(`   Last error: ${webhook.last_error_message || 'None'}`);
      console.log(`   Pending updates: ${webhook.pending_update_count}`);
    } else {
      console.log(`ℹ️  No webhook configured yet`);
    }
  }
} catch (error) {
  console.log(`❌ Webhook check error: ${error.message}`);
}

console.log('\n✅ Setup verification complete!');
console.log('\nNext steps:');
console.log('1. Run "npm install" to install dependencies');
console.log('2. Deploy to Vercel with "vercel --prod"');
console.log('3. Set up webhook after deployment');