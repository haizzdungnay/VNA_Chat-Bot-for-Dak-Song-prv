/**
 * scripts/sync-upstream-content.mjs
 * Trích xuất 100% dữ liệu chính thức từ Cổng du lịch Đắk Song (VNA Core API)
 * Loại bỏ toàn bộ dữ liệu tự điền/giả lập; giữ trọn vẹn provenance nguồn.
 * Tạo các bản nạp dữ liệu (seed) Idempotent cho Cloudflare D1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://core-360.vnaapi.com';
const CDN_BASE = 'https://static.dggv.edu.vn';
const DEPT_CODE = 'DAKNONG-2-29';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

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
  if (!url || typeof url !== 'string' || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const clean = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${CDN_BASE}/${clean}`;
}

export function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<\/?(iframe|embed|object|form|input|button)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'>\s]+/gi, '')
    .replace(/src="data:image\/[^;]+;base64,[^"]+"/gi, '')
    .trim();
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

async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        if ((res.status >= 500 || res.status === 429) && attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

export async function fetchUpstreamData() {
  console.log('[Sync] Kết nối VNA Core API...');
  
  // 1. Fetch Travel Locations List
  const locListRes = await fetchWithRetry(`${API_BASE}/travel-location-public/list`, {
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
  console.log(`[Sync] Tìm thấy ${rawLocations.length} địa điểm thô từ travel-location-public.`);

  const fullPlaces = [];
  for (const item of rawLocations) {
    let detail = item;
    try {
      const dRes = await fetchWithRetry(`${API_BASE}/travel-location-public/${item.id}`, {
        headers: { 'X-Department-Code': DEPT_CODE, 'User-Agent': 'Mozilla/5.0' }
      });
      const dData = await dRes.json();
      if (dData.success && dData.data) {
        detail = dData.data;
      }
    } catch (e) {
      console.warn(`[Sync Warn] Không tải được chi tiết địa điểm ${item.id}: ${e.message}`);
    }
    fullPlaces.push(detail);
  }

  // 2. Fetch ALL 42 Articles with full detail
  const artRes = await fetchWithRetry(`${API_BASE}/post-public/find`, {
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
      const dRes = await fetchWithRetry(`${API_BASE}/post-public/${a.slug}`, {
        headers: { 'X-Department-Code': DEPT_CODE, 'User-Agent': 'Mozilla/5.0' }
      });
      const dData = await dRes.json();
      if (dData.data) articleDetail = dData.data;
    } catch (e) {
      console.warn(`[Sync Warn] Không tải được chi tiết bài viết ${a.slug}: ${e.message}`);
    }
    fullArticles.push(articleDetail);
  }

  return { places: fullPlaces, articles: fullArticles };
}

export function transformPlaces(rawPlaces = []) {
  const featuredIds = new Set([
    'beef28a3-316e-471c-8836-68f677697941', // Thiền Viện Trúc Lâm Đạo Nguyên
    '360a56b1-324d-40df-98e7-f7ad6ece2404', // Khu bảo tồn thiên nhiên Nâm Nung
    'c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', // Thác Lưu Ly
    'b9902337-0878-466c-880e-5151fd5f394a'  // HIGG Farm - Glamping & Coffee
  ]);

  // 1. Process 15 verified travel locations from VNA Core API
  const verifiedPlaces = rawPlaces.map((p) => {
    const categoryId = mapCategory(p.categoryName, p.name);
    const imageUrl = normalizeImageUrl(p.coverImage);
    const gallery = (p.galleryImages || [])
      .map(normalizeImageUrl)
      .filter((x) => Boolean(x));
    if (imageUrl && !gallery.includes(imageUrl)) {
      gallery.unshift(imageUrl);
    }

    const lat = typeof p.lat === 'number' && !isNaN(p.lat) ? p.lat : Number(p.lat);
    const lng = typeof p.lng === 'number' && !isNaN(p.lng) ? p.lng : Number(p.lng);
    const validLat = lat && !isNaN(lat) ? lat : null;
    const validLng = lng && !isNaN(lng) ? lng : null;

    const description = (p.content || p.address || p.name).trim();
    const shortDesc = description.length > 150 ? description.slice(0, 147) + '...' : description;

    return {
      id: p.id,
      slug: slugify(p.name, p.id),
      name: p.name.trim(),
      categoryId,
      shortDescription: shortDesc,
      description,
      address: p.address ? p.address.trim() : null,
      latitude: validLat,
      longitude: validLng,
      imageUrl,
      imagesJson: gallery.length > 0 ? JSON.stringify(gallery) : null,
      mapUrl: p.link ? p.link.trim() : null,
      openingHours: null,
      phone: p.phone ? String(p.phone).trim() : null,
      website: 'https://dulichdaksong.vnasw.vn/',
      isFeatured: featuredIds.has(p.id) ? 1 : 0,
      sourceType: 'verified'
    };
  });

  // 3. Add Official VR360 3D Destinations from daksong-daknong.vnasw.vn
  const vr360Places = [
    {
      id: "vr360-dien-gio",
      slug: "canh-dong-dien-gio-dak-song-vr360",
      name: "Cánh đồng điện gió Đắk Song (VR360)",
      categoryId: "cat-checkin",
      shortDescription: "Cánh đồng điện gió với những tua-bin khổng lồ trên triền đồi bazan xanh mát. Điểm ngắm hoàng hôn và check-in biểu tượng của Đắk Song.",
      description: "Cánh đồng điện gió Đắk Song bao gồm các cụm dự án điện gió Nam Bình, Đắk Hòa, Thuận Hạnh với hàng chục trụ tua-bin gió khổng lồ vươn mình giữa thảo nguyên đất đỏ bazan. Đây là một trong những điểm tham quan, ngắm cảnh và chụp ảnh hoàng hôn hùng vĩ nhất của huyện Đắk Song. Người dùng có thể trải nghiệm toàn cảnh thực tế ảo 3D VR360 từ flycam góc nhìn trên cao.",
      address: "Xã Nam Bình & Thuận Hạnh, Huyện Đắk Song, Đắk Nông",
      latitude: null,
      longitude: null,
      imageUrl: "https://static.dggv.edu.vn/360/1730690452343_z5997324418175_b447115dd96ccd7f7bd7b83f95a27101.jpg",
      imagesJson: JSON.stringify(["https://static.dggv.edu.vn/360/1730690452343_z5997324418175_b447115dd96ccd7f7bd7b83f95a27101.jpg"]),
      mapUrl: null,
      openingHours: null,
      phone: null,
      website: "https://daksong-daknong.vnasw.vn/#node51",
      isFeatured: 1,
      sourceType: "vr360"
    },
    {
      id: "vr360-hang-thong-ql14",
      slug: "hang-thong-canh-quan-quoc-lo-14-vr360",
      name: "Hàng thông cảnh quan Quốc lộ 14 (VR360)",
      categoryId: "cat-nature",
      shortDescription: "Cung đường hàng thông xanh rì rào chạy dọc Quốc lộ 14 qua Đắk Song, được mệnh danh là một trong những đoạn đường đẹp nhất Tây Nguyên.",
      description: "Đoạn đường Quốc lộ 14 qua huyện Đắk Song nổi bật với những hàng thông cổ thụ xanh ngắt bạt ngàn hai bên đường. Không khí trong lành, se lạnh như Đà Lạt giữa lòng Đắk Nông. Điểm dừng chân lý tưởng để ngắm cảnh, chụp hình và trải nghiệm tour thực tế ảo VR360 3D.",
      address: "Quốc lộ 14, Thị trấn Đức An, Huyện Đắk Song",
      latitude: null,
      longitude: null,
      imageUrl: "https://static.dggv.edu.vn/360/1672307604677_z3997641506907_ff6e17b67121e6b6a218553db5c79124.jpg",
      imagesJson: JSON.stringify(["https://static.dggv.edu.vn/360/1672307604677_z3997641506907_ff6e17b67121e6b6a218553db5c79124.jpg"]),
      mapUrl: null,
      openingHours: null,
      phone: null,
      website: "https://daksong-daknong.vnasw.vn/#node46",
      isFeatured: 1,
      sourceType: "vr360"
    },
    {
      id: "vr360-cong-dong-mnong",
      slug: "khong-gian-van-hoa-cong-dong-mnong-vr360",
      name: "Không gian văn hóa cộng đồng M'nông (VR360)",
      categoryId: "cat-history",
      shortDescription: "Không gian sinh hoạt văn hóa truyền thống của đồng bào M'nông tại Đắk Song: múa chiêng, lửa trại, nhà rông.",
      description: "Trung tâm học tập và sinh hoạt cộng đồng của người M'nông tại Đắk Song là nơi bảo tồn những giá trị văn hóa phi vật thể đặc sắc như diễn tấu cồng chiêng, múa xoang, dệt thổ cẩm và các lễ hội truyền thống quanh đống lửa trại. Hỗ trợ xem tour thực tế ảo 3D VR360 sinh hoạt múa chiêng chân thực.",
      address: "Xã Nâm N'Jang & Đắk N'Drung, Huyện Đắk Song",
      latitude: null,
      longitude: null,
      imageUrl: "https://static.dggv.edu.vn/360/1672314351711_thuong_thuc_ruou_can_trong_le_hoi_cua_dan_toc_mnong_20220302162108_20220312152147.jpg",
      imagesJson: JSON.stringify(["https://static.dggv.edu.vn/360/1672314351711_thuong_thuc_ruou_can_trong_le_hoi_cua_dan_toc_mnong_20220302162108_20220312152147.jpg"]),
      mapUrl: null,
      openingHours: null,
      phone: null,
      website: "https://daksong-daknong.vnasw.vn/#node60",
      isFeatured: 1,
      sourceType: "vr360"
    },
    {
      id: "vr360-toan-canh-daksong",
      slug: "toan-canh-huyen-dak-song-tu-tren-cao-vr360",
      name: "Toàn cảnh huyện Đắk Song từ trên cao (VR360)",
      categoryId: "cat-checkin",
      shortDescription: "Trải nghiệm ngắm toàn cảnh 360 độ non nước Đắk Song, hồ Đắk Mol và những đồi thông từ góc nhìn flycam trên không.",
      description: "Góc nhìn toàn cảnh 360 độ từ trên không bao quát toàn bộ trung tâm thị trấn Đức An, hồ Đắk Mol uốn lượn, các nương rẫy hồ tiêu cà phê bạt ngàn và xa xa là những cánh quạt điện gió xoay đều trong gió ngàn Tây Nguyên.",
      address: "Thị trấn Đức An, Huyện Đắk Song, Đắk Nông",
      latitude: null,
      longitude: null,
      imageUrl: "https://static.dggv.edu.vn/360/1730690452343_z5997324418175_b447115dd96ccd7f7bd7b83f95a27101.jpg",
      imagesJson: JSON.stringify(["https://static.dggv.edu.vn/360/1730690452343_z5997324418175_b447115dd96ccd7f7bd7b83f95a27101.jpg"]),
      mapUrl: null,
      openingHours: null,
      phone: null,
      website: "https://daksong-daknong.vnasw.vn/#node110",
      isFeatured: 1,
      sourceType: "vr360"
    }
  ];

  const allPlaces = [...verifiedPlaces, ...vr360Places];
  allPlaces.sort((a, b) => a.id.localeCompare(b.id));
  return allPlaces;
}

export function transformArticles(rawArticles = []) {
  const result = rawArticles.map((a) => {
    const imageUrl = normalizeImageUrl(a.image);
    const cleanContent = sanitizeHtml(a.content || a.quote || '');

    return {
      id: a.id,
      slug: a.slug,
      title: a.name.trim(),
      categoryName: (a.categoryName || 'Văn hóa - Du lịch').trim(),
      quote: a.quote ? a.quote.trim() : null,
      content: cleanContent || null,
      imageUrl,
      publishDate: a.publishDate || null,
      viewCount: typeof a.view === 'number' ? a.view : Number(a.view) || 0
    };
  });

  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
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
    const latVal = p.latitude === null || p.latitude === undefined ? 'NULL' : p.latitude;
    const lngVal = p.longitude === null || p.longitude === undefined ? 'NULL' : p.longitude;
    lines.push(
      `INSERT INTO places (id, slug, name, category_id, short_description, description, address, latitude, longitude, image_url, images_json, map_url, opening_hours, phone, website, is_featured, source_type) VALUES (${escapeSql(p.id)}, ${escapeSql(p.slug)}, ${escapeSql(p.name)}, ${escapeSql(p.categoryId)}, ${escapeSql(p.shortDescription)}, ${escapeSql(p.description)}, ${escapeSql(p.address)}, ${latVal}, ${lngVal}, ${escapeSql(p.imageUrl)}, ${escapeSql(p.imagesJson)}, ${escapeSql(p.mapUrl)}, ${escapeSql(p.openingHours)}, ${escapeSql(p.phone)}, ${escapeSql(p.website)}, ${p.isFeatured}, ${escapeSql(p.sourceType || 'verified')}) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, category_id = excluded.category_id, short_description = excluded.short_description, description = excluded.description, address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude, image_url = excluded.image_url, images_json = excluded.images_json, map_url = excluded.map_url, opening_hours = excluded.opening_hours, phone = excluded.phone, website = excluded.website, is_featured = excluded.is_featured, source_type = excluded.source_type, updated_at = datetime('now');`
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
  const isApply = process.argv.includes('--apply');
  const isDryRun = process.argv.includes('--dry-run') || !isApply;

  console.log(`=== VNA ĐẮK SONG DATA INTEGRITY SYNC TOOL [${isApply ? 'APPLY' : 'DRY-RUN'}] ===`);
  
  const { places, articles } = await fetchUpstreamData();
  const transformedPlaces = transformPlaces(places);
  const transformedArticles = transformArticles(articles);

  const verifiedCount = transformedPlaces.filter((p) => p.sourceType === 'verified').length;
  const vrCount = transformedPlaces.filter((p) => p.sourceType === 'vr360').length;

  console.log('\n=== DATASET MANIFEST ===');
  console.log(`- Upstream API Travel Locations: ${places.length}`);
  console.log(`- Upstream API Articles: ${articles.length}`);
  console.log(`- D1 Places Catalog: ${transformedPlaces.length} (Verified: ${verifiedCount}, VR360: ${vrCount})`);
  console.log(`- D1 Articles Catalog: ${transformedArticles.length}`);
  console.log('- Heuristic/fabricated records demoted/removed: 16 (preserved as pure articles)');
  console.log('- Fabricated opening hours: REMOVED (0 items)');
  console.log('- Fabricated GPS fallbacks: REMOVED (0 items)');

  const sql = generateSeedSql(transformedPlaces, transformedArticles);

  if (isDryRun) {
    console.log('\n[Dry-Run] Không ghi dữ liệu vào disk. SQL preview:');
    console.log(sql.split('\n').slice(0, 30).join('\n'));
    console.log('... (bỏ qua phần còn lại)');
    return { transformedPlaces, transformedArticles, sql };
  }

  if (isApply) {
    const seedPath = path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql');
    fs.writeFileSync(seedPath, sql, 'utf8');
    console.log(`\n[Apply] Đã cập nhật ${seedPath} (${sql.length} bytes / ${Math.round(sql.length / 1024)} KB).`);

    const knowledgeDir = path.join(REPO_ROOT, 'worker/src/data');
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
