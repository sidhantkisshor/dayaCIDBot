// Database abstraction layer
// This allows switching between different databases easily

let db = null;
let dbType = null;

export async function initializeDatabase() {
  // Determine which database to use based on environment variables
  if (process.env.KV_REST_API_URL) {
    dbType = 'vercel-kv';
    // Try to use extended KV with dashboard features
    try {
      const { initializeKVExtended } = await import('./vercel-kv-extended.js');
      db = await initializeKVExtended();
      console.log('Vercel KV Extended connected successfully');
    } catch (error) {
      console.warn('Failed to initialize extended KV, falling back to basic:', error.message);
      const { initializeKV } = await import('./vercel-kv.js');
      db = await initializeKV();
    }
  } else if (process.env.SUPABASE_URL) {
    dbType = 'supabase';
    const { initializeSupabase } = await import('./supabase.js');
    db = await initializeSupabase();
  } else {
    // Fallback to in-memory storage for development
    dbType = 'memory';
    const { initializeMemory } = await import('./memory.js');
    db = await initializeMemory();
    console.warn('Using in-memory database - data will not persist!');
  }
  
  console.log(`Database initialized: ${dbType}`);
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function getDatabaseType() {
  return dbType;
}