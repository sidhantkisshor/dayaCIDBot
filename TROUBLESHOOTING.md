# Troubleshooting Guide - DayaCID Bot

## Bot Not Deleting/Blocking Messages

### 1. Check Bot Admin Rights
The bot **MUST** have administrator privileges in your Telegram group to delete messages and restrict users.

**How to fix:**
1. Go to your Telegram group
2. Click group name → Edit → Administrators
3. Add your bot as administrator
4. Enable these permissions:
   - Delete messages
   - Ban users
   - Pin messages (optional)

### 2. Verify Environment Variables in Vercel

**Required variables:**
```
TELEGRAM_BOT_TOKEN=your_actual_bot_token
SPAM_SCORE_THRESHOLD=5  # Lower value = more strict
```

**How to check:**
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project (dayacidbot)
3. Go to Settings → Environment Variables
4. Make sure `TELEGRAM_BOT_TOKEN` is set with your actual bot token from @BotFather

### 3. Check Bot Status
Run this command locally:
```bash
npm run check-status
```

This will verify:
- Bot token is valid
- Webhook is properly configured
- Bot can receive updates

### 4. Monitor Live Logs
Check real-time logs in Vercel:
```bash
npx vercel logs dayacidbot --follow
```

Or in the Vercel dashboard:
1. Go to your project
2. Click on Functions tab
3. Select your webhook function
4. View real-time logs

### 5. Test Spam Detection
Send these test messages in your group:
- Multiple links in one message
- Same message 3+ times rapidly
- Message with 5+ mentions
- ALL CAPS MESSAGE LIKE THIS

Check logs to see if spam scores are being calculated.

### 6. Database Issues
The bot uses in-memory database by default (data won't persist). To use persistent storage:

**Option A: Vercel KV (Recommended)**
1. Go to Vercel Dashboard → Storage
2. Create a KV database
3. Copy the environment variables
4. Add them to your project

**Option B: Supabase**
1. Create a Supabase project
2. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Vercel

### 7. Common Error Messages

**"Bot needs admin rights"**
- Solution: Make bot admin in group

**"TELEGRAM_BOT_TOKEN is not set"**
- Solution: Add token to Vercel environment variables

**"Rate limit exceeded"**
- The user is sending too many messages too quickly
- Adjust `MAX_MESSAGES_PER_MINUTE` in environment variables

### 8. Webhook Not Receiving Updates
Run setup webhook again:
```bash
npm run setup-webhook
```

### 9. Debug Mode
Add this to environment variables for verbose logging:
```
NODE_ENV=development
DEBUG=true
```

### 10. Quick Checklist
- [ ] Bot token is set in Vercel
- [ ] Bot is admin in group
- [ ] Webhook URL is configured
- [ ] Database is initialized (check logs)
- [ ] Spam threshold is reasonable (5-7)
- [ ] Bot can delete messages (check permissions)

## Still Having Issues?

1. Check function logs: `npx vercel logs --follow`
2. Redeploy: `npx vercel --prod`
3. Reset webhook: `npm run setup-webhook`

## Testing Commands
Try these commands in your group:
- `/help` - Should respond with help message
- `/stats` - Admin only, shows statistics
- Send spam-like content to test detection