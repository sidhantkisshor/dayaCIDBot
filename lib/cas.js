// DayaCID Bot — CAS (Combot Anti-Spam) Blacklist Integration

import { CAS_CACHE_TTL_MS } from './config.js';

// In-memory cache for CAS lookups
const casCache = new Map(); // userId -> { result: bool, checkedAt: timestamp }

// Check if a user is CAS-banned (known spammer)
// Fail-open: if the API is down, returns false (not banned)
export async function checkCAS(userId) {
  // Check cache first
  const cached = casCache.get(userId);
  if (cached && Date.now() - cached.checkedAt < CAS_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const response = await fetch(`https://api.cas.chat/check?user_id=${userId}`, {
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    const data = await response.json();
    const isBanned = data.ok === true;

    // Cache the result
    casCache.set(userId, { result: isBanned, checkedAt: Date.now() });

    if (isBanned) {
      console.log(`CAS check: User ${userId} IS banned (offenses: ${data.result?.offenses || 'unknown'})`);
    }

    return isBanned;
  } catch (error) {
    console.error(`CAS check failed for ${userId}:`, error.message);
    // Fail open — don't block users if CAS API is down
    return false;
  }
}

// Clear the cache (useful for testing)
export function clearCASCache() {
  casCache.clear();
}
