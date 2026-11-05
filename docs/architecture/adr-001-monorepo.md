# ADR 001: Sử dụng monorepo và Maven multi-module

## Quyết định

Nhóm dùng một repository duy nhất với Maven parent POM cho các service backend.

## Lý do

- Ba thành viên dùng chung contract, convention và CI.
- Chia sẻ thư viện JWT/core mà không tạo repository riêng.
- Release theo tuần dễ theo dõi trong một nhánh monorepo.
- Không chia sẻ entity hoặc database qua ranh giới service.
