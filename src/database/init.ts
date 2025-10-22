/**
 * Initialize the database with seed data
 */

import { seedKnowledgeBase } from './seed.js';
import { getAllKnowledge } from './store.js';

async function initDatabase() {
  console.log('Initializing database...');
  
  const existing = await getAllKnowledge();
  
  if (existing.length === 0) {
    await seedKnowledgeBase();
    console.log('✅ Database initialized successfully!');
  } else {
    console.log(`ℹ️  Database already has ${existing.length} entries. Skipping seed.`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase().catch(console.error);
}

export { initDatabase };

