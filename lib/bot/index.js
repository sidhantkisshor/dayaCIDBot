import TelegramBot from 'node-telegram-bot-api';

// Create bot instance (webhook mode for Vercel)
export const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Bot commands for BotFather
export const BOT_COMMANDS = [
  { command: 'start', description: 'Start the bot' },
  { command: 'help', description: 'Show help message' },
  { command: 'stats', description: 'Show group statistics (admin only)' },
  { command: 'report', description: 'Report a message as spam/scam' },
  { command: 'trust', description: 'Mark a user as trusted (admin only)' },
  { command: 'restrict', description: 'Restrict a user (admin only)' },
  { command: 'settings', description: 'Configure bot settings (admin only)' }
];

// Helper functions for common bot operations
export async function isAdmin(chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ['creator', 'administrator'].includes(member.status);
  } catch (error) {
    return false;
  }
}

export async function sendMessage(chatId, text, options = {}) {
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      ...options
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

export async function deleteMessage(chatId, messageId) {
  try {
    return await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    console.error('Failed to delete message:', error);
    throw error;
  }
}

export async function restrictUser(chatId, userId, options = {}) {
  try {
    return await bot.restrictChatMember(chatId, userId, options);
  } catch (error) {
    console.error('Failed to restrict user:', error);
    throw error;
  }
}