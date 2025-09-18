#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file!');
  process.exit(1);
}

async function checkBotStatus() {
  console.log('🤖 Checking bot status...\n');

  try {
    // Get bot info
    const meResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const meData = await meResponse.json();

    if (!meData.ok) {
      console.error('❌ Bot token is invalid!');
      console.error('Error:', meData.description);
      process.exit(1);
    }

    const bot = meData.result;
    console.log('✅ Bot Information:');
    console.log(`   Username: @${bot.username}`);
    console.log(`   Name: ${bot.first_name}`);
    console.log(`   ID: ${bot.id}`);
    console.log(`   Can join groups: ${bot.can_join_groups}`);
    console.log(`   Can read messages: ${bot.can_read_all_group_messages}`);
    console.log('');

    // Check webhook
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();

    if (webhookData.ok) {
      const webhook = webhookData.result;
      console.log('🔗 Webhook Status:');
      console.log(`   URL: ${webhook.url || 'Not set'}`);
      console.log(`   Has custom certificate: ${webhook.has_custom_certificate}`);
      console.log(`   Pending updates: ${webhook.pending_update_count}`);

      if (webhook.last_error_date) {
        const errorDate = new Date(webhook.last_error_date * 1000);
        console.log(`   ⚠️ Last error: ${webhook.last_error_message}`);
        console.log(`   Error date: ${errorDate.toISOString()}`);
      }

      if (webhook.last_synchronization_error_date) {
        const syncErrorDate = new Date(webhook.last_synchronization_error_date * 1000);
        console.log(`   ⚠️ Last sync error: ${syncErrorDate.toISOString()}`);
      }

      if (!webhook.url) {
        console.log('\n⚠️ Webhook is not configured! The bot won\'t receive updates.');
        console.log('Run the setup-webhook.js script to configure it.');
      }
    }

    // Check for updates (if webhook not set)
    if (!webhookData.result.url) {
      const updatesResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=1`);
      const updatesData = await updatesResponse.json();

      if (updatesData.ok && updatesData.result.length > 0) {
        console.log('\n📨 Recent update found (polling mode)');
      }
    }

    console.log('\n✅ Bot is properly configured and ready!');

  } catch (error) {
    console.error('❌ Error checking bot status:', error.message);
    process.exit(1);
  }
}

checkBotStatus();