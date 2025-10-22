/**
 * Seed the knowledge base with initial salon information
 */

import { addKnowledge, getAllKnowledge } from './store.js';

export async function seedKnowledgeBase() {
  // Initial salon knowledge - this is the base information the AI starts with
  const initialKnowledge = [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday from 9 AM to 7 PM, and Saturday from 10 AM to 6 PM. We are closed on Sundays.',
      category: 'hours',
      source: 'initial' as const,
    },
    {
      question: 'Where are you located?',
      answer: 'We are located at 123 Beauty Street, San Francisco, CA 94102.',
      category: 'location',
      source: 'initial' as const,
    },
    {
      question: 'What services do you offer?',
      answer: 'We offer haircuts, hair coloring, highlights, balayage, hair styling, blowouts, keratin treatments, and hair extensions.',
      category: 'services',
      source: 'initial' as const,
    },
    {
      question: 'How much does a haircut cost?',
      answer: 'A standard haircut is $65. A haircut with a senior stylist is $85.',
      category: 'pricing',
      source: 'initial' as const,
    },
    {
      question: 'Do I need an appointment?',
      answer: 'Yes, we operate by appointment only. You can book by calling us or through our website.',
      category: 'booking',
      source: 'initial' as const,
    },
  ];

  console.log('Seeding knowledge base with initial salon information...');
  for (const knowledge of initialKnowledge) {
    await addKnowledge(knowledge);
  }
  console.log(`Added ${initialKnowledge.length} entries to knowledge base`);
}

// Run if called directly
async function main() {
  console.log('Initializing database...');
  
  const existing = await getAllKnowledge();
  
  if (existing.length === 0) {
    await seedKnowledgeBase();
    console.log('✅ Database initialized successfully!');
  } else {
    console.log(`ℹ️  Database already has ${existing.length} entries. Skipping seed.`);
    console.log('To re-seed, delete the data/ directory and run again.');
  }
}

main().catch(console.error);

