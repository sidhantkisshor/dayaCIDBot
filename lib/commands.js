// DayaCID Bot — Command Handlers

import { sendMessage, banUser, unbanUser, isAdmin, getBotMember, logToAdmin, escapeHtml } from './telegram.js';
import { setTrusted, getStats, getWarnings, deleteWarnings, clearReports, userWarnings, trustedUsers } from './state.js';

export async function handleCommand(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';
  const threadId = message.message_thread_id || null;
  const [command] = text.split(' ');
  const lowerCommand = command.toLowerCase().split('@')[0]; // Handle /command@BotName

  switch (lowerCommand) {
    case '/start':
    case '/help':
      await sendMessage(chatId,
        '🛡️ <b>DayaCID Bot — Anti-Spam Protection</b>\n\n' +
        'I automatically detect and remove spam with:\n' +
        '• Pattern matching & keyword detection\n' +
        '• Behavior analysis & flood protection\n' +
        '• New member captcha verification\n' +
        '• CAS blacklist integration\n' +
        '• Unicode obfuscation detection\n\n' +
        '<b>Commands:</b>\n' +
        '/help - Show this message\n' +
        '/ban - Ban user (admin, reply to msg)\n' +
        '/unban - Unban user (admin, reply to msg)\n' +
        '/trust - Trust user (admin, reply to msg)\n' +
        '/untrust - Remove trust (admin, reply to msg)\n' +
        '/stats - Show protection statistics\n' +
        '/test - Test bot status\n' +
        '/check - Check bot permissions\n\n' +
        '💡 <b>Report spam:</b> Reply to any message and tag @DayaCIDbot\n' +
        '📊 3 reports from different members = auto-restrict 24h',
        false, threadId
      );
      return true;

    case '/test':
      await sendMessage(chatId, '✅ Bot is working and protecting your chat!', false, threadId);
      return true;

    case '/check':
      if (await isAdmin(chatId, userId)) {
        const botMember = await getBotMember(chatId);
        if (botMember) {
          const perms = [];
          if (botMember.can_delete_messages) perms.push('✅ Delete messages');
          else perms.push('❌ Delete messages');
          if (botMember.can_restrict_members) perms.push('✅ Restrict members');
          else perms.push('❌ Restrict members');
          if (botMember.can_promote_members) perms.push('✅ Promote members');
          else perms.push('❌ Promote members');

          await sendMessage(chatId,
            `🔧 <b>Bot Permissions</b>\n\n${perms.join('\n')}\n\n` +
            `Status: ${botMember.status}`,
            false, threadId
          );
        } else {
          await sendMessage(chatId, '❌ Could not check bot permissions', false, threadId);
        }
      } else {
        await sendMessage(chatId, '❌ Admin only command', true, threadId);
      }
      return true;

    case '/ban':
      if (await isAdmin(chatId, userId)) {
        if (message.reply_to_message) {
          const targetUser = message.reply_to_message.from;
          const banResult = await banUser(chatId, targetUser.id);
          if (banResult?.ok) {
            await sendMessage(chatId, `🚫 Banned ${escapeHtml(targetUser.first_name || 'user')}`, false, threadId);
            logToAdmin('ADMIN BAN', chatId, targetUser.id, targetUser.first_name || 'user',
              `Banned by admin ${message.from.first_name}`);
          } else {
            await sendMessage(chatId, '❌ Failed to ban user', false, threadId);
          }
        } else {
          await sendMessage(chatId, 'Reply to a message from the user you want to ban', false, threadId);
        }
      } else {
        await sendMessage(chatId, '❌ Admin only command', true, threadId);
      }
      return true;

    case '/unban':
      if (await isAdmin(chatId, userId)) {
        if (message.reply_to_message) {
          const targetUser = message.reply_to_message.from;
          const result = await unbanUser(chatId, targetUser.id);
          if (result?.ok) {
            // Clear all tracked state for this user
            await deleteWarnings(chatId, targetUser.id);
            clearReports(chatId, targetUser.id);
            await sendMessage(chatId, `✅ Unbanned ${escapeHtml(targetUser.first_name || 'user')}`, false, threadId);
            logToAdmin('ADMIN UNBAN', chatId, targetUser.id, targetUser.first_name || 'user',
              `Unbanned by admin ${message.from.first_name}`);
          } else {
            await sendMessage(chatId, '❌ Failed to unban user', false, threadId);
          }
        } else {
          await sendMessage(chatId, 'Reply to a message from the user you want to unban', false, threadId);
        }
      } else {
        await sendMessage(chatId, '❌ Admin only command', true, threadId);
      }
      return true;

    case '/trust':
      if (await isAdmin(chatId, userId)) {
        if (message.reply_to_message) {
          const targetUser = message.reply_to_message.from;
          await setTrusted(chatId, targetUser.id, true);
          await deleteWarnings(chatId, targetUser.id);
          clearReports(chatId, targetUser.id);
          await sendMessage(chatId, `✅ ${escapeHtml(targetUser.first_name || 'User')} is now trusted`, false, threadId);
        } else {
          await sendMessage(chatId, 'Reply to a message from the user you want to trust', false, threadId);
        }
      } else {
        await sendMessage(chatId, '❌ Admin only command', true, threadId);
      }
      return true;

    case '/untrust':
      if (await isAdmin(chatId, userId)) {
        if (message.reply_to_message) {
          const targetUser = message.reply_to_message.from;
          await setTrusted(chatId, targetUser.id, false);
          await sendMessage(chatId, `⚠️ ${escapeHtml(targetUser.first_name || 'User')} is no longer trusted`, false, threadId);
        } else {
          await sendMessage(chatId, 'Reply to a message from the user you want to untrust', false, threadId);
        }
      } else {
        await sendMessage(chatId, '❌ Admin only command', true, threadId);
      }
      return true;

    case '/stats': {
      const stats = await getStats(chatId);
      const warningCount = userWarnings.size;
      const trustedCount = trustedUsers.size;
      const kvInfo = stats.deleted > 0 ? ' (persistent)' : ' (this session)';

      await sendMessage(chatId,
        `📊 <b>Bot Statistics</b>${kvInfo}\n\n` +
        `🗑️ Messages deleted: ${stats.deleted}\n` +
        `🔇 Users muted: ${stats.muted}\n` +
        `🚫 Users banned: ${stats.banned}\n` +
        `⚠️ Users with warnings: ${warningCount}\n` +
        `✅ Trusted users: ${trustedCount}\n` +
        `🔐 Captcha passed: ${stats.captchaPassed}\n` +
        `❌ Captcha failed: ${stats.captchaFailed}\n` +
        `\n🛡️ Protection: <b>Active</b>`,
        false, threadId
      );
      return true;
    }

    default:
      return false; // Unknown command, don't consume it
  }
}
