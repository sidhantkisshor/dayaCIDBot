import { handleMessage } from './message.js';
import { handleCallbackQuery } from './callback.js';
import { handleChatMember } from './chatMember.js';
import { logUpdate } from '../utils/logger.js';

export async function handleUpdate(update) {
  try {
    // Log all updates for monitoring
    await logUpdate(update);

    // Route to appropriate handler
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.chat_member) {
      await handleChatMember(update.chat_member);
    } else if (update.my_chat_member) {
      // Bot was added/removed from a chat
      console.log('Bot membership changed:', update.my_chat_member);
    }
  } catch (error) {
    console.error('Update handling error:', error);
    throw error;
  }
}