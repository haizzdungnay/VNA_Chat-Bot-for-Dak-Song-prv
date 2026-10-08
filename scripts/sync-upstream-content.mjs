/**
 * scripts/sync-upstream-content.mjs
 * Trích xuất dữ liệu chính thức từ Cổng du lịch Đắk Song (VNA Core API)
 * và tạo bản nạp dữ liệu (seed) Idempotent cho Cloudflare D1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://core-360.vnaapi.com';
const CDN_BASE = 'https://static.dggv.edu.vn';
const DEPT_CODE = 'DAKNONG-2-29';

// Map danh mục từ nguồn sang 4 danh mục D1 chuẩn MVP
export function mapCategory(upstreamCat, placeName = '') {
  const s = ((upstreamCat || '') + ' ' + (placeName || '')).toLowerCase();
  if (s.includes('nâm nung') || s.includes('thác') || s.includes('lưu ly') || s.includes('núi') || s.includes('rừng') || s.includes('thiên nhiên') || s.includes('sinh thái') || s.includes('hồ đắk')) {
    return 'cat-nature';
  }
  if (s.includes('ăn uống') || s.includes('nhà hàng') || s.includes('ẩm thực') || s.includes('phở') || s.includes('bún')) {
    return 'cat-food';
  }
  if (s.includes('trúc lâm') || s.includes('thiền viện') || s.includes('di tích') || s.includes('lịch sử') || s.includes('tâm linh') || s.includes('chùa')) {
    return 'cat-history';
  }
  return 'cat-checkin'; // Địa điểm du lịch, farmstay, nhà nghỉ, cây giống, tiện ích
}

export function normalizeImageUrl(url) {
  if (!url) return 'https://static.dggv.edu.vn/360/1672307604677_z3997641506907_ff6e17b67121e6b6a218553db5c79124.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const clean = url.startsWith('/') ? url.slice(1) : url;
  return `${CDN_BASE}/${clean}`;
}

export function slugify(text, id) {
  const cleanText = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const shortId = (id || '').slice(0, 8);
  return `${cleanText}-${shortId}`;
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

export async function fetchUpstreamData() {
  console.log('[Sync] Kết nối VNA Core API...');
  
  // 1. Fetch Travel Locations List
  const locListRes = await fetch(`${API_BASE}/travel-location-public/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Department-Code': DEPT_CODE,
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
      bounds: { north: 14.0, south: 10.0, east: 110.0, west: 105.0 },
      departmentCode: DEPT_CODE,
      pageNumber: 0,
      pageSize: 100
    })
  });
  const locListData = await locListRes.json();
  const rawLocations = locListData.data?.items || [];
  console.log(`[Sync] Tìm thấy ${rawLocations.length} địa điểm thô.`);

  // 2. Fetch Details for each location
  const fullPlaces = [];
  for (const item of rawLocations) {
    let detail = item;
    try {
      const dRes = await fetch(`${API_BASE}/travel-location-public/${item.id}`, {
        headers: { 'X-Department-Code': DEPT_CODE, 'User-Agent': 'Mozilla/5.0' }
      });
      const dData = await dRes.json();
      if (dData.success && dData.data) {
        detail = dData.data;
      }
    } catch {
      // fallback to item
    }
    fullPlaces.push(detail);
  }

  // 3. Fetch Articles across all pages
  const allArticles = [];
  let page = 1;
  while (true) {
    const artRes = await fetch(`${API_BASE}/post-public/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Department-Code': DEPT_CODE,
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({ page, limit: 10 })
    });
    const artData = await artRes.json();
    const items = artData.data?.items || [];
    if (!items.length) break;
    allArticles.push(...items);
    if (allArticles.length >= (artData.data?.total || 0) || page >= 10) break;
    page++;
  }
  console.log(`[Sync] Tìm thấy ${allArticles.length} bài viết văn hóa/du lịch.`);

  return { places: fullPlaces, articles: allArticles };
}

export function transformPlaces(rawPlaces) {
  // Top featured place IDs
  const featuredIds = new Set([
    'beef28a3-316e-471c-8836-68f677697941', // Thiền Viện Trúc Lâm Đạo Nguyên
    '360a56b1-324d-40df-98e7-f7ad6ece2404', // Khu bảo tồn thiên nhiên Nâm Nung
    'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', // Thác Lưu Ly
    'b9902337-0878-466c-880e-5151fd5f394a'  // HIGG Farm - Glamping & Coffee
  ]);

  return rawPlaces.map((p) => {
    const categoryId = mapCategory(p.categoryName, p.name);
    const imageUrl = normalizeImageUrl(p.coverImage);
    const gallery = (p.galleryImages || []).map(normalizeImageUrl);
    if (!gallery.includes(imageUrl)) {
      gallery.unshift(imageUrl);
    }
    
    // Fallback opening hours
    let openingHours = '07:30 - 17:30';
    if (categoryId === 'cat-food') openingHours = '06:00 - 22:00';
    if (categoryId === 'cat-nature') openingHours = 'Cả ngày (Khuyến nghị 06:00 - 17:30)';

    const description = (p.content || p.address || `Địa điểm du lịch tại Đắk Song: ${p.name}`).trim();
    const shortDesc = description.slice(0, 150) + (description.length > 150 ? '...' : '');

    return {
      id: p.id,
      slug: slugify(p.name, p.id),
      name: p.name.trim(),
      categoryId,
      shortDescription: shortDesc,
      description,
      address: (p.address || 'Huyện Đắk Song, Tỉnh Đắk Nông').trim(),
      latitude: Number(p.lat) || 12.2499,
      longitude: Number(p.lng) || 107.5681,
      imageUrl,
      imagesJson: JSON.stringify(gallery),
      mapUrl: p.link || `https://maps.google.com/?q=${p.lat},${p.lng}`,
      openingHours,
      phone: p.phone ? String(p.phone).trim() : null,
      website: 'https://dulichdaksong.vnasw.vn/',
      isFeatured: featuredIds.has(p.id) ? 1 : 0
    };
  });
}

export function generateSeedSql(transformedPlaces) {
  const lines = [
    '-- VNA Đắk Song D1 Official Seed Data (Generated from VNA Core API)',
    '-- Timestamp: ' + new Date().toISOString(),
    '',
    '-- 1. Categories (Safe Idempotent Insert)',
    `INSERT INTO categories (id, slug, name, icon) VALUES`,
    `  ('cat-history', 'di-tich-lich-su', 'Di tích lịch sử', 'zi-home'),`,
    `  ('cat-nature', 'thien-nhien', 'Thiên nhiên', 'zi-location'),`,
    `  ('cat-checkin', 'diem-check-in', 'Điểm check-in', 'zi-star'),`,
    `  ('cat-food', 'am-thuc', 'Ẩm thực', 'zi-chat')`,
    `ON CONFLICT(id) DO UPDATE SET`,
    `  slug = excluded.slug,`,
    `  name = excluded.name,`,
    `  icon = excluded.icon;`,
    '',
    '-- 2. Dọn dẹp dữ liệu mẫu ban đầu (place-01..04 nếu còn tồn tại)',
    `DELETE FROM places WHERE id IN ('place-01', 'place-02', 'place-03', 'place-04');`,
    '',
    '-- 3. Official Places (15 Verified Locations from dulichdaksong.vnasw.vn)'
  ];

  for (let i = 0; i < transformedPlaces.length; i++) {
    const p = transformedPlaces[i];
    const isFirst = i === 0;
    const prefix = isFirst ? 'INSERT INTO places (id, slug, name, category_id, short_description, description, address, latitude, longitude, image_url, images_json, map_url, opening_hours, phone, website, is_featured) VALUES' : ' ';
    const isLast = i === transformedPlaces.length - 1;
    const row = `  (${escapeSql(p.id)}, ${escapeSql(p.slug)}, ${escapeSql(p.name)}, ${escapeSql(p.categoryId)}, ${escapeSql(p.shortDescription)}, ${escapeSql(p.description)}, ${escapeSql(p.address)}, ${p.latitude}, ${p.longitude}, ${escapeSql(p.imageUrl)}, ${escapeSql(p.imagesJson)}, ${escapeSql(p.mapUrl)}, ${escapeSql(p.openingHours)}, ${escapeSql(p.phone)}, ${escapeSql(p.website)}, ${p.isFeatured})` + (isLast ? '' : ',');
    if (isFirst) lines.push(prefix);
    lines.push(row);
  }

  lines.push('ON CONFLICT(id) DO UPDATE SET');
  lines.push('  slug = excluded.slug,');
  lines.push('  name = excluded.name,');
  lines.push('  category_id = excluded.category_id,');
  lines.push('  short_description = excluded.short_description,');
  lines.push('  description = excluded.description,');
  lines.push('  address = excluded.address,');
  lines.push('  latitude = excluded.latitude,');
  lines.push('  longitude = excluded.longitude,');
  lines.push('  image_url = excluded.image_url,');
  lines.push('  images_json = excluded.images_json,');
  lines.push('  map_url = excluded.map_url,');
  lines.push('  opening_hours = excluded.opening_hours,');
  lines.push('  phone = excluded.phone,');
  lines.push('  website = excluded.website,');
  lines.push('  is_featured = excluded.is_featured,');
  lines.push("  updated_at = datetime('now');");

  return lines.join('\n');
}

export async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const isApply = process.argv.includes('--apply');

  console.log(`=== VNA ĐẮK SONG DATA SYNC TOOL [${isDryRun ? 'DRY-RUN' : isApply ? 'APPLY' : 'INSPECT'}] ===`);
  
  const { places, articles } = await fetchUpstreamData();
  const transformed = transformPlaces(places);

  console.log(`\n--- Danh sách ${transformed.length} địa điểm đã chuẩn hóa ---`);
  for (const p of transformed) {
    console.log(`[ID: ${p.id.slice(0, 8)}] ${p.name.padEnd(35)} | Cat: ${p.categoryId.padEnd(12)} | Featured: ${p.isFeatured} | ${p.address.slice(0, 35)}`);
  }

  const sql = generateSeedSql(transformed);

  if (isDryRun) {
    console.log('\n[Dry-Run] Xem trước 15 dòng SQL đầu tiên:');
    console.log(sql.split('\n').slice(0, 20).join('\n'));
    console.log('... (bỏ qua phần còn lại)');
    return { transformed, sql, articles };
  }

  if (isApply) {
    const seedPath = path.resolve('worker/migrations/0002_seed.sql');
    fs.writeFileSync(seedPath, sql, 'utf8');
    console.log(`\n[Apply] Đã cập nhật ${seedPath} (${sql.length} bytes).`);

    // Lưu kho tri thức bài viết vào worker
    const knowledgeDir = path.resolve('worker/src/data');
    if (!fs.existsSync(knowledgeDir)) {
      fs.mkdirSync(knowledgeDir, { recursive: true });
    }
    const knowledgePath = path.join(knowledgeDir, 'articles-knowledge.json');
    const articlesClean = articles.map(a => ({
      title: a.name,
      category: a.categoryName,
      slug: a.slug,
      quote: a.quote,
      image: normalizeImageUrl(a.image)
    }));
    fs.writeFileSync(knowledgePath, JSON.stringify(articlesClean, null, 2), 'utf8');
    console.log(`[Apply] Đã lưu ${articlesClean.length} bài viết vào ${knowledgePath}.`);
  }

  return { transformed, sql, articles };
}

// Auto run when executed directly
if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  run().catch(err => {
    console.error('[Sync Error]:', err);
    process.exit(1);
  });
}
