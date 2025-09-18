import { bot } from '../bot/index.js';
import { checkSpam } from '../security/spamDetector.js';
import { checkScam } from '../security/scamDetector.js';
import { handleNewUser } from '../security/newUserHandler.js';
import { processCommand } from './commands.js';
import { getUserData, updateUserActivity } from '../database/users.js';
import { addToMessageHistory } from '../database/messages.js';

export async function handleMessage(message) {
  const { chat, from, text, entities, new_chat_members } = message;

  // Log incoming message for debugging
  console.log(`[MESSAGE] Chat: ${chat.id}, User: ${from.id}, Text: ${text?.substring(0, 50) || 'no-text'}`)
  
  // Handle new members joining
  if (new_chat_members && new_chat_members.length > 0) {
    for (const newMember of new_chat_members) {
      await handleNewUser(chat.id, newMember, message);
    }
    return;
  }

  // Ignore messages from bots (except ourselves for testing)
  if (from.is_bot && from.username !== process.env.BOT_USERNAME) {
    return;
  }

  // Get or create user data
  const userData = await getUserData(from.id, chat.id);
  
  // Check if user is restricted
  if (userData.restricted) {
    // Delete message from restricted user
    try {
      console.log(`[DELETING] Restricted user ${from.id} message in chat ${chat.id}`);
      await bot.deleteMessage(chat.id, message.message_id);
      console.log(`[DELETED] Successfully deleted message from restricted user`);
      return;
    } catch (error) {
      console.error(`[DELETE FAILED] Chat: ${chat.id}, Message: ${message.message_id}, Error:`, error.message);
      // Check if bot has admin rights
      try {
        const botMember = await bot.getChatMember(chat.id, (await bot.getMe()).id);
        if (!['administrator', 'creator'].includes(botMember.status)) {
          console.error('[PERMISSION ERROR] Bot is not an admin in this chat!');
        }
      } catch (e) {
        console.error('[ERROR] Could not check bot permissions:', e.message);
      }
    }
  }

  // Update user activity
  await updateUserActivity(from.id, chat.id);

  // Store message for analysis
  await addToMessageHistory(from.id, chat.id, message);

  // Check for commands
  if (entities && entities.some(e => e.type === 'bot_command')) {
    await processCommand(message);
    return;
  }

  // Skip spam/scam checks for admins
  const chatMember = await bot.getChatMember(chat.id, from.id);
  if (['creator', 'administrator'].includes(chatMember.status)) {
    return;
  }

  // Run security checks
  const spamScore = await checkSpam(message, userData);
  const scamScore = await checkScam(message, userData);
  
  const totalScore = spamScore + scamScore;
  const threshold = parseInt(process.env.SPAM_SCORE_THRESHOLD || '5');

  console.log(`[SPAM CHECK] User: ${from.id}, Spam: ${spamScore}, Scam: ${scamScore}, Total: ${totalScore}, Threshold: ${threshold}`);

  if (totalScore >= threshold) {
    console.log(`[ACTION REQUIRED] Score ${totalScore} exceeds threshold ${threshold}`);
    // Take action based on score
    try {
      console.log(`[DELETING] Spam message from user ${from.id} in chat ${chat.id}`);
      await bot.deleteMessage(chat.id, message.message_id);
      console.log(`[DELETED] Successfully deleted spam message`);

      if (totalScore >= threshold * 1.5) {
        // High confidence - restrict user
        console.log(`[RESTRICTING] User ${from.id} with high spam score ${totalScore}`);
        await bot.restrictChatMember(chat.id, from.id, {
          can_send_messages: false,
          until_date: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        });
        console.log(`[RESTRICTED] User ${from.id} for 1 hour`);

        await bot.sendMessage(
          chat.id,
          `⚠️ User ${from.first_name} has been temporarily restricted for suspicious activity (Score: ${totalScore}).`,
          {
            reply_to_message_id: message.message_id,
            allow_sending_without_reply: true
          }
        );
      }
    } catch (error) {
      console.error(`[ACTION FAILED] Could not delete/restrict. Error:`, error.message);
      console.error('Full error:', error);

      // Check bot permissions
      try {
        const botInfo = await bot.getMe();
        const botMember = await bot.getChatMember(chat.id, botInfo.id);
        console.log(`[BOT STATUS] Bot (@${botInfo.username}) status in chat: ${botMember.status}`);
        if (!['administrator', 'creator'].includes(botMember.status)) {
          console.error('[CRITICAL] Bot needs admin rights to delete messages and restrict users!');
          await bot.sendMessage(
            chat.id,
            `❌ I need admin rights to delete spam messages and restrict users!`,
            { reply_to_message_id: message.message_id, allow_sending_without_reply: true }
          );
        }
      } catch (permError) {
        console.error('[ERROR] Could not check bot permissions:', permError.message);
      }
    }
  } else {
    console.log(`[PASS] Message score ${totalScore} below threshold ${threshold}`);
  }
}