import { bot } from '../bot/index.js';
import { checkSpam } from '../security/spamDetector.js';
import { checkScam } from '../security/scamDetector.js';
import { handleNewUser } from '../security/newUserHandler.js';
import { processCommand } from './commands.js';
import { getUserData, updateUserActivity } from '../database/users.js';
import { addToMessageHistory } from '../database/messages.js';
import { getDatabase } from '../database/index.js';

export async function handleMessage(message) {
  const { chat, from, text, entities, new_chat_members } = message;
  const db = getDatabase();

  // Log incoming message for debugging
  console.log(`[MESSAGE] Chat: ${chat.id}, User: ${from.id}, Text: ${text?.substring(0, 50) || 'no-text'}`);

  // Track statistics
  if (db.incrementStat) {
    await db.incrementStat('total_messages', 1);
    await db.markUserActive?.(from.id, chat.id);
  }
  
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

  // Log activity to database
  if (db.logActivity) {
    await db.logActivity({
      username: from.username || from.first_name,
      userId: from.id,
      chatId: chat.id,
      message: text?.substring(0, 100) || '',
      score: totalScore,
      action: totalScore >= threshold ? 'detected' : 'allowed'
    });
  }

  if (totalScore >= threshold) {
    console.log(`[ACTION REQUIRED] Score ${totalScore} exceeds threshold ${threshold}`);

    // Track spam statistics
    if (db.incrementStat) {
      await db.incrementStat('spam_detected', 1);
    }

    // Track pattern matches (if we have them from the spam check)
    if (db.incrementPatternMatch && message._patternMatches) {
      for (const match of message._patternMatches) {
        await db.incrementPatternMatch(match.category);
      }
    }

    // Take action based on score
    try {
      console.log(`[DELETING] Spam message from user ${from.id} in chat ${chat.id}`);
      await bot.deleteMessage(chat.id, message.message_id);
      console.log(`[DELETED] Successfully deleted spam message`);

      // Update activity log
      if (db.logActivity) {
        await db.logActivity({
          username: from.username || from.first_name,
          userId: from.id,
          chatId: chat.id,
          message: text?.substring(0, 100) || '',
          score: totalScore,
          action: 'deleted'
        });
      }

      // Auto-ban for high scores
      if (totalScore >= threshold * 1.5) {
        // High confidence - BAN user permanently
        console.log(`[BANNING] User ${from.id} with high spam score ${totalScore}`);

        try {
          // Ban the user (kick and can't return)
          await bot.banChatMember(chat.id, from.id);
          console.log(`[BANNED] User ${from.id} permanently banned`);

          // Update activity log
          if (db.logActivity) {
            await db.logActivity({
              username: from.username || from.first_name,
              userId: from.id,
              chatId: chat.id,
              message: 'User permanently banned for spam',
              score: totalScore,
              action: 'banned'
            });
          }

          await bot.sendMessage(
            chat.id,
            `🚫 User ${from.first_name} has been permanently banned for spam/scam activity (Score: ${totalScore}).`,
            {
              reply_to_message_id: message.message_id,
              allow_sending_without_reply: true
            }
          );
        } catch (banError) {
          console.error(`[BAN FAILED] Could not ban user ${from.id}:`, banError.message);
        }
      } else if (totalScore >= threshold * 1.2) {
        // Medium confidence - restrict for 24 hours
        console.log(`[RESTRICTING] User ${from.id} with spam score ${totalScore}`);
        await bot.restrictChatMember(chat.id, from.id, {
          can_send_messages: false,
          until_date: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        });
        console.log(`[RESTRICTED] User ${from.id} for 24 hours`);

        await bot.sendMessage(
          chat.id,
          `⚠️ User ${from.first_name} has been restricted for 24 hours for suspicious activity.`,
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

    // Publish event for real-time dashboard
    if (db.publishEvent) {
      await db.publishEvent('message', {
        username: from.username || from.first_name,
        userId: from.id,
        chatId: chat.id,
        message: text?.substring(0, 100) || '',
        score: totalScore,
        spam: false,
        action: 'allowed',
        timestamp: Date.now()
      });
    }
  }
}