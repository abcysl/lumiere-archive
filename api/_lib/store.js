import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Redis credentials not set (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)');
  }
  _redis = new Redis({ url, token });
  return _redis;
}

const KEY = 'lumiere:content:v1';

export const DEFAULT_CONTENT = {
  profile: {
    name: 'Lumière Archive',
    tagline: 'A study of light, stillness,\nand quiet moments.',
    bio: [
      "Based between Seoul and the coast, I've spent the last decade documenting landscapes that pause between silence and motion. My work lives in the hour before sunrise and the minute after dusk.",
      'Available for editorial, brand campaigns, and private commissions worldwide.',
    ],
    image: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80',
    stats: [
      { num: '12',  lbl: 'Years' },
      { num: '80+', lbl: 'Publications' },
      { num: '27',  lbl: 'Countries' },
    ],
    instagram: 'https://instagram.com/',
    email: 'abcysl@gmail.com',
  },
  career: [
    { year: '2024', title: 'Solo Exhibition — "Stillness"', place: 'Seoul' },
    { year: '2022', title: 'Editorial — National Geographic Korea', place: 'Print' },
    { year: '2020', title: 'Brand Campaign — Aesop Asia', place: 'Commercial' },
    { year: '2018', title: 'Group Show — "Coastal"', place: 'Jeju' },
  ],
  albums: null, // null means use seed (set externally on first read)
};

export async function readContent(seedAlbums) {
  const redis = getRedis();
  const data = await redis.get(KEY);
  if (data && typeof data === 'object') {
    if (!data.albums || !Array.isArray(data.albums) || data.albums.length === 0) {
      data.albums = seedAlbums;
    }
    return data;
  }
  // First read — seed and persist
  const initial = { ...DEFAULT_CONTENT, albums: seedAlbums };
  await redis.set(KEY, initial);
  return initial;
}

export async function writeContent(content) {
  const redis = getRedis();
  await redis.set(KEY, content);
  return content;
}
