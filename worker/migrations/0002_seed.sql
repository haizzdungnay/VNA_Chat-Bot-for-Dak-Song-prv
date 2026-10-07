-- Migration 0002: Development placeholder seed data
-- LUU Y: Day la du lieu placeholder ro rang cho development, KHONG PHAI du lieu thuc te da xac minh.
-- Cac truong address, latitude, longitude, map_url, opening_hours, phone, website de NULL tranh hieu nham.

INSERT OR IGNORE INTO categories (id, slug, name, icon) VALUES
('cat-nature', 'thien-nhien', 'Thiên nhiên', 'zi-location'),
('cat-history', 'di-tich-lich-su', 'Di tích lịch sử', 'zi-home'),
('cat-food', 'am-thuc', 'Ẩm thực', 'zi-chat'),
('cat-checkin', 'check-in', 'Điểm check-in', 'zi-star');

INSERT OR IGNORE INTO places (
  id, slug, name, category_id, short_description, description,
  address, latitude, longitude, image_url, images_json, map_url,
  opening_hours, phone, website, is_featured
) VALUES
(
  'place-01',
  'dia-diem-mau-01',
  'Địa điểm mẫu 01',
  'cat-nature',
  'Dữ liệu mẫu phục vụ phát triển',
  'Dữ liệu placeholder dành cho kiểm thử và phát triển. Sẽ được cập nhật khi có dữ liệu chính thức.',
  NULL,
  NULL,
  NULL,
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=80',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  1
),
(
  'place-02',
  'dia-diem-mau-02',
  'Địa điểm mẫu 02',
  'cat-checkin',
  'Dữ liệu mẫu phục vụ phát triển',
  'Dữ liệu placeholder dành cho kiểm thử và phát triển. Sẽ được cập nhật khi có dữ liệu chính thức.',
  NULL,
  NULL,
  NULL,
  'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=600&q=80',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  1
),
(
  'place-03',
  'dia-diem-mau-03',
  'Địa điểm mẫu 03',
  'cat-nature',
  'Dữ liệu mẫu phục vụ phát triển',
  'Dữ liệu placeholder dành cho kiểm thử và phát triển. Sẽ được cập nhật khi có dữ liệu chính thức.',
  NULL,
  NULL,
  NULL,
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0
),
(
  'place-04',
  'dia-diem-mau-04',
  'Địa điểm mẫu 04',
  'cat-food',
  'Dữ liệu mẫu phục vụ phát triển',
  'Dữ liệu placeholder dành cho kiểm thử và phát triển. Sẽ được cập nhật khi có dữ liệu chính thức.',
  NULL,
  NULL,
  NULL,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  1
);
