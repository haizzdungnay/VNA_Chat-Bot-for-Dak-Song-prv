-- VNA Đắk Song D1 Official Seed Data (Generated from VNA Core API)
-- Timestamp: 2026-10-08T07:38:43.513Z

-- 1. Categories (Safe Idempotent Insert)
INSERT INTO categories (id, slug, name, icon) VALUES
  ('cat-history', 'di-tich-lich-su', 'Di tích lịch sử', 'zi-home'),
  ('cat-nature', 'thien-nhien', 'Thiên nhiên', 'zi-location'),
  ('cat-checkin', 'diem-check-in', 'Điểm check-in', 'zi-star'),
  ('cat-food', 'am-thuc', 'Ẩm thực', 'zi-chat')
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  name = excluded.name,
  icon = excluded.icon;

-- 2. Dọn dẹp dữ liệu mẫu ban đầu (place-01..04 nếu còn tồn tại)
DELETE FROM places WHERE id IN ('place-01', 'place-02', 'place-03', 'place-04');

-- 3. Official Places (15 Verified Locations from dulichdaksong.vnasw.vn)
INSERT INTO places (id, slug, name, category_id, short_description, description, address, latitude, longitude, image_url, images_json, map_url, opening_hours, phone, website, is_featured) VALUES
  ('84fcaaa1-5b4f-4389-9bc3-ff42e1dd6c82', 'bun-cha-quat-84fcaaa1', 'Bún chả quạt', 'cat-food', 'Quán ăn gia đình', 'Quán ăn gia đình', 'Thôn 10, xã Nam Bình, huyện Đắk Song', 12.284783257659528, 107.59647422345435, 'https://static.dggv.edu.vn/360/1682415906138_2023-03-09.jpg', '["https://static.dggv.edu.vn/360/1682415906138_2023-03-09.jpg"]', 'https://goo.gl/maps/2iCoG39vAcDm29BP7', '06:00 - 22:00', '0981302444', 'https://dulichdaksong.vnasw.vn/', 0),
  ('b9902337-0878-466c-880e-5151fd5f394a', 'higg-farm-glamping-coffee-b9902337', 'HIGG Farm - Glamping & Coffee', 'cat-checkin', 'Bạn có từng cùng người mình thương ngắm hoàng hôn trong lòng núi, một ngày ươm nắng cùng nhau chèo thuyền lãng mạn thả trôi trên mặt hồ xanh biếc. 
Đó...', 'Bạn có từng cùng người mình thương ngắm hoàng hôn trong lòng núi, một ngày ươm nắng cùng nhau chèo thuyền lãng mạn thả trôi trên mặt hồ xanh biếc. 
Đó là ngày ta được ở bên cạnh nhau tận hưởng từng giây phút an yên, những mảnh ký ức đẹp đẽ nhất… 💕
🎉 Cả Nhà Hãy Đến Với HIGG Farm Để Tận Hưởng Thư Giãn Bên Gia Đình & Người Thương Nhé!
⛺️⛺️⛺️ Higg Farm 🌲🌲🌲
🔸 Thôn 4, Xã Nâm N Jang, Đắk Song Tỉnh Đắk Nông ( Cách HCM Chỉ Hơn 4H)', 'Thôn 4, Đắk Song, Đắk Nông 640000, Việt Nam', 12.188943343503798, 107.62813277301623, 'https://static.dggv.edu.vn/360/1681379418700_330464010_1349343925899736_2201816785743800654_n.jpg', '["https://static.dggv.edu.vn/360/1681379418700_330464010_1349343925899736_2201816785743800654_n.jpg"]', 'https://goo.gl/maps/vRDhvQNwzCB12BKt5', '07:30 - 17:30', '0796567879', 'https://dulichdaksong.vnasw.vn/', 1),
  ('9b9fbe0a-6b9d-4fc0-b381-c75cf422a22d', 'hoang-dung-farm-9b9fbe0a', 'Hoàng- Dung Farm', 'cat-checkin', 'Cây trồng', 'Cây trồng', 'Unnamed Road, Đắk Song, Đắk Nông, Việt Nam', 12.254463503501807, 107.62155182210577, 'https://static.dggv.edu.vn/360/1682416759093_2022-05-05.jpg', '["https://static.dggv.edu.vn/360/1682416759093_2022-05-05.jpg"]', 'https://goo.gl/maps/CZ1QtqYAxDqqLUkH7', '07:30 - 17:30', '0336113002', 'https://dulichdaksong.vnasw.vn/', 0),
  ('360a56b1-324d-40df-98e7-f7ad6ece2404', 'khu-bao-ton-thien-nhien-nam-nung-360a56b1', 'Khu bảo tồn thiên nhiên Nâm Nung', 'cat-nature', 'Ẩn sâu trong khu bảo tồn thiên nhiên Nâm Nung, tỉnh Đắk Nông, là một hệ thống suối và thác dày đặc cùng đỉnh núi Nâm Nung cao hơn 1.500m. Du khách đừn...', 'Ẩn sâu trong khu bảo tồn thiên nhiên Nâm Nung, tỉnh Đắk Nông, là một hệ thống suối và thác dày đặc cùng đỉnh núi Nâm Nung cao hơn 1.500m. Du khách đừng bỏ qua cơ hội đến đây để cảm nhận không khí trong lành và vẻ hoang sơ của cảnh quan.', 'TL 686, Xã Nâm N''Jang, Huyện Đắk Song, Tỉnh Đắk Nông', 12.250514021821568, 107.81115241600715, 'https://static.dggv.edu.vn/360/1679365017974_123201-nam-nung-4.jpg', '["https://static.dggv.edu.vn/360/1679365017974_123201-nam-nung-4.jpg"]', 'https://goo.gl/maps/sbCCjLGsjPCQcWFV8', 'Cả ngày (Khuyến nghị 06:00 - 17:30)', NULL, 'https://dulichdaksong.vnasw.vn/', 1),
  ('215a07df-2114-4653-8993-92874fe4af4a', 'nha-hang-gun-215a07df', 'Nhà hàng Gun', 'cat-food', 'ẨM THỰC GUN - Ăn là mê - Phê quên lối
COFFEE GUN - Uống là mê - Phê quên lối', 'ẨM THỰC GUN - Ăn là mê - Phê quên lối
COFFEE GUN - Uống là mê - Phê quên lối', 'Tổ 1, Đăk Song District, Dak Nong, Vietnam', 12.264173197814051, 107.60828139303516, 'https://static.dggv.edu.vn/360/1682416024611_z3521274985805_e8d16a2bed051d7f25a13620a4ebfab3.jpg', '["https://static.dggv.edu.vn/360/1682416024611_z3521274985805_e8d16a2bed051d7f25a13620a4ebfab3.jpg"]', 'https://www.facebook.com/amthucgun/?ref=pages_you_manage', '06:00 - 22:00', '0347504750', 'https://dulichdaksong.vnasw.vn/', 0),
  ('b44037df-7ab5-4ddc-8748-b5926d4004c1', 'nha-hang-hai-san-tung-b44037df', 'Nhà hàng Hải Sản Tùng', 'cat-food', '7J27+WJM, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', '7J27+WJM, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', '7J27+WJM, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.252357245921743, 107.61404828805571, 'https://static.dggv.edu.vn/360/1682416110004_2021-05-03.jpg', '["https://static.dggv.edu.vn/360/1682416110004_2021-05-03.jpg"]', 'https://goo.gl/maps/wo7h9QtyAbfWmkZU8', '06:00 - 22:00', '0976413633', 'https://dulichdaksong.vnasw.vn/', 0),
  ('6b13b69d-4836-4ad5-ba56-11b504529826', 'nha-hang-trieu-dat-6b13b69d', 'Nhà hàng Triệu Đạt', 'cat-food', 'Nhà hàng', 'Nhà hàng', '7J26+RV6, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.252032170253218, 107.61214554548968, 'https://static.dggv.edu.vn/360/1682416169105_2023-03-09-(1).jpg', '["https://static.dggv.edu.vn/360/1682416169105_2023-03-09-(1).jpg"]', 'https://goo.gl/maps/MQAdwRgqXHdHLTcY6', '06:00 - 22:00', '0944747089', 'https://dulichdaksong.vnasw.vn/', 0),
  ('0abe69cc-7e6c-4116-97f8-76a50303c730', 'nha-nghi-hong-nhien-0abe69cc', 'Nhà nghỉ Hồng Nhiên', 'cat-checkin', 'Nhà nghỉ bình dân', 'Nhà nghỉ bình dân', '7J36+72W, QL14, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.253246872573776, 107.61008059511025, 'https://static.dggv.edu.vn/360/1682416227780_2023-01-30.jpg', '["https://static.dggv.edu.vn/360/1682416227780_2023-01-30.jpg"]', 'https://goo.gl/maps/GyHFo9xunwnzXAHz7', '07:30 - 17:30', '0945902519', 'https://dulichdaksong.vnasw.vn/', 0),
  ('3700d4cd-9164-4150-a3e6-45a33d0d06e6', 'nha-nghi-ngoc-sang-3700d4cd', 'Nhà nghỉ Ngọc Sáng', 'cat-checkin', 'Nhà nghỉ bình dân', 'Nhà nghỉ bình dân', '7J26+Q5Q, QL14, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.25193616459991, 107.61049686360523, 'https://static.dggv.edu.vn/360/1682416281765_IMG20190809101005.jpg', '["https://static.dggv.edu.vn/360/1682416281765_IMG20190809101005.jpg"]', 'https://goo.gl/maps/Y9qX6tPAnLgDEct99', '07:30 - 17:30', '0963800506', 'https://dulichdaksong.vnasw.vn/', 0),
  ('88d271e5-6702-4bc0-ab37-5f19e6c33b01', 'nha-nghi-thien-huong-88d271e5', 'Nhà Nghỉ Thiên Hương', 'cat-checkin', 'Nhà nghỉ bình dân', 'Nhà nghỉ bình dân', '7J36+33M, QL14, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.252691407104999, 107.61015255866883, 'https://static.dggv.edu.vn/360/1682416310365_20211130_074225.jpg', '["https://static.dggv.edu.vn/360/1682416310365_20211130_074225.jpg"]', 'https://goo.gl/maps/7W52hrMF1Fqpo3WaA', '07:30 - 17:30', '02613714499', 'https://dulichdaksong.vnasw.vn/', 0),
  ('6948847a-5629-4924-bbf4-cfb91622b1c8', 'pho-bo-bac-hai-6948847a', 'Phở bò Bắc Hải', 'cat-food', 'Quán ăn', 'Quán ăn', '7J36+396, QL14, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.25267705655884, 107.61090040195386, 'https://static.dggv.edu.vn/360/1682416351270_2023-01-14.jpg', '["https://static.dggv.edu.vn/360/1682416351270_2023-01-14.jpg"]', 'https://goo.gl/maps/NdmKh3Z8F2JS9fgH8', '06:00 - 22:00', NULL, 'https://dulichdaksong.vnasw.vn/', 0),
  ('beef28a3-316e-471c-8836-68f677697941', 'thien-vien-truc-lam-dao-nguyen-beef28a3', 'Thiền Viện Trúc Lâm Đạo Nguyên', 'cat-history', 'Nhắc tới các điểm đến linh thiêng ở Đắk Nông thì không ai là không biết tới Thiền Viện Trúc Lâm Đạo Nguyên - một cơ sở Phật giáo nổi tiếng, không chỉ ...', 'Nhắc tới các điểm đến linh thiêng ở Đắk Nông thì không ai là không biết tới Thiền Viện Trúc Lâm Đạo Nguyên - một cơ sở Phật giáo nổi tiếng, không chỉ sở hữu lối kiến trúc độc đáo, phong cách ấn tượng, mà còn có khu bảo tồn thiên nhiên vô cùng tuyệt vời. Tới đây, bạn sẽ có cơ hội hòa mình vào bầu không khí trong lành, dễ chịu, tận hưởng cảm giác an yên, mang tới sự thoải mái đến lạ thường.', 'huyện Đắk Song, Tỉnh Đắk Nông', 12.206906767809688, 107.70470029448451, 'https://static.dggv.edu.vn/360/1679364818513_thien-vien-truc-lam-dao-nguyen-5.jpg', '["https://static.dggv.edu.vn/360/1679364818513_thien-vien-truc-lam-dao-nguyen-5.jpg"]', 'https://goo.gl/maps/eCSKAUMYAq1a9m1aA', '07:30 - 17:30', NULL, 'https://dulichdaksong.vnasw.vn/', 1),
  ('c5e658bd-da7c-420d-9f5e-bdf8a61bcf42', 'thac-luu-ly-c5e658bd', 'Thác Lưu Ly', 'cat-nature', 'Không chỉ có thác Liêng Nung, Dray Nu, Dray Sáp, Gia Long mà bản đồ check-in tại Đắk Nông còn có một thác nước khác đẹp không kém, đó là thác Lưu Ly. ...', 'Không chỉ có thác Liêng Nung, Dray Nu, Dray Sáp, Gia Long mà bản đồ check-in tại Đắk Nông còn có một thác nước khác đẹp không kém, đó là thác Lưu Ly. Thác nước mang vẻ đẹp trời phú đang cực kỳ thu hút các tín đồ sống ảo đến check-in.', 'Đường Tỉnh Lộ 686 Nâm N''Jang Đắk Nông', 12.22541127316886, 107.68479586875392, 'https://static.dggv.edu.vn/360/1679365135640_daknong-thac-luu-ly.jpg', '["https://static.dggv.edu.vn/360/1679365135640_daknong-thac-luu-ly.jpg"]', 'https://goo.gl/maps/ki4kgsm85QMp2UY28', 'Cả ngày (Khuyến nghị 06:00 - 17:30)', NULL, 'https://dulichdaksong.vnasw.vn/', 1),
  ('8ec70c9d-6a86-47fe-be84-8c8f1ba022d4', 'trung-tam-y-te-huyen-dak-song-8ec70c9d', 'Trung tâm y tế huyện đắk song', 'cat-checkin', 'Trung tâm y tế huyện đắk song', 'Trung tâm y tế huyện đắk song', '7J74+9J7, QL14, Tổ 1, Đắk Song, Đắk Nông, Việt Nam', 12.263254814176838, 107.60498242761227, 'https://static.dggv.edu.vn/360/1682416945974_2022-04-23.jpg', '["https://static.dggv.edu.vn/360/1682416945974_2022-04-23.jpg"]', 'https://goo.gl/maps/5Nn9KBy4jEbCyEpg7', '07:30 - 17:30', '02613703006', 'https://dulichdaksong.vnasw.vn/', 0),
  ('d98b220b-bb9c-4fc4-9d8b-6e346fcc7496', 'am-thuc-hong-nhien-d98b220b', 'Ẩm thực Hồng Nhiên', 'cat-food', 'Nhà hàng', 'Nhà hàng', '7J85+9JM, Thị trấn Đức An, Đắk Song, Đắk Nông, Vietnam', 12.265875534650656, 107.60901103072162, 'https://static.dggv.edu.vn/360/1682415746498_2022-04-21.jpg', '["https://static.dggv.edu.vn/360/1682415746498_2022-04-21.jpg"]', 'https://goo.gl/maps/a84No5vk5NjdQLwN8', '06:00 - 22:00', '0989376179', 'https://dulichdaksong.vnasw.vn/', 0)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  name = excluded.name,
  category_id = excluded.category_id,
  short_description = excluded.short_description,
  description = excluded.description,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  image_url = excluded.image_url,
  images_json = excluded.images_json,
  map_url = excluded.map_url,
  opening_hours = excluded.opening_hours,
  phone = excluded.phone,
  website = excluded.website,
  is_featured = excluded.is_featured,
  updated_at = datetime('now');