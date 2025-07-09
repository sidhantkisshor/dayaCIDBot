# Deployment Guide for DayaCID Bot

## 🚀 Vercel Deployment (Recommended)

### Step 1: Prepare Your Project

1. Make sure all files are ready and `.env` is configured
2. Ensure `.gitignore` includes `.env` to protect your bot token

### Step 2: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 3: Deploy to Vercel

```bash
# Login to Vercel (first time only)
vercel login

# Deploy to production
vercel --prod
```

During deployment, Vercel will ask:
- Set up and deploy? **Y**
- Which scope? (Choose your account)
- Link to existing project? **N** (first time)
- Project name? **telegram-trading-bot** (or your choice)
- Directory? **./** (current directory)

### Step 4: Configure Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add all variables from `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `BOT_USERNAME`
   - Other configuration variables

### Step 5: Set Up Database

#### Option A: Vercel KV (Easiest)
1. In Vercel Dashboard → Storage
2. Create new KV database
3. It will automatically add environment variables

#### Option B: Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection details to Vercel env vars

### Step 6: Configure Telegram Webhook

After deployment, set up the webhook:

```bash
# Get your deployment URL from Vercel
DEPLOYMENT_URL="https://your-project.vercel.app"

# Set webhook using curl
curl -X POST "$DEPLOYMENT_URL/api/setup-webhook" \
  -H "Authorization: Bearer your_webhook_secret"
```

Or manually:
```bash
curl "https://api.telegram.org/bot${YOUR_BOT_TOKEN}/setWebhook" \
  -F "url=$DEPLOYMENT_URL/api/telegram-webhook" \
  -F "allowed_updates=[\"message\",\"callback_query\",\"chat_member\"]" \
  -F "secret_token=your_webhook_secret"
```

### Step 7: Verify Deployment

1. Check webhook status:
```bash
curl "https://api.telegram.org/bot${YOUR_BOT_TOKEN}/getWebhookInfo"
```

2. Add bot to a test group
3. Send a test message
4. Check Vercel logs:
```bash
vercel logs
```

## 🔧 Troubleshooting

### Bot Not Responding
1. Check webhook info (step 7)
2. Verify environment variables in Vercel
3. Check function logs: `vercel logs --follow`

### Database Connection Issues
1. Verify database credentials
2. Check if database is accessible
3. Try in-memory mode first (remove database env vars)

### Webhook Errors
1. Ensure HTTPS URL (Vercel provides this)
2. Check secret token matches
3. Verify bot has correct permissions in group

## 🔄 Updating the Bot

```bash
# Make your changes
git add .
git commit -m "Update bot features"

# Deploy updates
vercel --prod
```

## 📊 Monitoring

### Vercel Dashboard
- Function invocations
- Error rates
- Performance metrics

### Bot Health Checks
```bash
# Check webhook
curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"

# Check bot info
curl "https://api.telegram.org/bot${TOKEN}/getMe"
```

## 🛡️ Security Best Practices

1. **Never commit `.env` file**
2. **Use strong webhook secret**
3. **Regularly rotate tokens**
4. **Monitor suspicious activity**
5. **Keep dependencies updated**

## 🌐 Custom Domain (Optional)

1. Add custom domain in Vercel settings
2. Update webhook URL to use custom domain
3. Configure DNS as instructed by Vercel

## 📈 Scaling

Vercel automatically scales your bot:
- Concurrent executions: 1000 (free tier)
- Function duration: 10 seconds max
- Monthly executions: 100,000 (free tier)

For higher limits, upgrade to Vercel Pro.

## 🆘 Need Help?

1. Check Vercel logs first
2. Verify all environment variables
3. Test with a simple webhook first
4. Join Vercel Discord for platform help
5. Check Telegram Bot API documentation

---

Remember: Your bot token is sensitive! Keep it secret and secure.