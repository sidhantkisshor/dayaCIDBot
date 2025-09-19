#!/usr/bin/env node

import fetch from 'node-fetch';

const BOT_TOKEN = '7660494644:AAE1U_K5IXqGoQQ2NbrqXJkQaonRm9z2KpU';
const WEBHOOK_URL = 'https://dayacidbot-g3xb0hink-sidhants-projects-bb2d31ab.vercel.app/api/webhook';

async function setupWebhook() {
    console.log('🔗 Setting up Telegram webhook...\n');

    try {
        // First, get bot info to verify token
        const meResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const meData = await meResponse.json();

        if (!meData.ok) {
            console.error('❌ Bot token is invalid!');
            process.exit(1);
        }

        console.log('✅ Bot verified:');
        console.log(`   Username: @${meData.result.username}`);
        console.log(`   Name: ${meData.result.first_name}`);
        console.log('');

        // Set the webhook
        console.log('📡 Setting webhook URL...');
        const setWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

        const webhookResponse = await fetch(setWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: WEBHOOK_URL,
                allowed_updates: ['message', 'callback_query', 'inline_query', 'chat_member', 'my_chat_member'],
                drop_pending_updates: false
            })
        });

        const webhookData = await webhookResponse.json();

        if (webhookData.ok) {
            console.log('✅ Webhook set successfully!');
            console.log(`   URL: ${WEBHOOK_URL}`);
        } else {
            console.error('❌ Failed to set webhook:', webhookData.description);
            process.exit(1);
        }

        // Verify webhook
        console.log('\n🔍 Verifying webhook...');
        const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const infoData = await infoResponse.json();

        if (infoData.ok) {
            const info = infoData.result;
            console.log('📊 Webhook Info:');
            console.log(`   URL: ${info.url}`);
            console.log(`   Pending updates: ${info.pending_update_count}`);

            if (info.last_error_date) {
                console.log(`   ⚠️ Last error: ${info.last_error_message}`);
            }
        }

        console.log('\n✅ Webhook setup complete!');
        console.log('Your bot is now connected to the Vercel deployment.');
        console.log('\n📱 Test your bot by:');
        console.log('1. Adding it to a Telegram group');
        console.log('2. Granting admin permissions');
        console.log('3. Sending messages to test spam detection');

    } catch (error) {
        console.error('❌ Error setting up webhook:', error.message);
        process.exit(1);
    }
}

setupWebhook();