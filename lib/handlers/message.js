import { bot } from '../bot/index.js';
import { checkSpam } from '../security/spamDetector.js';
import { checkScam } from '../security/scamDetector.js';
import { handleNewUser } from '../security/newUserHandler.js';
import { processCommand } from './commands.js';
import { getUserData, updateUserActivity } from '../database/users.js';
import { addToMessageHistory } from '../database/messages.js';

export async function handleMessage(message) {
  const { chat, from, text, entities, new_chat_members } = message;
  
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
      await bot.deleteMessage(chat.id, message.message_id);
      return;
    } catch (error) {
      console.error('Failed to delete restricted user message:', error);
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
  const threshold = parseInt(process.env.SPAM_SCORE_THRESHOLD || '7');

  if (totalScore >= threshold) {
    // Take action based on score
    try {
      await bot.deleteMessage(chat.id, message.message_id);
      
      if (totalScore >= threshold * 1.5) {
        // High confidence - restrict user
        await bot.restrictChatMember(chat.id, from.id, {
          can_send_messages: false,
          until_date: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        });
        
        await bot.sendMessage(
          chat.id,
          `⚠️ User ${from.first_name} has been temporarily restricted for suspicious activity.`,
          { 
            reply_to_message_id: message.message_id,
            allow_sending_without_reply: true 
          }
        );
      }
    } catch (error) {
      console.error('Failed to handle spam/scam:', error);
    }
  }
}