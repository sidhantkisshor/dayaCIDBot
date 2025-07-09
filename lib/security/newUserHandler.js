import { bot } from '../bot/index.js';
import { createUser } from '../database/users.js';
import { generateCaptcha } from '../utils/captcha.js';

export async function handleNewUser(chatId, newMember, message) {
  try {
    // Skip if bot
    if (newMember.is_bot) {
      return;
    }

    // Create user record
    await createUser(newMember.id, chatId);

    // Check if CAPTCHA is enabled
    if (process.env.ENABLE_CAPTCHA === 'true') {
      await sendCaptchaChallenge(chatId, newMember, message);
    } else {
      // Just restrict new users
      await restrictNewUser(chatId, newMember.id);
      await sendWelcomeMessage(chatId, newMember, message);
    }

    // Delete the join message to keep chat clean
    try {
      await bot.deleteMessage(chatId, message.message_id);
    } catch (error) {
      console.error('Failed to delete join message:', error);
    }
  } catch (error) {
    console.error('Error handling new user:', error);
  }
}

async function sendCaptchaChallenge(chatId, user, originalMessage) {
  const captcha = generateCaptcha();
  
  // Restrict user until they pass CAPTCHA
  await bot.restrictChatMember(chatId, user.id, {
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false
  });

  const keyboard = {
    inline_keyboard: [[
      { text: captcha.options[0], callback_data: `captcha_${user.id}_${captcha.options[0]}` },
      { text: captcha.options[1], callback_data: `captcha_${user.id}_${captcha.options[1]}` },
      { text: captcha.options[2], callback_data: `captcha_${user.id}_${captcha.options[2]}` }
    ]]
  };

  const captchaMessage = await bot.sendMessage(
    chatId,
    `👋 Welcome ${user.first_name}!\n\n` +
    `🔐 Please complete this verification to join the group:\n\n` +
    `**${captcha.question}**\n\n` +
    `⏱ You have 2 minutes to answer.`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );

  // Store CAPTCHA data for verification
  await storeCaptchaData(user.id, chatId, captcha.answer, captchaMessage.message_id);

  // Set timeout to kick if not answered
  setTimeout(async () => {
    const userData = await getUserData(user.id, chatId);
    if (userData && !userData.verified) {
      try {
        await bot.banChatMember(chatId, user.id);
        await bot.deleteMessage(chatId, captchaMessage.message_id);
        
        // Unban after 30 seconds so they can try again
        setTimeout(() => bot.unbanChatMember(chatId, user.id), 30000);
      } catch (error) {
        console.error('Failed to remove unverified user:', error);
      }
    }
  }, 120000); // 2 minutes
}

async function restrictNewUser(chatId, userId) {
  const restrictionHours = parseInt(process.env.NEW_USER_RESTRICTION_HOURS || '24');
  const untilDate = Math.floor(Date.now() / 1000) + (restrictionHours * 3600);

  await bot.restrictChatMember(chatId, userId, {
    until_date: untilDate,
    can_send_messages: true,
    can_send_media_messages: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_send_polls: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false
  });
}

async function sendWelcomeMessage(chatId, user, originalMessage) {
  const welcomeText = 
    `👋 Welcome ${user.first_name} to our trading community!\n\n` +
    `📋 **New Member Guidelines:**\n` +
    `• No spam, scams, or unauthorized promotions\n` +
    `• No financial advice or guaranteed profit claims\n` +
    `• Respect all members and admins\n` +
    `• Links and media are restricted for new members\n\n` +
    `⏱ Restrictions will be lifted after 24 hours of good behavior.\n\n` +
    `Happy trading! 📈`;

  const welcomeMsg = await bot.sendMessage(chatId, welcomeText, {
    parse_mode: 'Markdown'
  });

  // Delete welcome message after 30 seconds
  setTimeout(() => {
    bot.deleteMessage(chatId, welcomeMsg.message_id).catch(() => {});
  }, 30000);
}

// Placeholder functions - implement with your database
async function storeCaptchaData(userId, chatId, answer, messageId) {
  // Store in database/cache
}

async function getUserData(userId, chatId) {
  // Get from database
  return { verified: false };
}