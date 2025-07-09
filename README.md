# DayaCID Bot - Telegram Trading Community Protection

A sophisticated anti-spam and anti-scam bot designed specifically for Telegram trading communities, featuring multi-layered protection and continuous learning capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Vercel CLI (`npm i -g vercel`)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your bot token and settings
```

4. Deploy to Vercel:
```bash
vercel --prod
```

5. Set up webhook (after deployment):
```bash
curl -X POST https://your-project.vercel.app/api/setup-webhook \
  -H "Authorization: Bearer your_webhook_secret"
```

## 🛡️ Features

### Core Protection
- **CAPTCHA Verification**: Math problems and trading knowledge quizzes for new members
- **Spam Detection**: Pattern matching, rate limiting, and behavioral analysis
- **Scam Prevention**: Trading-specific scam pattern recognition
- **Link Filtering**: Suspicious URL detection and whitelist management
- **Raid Protection**: Mass join detection and automatic lockdown

### Smart Detection
- Context-aware keyword filtering
- Financial scam narrative detection
- Reputation scoring system
- Message similarity analysis
- New user restrictions

### Admin Tools
- `/stats` - View group statistics
- `/trust @user` - Mark user as trusted
- `/restrict @user` - Manually restrict users
- `/settings` - View current bot configuration

## 📋 Configuration

### Environment Variables

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_secret

# Optional - Features
ENABLE_CAPTCHA=true
ENABLE_LINK_CHECKING=true
MAX_MESSAGES_PER_MINUTE=10
NEW_USER_RESTRICTION_HOURS=24
SPAM_SCORE_THRESHOLD=7

# Database (choose one)
# Option 1: Vercel KV
KV_REST_API_URL=...

# Option 2: Supabase
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## 🏗️ Architecture

### Serverless Design
- Webhook-based message processing
- Stateless function execution
- External database for persistence
- Automatic scaling with traffic

### Security Layers
1. **Prevention**: Entry verification, rate limiting
2. **Detection**: Content analysis, pattern matching
3. **Response**: Automated actions, admin alerts
4. **Learning**: Continuous improvement from moderator actions

## 📊 Database Options

### Development (In-Memory)
- No configuration needed
- Data doesn't persist between deployments
- Good for testing

### Production Options

#### Vercel KV (Recommended)
- Redis-compatible
- Great for rate limiting and caching
- Easy integration with Vercel

#### Supabase
- PostgreSQL database
- Real-time capabilities
- Good for analytics dashboards

## 🚦 Bot Commands

### User Commands
- `/start` - Bot introduction
- `/help` - Show available commands
- `/report` - Report spam/scam (reply to message)

### Admin Commands
- `/stats` - Group statistics
- `/trust @user` - Mark as trusted
- `/restrict @user` - Restrict user
- `/settings` - View configuration

## 🔧 Development

### Local Testing
```bash
vercel dev
```

### Adding Features
1. Update spam/scam patterns in `lib/security/`
2. Add new commands in `lib/handlers/commands.js`
3. Implement database methods in `lib/database/`

### Testing Webhook Locally
Use [ngrok](https://ngrok.com/) to expose local server:
```bash
ngrok http 3000
# Use the HTTPS URL for webhook
```

## 📈 Monitoring

The bot logs:
- All security events
- Detected spam/scam attempts
- User restrictions
- Error events

Check Vercel logs:
```bash
vercel logs
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Submit pull request

## 📝 License

MIT License - see LICENSE file

## 🆘 Support

- Report issues on GitHub
- Join our support group (if applicable)
- Check documentation at `/docs`

## 🎯 Roadmap

- [ ] ML-powered content analysis
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Voice message scanning
- [ ] Integration with trading APIs
- [ ] Cross-group intelligence network

---

Built with ❤️ for the trading community by DayaCID