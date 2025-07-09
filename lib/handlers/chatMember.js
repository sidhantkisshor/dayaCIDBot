import { checkJoinRateLimit } from '../utils/rateLimit.js';
import { logSecurity } from '../utils/logger.js';

export async function handleChatMember(update) {
  const { chat, new_chat_member, old_chat_member, date } = update;
  
  // Check if someone joined
  if (old_chat_member.status === 'left' && new_chat_member.status === 'member') {
    // Check for raid
    const isRaid = await checkJoinRateLimit(chat.id);
    if (isRaid) {
      logSecurity('POTENTIAL_RAID', {
        chat_id: chat.id,
        timestamp: date
      });
      
      // Could implement automatic chat lockdown here
      // For now, just log it
    }
  }
  
  // Log member changes for monitoring
  logSecurity('MEMBER_UPDATE', {
    chat_id: chat.id,
    user_id: new_chat_member.user.id,
    old_status: old_chat_member.status,
    new_status: new_chat_member.status
  });
}