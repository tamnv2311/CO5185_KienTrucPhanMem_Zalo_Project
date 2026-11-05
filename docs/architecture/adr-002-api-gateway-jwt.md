# ADR 002: Xác thực JWT tại API Gateway

## Quyết định

API Gateway xác thực access token và truyền `X-User-Id` sang service.

Refresh và login được công khai; endpoint profile, friend, group và chat cần bearer token.

## Hệ quả

- Giảm xác thực JWT trùng lặp.
- Service không tin request trực tiếp thiếu gateway identity header.
- Refresh/logout dùng refresh token riêng và có kiểm tra trạng thái revoked.
