# 🚀 DayaCID Bot Deployment Checklist

## ✅ Pre-Deployment

- [x] Bot created with @BotFather
- [x] Bot token saved in `.env`
- [x] Webhook secret configured
- [ ] Your Telegram user ID added to `ADMIN_IDS` in `.env`

## 📦 Installation

```bash
# 1. Install dependencies
npm install

# 2. Verify setup
npm run verify
```

## 🔐 Webhook Secret Verification

Your webhook secret is: `daya_cid_security_secret_2024_trading`

This secret is:
- ✅ Correctly set in `.env`
- ✅ Used in webhook verification (`lib/utils/security.js`)
- ✅ Required for webhook setup endpoint
- ✅ Properly formatted (alphanumeric with underscores)

## 🌐 Deployment Steps

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Note your deployment URL** (e.g., `https://telegram-trading-bot.vercel.app`)

3. **Set up webhook** (replace YOUR_DEPLOYMENT_URL):
   ```bash
   curl -X POST https://YOUR_DEPLOYMENT_URL/api/setup-webhook \
     -H "Authorization: Bearer daya_cid_security_secret_2024_trading"
   ```

4. **Verify webhook:**
   ```bash
   curl https://api.telegram.org/bot7660494644:AAHeSiuc3WioPqSSGdiIvTFbfszScqPbK5c/getWebhookInfo
   ```

## 🗄️ Database Setup

### Option 1: Start with In-Memory (Default)
- No configuration needed
- Data won't persist between deployments
- Good for testing

### Option 2: Vercel KV (Recommended)
1. Go to Vercel Dashboard → Storage
2. Create KV database
3. Environment variables auto-added

### Option 3: Supabase
1. Create project at supabase.com
2. Run SQL from `lib/database/supabase.js` comments
3. Add credentials to Vercel env vars

## 🤖 Bot Permissions

Add bot to group with these admin permissions:
- ✅ Delete messages
- ✅ Restrict members  
- ✅ Ban users
- ✅ Add new admins (optional)

## 🧪 Testing

1. Add bot to test group
2. Have someone join - should see CAPTCHA
3. Test spam detection with repeated messages
4. Try posting suspicious links
5. Use `/help` command

## 📊 Monitoring

- **Vercel Logs:** `vercel logs --follow`
- **Bot Status:** `npm run verify`
- **Webhook Info:** Check via Telegram API

## ⚠️ Important Notes

1. **Never commit `.env` file** - it contains your bot token!
2. **Webhook secret** must match in:
   - `.env` file
   - Authorization header when setting webhook
   - Telegram webhook configuration

3. **Admin commands** require your Telegram ID in `ADMIN_IDS`

## 🎉 Success Indicators

- ✅ Bot responds to `/start` in groups
- ✅ New members see CAPTCHA challenge
- ✅ Spam messages are deleted
- ✅ Admin commands work for authorized users

---

Your bot is ready for deployment! The webhook secret is correctly configured.