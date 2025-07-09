// Simple logger for tracking bot activity

export async function logUpdate(update) {
  const type = Object.keys(update).find(key => 
    ['message', 'callback_query', 'inline_query', 'chat_member'].includes(key)
  );
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${type}:`, JSON.stringify(update, null, 2));
  } else {
    // In production, log minimal info
    console.log(`[${new Date().toISOString()}] ${type} from ${update[type]?.from?.id || 'unknown'}`);
  }
}

export function logError(context, error) {
  console.error(`[ERROR] ${context}:`, error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
}

export function logSecurity(event, details) {
  console.log(`[SECURITY] ${event}:`, details);
}