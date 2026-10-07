-- Migration 0002: Development placeholder seed data
-- LUU Y: Day la du lieu placeholder cho development, khong phai du lieu thuc te da xac minh.
-- Khong tu sang tac gia ve, gio mo cua, so dien thoai that.

INSERT OR IGNORE INTO categories (id, slug, name, icon) VALUES
('cat-nature', 'thien-nhien', 'Thiên nhiên', 'zi-location'),
('cat-history', 'di-tich-lich-su', 'Di tích lịch sử', 'zi-home'),
('cat-food', 'am-thuc', 'Ẩm thực', 'zi-chat'),
('cat-checkin', 'check-in', 'Điểm check-in', 'zi-star');

INSERT OR IGNORE INTO places (
  id, slug, name, category_id, short_description, description,
  address, latitude, longitude, image_url, map_url, is_featured
) VALUES
(
  'place-01',
  'thac-mau-dak-song',
  'Địa điểm mẫu 01 - Thác mẫu Đắk Song (Placeholder)',
  'cat-nature',
  'Địa điểm mẫu thử nghiệm: Thác nước sinh thái Đắk Song.',
  'Dữ liệu mẫu cho môi trường development. Cảnh quan thác nước sinh thái Đắk Song phục vụ kiểm thử ứng dụng và trợ lý AI. Thông tin chính thức sẽ được cập nhật sau khi kiểm chứng.',
  'Huyện Đắk Song, tỉnh Đắk Nông (Địa chỉ mẫu)',
  12.28,
  107.60,
  'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=80',
  'https://maps.google.com',
  1
),
(
  'place-02',
  'doi-thong-mau-dak-song',
  'Địa điểm mẫu 02 - Đồi thông mẫu Đắk Song (Placeholder)',
  'cat-checkin',
  'Địa điểm mẫu thử nghiệm: Rừng thông cảnh quan Đắk Song.',
  'Dữ liệu mẫu cho môi trường development. Rừng thông thoáng đãng, thích hợp cắm trại và check-in trải nghiệm. Dữ liệu xác minh sẽ cập nhật sau.',
  'Huyện Đắk Song, tỉnh Đắk Nông (Địa chỉ mẫu)',
  12.26,
  107.58,
  'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=600&q=80',
  'https://maps.google.com',
  1
),
(
  'place-03',
  'nong-trai-mau-dak-song',
  'Địa điểm mẫu 03 - Vườn nông sản mẫu Đắk Song (Placeholder)',
  'cat-nature',
  'Địa điểm mẫu thử nghiệm: Vườn hồ tiêu và cà phê Đắk Song.',
  'Dữ liệu mẫu cho môi trường development. Nông trại hồ tiêu và cà phê mẫu phục vụ trải nghiệm nông nghiệp sinh thái.',
  'Huyện Đắk Song, tỉnh Đắk Nông (Địa chỉ mẫu)',
  12.30,
  107.62,
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
  'https://maps.google.com',
  0
),
(
  'place-04',
  'quan-an-dac-san-mau',
  'Địa điểm mẫu 04 - Quán ăn đặc sản mẫu (Placeholder)',
  'cat-food',
  'Địa điểm mẫu thử nghiệm: Ẩm thực truyền thống Đắk Song.',
  'Dữ liệu mẫu cho môi trường development. Món ăn truyền thống địa phương dùng để kiểm thử gợi ý ẩm thực từ AI.',
  'Thị trấn Đức An, Đắk Song, Đắk Nông (Địa chỉ mẫu)',
  12.27,
  107.59,
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  'https://maps.google.com',
  1
);
