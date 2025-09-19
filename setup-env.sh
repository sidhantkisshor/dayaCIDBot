#!/bin/bash

echo "Setting up Vercel environment variables..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create a .env file with your configuration first."
    echo "Copy .env.example to .env and fill in your values."
    exit 1
fi

# Load variables from .env
export $(cat .env | grep -v '^#' | xargs)

# Check if bot token exists
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN not found in .env file!"
    exit 1
fi

echo "Found bot token: ${TELEGRAM_BOT_TOKEN:0:10}..."

# Add to Vercel (for all environments)
echo "Adding TELEGRAM_BOT_TOKEN to Vercel..."
echo "$TELEGRAM_BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN production
echo "$TELEGRAM_BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN preview
echo "$TELEGRAM_BOT_TOKEN" | npx vercel env add TELEGRAM_BOT_TOKEN development

# Add other important variables if they exist
if [ ! -z "$TELEGRAM_WEBHOOK_SECRET" ]; then
    echo "Adding TELEGRAM_WEBHOOK_SECRET..."
    echo "$TELEGRAM_WEBHOOK_SECRET" | npx vercel env add TELEGRAM_WEBHOOK_SECRET production
    echo "$TELEGRAM_WEBHOOK_SECRET" | npx vercel env add TELEGRAM_WEBHOOK_SECRET preview
    echo "$TELEGRAM_WEBHOOK_SECRET" | npx vercel env add TELEGRAM_WEBHOOK_SECRET development
fi

if [ ! -z "$BOT_USERNAME" ]; then
    echo "Adding BOT_USERNAME..."
    echo "$BOT_USERNAME" | npx vercel env add BOT_USERNAME production
    echo "$BOT_USERNAME" | npx vercel env add BOT_USERNAME preview
    echo "$BOT_USERNAME" | npx vercel env add BOT_USERNAME development
fi

if [ ! -z "$SPAM_SCORE_THRESHOLD" ]; then
    echo "Adding SPAM_SCORE_THRESHOLD..."
    echo "$SPAM_SCORE_THRESHOLD" | npx vercel env add SPAM_SCORE_THRESHOLD production
    echo "$SPAM_SCORE_THRESHOLD" | npx vercel env add SPAM_SCORE_THRESHOLD preview
    echo "$SPAM_SCORE_THRESHOLD" | npx vercel env add SPAM_SCORE_THRESHOLD development
fi

# KV Database variables
if [ ! -z "$KV_REST_API_URL" ]; then
    echo "Adding KV database variables..."
    echo "$KV_REST_API_URL" | npx vercel env add KV_REST_API_URL production
    echo "$KV_REST_API_URL" | npx vercel env add KV_REST_API_URL preview
    echo "$KV_REST_API_URL" | npx vercel env add KV_REST_API_URL development

    if [ ! -z "$KV_REST_API_TOKEN" ]; then
        echo "$KV_REST_API_TOKEN" | npx vercel env add KV_REST_API_TOKEN production
        echo "$KV_REST_API_TOKEN" | npx vercel env add KV_REST_API_TOKEN preview
        echo "$KV_REST_API_TOKEN" | npx vercel env add KV_REST_API_TOKEN development
    fi

    if [ ! -z "$KV_REST_API_READ_ONLY_TOKEN" ]; then
        echo "$KV_REST_API_READ_ONLY_TOKEN" | npx vercel env add KV_REST_API_READ_ONLY_TOKEN production
        echo "$KV_REST_API_READ_ONLY_TOKEN" | npx vercel env add KV_REST_API_READ_ONLY_TOKEN preview
        echo "$KV_REST_API_READ_ONLY_TOKEN" | npx vercel env add KV_REST_API_READ_ONLY_TOKEN development
    fi

    if [ ! -z "$KV_URL" ]; then
        echo "$KV_URL" | npx vercel env add KV_URL production
        echo "$KV_URL" | npx vercel env add KV_URL preview
        echo "$KV_URL" | npx vercel env add KV_URL development
    fi
fi

echo ""
echo "✅ Environment variables added to Vercel!"
echo ""
echo "Next steps:"
echo "1. Redeploy your project: npx vercel --prod"
echo "2. Check health endpoint: https://your-project.vercel.app/api/health"
echo "3. Setup webhook: npm run setup-webhook"