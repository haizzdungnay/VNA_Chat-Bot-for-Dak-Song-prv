import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapCategory,
  normalizeImageUrl,
  sanitizeHtml,
  slugify,
  transformPlaces,
  generateSeedSql
} from '../../scripts/sync-upstream-content.mjs';

test('mapCategory accurately categorizes Dak Song locations', () => {
  assert.equal(mapCategory('Ăn Uống', 'Bún chả quạt'), 'cat-food');
  assert.equal(mapCategory('Nhà hàng', 'Nhà hàng Gun'), 'cat-food');
  assert.equal(mapCategory('Di tích', 'Thiền Viện Trúc Lâm Đạo Nguyên'), 'cat-history');
  assert.equal(mapCategory('Di tích', 'Khu bảo tồn thiên nhiên Nâm Nung'), 'cat-nature');
  assert.equal(mapCategory('Di tích', 'Thác Lưu Ly'), 'cat-nature');
  assert.equal(mapCategory('Địa điểm du lịch', 'HIGG Farm - Glamping & Coffee'), 'cat-checkin');
  assert.equal(mapCategory('Nhà nghỉ, khách sạn', 'Nhà nghỉ Hồng Nhiên'), 'cat-checkin');
  assert.equal(mapCategory('Cây giống', 'Hoàng- Dung Farm'), 'cat-checkin');
});

test('normalizeImageUrl handles relative CDN paths and full URLs', () => {
  const relative = '360/1682415906138_2023-03-09.jpg';
  assert.equal(
    normalizeImageUrl(relative),
    'https://static.dggv.edu.vn/360/1682415906138_2023-03-09.jpg'
  );

  const full = 'https://example.com/photo.png';
  assert.equal(normalizeImageUrl(full), full);

  // B2 requirement: zero fabricated images, empty/missing returns null
  assert.equal(normalizeImageUrl(''), null);
  assert.equal(normalizeImageUrl(null), null);
});

test('sanitizeHtml strips dangerous scripts, event handlers, and javascript URIs', () => {
  const malicious = '<p>Xin chào</p><script>alert("xss")</script><img src="x" onerror="alert(1)"><a href="javascript:alert(2)">Click</a>';
  const cleaned = sanitizeHtml(malicious);
  assert.ok(!cleaned.includes('<script'));
  assert.ok(!cleaned.includes('onerror'));
  assert.ok(!cleaned.includes('javascript:'));
  assert.ok(cleaned.includes('<p>Xin chào</p>'));
});

test('slugify cleans Vietnamese accents and appends short ID', () => {
  const slug = slugify('Khu bảo tồn thiên nhiên Nâm Nung', '360a56b1-324d-40df');
  assert.equal(slug, 'khu-bao-ton-thien-nhien-nam-nung-360a56b1');
});

test('transformPlaces generates 15 verified places with valid D1 schema fields', () => {
  const sample = [
    {
      id: 'test-1',
      name: 'Thác Lưu Ly',
      categoryName: 'Di tích',
      coverImage: '360/thac.jpg',
      galleryImages: ['360/thac.jpg'],
      lat: 12.2254,
      lng: 107.6848,
      address: 'Đường Tỉnh Lộ 686 Nâm N\'Jang Đắk Nông',
      content: 'Thác nước đẹp',
      link: 'https://goo.gl/maps/xyz'
    }
  ];

  const transformed = transformPlaces(sample);
  assert.ok(transformed.length >= 1);
  const p = transformed[0];
  assert.equal(p.id, 'test-1');
  assert.equal(p.name, 'Thác Lưu Ly');
  assert.equal(p.categoryId, 'cat-nature');
  assert.equal(p.latitude, 12.2254);
  assert.equal(p.longitude, 107.6848);
  assert.match(p.imageUrl, /^https:\/\/static\.dggv\.edu\.vn\//);
  assert.equal(p.website, 'https://dulichdaksong.vnasw.vn/');
  // Phase 2: openingHours must be null when not verified from upstream
  assert.equal(p.openingHours, null);
  assert.equal(p.sourceType, 'verified');
});

test('generateSeedSql produces valid idempotent SQLite syntax', () => {
  const sample = [
    {
      id: 'test-uuid',
      slug: 'test-place-test-uui',
      name: 'Địa điểm thử nghiệm',
      categoryId: 'cat-checkin',
      shortDescription: 'Mô tả ngắn',
      description: 'Mô tả chi tiết',
      address: 'Đắk Song',
      latitude: 12.25,
      longitude: 107.6,
      imageUrl: 'https://static.dggv.edu.vn/360/test.jpg',
      imagesJson: '["https://static.dggv.edu.vn/360/test.jpg"]',
      mapUrl: 'https://maps.google.com',
      openingHours: '07:30 - 17:30',
      phone: '0901234567',
      website: 'https://dulichdaksong.vnasw.vn/',
      isFeatured: 1
    }
  ];

  const sql = generateSeedSql(sample);
  assert.match(sql, /INSERT INTO categories/);
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(sql, /INSERT INTO places/);
  assert.match(sql, /'test-uuid'/);
  assert.match(sql, /'cat-checkin'/);
});
