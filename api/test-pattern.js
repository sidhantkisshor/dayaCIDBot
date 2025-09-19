import { SPAM_PATTERNS, checkPatterns } from '../lib/security/patterns.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Test the message against patterns
        const result = checkPatterns(message, SPAM_PATTERNS);

        // Format the response
        const response = {
            message: message,
            score: result.totalScore,
            matches: result.matches,
            recommendation: getRecommendation(result.totalScore)
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Pattern test error:', error);
        return res.status(500).json({ error: 'Failed to test pattern' });
    }
}

function getRecommendation(score) {
    if (score >= 7) {
        return 'HIGH RISK - Delete message and restrict user';
    } else if (score >= 5) {
        return 'MEDIUM RISK - Delete message';
    } else if (score >= 3) {
        return 'LOW RISK - Monitor user';
    } else {
        return 'SAFE - No action needed';
    }
}