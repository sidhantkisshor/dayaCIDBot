import { bot } from '../bot/index.js';
import { getDatabase } from '../database/index.js';
import { markUserVerified } from '../database/users.js';

export async function handleCallbackQuery(query) {
  const { data, from, message } = query;
  
  try {
    // Answer callback to remove loading state
    await bot.answerCallbackQuery(query.id);
    
    // Handle CAPTCHA verification
    if (data.startsWith('captcha_')) {
      await handleCaptchaCallback(query);
    }
    // Add more callback handlers here as needed
    
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.answerCallbackQuery(query.id, {
      text: 'An error occurred. Please try again.',
      show_alert: true
    });
  }
}

async function handleCaptchaCallback(query) {
  const { data, from, message } = query;
  const [, targetUserId, answer] = data.split('_');
  
  // Verify this is the correct user
  if (from.id !== parseInt(targetUserId)) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ This verification is not for you!',
      show_alert: true
    });
    return;
  }
  
  const db = getDatabase();
  const captchaData = await db.getCaptcha(from.id, message.chat.id);
  
  if (!captchaData) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Verification expired. You will be removed.',
      show_alert: true
    });
    return;
  }
  
  if (answer === captchaData.answer) {
    // Correct answer - unrestrict user
    await bot.restrictChatMember(message.chat.id, from.id, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    });
    
    await markUserVerified(from.id, message.chat.id);
    await db.deleteCaptcha(from.id, message.chat.id);
    
    // Edit the message to show success
    await bot.editMessageText(
      `✅ Welcome ${from.first_name}! You have been verified.\n\n` +
      `Please read the pinned messages and follow our community rules.`,
      {
        chat_id: message.chat.id,
        message_id: message.message_id
      }
    );
    
    // Delete success message after 10 seconds
    setTimeout(() => {
      bot.deleteMessage(message.chat.id, message.message_id).catch(() => {});
    }, 10000);
    
  } else {
    // Wrong answer - kick user
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Incorrect answer. You will be removed.',
      show_alert: true
    });
    
    await bot.banChatMember(message.chat.id, from.id);
    await bot.deleteMessage(message.chat.id, message.message_id);
    
    // Unban after 30 seconds so they can try again
    setTimeout(() => {
      bot.unbanChatMember(message.chat.id, from.id).catch(() => {});
    }, 30000);
  }
}