-- Migration 0008: Business Operations & Booking Platform (Phase 8.3 Additive)

CREATE TABLE IF NOT EXISTS tour_products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,
  duration_days INTEGER NOT NULL DEFAULT 1,
  min_travelers INTEGER NOT NULL DEFAULT 1,
  max_travelers INTEGER NOT NULL DEFAULT 20,
  base_price INTEGER NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  status TEXT NOT NULL DEFAULT 'published',
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tour_products_code ON tour_products(code);
CREATE INDEX IF NOT EXISTS idx_tour_products_status ON tour_products(status);

CREATE TABLE IF NOT EXISTS tour_product_destinations (
  id TEXT PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tour_products(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tour_dest_tour ON tour_product_destinations(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_dest_place ON tour_product_destinations(place_id);

CREATE TABLE IF NOT EXISTS tour_services (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  provider_name TEXT DEFAULT 'Trung tâm XTTM&DL Đắk Song',
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tour_services_code ON tour_services(code);
CREATE INDEX IF NOT EXISTS idx_tour_services_category ON tour_services(category);
CREATE INDEX IF NOT EXISTS idx_tour_services_active ON tour_services(is_active);

CREATE TABLE IF NOT EXISTS tour_price_rules (
  id TEXT PRIMARY KEY,
  service_id TEXT REFERENCES tour_services(id) ON DELETE CASCADE,
  tour_id TEXT REFERENCES tour_products(id) ON DELETE CASCADE,
  pricing_mode TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_rules_service ON tour_price_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_tour ON tour_price_rules(tour_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_active ON tour_price_rules(is_active);

CREATE TABLE IF NOT EXISTS booking_quotes (
  id TEXT PRIMARY KEY,
  quote_reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_id TEXT REFERENCES tour_products(id) ON DELETE SET NULL,
  itinerary_id TEXT REFERENCES travel_itineraries(id) ON DELETE SET NULL,
  itinerary_version INTEGER,
  adults_count INTEGER NOT NULL DEFAULT 1,
  children_count INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1,
  subtotal INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'VND',
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_quotes_user ON booking_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_quotes_ref ON booking_quotes(quote_reference);
CREATE INDEX IF NOT EXISTS idx_booking_quotes_status ON booking_quotes(status);

CREATE TABLE IF NOT EXISTS booking_quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES booking_quotes(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES tour_services(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  pricing_mode TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON booking_quote_items(quote_id);

CREATE TABLE IF NOT EXISTS tour_bookings (
  id TEXT PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL REFERENCES booking_quotes(id),
  tour_id TEXT REFERENCES tour_products(id) ON DELETE SET NULL,
  itinerary_id TEXT REFERENCES travel_itineraries(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  adults_count INTEGER NOT NULL DEFAULT 1,
  children_count INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  booking_status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tour_bookings_user ON tour_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_ref ON tour_bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_status ON tour_bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_payment ON tour_bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_tour_bookings_created ON tour_bookings(created_at);

CREATE TABLE IF NOT EXISTS tour_booking_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES tour_services(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  pricing_mode TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_booking_items_booking ON tour_booking_items(booking_id);

CREATE TABLE IF NOT EXISTS mock_payment_attempts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
  transaction_reference TEXT NOT NULL UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'mock_bank_transfer',
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  failure_reason TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_booking ON mock_payment_attempts(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_ref ON mock_payment_attempts(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON mock_payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created ON mock_payment_attempts(created_at);

CREATE TABLE IF NOT EXISTS booking_state_events (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES tour_bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_state_events_booking ON booking_state_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_state_events_created ON booking_state_events(created_at);

-- Seed Initial Tour Products (Idempotent)
INSERT INTO tour_products (id, code, title, description, cover_image_url, duration_days, min_travelers, max_travelers, base_price, status, is_demo)
VALUES
  ('tour-ds-01', 'TOUR-DS-01', 'Hành trình Xanh Nâm Nung 2N1Đ', 'Khám phá khu bảo tồn thiên nhiên Nâm Nung nguyên sinh, thác Lưu Ly hùng vĩ và trải nghiệm ẩm thực Tây Nguyên đặc trưng.', 'https://static.dggv.edu.vn/360/1679365017974_123201-nam-nung-4.jpg', 2, 2, 15, 1250000, 'published', 1),
  ('tour-ds-02', 'TOUR-DS-02', 'Văn hóa & Đặc sản Đắk Song 1N', 'Thưởng thức ẩm thực địa phương, ghé thăm nhà hàng bản địa và trải nghiệm check-in nông nghiệp đặc sản.', 'https://static.dggv.edu.vn/360/1682416024611_z3521274985805_e8d16a2bed051d7f25a13620a4ebfab3.jpg', 1, 1, 20, 650000, 'published', 1),
  ('tour-ds-03', 'TOUR-DS-03', 'Trải nghiệm Homestay & Cảnh quan 1N', 'Nghỉ dưỡng sinh thái, check-in ngắm hoàng hôn đồi thông Đắk Song và tận hưởng không khí trong lành.', 'https://static.dggv.edu.vn/360/1682416281765_IMG20190809101005.jpg', 1, 1, 10, 500000, 'published', 1)
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code,
  title = excluded.title,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url,
  duration_days = excluded.duration_days,
  base_price = excluded.base_price,
  status = excluded.status;

-- Seed Initial Tourism Services (Idempotent)
INSERT INTO tour_services (id, code, name, category, description, provider_name, place_id, is_active, is_demo)
VALUES
  ('srv-guide-01', 'SRV-GUIDE-01', 'Hướng dẫn viên bản địa tiếng Việt', 'guide', 'HDV am hiểu tường tận văn hóa địa phương, lịch sử rừng Nâm Nung và ẩm thực Đắk Song.', 'Hiệp hội Du lịch Đắk Song', NULL, 1, 1),
  ('srv-bus-01', 'SRV-BUS-01', 'Xe trung chuyển 7-16 chỗ', 'transport', 'Xe đưa đón khứ hồi từ thị trấn Đức An đến các điểm tham quan trên địa bàn huyện.', 'Hợp tác xã Vận tải Đắk Song', NULL, 1, 1),
  ('srv-ticket-nn', 'SRV-TICKET-NN', 'Vé tham quan Khu bảo tồn Nâm Nung', 'ticket', 'Vé vào cổng Khu BTTN Nâm Nung bao gồm bảo hiểm du lịch sinh thái.', 'Ban Quản lý KBTTN Nâm Nung', '360a56b1-324d-40df-98e7-f7ad6ece2404', 1, 1),
  ('srv-hotel-01', 'SRV-HOTEL-01', 'Phòng nghỉ sinh thái / Nhà nghỉ tiêu chuẩn', 'accommodation', 'Phòng nghỉ tiện nghi tại trung tâm huyện Đắk Song, thoáng mát, yên tĩnh.', 'Nhà nghỉ Hồng Nhiên', '0abe69cc-7e6c-4116-97f8-76a50303c730', 1, 1),
  ('srv-meal-01', 'SRV-MEAL-01', 'Set cơm lam gà nướng đặc sản', 'meal', 'Bữa ăn đậm vị truyền thống Tây Nguyên với gà nướng than hoa, cơm lam và rau rừng.', 'Nhà hàng Gun', '215a07df-2114-4653-8993-92874fe4af4a', 1, 1)
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  provider_name = excluded.provider_name,
  place_id = excluded.place_id,
  is_active = excluded.is_active;

-- Seed Price Rules for Services (Idempotent)
INSERT INTO tour_price_rules (id, service_id, tour_id, pricing_mode, unit_price, currency, is_active)
VALUES
  ('pr-guide-01', 'srv-guide-01', NULL, 'per_day', 500000, 'VND', 1),
  ('pr-bus-01', 'srv-bus-01', NULL, 'per_day', 1200000, 'VND', 1),
  ('pr-ticket-nn', 'srv-ticket-nn', NULL, 'per_person', 60000, 'VND', 1),
  ('pr-hotel-01', 'srv-hotel-01', NULL, 'per_night', 450000, 'VND', 1),
  ('pr-meal-01', 'srv-meal-01', NULL, 'per_person', 150000, 'VND', 1)
ON CONFLICT(id) DO UPDATE SET
  pricing_mode = excluded.pricing_mode,
  unit_price = excluded.unit_price,
  is_active = excluded.is_active;
