# MA TRẬN KIỂM THỬ GIAO DIỆN & TƯƠNG THÍCH THIẾT BỊ (PHASE 5 QA MATRIX)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày thực hiện:** 09/10/2026  
**Tiêu chuẩn thiết kế:** Stitch Eco Modern (Light) & Highland Nocturne (Dark)  
**Phạm vi:** 4 màn hình chính, 2 modal/sheet, 3 kích thước viewport mobile, 2 chế độ màu.

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM THỬ GIAO DIỆN (UI/UX SUMMARY)

| Viewport | Kích thước đại diện | Chế độ sáng (Eco Modern) | Chế độ tối (Highland Nocturne) | Safe Area Notches | Kết luận |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **360 × 800** | Android Màn hình nhỏ (Galaxy A, Redmi) | **PASS** | **PASS** | Đạt (`env(safe-area)`) | Bố cục co giãn chuẩn, không tràn ngang |
| **390 × 844** | iOS Chuẩn (iPhone 12/13/14/15) | **PASS** | **PASS** | Đạt | Dynamic notch & Home bar an toàn |
| **430 × 932** | iOS Pro Max / Flagship lớn | **PASS** | **PASS** | Đạt (Dynamic Island) | Tận dụng tốt không gian, thẻ cân đối |

> **LƯU Ý QUAN TRỌNG VỀ THIẾT BỊ THẬT (REAL DEVICE NOTICE):**  
> Trạng thái kiểm thử trên máy thật: **REAL_DEVICE_NOT_VERIFIED** (do môi trường phát triển hiện tại chưa được cấp Zalo App ID để build bản quét mã QR trực tiếp trên ứng dụng Zalo di động). Toàn bộ logic, CSS safe-area, React component và layout responsive đã được xác minh đạt 100% trên môi trường giả lập trình duyệt và ZMP SDK.

---

## 2. MA TRẬN CHI TIẾT TỪNG MÀN HÌNH THEO VIEWPORT

### 2.1. Trang Chủ (Home - Route `/`)
- **Header:** Sticky top, độ mờ `backdrop-filter: blur(16px)`, hiển thị logo badge rừng xanh và tiêu đề "Du lịch Đắk Song".
- **Lưới 4 danh mục:** Hiển thị 4 thẻ vuông bo tròn 16px (Di tích, Thiên nhiên, Check-in, Ẩm thực). Tại 360px hiển thị 2 cột cân đối, không chồng lấn.
- **Danh sách địa điểm nổi bật:** Cuộn ngang mượt mà (`overflow-x: auto`), ảnh cover tỉ lệ chuẩn, hiển thị badge danh mục.
- **Chip gợi ý AI:** Tự động xuống dòng (`flex-wrap: wrap`), kích thước chạm tối thiểu 36px.

### 2.2. Khám Phá (Explore - Route `/explore`)
- **Thanh tìm kiếm:** Ô nhập văn bản kèm icon kính lúp, lọc thời gian thực tên và mô tả địa điểm.
- **Thanh tab danh mục ngang:** Bấm chọn chuyển đổi ngay lập tức, nút active có nền màu xanh `#137A3E`.
- **Thẻ PlaceCard:** Hiển thị tên địa điểm, ảnh đại diện, danh mục, địa chỉ rút gọn. Xử lý tốt ảnh bị lỗi (ẩn placeholder an toàn, không vỡ layout).

### 2.3. Chi Tiết Địa Điểm (Place Detail - Route `/place/:id`)
- **Ảnh Hero Cover:** Tràn viền đỉnh, nút Back nằm ở `top: calc(env(safe-area-inset-top, 0px) + 12px)`, không bị che bởi tai thỏ / camera đục lỗ.
- **Bộ sưu tập ảnh (Gallery):** Hiển thị các thumbnail, bấm mở xem ảnh; nếu không có gallery thì hiển thị ảnh bìa duy nhất.
- **Thông tin xác minh:** Địa chỉ thật, nút mở bản đồ Google Maps, số điện thoại (bấm gọi nếu có).
- **Điểm đến VR360:** Với địa điểm `source_type = 'vr360'`, hiển thị nhãn "Trải nghiệm thực tế ảo 3D VR360", ẩn mục giờ mở cửa và tọa độ GPS (tránh bịa thông tin).
- **Hỏi AI:** Nút "Hỏi trợ lý AI về địa điểm này" chuyển mượt sang `/chat?placeId=...`.

### 2.4. Trợ Lý AI Du Lịch (AI Chat - Route `/chat`)
- **Khu vực tin nhắn:** Có đệm đáy `padding-bottom: 100px` đảm bảo tin nhắn cuối cùng không bao giờ bị thanh nhập che khuất.
- **Thanh nhập liệu (Composer Bar):** Cố định tại `bottom: calc(60px + env(safe-area-inset-bottom, 0px))`, nằm ngay phía trên thanh bottom navigation 60px.
- **Thẻ PlaceCard gợi ý:** Render trực tiếp trong luồng chat nếu AI đề xuất, bấm vào chuyển ngay tới trang chi tiết.
- **Xử lý lỗi mạng:** Nút "Thử lại" chỉ gửi lại câu hỏi thất bại, không nhân đôi bong bóng tin nhắn.

---

## 3. KIỂM SOÁT Z-INDEX VÀ OVERLAY STACK

| Lớp thành phần | Giá trị z-index | Mục đích & Ranh giới tương tác |
| :--- | :---: | :--- |
| Nội dung nền (Page Content) | 1 | Luồng cuộn chính |
| Nút quay lại chi tiết (Back Button) | 10 | Luôn bấm được trên ảnh hero |
| Thanh nhập chat (Composer Bar) | 35 | Nổi trên nội dung chat, dưới nav |
| Thanh điều hướng dưới (Bottom Nav) | 40 | Cố định đáy 3 tab |
| Header trên cùng (Eco Header) | 40 | Cố định đỉnh |
| Welcome Bottom Sheet | 60 | Trượt từ dưới lên, che bottom nav |
| Toast thông báo toàn cục | 70 | Hiển thị giữa màn hình phía dưới |
| Modal đọc bài viết (ArticleModal) | 9999 | Toàn màn hình cao nhất, che toàn bộ UI |

---

## 4. XÁC MINH KHẮC PHỤC LỖI REACT HOOKS TRÊN ARTICLE MODAL
- **Vấn đề cũ (P2-04):** `ArticleModal` từng có lệnh `if (!article) return null;` trước lệnh `useMemo`, vi phạm React Rules of Hooks khi modal chuyển trạng thái `null -> article -> null`.
- **Khắc phục:** Đưa toàn bộ các lệnh Hooks (`useNavigate`, `useMemo`, `useCallback`) lên đầu component. Lệnh trả về `null` chỉ thực thi sau khi tất cả hooks đã được gọi.
- **Kết quả kiểm thử:** Bài test tự động số 13 trong `miniapp/test/fe-logic.test.mjs` xác nhận số lượng hook luôn bất biến (3 hooks) trong mọi chu kỳ render.
