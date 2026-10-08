import { db, schema } from '../../../db';
import { randomUUID } from 'crypto';
import { requireAdminSession } from '../../../utils/adminAuth';
import { rateLimit, RATE_LIMITS } from '../../../utils/rateLimit';

// Recommended Torznab-compatible categories with proper Newznab IDs
const SEED_CATEGORIES = [
  // Movies
  {
    name: 'Movies',
    slug: 'movies',
    newznabId: 2000,
    subcategories: [
      { name: 'HD', slug: 'movies-hd', newznabId: 2040 },
      { name: 'UHD/4K', slug: 'movies-uhd', newznabId: 2045 },
      { name: 'SD', slug: 'movies-sd', newznabId: 2030 },
      { name: 'Blu-Ray', slug: 'movies-bluray', newznabId: 2050 },
    ],
  },
  // TV
  {
    name: 'TV',
    slug: 'tv',
    newznabId: 5000,
    subcategories: [
      { name: 'HD', slug: 'tv-hd', newznabId: 5040 },
      { name: 'UHD/4K', slug: 'tv-uhd', newznabId: 5045 },
      { name: 'SD', slug: 'tv-sd', newznabId: 5030 },
      { name: 'Anime', slug: 'tv-anime', newznabId: 5070 },
      { name: 'Documentary', slug: 'tv-documentary', newznabId: 5080 },
    ],
  },
  // Audio
  {
    name: 'Audio',
    slug: 'audio',
    newznabId: 3000,
    subcategories: [
      { name: 'MP3', slug: 'audio-mp3', newznabId: 3010 },
      { name: 'Lossless', slug: 'audio-lossless', newznabId: 3040 },
    ],
  },
  // Games
  {
    name: 'Games',
    slug: 'games',
    newznabId: 4050,
    subcategories: [
      { name: 'PC', slug: 'games-pc', newznabId: 4050 },
      { name: 'Console', slug: 'games-console', newznabId: 1000 },
      { name: 'PlayStation', slug: 'games-playstation', newznabId: 1180 },
      { name: 'Xbox', slug: 'games-xbox', newznabId: 1040 },
    ],
  },
  // Software
  {
    name: 'Software',
    slug: 'software',
    newznabId: 4000,
    subcategories: [
      { name: 'Windows', slug: 'software-windows', newznabId: 4020 },
      { name: 'Mac', slug: 'software-mac', newznabId: 4030 },
    ],
  },
  // Books
  {
    name: 'Books',
    slug: 'books',
    newznabId: 7000,
    subcategories: [
      { name: 'Ebooks', slug: 'books-ebooks', newznabId: 7020 },
      { name: 'Comics', slug: 'books-comics', newznabId: 7030 },
      { name: 'Magazines', slug: 'books-magazines', newznabId: 7010 },
    ],
  },
  // XXX (optional, can be removed if not needed)
  {
    name: 'XXX',
    slug: 'xxx',
    newznabId: 6000,
    subcategories: [],
  },
  // Other
  {
    name: 'Other',
    slug: 'other',
    newznabId: 8000,
    subcategories: [],
  },
];

export default defineEventHandler(async (event) => {
  await rateLimit(event, RATE_LIMITS.admin);
  await requireAdminSession(event);

  // Check if categories already exist
  const existingCategories = await db.query.categories.findMany();
  if (existingCategories.length > 0) {
    throw createError({
      statusCode: 400,
      message:
        'Categories already exist. Delete all categories first to re-seed.',
    });
  }

  let created = 0;

  for (const cat of SEED_CATEGORIES) {
    const parentId = randomUUID();

    // Create parent category
    await db.insert(schema.categories).values({
      id: parentId,
      name: cat.name,
      slug: cat.slug,
      parentId: null,
      newznabId: cat.newznabId,
      createdAt: new Date(),
    });
    created++;

    // Create subcategories
    for (const sub of cat.subcategories) {
      await db.insert(schema.categories).values({
        id: randomUUID(),
        name: sub.name,
        slug: sub.slug,
        parentId: parentId,
        newznabId: sub.newznabId,
        createdAt: new Date(),
      });
      created++;
    }
  }

  return { success: true, created };
});
