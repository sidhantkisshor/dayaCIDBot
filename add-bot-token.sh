#!/bin/bash

echo "==================================="
echo "   Vercel Environment Setup"
echo "==================================="
echo ""

# Prompt for bot token
read -p "Enter your Telegram Bot Token: " BOT_TOKEN

if [ -z "$BOT_TOKEN" ]; then
    echo "❌ Bot token cannot be empty!"
    exit 1
fi

echo ""
echo "Adding bot token to Vercel..."
echo "Token: ${BOT_TOKEN:0:20}..."
echo ""

# Add to production
echo "Adding to production..."
echo "$BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN production --force

# Add to preview
echo "Adding to preview..."
echo "$BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN preview --force

# Add to development
echo "Adding to development..."
echo "$BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN development --force

# Add default spam threshold
echo ""
echo "Adding default SPAM_SCORE_THRESHOLD (5)..."
echo "5" | npx vercel env add SPAM_SCORE_THRESHOLD production --force
echo "5" | npx vercel env add SPAM_SCORE_THRESHOLD preview --force
echo "5" | npx vercel env add SPAM_SCORE_THRESHOLD development --force

echo ""
echo "✅ Environment variables added!"
echo ""
echo "Listing current variables:"
npx vercel env ls

echo ""
echo "==================================="
echo "Next steps:"
echo "1. Redeploy: npx vercel --prod --yes"
echo "2. Check health: https://dayacidbot.vercel.app/api/health"
echo "==================================="