# ZaloLite Web (frontend)

Giao diện web của ZaloLite: React 18 + TypeScript + Vite, bố cục 3 cột quen thuộc của ứng dụng nhắn tin
(thanh điều hướng – danh sách hội thoại – khung chat – thông tin hội thoại).

## Chạy

```powershell
npm install
npm run dev      # http://localhost:5173 – /api và /ws được proxy sang gateway :8080
npm run build
npm test         # vitest
```

## Hai chế độ dữ liệu

| Chế độ | Khi nào | Dữ liệu |
|---|---|---|
| **Live** | Đăng nhập thành công qua `POST /api/auth/login` | Gọi API thật qua gateway; WebSocket STOMP `/ws` cho hội thoại có trên backend |
| **Demo** | Backend không chạy (lỗi mạng, 404, 5xx) hoặc bấm "Dùng thử với dữ liệu mẫu" | Dữ liệu mẫu trong `src/data/seed.ts`, lưu `localStorage`, mô phỏng đã nhận/đã xem, đang soạn tin, trả lời tự động |

Trong chế độ Live, tính năng nào backend chưa có endpoint thì frontend tự dùng dữ liệu cục bộ
(xem `src/data/store.ts` và `src/api/liveApi.ts`). Khi viết thêm backend, chỉ cần bổ sung hàm trong `liveApi.ts`.

## Tính năng

- **Tài khoản**: đăng nhập / đăng ký, hồ sơ cá nhân (ảnh đại diện, ảnh bìa, giới tính, ngày sinh, giới thiệu), đăng xuất.
- **Tin nhắn**: chat 1-1 và nhóm; văn bản, link, ảnh (nhiều ảnh), video, file ≤ 100 MB, emoji, sticker, nút 👍 gửi nhanh;
  kéo-thả và dán ảnh; trả lời, chuyển tiếp, thu hồi (24h), xóa phía tôi, sao chép, ghim tin nhắn (tối đa 3);
  thả cảm xúc; nhắc tên `@`; bình chọn trong nhóm; trạng thái Đang gửi / Đã gửi / Đã nhận / Đã xem / Gửi lỗi + thử lại;
  "đang soạn tin…"; tìm tin nhắn trong hội thoại; cuộc gọi thoại / video (giao diện + camera cục bộ, lưu nhật ký cuộc gọi).
- **Danh sách hội thoại**: Tất cả / Chưa đọc, ghim, tắt thông báo, đánh dấu đã đọc / chưa đọc, xóa hội thoại,
  tìm kiếm liên hệ, nhóm và nội dung tin nhắn (không phân biệt dấu).
- **Danh bạ**: bạn bè theo chữ cái, lọc đang hoạt động; danh sách nhóm; lời mời kết bạn đã nhận / đã gửi;
  thêm bạn bằng số điện thoại / email.
- **Nhóm**: tạo nhóm (ảnh, tên, ≥ 2 thành viên), đổi tên / ảnh, thêm / xóa thành viên, trưởng nhóm / phó nhóm,
  chuyển quyền trưởng nhóm, rời nhóm, giải tán nhóm.
- **Thông tin hội thoại**: kho Ảnh/Video, File, Link đã chia sẻ; xóa lịch sử trò chuyện.
- **Cloud của tôi**: hội thoại với chính mình để lưu ghi chú, file.
- **Thống kê**: KPI, tin nhắn theo ngày, tỷ lệ loại nội dung, nhóm sôi động, người dùng tích cực (API `statistics-service`, dự phòng tính cục bộ).
- **Cài đặt**: giao diện sáng / tối / theo hệ thống, cỡ chữ, phím Enter để gửi, trạng thái truy cập, "Đã xem", âm thanh thông báo.
- **Responsive**: trên điện thoại thanh điều hướng chuyển xuống dưới, danh sách và khung chat hiển thị lần lượt.

## Cấu trúc

```
src/
  api/        client.ts (fetch + timeout + lỗi), liveApi.ts (endpoint backend)
  data/       types.ts, seed.ts (dữ liệu mẫu), store.ts (state + nghiệp vụ, useSyncExternalStore)
  app/        AppShell.tsx (thanh điều hướng, modal hồ sơ / cài đặt, toast)
  components/ ui.tsx (Avatar, Modal, Menu, Toggle, hộp xác nhận…)
  features/
    auth/ chat/ contacts/ profile/ settings/ stats/
  lib/        format.ts, icons.tsx (bộ icon SVG tự vẽ)
```

## Endpoint frontend đang dùng (để backend bám theo)

| Phương thức | Đường dẫn | Ghi chú |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` | trả `{ accessToken, refreshToken, user? }` |
| GET/PUT | `/api/users/me` | `displayName, avatar, bio, phone` |
| POST | `/api/friends/requests` | `{ target, email, message }` |
| GET/POST | `/api/groups` | `{ name, memberIds }` |
| GET | `/api/chat/conversations/{id}/messages` | |
| POST | `/api/chat/messages` | `{ conversationId, clientMsgId, content, type }` |
| WS | `/ws` → `/topic/conversations/{id}` | STOMP |
| GET | `/api/stats/overview`, `/api/stats/groups`, `/api/stats/media` | |

Chưa có backend: media upload (MinIO), lời mời kết bạn đã nhận / chấp nhận, quản lý thành viên nhóm qua API, cảm xúc,
thu hồi, ghim, bình chọn, signalling cho cuộc gọi.
