# C4 Context

ZaloLite cung cấp đăng ký tài khoản, kết bạn, quản lý nhóm và chat 1-1 cho người dùng web.

- Người dùng tương tác qua Web Client qua HTTPS và WebSocket.
- API Gateway định tuyến REST/WebSocket và xác thực JWT.
- User/Auth Service quản lý tài khoản, profile và friendship.
- Group Service quản lý nhóm, thành viên và quyền.
- Chat Service lưu hội thoại, tin nhắn và trạng thái presence.

Mỗi hệ thống ngoài như MySQL, MongoDB và Redis được quản lý riêng theo service.
