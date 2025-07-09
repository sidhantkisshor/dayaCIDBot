import { bot, isAdmin } from '../bot/index.js';
import { getUserData, setUserTrusted, setUserRestriction } from '../database/users.js';
import { getDatabase } from '../database/index.js';

export async function processCommand(message) {
  const { text, chat, from } = message;
  const [command, ...args] = text.split(' ');
  const baseCommand = command.replace(`@${process.env.BOT_USERNAME}`, '');
  
  switch (baseCommand) {
    case '/start':
      await handleStart(message);
      break;
    case '/help':
      await handleHelp(message);
      break;
    case '/stats':
      await handleStats(message);
      break;
    case '/report':
      await handleReport(message);
      break;
    case '/trust':
      await handleTrust(message);
      break;
    case '/restrict':
      await handleRestrict(message);
      break;
    case '/settings':
      await handleSettings(message);
      break;
    default:
      // Unknown command, ignore
      break;
  }
}

async function handleStart(message) {
  const { chat, from } = message;
  
  if (chat.type === 'private') {
    await bot.sendMessage(
      chat.id,
      `👋 Hello ${from.first_name}!\n\n` +
      `I'm DayaCID Bot - Community Integrity Defense for trading groups.\n\n` +
      `🛡️ **My Features:**\n` +
      `• Advanced spam detection\n` +
      `• Trading scam prevention\n` +
      `• New member verification\n` +
      `• Raid protection\n\n` +
      `Add me to your trading group as an admin to get started!`,
      { parse_mode: 'Markdown' }
    );
  } else {
    // In group, just acknowledge
    await bot.sendMessage(chat.id, "👋 I'm ready to protect this community!");
  }
}

async function handleHelp(message) {
  const { chat, from } = message;
  const isUserAdmin = await isAdmin(chat.id, from.id);
  
  let helpText = `📚 **Available Commands:**\n\n` +
    `/help - Show this message\n` +
    `/report - Report a message as spam/scam\n`;
  
  if (isUserAdmin) {
    helpText += `\n**Admin Commands:**\n` +
      `/stats - View group statistics\n` +
      `/trust @user - Mark user as trusted\n` +
      `/restrict @user - Manually restrict a user\n` +
      `/settings - Configure bot settings\n`;
  }
  
  await bot.sendMessage(chat.id, helpText, { parse_mode: 'Markdown' });
}

async function handleStats(message) {
  const { chat, from } = message;
  
  if (!await isAdmin(chat.id, from.id)) {
    await bot.sendMessage(chat.id, "❌ This command is for admins only.");
    return;
  }
  
  // Gather statistics
  const db = getDatabase();
  // This would need proper implementation with your database
  
  await bot.sendMessage(
    chat.id,
    `📊 **Group Statistics**\n\n` +
    `• Total members: ${(await bot.getChatMemberCount(chat.id))}\n` +
    `• Protected from spam: Many\n` +
    `• Active protection: ✅\n\n` +
    `More detailed stats coming soon!`,
    { parse_mode: 'Markdown' }
  );
}

async function handleReport(message) {
  const { chat, from, reply_to_message } = message;
  
  if (!reply_to_message) {
    await bot.sendMessage(
      chat.id,
      "ℹ️ Reply to a message with /report to report it as spam/scam."
    );
    return;
  }
  
  // Log the report
  console.log('Report received:', {
    reporter: from.id,
    reported_user: reply_to_message.from.id,
    message_id: reply_to_message.message_id
  });
  
  await bot.sendMessage(
    chat.id,
    "✅ Thank you for the report. We'll review it.",
    { reply_to_message_id: message.message_id }
  );
}

async function handleTrust(message) {
  const { chat, from, text } = message;
  
  if (!await isAdmin(chat.id, from.id)) {
    await bot.sendMessage(chat.id, "❌ This command is for admins only.");
    return;
  }
  
  // Extract mentioned user
  const mention = message.entities?.find(e => e.type === 'mention' || e.type === 'text_mention');
  if (!mention) {
    await bot.sendMessage(chat.id, "ℹ️ Usage: /trust @username");
    return;
  }
  
  // For text_mention, we have the user object
  if (mention.type === 'text_mention') {
    await setUserTrusted(mention.user.id, chat.id, true);
    await bot.sendMessage(
      chat.id,
      `✅ User ${mention.user.first_name} is now trusted.`
    );
  } else {
    // For @username mentions, we'd need to resolve the username
    await bot.sendMessage(
      chat.id,
      "ℹ️ Please use /trust with a direct user mention (not username)."
    );
  }
}

async function handleRestrict(message) {
  const { chat, from } = message;
  
  if (!await isAdmin(chat.id, from.id)) {
    await bot.sendMessage(chat.id, "❌ This command is for admins only.");
    return;
  }
  
  const mention = message.entities?.find(e => e.type === 'text_mention');
  if (!mention) {
    await bot.sendMessage(chat.id, "ℹ️ Usage: /restrict @user");
    return;
  }
  
  const targetUser = mention.user;
  await setUserRestriction(targetUser.id, chat.id, true);
  
  await bot.restrictChatMember(chat.id, targetUser.id, {
    can_send_messages: false,
    until_date: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  });
  
  await bot.sendMessage(
    chat.id,
    `⚠️ User ${targetUser.first_name} has been restricted for 1 hour.`
  );
}

async function handleSettings(message) {
  const { chat, from } = message;
  
  if (!await isAdmin(chat.id, from.id)) {
    await bot.sendMessage(chat.id, "❌ This command is for admins only.");
    return;
  }
  
  await bot.sendMessage(
    chat.id,
    `⚙️ **Bot Settings**\n\n` +
    `• CAPTCHA: ${process.env.ENABLE_CAPTCHA === 'true' ? '✅' : '❌'}\n` +
    `• Link Checking: ${process.env.ENABLE_LINK_CHECKING === 'true' ? '✅' : '❌'}\n` +
    `• Max Messages/Min: ${process.env.MAX_MESSAGES_PER_MINUTE}\n` +
    `• New User Restriction: ${process.env.NEW_USER_RESTRICTION_HOURS}h\n\n` +
    `Settings can be configured through environment variables.`,
    { parse_mode: 'Markdown' }
  );
}