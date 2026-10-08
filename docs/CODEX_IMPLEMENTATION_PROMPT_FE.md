Codex Implementation Prompt — VNA Đắk Song Zalo Mini App FE (Light/Dark + Onboarding)
Dành cho: Codex làm việc trực tiếp trên repository đã có backend foundation và frontend skeleton.
Phạm vi: Hoàn thiện 4 màn FE đã duyệt trong Stitch, 2 theme, và Welcome/Personalization Bottom Sheet mới.
Lưu ý: Đây là bản thay thế toàn bộ prompt implement FE trước đó, không phải chỉ một phần bổ sung. Dùng prompt này sau khi đã xuất và đưa cả hai ZIP Stitch vào workspace Codex.

0. Repository, tài liệu đầu vào và mục tiêu
Repository: https://github.com/haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv
Project đã có:
- Frontend: React 18, TypeScript strict, Vite, zmp-sdk, zmp-ui, zmp-vite-plugin, ZMPRouter.
- Backend: Cloudflare Workers native fetch router, Cloudflare D1, 2 AI providers (Workers AI/OpenAI-compatible).
- API foundation đã freeze:
  - GET /api/health
  - GET /api/categories
  - GET /api/places
  - GET /api/places/:id
  - POST /api/chat
- D1 schema và backend architecture đã chốt. Không rewrite, không tạo backend profile mới.
Mục tiêu: Implement trực tiếp một Zalo Mini App Smart Tourism Đắk Song trông giống thiết kế Stitch đã duyệt, chạy được trên mobile/WebView, dùng đúng API hiện tại, có AI Chat, có Light/Dark, thêm onboarding cá nhân hóa nhẹ trong lần dùng đầu.
Viết code thực sự, không dừng ở kế hoạch, mockup hoặc mô tả. Deadline MVP rất ngắn, ưu tiên hoàn thành luồng chính, không mở rộng chức năng không cần thiết.
1. Nguồn thiết kế — BẮT BUỘC INSPECT TRƯỚC
Có hai gói thiết kế riêng:
1. Baseline 8 màn đã duyệt: design-reference/stitch-final.zip.
   - Home Light/Dark.
   - Explore Light/Dark.
   - Place Detail Light/Dark.
   - AI Chat Light/Dark.
   - Các file screen.png, code.html, DESIGN.md tương ứng.
2. Bổ sung onboarding: design-reference/stitch-onboarding.zip.
   - Welcome/Personalization Bottom Sheet Light/Dark overlay trên Home.
   - Có thể gồm bản editing state và design addendum.
Giải nén/đọc cả hai. Có thể để file tham chiếu trong design-reference/stitch-final/ và design-reference/stitch-onboarding/ mà không nhúng nguyên HTML thiết kế vào frontend.
Nếu thiếu một trong hai ZIP, dừng và yêu cầu cung cấp file, không tự sáng tác onboarding hoặc redesign các màn.
Thứ tự ưu tiên khi có xung đột:
1. Ảnh Stitch (screen.png) cho bố cục/thẩm mỹ, trừ chỗ screenshot bị lỗi hiển thị.
2. code.html cho thành phần, spacing, size, layout, màu.
3. DESIGN.md cho typography, color tokens, guideline.
4. Quy định kỹ thuật đã chốt trong prompt này và compatibility Zalo Mini App.
Một số screenshot Light Mode ở bản Stitch trước có thể bị render thiếu nội dung dù HTML đầy đủ. Không copy màn trắng/hỏng; kiểm tra screenshot và HTML để suy ra bố cục đã duyệt.
Không thiết kế lại. Không dùng template travel app khác.
2. Visual baseline — ĐÃ DUYỆT
Ngôn ngữ: Eco Modern + Central Highlands Identity + Smart Tourism.
Màu Light Mode thương hiệu:
- Forest Green: #1F5D42.
- Leaf Green: #65A96E.
- Earth Ochre: #C58A3A.
- Light Earth: #E7C37A.
- Background: #F6F8F5.
- Surface: #FFFFFF.
- Primary text: #1C2520.
- Muted text: #6B756F.
Dark Mode: lấy từ Stitch Highland Nocturne đã duyệt; không tự đổi sang màu neon/tím. Nếu DESIGN.md có token mâu thuẫn với HTML/ảnh đã duyệt, chuẩn hóa token nội bộ theo thành phẩm đã duyệt.
- Một cây React component dùng chung cho hai theme; chỉ khác CSS variables/style tokens.
- Dùng CSS custom properties tập trung (hoặc approach gọn tương đương), không copy hai bộ page code.
- Typography, spacing, radius, cards, image treatment, bottom navigation phải nhất quán.
- Ưu tiên ảnh du lịch lớn, white space, shadow mỏng, ảnh tự nhiên, vàng đất dùng ít.
- Tối ưu viewport 390 × 844, responsive 360–430px.
- Không dựng lại status bar/title bar giả của Zalo, không tạo nested bottom nav.
Theme behavior:
- Theo system theme trong lần đầu.
- Cho người dùng chọn Light/Dark một cách nhẹ nhàng, không làm thay đổi layout Stitch.
- Nếu người dùng override, lưu tùy chọn riêng biệt và giữ ổn định qua các màn/lần mở app.
- Chuyển theme không được reset chat hoặc đóng/mở lại luồng điều hướng ngoài ý muốn.
3. Routing & app shell
Dùng ZMPRouter hiện có; giữ đúng 4 trang chính, 3 tab:
Route	Màn	Tab bottom navigation
/	Home	Trang chủ
/explore	Explore	Khám phá
/place/:id	Place Detail	Không cần tab nếu thiết kế yêu cầu immersive
/chat	AI Travel Assistant	Trợ lý AI


- Hỗ trợ /explore?categoryId=....
- Hỗ trợ /chat?placeId=....
- Không tạo route /onboarding hay route /profile.
- Welcome sheet là overlay tại Home khi first-run, không phải Activity Android/native hoặc trang đăng ký riêng.
- Nội dung dưới bottom nav không bị che; chừa safe area, keyboard safe area.
4. Home Page
Dùng Home Light/Dark Stitch đã duyệt, gồm:
- Header tối giản, không lặp tiêu đề từ Zalo shell.
- Hero ảnh lớn, intro/CTA.
- Danh mục sở thích 2×2 (không truncate chữ Tiếng Việt).
- CTA Trợ lý AI bằng green/ochre.
- Điểm đến nổi bật.
- 3-tab bottom nav.
Kết nối:
- GET /api/categories.
- GET /api/places?featured=true.
Tương tác:
- Click category → /explore?categoryId=....
- CTA khám phá → /explore.
- CTA AI → /chat.
- Click place → /place/:id.
- Nếu đã có biệt danh được lưu, có thể dùng để cá nhân hóa một câu chào nhỏ, không thay bố cục Home.
- Bổ sung entry nhỏ Cá nhân hóa ở vị trí hợp lý (ví dụ action nhỏ trong header/AI CTA overflow), để mở lại cùng Bottom Sheet. Không thêm profile tab.
5. Explore Page
Dùng Explore Light/Dark Stitch đã duyệt, gồm:
- Search.
- Category chips.
- Place cards ảnh rõ.
- Loading/error/empty states.
- Bottom navigation.
API:
- GET /api/categories.
- GET /api/places?categoryId=...&search=...&featured=... khi thích hợp.
Yêu cầu:
- Debounce search ~300ms.
- Bảo vệ khỏi stale responses (abort controller hoặc request sequencing).
- Không để search/category chồng request rồi ghi dữ liệu sai.
- Placeholder ảnh khi thiếu.
- Không hard-code thông tin du lịch giả thành facts.
- Các card navigate đúng Place Detail.
6. Place Detail Page
Dùng Place Detail Light/Dark Stitch đã duyệt:
- Hero image.
- Back navigation.
- Category badge.
- Tên và optional address.
- Chỉ đường / Chia sẻ.
- Giới thiệu.
- Gallery từ images?: string[].
- Các metadata optional openingHours, phone, website — không render ô trống.
- Khu vực AI tip/assistance.
API: GET /api/places/:id.
BẮT BUỘC: Hỏi AI về địa điểm này
Giữ phong cách AI tip đã duyệt, thêm CTA rõ ràng:
✨ Hỏi AI về địa điểm này
Khi nhấn:
navigate(`/chat?placeId=${encodeURIComponent(place.id)}`);
Không có backend endpoint mới. Không gửi dữ liệu địa điểm tự bịa.
Directions & Share
Giữ nút theo Stitch. Chỉ triển khai Zalo native API nếu đã xác minh function signature chính thức. Nếu chưa cấu hình được:
- Chỉ đường: dùng mapUrl hoặc tọa độ đã xác minh; thiếu → disable/thông báo đúng, không mở tọa độ placeholder.
- Chia sẻ: dùng API chính thức/fallback xác minh được; không báo đã copy hoặc chia sẻ nếu chưa thực sự thành công.
- Không biến bước này thành blocker của FE nếu cần app ID/quyền Zalo chưa có.
7. AI Chat Page
Dùng AI Chat Light/Dark Stitch đã duyệt:
- Welcome state.
- Suggestion chips: 🌿 Đi thiên nhiên, 📸 Chỗ chụp ảnh đẹp, 🍜 Ăn gì?, 🗓 Lịch trình 1 ngày.
- Chat bubbles user/assistant.
- Loading/error/retry.
- Cards địa điểm từ placeIds → fetch existing place API → PlaceCard.
- Fixed composer tối ưu bàn phím Zalo WebView.
- Không dựng microphone/voice chat nếu chưa làm thật.
- Không hiện raw ID như nội dung cuối cùng.
API GIỮ NGUYÊN:
interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

interface ChatResponse {
  answer: string;
  placeIds: string[];
}
AI contextual chat: từ Place Detail
Khi vào /chat?placeId=...:
1. Đọc, validate placeId.
2. Lấy Place bằng GET /api/places/:id.
3. Hiển thị chip 📍 Đang tìm hiểu: {place.name}.
4. Tạo câu hỏi giới thiệu đúng địa điểm theo dữ liệu đã xác minh; có thể auto-send đúng một lần, không duplicate trong React Strict Mode/re-render.
5. Tiếp tục chat, giữ ngữ cảnh placeId trong conversation hiện tại.
6. Cho xóa chip để quay về chat thường.
7. ID sai/missing → fallback chat thường kèm thông báo dễ hiểu.
8. Truy cập /chat từ bottom navigation vẫn hoạt động độc lập.
Giữ chat history gọn và sạch; khi retry request lỗi, không thêm lại user bubble và không nhét trùng failed user message vào history.
Giới hạn có thật của backend
Backend ChatService hiện có MAX_MESSAGE_LENGTH = 500, MAX_HISTORY_MESSAGES = 8. Frontend cần giới hạn request tương thích kể cả khi đã thêm personalization/context; tránh việc nối các đoạn prompt dài khiến API trả HTTP 400.
Không sửa ChatRequest/ChatResponse để thêm profile hoặc placeId field.
8. TÍNH NĂNG MỚI — First-Visit Welcome & Personalization Bottom Sheet (P1)
Đây là bổ sung mới so với prompt FE trước. Thiết kế theo ZIP Stitch onboarding Light/Dark và overlay lên Home, không có route/tab mới.
8.1. Mục đích
1. Cá nhân hóa lời chào/trải nghiệm du lịch mức cơ bản.
2. Cho AI xưng hô thân thiện theo cách người dùng tự chọn, không suy luận giới tính/tên/tuổi.
3. Không yêu cầu tài khoản, đăng nhập Zalo, số điện thoại hay năm sinh chính xác.
8.2. Form data tối giản
Đề xuất frontend type tương đương:
type AddressAs = "anh" | "chi" | "ban" | "em";
type AgeGroup = "under18" | "18-24" | "25-34" | "35-49" | "50plus" | null;

interface PersonalizationProfile {
  displayName?: string;        // biệt danh tự nguyện, tối đa 32 ký tự
  addressAs: AddressAs;        // default: "ban"
  ageGroup: AgeGroup;          // default: null
  allowAIContext: boolean;     // default: false, chỉ opt-in mới truyền sang AI
  updatedAt: string;
}
UI copy tiếng Việt theo Stitch onboarding:
- Chào mừng đến với Đắk Song! 🌿
- Bạn muốn được gọi là gì? → Tên hoặc biệt danh (optional).
- Cách xưng hô bạn thích → Anh / Chị / Bạn / Em (default Bạn).
- Nhóm tuổi → Không chia sẻ / Dưới 18 / 18–24 / 25–34 / 35–49 / 50+ (optional).
- Checkbox opt-in (mặc định off) để dùng thông tin trong AI.
- Lưu và bắt đầu khám phá.
- Bỏ qua, khám phá ngay.
Không hỏi giới tính, ngày sinh, năm sinh chính xác, số điện thoại, email, tài khoản.
8.3. First-run behavior
- Khi vào ứng dụng lần đầu, chỉ mở sheet sau khi shell/Home đã sẵn sàng; không flash nhiều lần.
- Người dùng có thể bỏ qua ngay, không khóa Home/Explore/AI.
- Ghi nhận onboardingSeen độc lập với profile để người đã Skip không bị hỏi lại mỗi lần mở app.
- Nếu bấm Save thì lưu profile; nếu bấm Skip thì không lưu profile cá nhân.
- Theme change không làm mất form đang nhập.
- Reopen sheet bằng entry Cá nhân hóa có sẵn trong Home/AI Chat.
- Chế độ edit dùng cùng component, preload dữ liệu và có Lưu thay đổi/Xóa thông tin đã lưu.
- Xóa profile phải xóa cả lựa chọn đồng ý gửi dữ liệu sang AI; không tự xóa hoặc sửa chat messages lịch sử ngoài ý muốn.
- Khi update profile, lời chào và những lần request AI tiếp theo dùng giá trị mới.
8.4. Local persistence và quyền riêng tư
Không tạo DB table, backend endpoint, server profile, Zalo login hay analytics để lưu hồ sơ.
- Lưu dữ liệu tự nguyện cục bộ trên thiết bị bằng storage API tương thích Zalo Mini App đã xác minh; nếu cần dùng web storage thì phải hoạt động trên Zalo WebView và có fallback khi storage unavailable.
- Namespace/version keys rõ ràng, ví dụ vna.daksong.personalization.v1 và vna.daksong.onboardingSeen.v1.
- Chỉ lưu đúng field đã mô tả; không lưu token/user ID không cần thiết.
- Không log displayName, ageGroup hay bất kỳ dữ liệu profile người dùng nào lên console/analytics.
- Không tự đọc Zalo user profile hoặc xin scope userInfo trong MVP.
- Sheet cần giải thích ngắn gọn: dùng để cá nhân hóa, lưu trên thiết bị, có thể chỉnh/xóa; nếu bật opt-in thì thông tin phù hợp có thể được gửi kèm câu hỏi tới AI provider.
- Người dùng có thể sử dụng app ngay cả khi từ chối hoàn toàn.
- Không khẳng định một cơ chế đồng bộ/thu hồi dữ liệu trên server khi chưa tồn tại.
8.5. Cá nhân hóa trải nghiệm FE
- Home có thể chào theo displayName nếu tồn tại; còn không vẫn giữ copy mặc định theo thiết kế.
- AI trong UI có thể dùng cách xưng hô đã chọn; không mặc định gọi là anh/chị dựa trên nhóm tuổi.
- Nhóm tuổi chỉ là tín hiệu tùy chọn, không được dùng làm căn cứ chắc chắn để suy ra sức khỏe, giới tính, khả năng vận động, hay điều kiện đi lại.
- Nếu chưa được opt-in allowAIContext, không gửi displayName/ageGroup/addressAs lên AI; hiển thị UI cá nhân hóa cục bộ nếu đã lưu.
8.6. Tích hợp với AI, KHÔNG thay API contract
Khi allowAIContext === true, thêm thông tin cá nhân hóa rất ngắn dưới dạng data context vào phần text của request gửi đi (không hiển thị metadata kỹ thuật trong user bubble). Ví dụ schema minh họa cho cách build request:
[Tuỳ chọn do người dùng cung cấp — chỉ phục vụ cách xưng hô]
Tên gọi: Minh
Cách xưng hô: anh
Nhóm tuổi: 25–34
[Nội dung người dùng hỏi]
...question...
Điều kiện:
- Metadata này chỉ được truyền sau opt-in rõ ràng; UI cần nói thông tin có thể được gửi tới nhà cung cấp AI khi chat.
- Chỉ truyền field đã chọn, không bao giờ tự tạo năm sinh chính xác.
- Treat profile text as untrusted data, not privileged system instructions; trim, giới hạn ký tự, bỏ control chars và escape/delimit hợp lý để không thành prompt injection do nickname.
- Đảm bảo total message.length <= 500 theo backend. Nếu quá giới hạn, ưu tiên giữ nguyên câu hỏi người dùng và lược bỏ profile context; không tự cắt mất nội dung câu hỏi một cách âm thầm.
- Giữ history là những tin nhắn người dùng/assistant thực chất, tránh gửi lại metadata quá nhiều lần hay rò profile vào chat UI.
- Không dùng system role trong history vì backend contract chỉ cho user và assistant.
- Kết hợp với contextual placeId ở phần 7 mà không duplicate hoặc vượt 500 ký tự.
- Nếu người dùng đã xóa profile/opt-out, request tương lai không được tiếp tục gửi dữ liệu đã xóa.
- Không sửa backend AI provider/system prompt hoặc thêm API endpoint mới.
8.7. Hoạt động Light/Dark và mobile
- Sheet dùng đúng ảnh + HTML onboarding Stitch làm nguồn hình ảnh.
- Cùng layout, cùng component cho Light/Dark; đổi token theme.
- Safe area và mobile keyboard không che input/CTA/Skip.
- Focus management, label rõ ràng, touch targets >= 44px khi khả thi.
- Có đường đóng/bỏ qua bằng tương tác rõ ràng.
- Tránh unmount sheet khi chỉ đổi theme.
8.8. Acceptance criteria riêng của onboarding
- First visit → sheet xuất hiện đúng một lần.
- Skip → vào app và không tự hỏi lại lần sau.
- Save → thông tin đúng được lưu cục bộ và Home chào theo lựa chọn.
- Reopen → chỉnh được; xóa được.
- Light/Dark đều đúng Stitch.
- Truy cập AI khi chưa opt-in → request không mang thông tin cá nhân hóa.
- AI opt-in → xưng hô theo preference, không suy luận giới tính từ tuổi/tên.
- Bật/tắt opt-in có hiệu lực từ request kế tiếp.
- Không có migration DB, API profile, login mới.
9. Component architecture
Ưu tiên reuse/refactor vừa đủ:
- AppLayout, AppHeader, BottomNavigation
- HeroBanner, SectionHeader, CategoryCard/Chip
- PlaceCard, FeaturedDestinationCard, ImageGallery
- AIInvitationCard, AIRecommendationCard
- ChatBubble, ChatComposer, ChatSuggestionChip, ContextualPlaceChip
- WelcomePersonalizationSheet (một component dùng cả first-run/edit)
- usePersonalization hoặc Context/state tương đương, một nguồn state thống nhất và storage adapter gọn
- LoadingView, ErrorView, EmptyView
Không tạo design framework, Nx/Turborepo, state library cồng kềnh, hoặc duplicating pages for themes.
10. API/Data contract freeze
Không sửa schema, routes, migrations, worker hoặc AI provider.
Types từ baseline:
interface Place {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  category?: Category;
  shortDescription: string;
  description: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  images?: string[];
  mapUrl?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  isFeatured: boolean;
}
Place response, ChatRequest, ChatResponse giữ shape hiện tại.
- Sử dụng miniapp/src/services/api.ts hiện có, không fetch() tùy tiện trong UI component.
- Base URL từ VITE_API_BASE_URL.
- Không đặt AI key ở client.
- Tối ưu các trường optional; hình ảnh không có thì fallback trung tính.
- Dữ liệu placeholder chỉ để DEV; không nhầm là sự thật về Đắk Song.
- Nếu backend chưa chạy trong preview, có thể tạo mock adapter chỉ DEV và dưới feature flag rõ ràng; production bắt buộc gọi API thật.
11. Ảnh, icon, styling
- Không iframe/nhúng raw code.html từ Stitch vào React.
- Không dùng Tailwind CDN runtime từ HTML Stitch.
- Dùng CSS maintainable và system theme tokens; chỉ thêm dependency nhỏ nếu thực sự cần.
- Hình Stitch là tham chiếu, không phải nguồn xác nhận địa điểm thật/quyền sử dụng ảnh.
- Không tạo tên điểm đến, giá vé, rating, km, thời tiết, giờ mở cửa, điện thoại giả.
- Ảnh trên production phải là ảnh có quyền sử dụng và dữ liệu đã xác minh.
- Không đưa ảnh/video lớn vào bundle vô ích; ưu tiên URL từ API.
12. Navigation, UX và a11y
- Responsive 360/390/430px; không horizontal page overflow.
- Điều hướng đầy đủ Home → Explore → Detail → AI → Detail.
- Bottom nav không che nội dung; composer không bị bàn phím che.
- Search debounce + stale response guard.
- Chat retry không duplicate failed message hoặc tự lặp history.
- Loading/error/empty ổn định.
- Buttons, inputs, labels accessible, contrast đủ trong hai theme.
- Tất cả text hiển thị chính bằng tiếng Việt tự nhiên; từ “AI” được phép.
- Không tạo nút giả báo action thành công khi chức năng chưa hoạt động.
13. Security & privacy baseline
- Secrets chỉ ở Worker, không commit .env/.dev.vars.
- Không log nickname/nhóm tuổi/opt-in/chat profile payload.
- Không xin quyền Zalo user profile/số điện thoại/vị trí khi chưa cần.
- Không gửi dữ liệu cá nhân hóa tới AI nếu chưa opt-in.
- API request bodies tuân thủ validation contract hiện tại.
- Có khả năng sửa/xóa thông tin đã lưu.
- Không thu thập năm sinh chính xác, giới tính, email, phone, thông tin định danh hoặc dùng cho mục đích ngoài personalizing.
- Không cần analytics/tracking để chứng minh tính năng hoạt động.
14. Không làm trong task này
- New login/auth/Profile screen.
- GPS check-in, passport, XP/gamification.
- Booking, payment, voucher, review/comment, favorites/bookmark.
- AI streaming/SSE, voice chat/microphone, WebSocket, vector DB/RAG.
- Admin, CMS, notification, analytics.
- DB profile table, migration, backend endpoint mới.
- System prompt overhaul, change Worker runtime/AI providers.
- Auto-deploy production.
Không thêm main screen thứ 5. Onboarding là Bottom Sheet overlay, không phải Activity.
15. Workflow thực thi
Phase A — Inspect
- git status, project tree, FE components/routes, API client, contracts.
- Giải nén và kiểm tra hai ZIP Stitch, tổng cộng 8 main screens + onboarding Light/Dark.
- Phát hiện chỗ conflict giữa screenshot/HTML/DESIGN.md.
Phase B — Foundation UI
- Design tokens, theme persistence + system preference.
- App shell, navigation, reusable primitives.
- Local personalization storage adapter + hook/context tối giản.
Phase C — Four main screens
1. Home.
2. Explore.
3. Place Detail.
4. AI Chat.
Bám sát Stitch trước khi polish tự do.
Phase D — Onboarding & AI context
- Welcome sheet Light/Dark từ Stitch onboarding.
- First-run/skip/edit/delete/opt-in.
- Home greeting.
- Place Detail → /chat?placeId=....
- AI prompt adaptation theo local preference khi đã opt-in; giữ nguyên API.
- Retry fix và keyboard layout.
Phase E — Validate
Chạy lệnh thực tế và ghi kết quả:
npm install
npm run typecheck
npm run test
npm run build
Nếu có browser automation/render:
- Capture các màn chính ở Light/Dark (tổng 8 trạng thái).
- Capture Welcome sheet ở Light/Dark (2 trạng thái).
- Đối chiếu trực quan với Stitch; sửa mismatch lớn.
Nếu thiếu browser environment, báo rõ not visually verified và đưa hướng dẫn preview.
16. Test user journeys bắt buộc
1. First run → Welcome sheet → Skip → Home → reopen sheet → Save → Personalized greeting.
2. First run → Save → Reload → sheet không hiện lại, profile vẫn còn.
3. Edit nickname/pronoun/age group, change opt-in, delete profile.
4. allowAIContext=false → outgoing ChatRequest không có metadata cá nhân hóa.
5. allowAIContext=true → AI request có only allowed short personalization context; message <= 500 ký tự.
6. Home → category → Explore → Detail.
7. Explore → Detail → Hỏi AI về địa điểm này → contextual Chat → follow-up.
8. Home → Chat thường → suggestion → AI response → recommended PlaceCard → Detail.
9. Chat request fail → Retry → không duplicate bubble/message trong history.
10. Switch Light/Dark khi đang trên Home, Detail, Chat, và sheet → state không bị reset.
11. Mobile widths 360/390/430; keyboard open; navbar/composer/CTA hiển thị đúng.
12. No place coordinates → directions không mở location giả, share không báo thành công giả.
Các test AI có thể mock deterministic ở test-only layer, nhưng production không dùng mock ngầm.
17. Definition of Done
Task được xem là hoàn thành khi:
- [ ] 4 trang React khớp trực quan Stitch baseline.
- [ ] Light và Dark dùng chung component tree.
- [ ] Themes tự theo system và cho phép override/persist.
- [ ] 3-tab bottom nav và các route hoạt động.
- [ ] Home/Explore/Detail thực sự gọi API.
- [ ] AI Chat nhận/trả API và render placeIds thành recommended cards.
- [ ] Detail → contextual AI hoạt động đúng ngữ cảnh.
- [ ] Welcome sheet hiển thị theo first-run, skip/save/edit/delete hoạt động.
- [ ] Dữ liệu onboarding chỉ lưu cục bộ, AI opt-in mặc định off, không send khi off.
- [ ] Trường optional/gallery được xử lý an toàn.
- [ ] Không có dữ liệu địa điểm giả được đưa thành thông tin thật.
- [ ] Không cần thay đổi BE/D1/contracts.
- [ ] npm run typecheck, npm run test, npm run build pass (hoặc ghi chính xác blocker không do code).
- [ ] Không deploy production tự động.
18. Báo cáo hoàn thành
Báo cáo ngắn nhưng kiểm chứng được:
1. Các file tạo/sửa.
2. Bản đồ mapping Stitch references → React pages/components.
3. Theme Light/Dark đã triển khai ra sao.
4. Onboarding storage, opt-in, editing/reset hoạt động ra sao.
5. Tích hợp API và contextual AI ra sao (bao gồm giới hạn 500 ký tự).
6. Kết quả command/test đã chạy thực sự, không khẳng định runtime nếu chỉ build.
7. Screenshot UI nếu thật sự đã chụp và đối chiếu.
8. P0/P1/P2 tồn đọng trước khi đưa lên Zalo.
9. Các bước cần người dùng thực hiện thủ công: Zalo App ID, Cloudflare D1 ID, secrets, whitelist/domain nếu cần, deploy/test thiết bị thật.
Source control:
- Giữ lịch sử repo; không ghi đè dự án bằng scaffold mới.
- Không commit secret.
- Không push/deploy tự động trừ khi workflow hiện tại đã cho phép rõ ràng.
- FE changes chủ yếu ở miniapp/, các design references ở design-reference/.
FINAL INSTRUCTION
Approved design means implement, not redesign.
Read both Stitch ZIP files. Implement the four approved React screens, Light/Dark themes, and optional welcome personalization bottom sheet in the existing Zalo Mini App. Include Place Detail → contextual AI and opt-in AI addressing while strictly preserving the existing backend APIs and D1 schema. Write working code and run the tests/build. Do not ask questions already answered by this prompt.