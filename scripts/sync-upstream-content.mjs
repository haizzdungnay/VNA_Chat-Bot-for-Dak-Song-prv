/**
 * scripts/sync-upstream-content.mjs
 * Trích xuất 100% địa điểm và toàn bộ 42 bài viết từ Cổng du lịch Đắk Song (VNA Core API)
 * và tạo các bản nạp dữ liệu (seed) Idempotent cho Cloudflare D1.
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
  if (s.includes('nâm nung') || s.includes('thác') || s.includes('lưu ly') || s.includes('núi') || s.includes('rừng') || s.includes('thiên nhiên') || s.includes('sinh thái') || s.includes('hồ đắk') || s.includes('dã quỳ')) {
    return 'cat-nature';
  }
  if (s.includes('ăn uống') || s.includes('nhà hàng') || s.includes('ẩm thực') || s.includes('phở') || s.includes('bún') || s.includes('cơm') || s.includes('gà') || s.includes('vịt') || s.includes('nướng') || s.includes('cà đắng')) {
    return 'cat-food';
  }
  if (s.includes('trúc lâm') || s.includes('thiền viện') || s.includes('di tích') || s.includes('lịch sử') || s.includes('tâm linh') || s.includes('chùa') || s.includes('đạo trung') || s.includes('nhà rông') || s.includes('lễ hội') || s.includes('m’nông') || s.includes('bỏ mả') || s.includes('mừng lúa')) {
    return 'cat-history';
  }
  return 'cat-checkin'; // Địa điểm du lịch, farmstay, nhà nghỉ, cây giống, tiện ích, mua sắm, quảng trường, chợ, làng nghề
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
    } catch {}
    fullPlaces.push(detail);
  }

  // 2. Fetch ALL 42 Articles with full detail
  const artRes = await fetch(`${API_BASE}/post-public/find`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Department-Code': DEPT_CODE,
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({ pageNumber: 0, pageSize: 100 })
  });
  const artData = await artRes.json();
  const rawArticles = artData.data?.items || [];
  console.log(`[Sync] Tìm thấy ${rawArticles.length} bài viết tổng cộng.`);

  const fullArticles = [];
  for (const a of rawArticles) {
    let articleDetail = a;
    try {
      const dRes = await fetch(`${API_BASE}/post-public/${a.slug}`, {
        headers: { 'X-Department-Code': DEPT_CODE, 'User-Agent': 'Mozilla/5.0' }
      });
      if (dRes.ok) {
        const dData = await dRes.json();
        if (dData.data) articleDetail = dData.data;
      }
    } catch {}
    fullArticles.push(articleDetail);
  }

  return { places: fullPlaces, articles: fullArticles };
}

export function transformPlaces(rawPlaces, rawArticles = []) {
  const featuredIds = new Set([
    'beef28a3-316e-471c-8836-68f677697941', // Thiền Viện Trúc Lâm Đạo Nguyên
    '360a56b1-324d-40df-98e7-f7ad6ece2404', // Khu bảo tồn thiên nhiên Nâm Nung
    'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', // Thác Lưu Ly
    'b9902337-0878-466c-880e-5151fd5f394a', // HIGG Farm - Glamping & Coffee
    'f7cec5d2-d354-4a9a-83ae-98f7160e31ad', // Quảng Trường Đắk Song
    'eb1f6092-2d5d-4492-aa66-30a5581af606'  // Chợ huyện Đắk Song
  ]);

  // 1. Process 15 standard locations
  const resultPlaces = rawPlaces.map((p) => {
    const categoryId = mapCategory(p.categoryName, p.name);
    const imageUrl = normalizeImageUrl(p.coverImage);
    const gallery = (p.galleryImages || []).map(normalizeImageUrl);
    if (!gallery.includes(imageUrl)) gallery.unshift(imageUrl);

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

  // 2. Convert venue/spot-based articles into places to ensure ALL places from articles exist in places catalog
  const existingNames = new Set(resultPlaces.map(p => p.name.toLowerCase()));
  const venueArticles = rawArticles.filter(a => {
    const name = a.name.toLowerCase();
    const cat = (a.categoryName || '').toLowerCase();
    return (
      cat.includes('nhà hàng') ||
      cat.includes('ẩm thực') ||
      cat.includes('mua sắm') ||
      cat.includes('địa điểm giải trí') ||
      cat.includes('làng nghề') ||
      cat.includes('cơ sở lưu trú') ||
      cat.includes('di tích') ||
      name.includes('quán') ||
      name.includes('quảng trường') ||
      name.includes('chợ') ||
      name.includes('bệnh viện') ||
      name.includes('làng nghề') ||
      name.includes('đồi đạo trung')
    ) && !existingNames.has(name) && !name.includes('test');
  });

  for (const va of venueArticles) {
    const categoryId = mapCategory(va.categoryName, va.name);
    const imageUrl = normalizeImageUrl(va.image);
    const rawQuote = (va.quote || '').trim();
    const rawContent = (va.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const desc = rawContent || rawQuote || `Điểm đến du lịch văn hóa tại Đắk Song: ${va.name}`;
    const shortDesc = (rawQuote || desc).slice(0, 150);

    let address = 'Huyện Đắk Song, Tỉnh Đắk Nông';
    if (rawQuote && (rawQuote.includes('Quốc Lộ') || rawQuote.includes('QL') || rawQuote.includes('xã') || rawQuote.includes('Thị trấn'))) {
      address = rawQuote.split('\n')[0].replace(/^Địa chỉ.*?:/i, '').trim();
    }

    resultPlaces.push({
      id: va.id,
      slug: slugify(va.name, va.id),
      name: va.name.trim(),
      categoryId,
      shortDescription: shortDesc,
      description: desc,
      address,
      latitude: 12.2499,
      longitude: 107.5681,
      imageUrl,
      imagesJson: JSON.stringify([imageUrl]),
      mapUrl: `https://maps.google.com/?q=${encodeURIComponent(va.name + ' Đắk Song')}`,
      openingHours: categoryId === 'cat-food' ? '07:00 - 21:30' : '07:30 - 17:30',
      phone: null,
      website: `https://dulichdaksong.vnasw.vn/bai-viet/${va.slug}`,
      isFeatured: featuredIds.has(va.id) ? 1 : 0
    });
  }

  return resultPlaces;
}

export function transformArticles(rawArticles) {
  return rawArticles.map(a => {
    const imageUrl = normalizeImageUrl(a.image);
    // Sanitize huge inlined base64 editor blobs by pointing to cover image
    const cleanContent = (a.content || a.quote || '')
      .replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="' + imageUrl + '"')
      .trim();

    return {
      id: a.id,
      slug: a.slug,
      title: a.name.trim(),
      categoryName: (a.categoryName || 'Văn hóa - Du lịch').trim(),
      quote: (a.quote || '').trim(),
      content: cleanContent,
      imageUrl,
      publishDate: a.publishDate || new Date().toISOString().split('T')[0],
      viewCount: a.view || 0
    };
  });
}

export function generateSeedSql(transformedPlaces = [], transformedArticles = []) {
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
    '-- 2. Dọn dẹp dữ liệu mẫu ban đầu (place-01..04)',
    `DELETE FROM places WHERE id IN ('place-01', 'place-02', 'place-03', 'place-04');`,
    '',
    `-- 3. Places (${transformedPlaces.length} địa danh & điểm dịch vụ từ Cổng thông tin du lịch Đắk Song)`
  ];

  for (const p of transformedPlaces) {
    lines.push(
      `INSERT INTO places (id, slug, name, category_id, short_description, description, address, latitude, longitude, image_url, images_json, map_url, opening_hours, phone, website, is_featured) VALUES (${escapeSql(p.id)}, ${escapeSql(p.slug)}, ${escapeSql(p.name)}, ${escapeSql(p.categoryId)}, ${escapeSql(p.shortDescription)}, ${escapeSql(p.description)}, ${escapeSql(p.address)}, ${p.latitude}, ${p.longitude}, ${escapeSql(p.imageUrl)}, ${escapeSql(p.imagesJson)}, ${escapeSql(p.mapUrl)}, ${escapeSql(p.openingHours)}, ${escapeSql(p.phone)}, ${escapeSql(p.website)}, ${p.isFeatured}) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, category_id = excluded.category_id, short_description = excluded.short_description, description = excluded.description, address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude, image_url = excluded.image_url, images_json = excluded.images_json, map_url = excluded.map_url, opening_hours = excluded.opening_hours, phone = excluded.phone, website = excluded.website, is_featured = excluded.is_featured, updated_at = datetime('now');`
    );
  }

  lines.push('');
  lines.push(`-- 4. Articles Table & Data (${transformedArticles.length} bài viết toàn văn)`);
  lines.push(`CREATE TABLE IF NOT EXISTS articles (`);
  lines.push(`  id TEXT PRIMARY KEY,`);
  lines.push(`  slug TEXT NOT NULL UNIQUE,`);
  lines.push(`  title TEXT NOT NULL,`);
  lines.push(`  category_name TEXT NOT NULL,`);
  lines.push(`  quote TEXT,`);
  lines.push(`  content TEXT,`);
  lines.push(`  image_url TEXT,`);
  lines.push(`  publish_date TEXT,`);
  lines.push(`  view_count INTEGER DEFAULT 0,`);
  lines.push(`  created_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  lines.push(`);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);`);
  lines.push(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_name);`);
  lines.push('');

  for (const a of transformedArticles) {
    lines.push(
      `INSERT INTO articles (id, slug, title, category_name, quote, content, image_url, publish_date, view_count) VALUES (${escapeSql(a.id)}, ${escapeSql(a.slug)}, ${escapeSql(a.title)}, ${escapeSql(a.categoryName)}, ${escapeSql(a.quote)}, ${escapeSql(a.content)}, ${escapeSql(a.imageUrl)}, ${escapeSql(a.publishDate)}, ${a.viewCount}) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, title = excluded.title, category_name = excluded.category_name, quote = excluded.quote, content = excluded.content, image_url = excluded.image_url, publish_date = excluded.publish_date, view_count = excluded.view_count;`
    );
  }

  return lines.join('\n');
}

export async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const isApply = process.argv.includes('--apply');

  console.log(`=== VNA ĐẮK SONG FULL DATA SYNC TOOL [${isDryRun ? 'DRY-RUN' : isApply ? 'APPLY' : 'INSPECT'}] ===`);
  
  const { places, articles } = await fetchUpstreamData();
  const transformedPlaces = transformPlaces(places, articles);
  const transformedArticles = transformArticles(articles);

  console.log(`\n--- Đã chuẩn hóa ${transformedPlaces.length} địa điểm và ${transformedArticles.length} bài viết toàn văn ---`);

  const sql = generateSeedSql(transformedPlaces, transformedArticles);

  if (isDryRun) {
    console.log('\n[Dry-Run] Xem trước SQL:');
    console.log(sql.split('\n').slice(0, 30).join('\n'));
    console.log('... (bỏ qua phần còn lại)');
    return { transformedPlaces, transformedArticles, sql };
  }

  if (isApply) {
    const seedPath = path.resolve('worker/migrations/0002_seed.sql');
    fs.writeFileSync(seedPath, sql, 'utf8');
    console.log(`\n[Apply] Đã cập nhật ${seedPath} (${sql.length} bytes / ${Math.round(sql.length / 1024)} KB).`);

    // Lưu toàn bộ kho tri thức bài viết vào worker
    const knowledgeDir = path.resolve('worker/src/data');
    if (!fs.existsSync(knowledgeDir)) {
      fs.mkdirSync(knowledgeDir, { recursive: true });
    }
    const knowledgePath = path.join(knowledgeDir, 'articles-knowledge.json');
    fs.writeFileSync(knowledgePath, JSON.stringify(transformedArticles, null, 2), 'utf8');
    console.log(`[Apply] Đã lưu ${transformedArticles.length} bài viết vào ${knowledgePath}.`);
  }

  return { transformedPlaces, transformedArticles, sql };
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase()) {
  run().catch(err => {
    console.error('[Sync Error]:', err);
    process.exit(1);
  });
}
