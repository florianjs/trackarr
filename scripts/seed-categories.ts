import { db, schema } from '../server/db';
import { randomUUID } from 'crypto';

const categories = [
  { name: 'Movies', slug: 'movies' },
  { name: 'TV Shows', slug: 'tv-shows' },
  { name: 'Music', slug: 'music' },
  { name: 'Games', slug: 'games' },
  { name: 'Software', slug: 'software' },
  { name: 'Other', slug: 'other' },
];

async function seed() {
  console.log('Seeding categories...');
  for (const cat of categories) {
    try {
      await db
        .insert(schema.categories)
        .values({
          id: randomUUID(),
          name: cat.name,
          slug: cat.slug,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
      console.log(`Added category: ${cat.name}`);
    } catch (e) {
      console.error(`Failed to add category ${cat.name}:`, e);
    }
  }
  console.log('Done!');
  process.exit(0);
}

seed();
