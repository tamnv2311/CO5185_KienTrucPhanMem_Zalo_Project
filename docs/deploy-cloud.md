# Triển khai ZaloLite lên cloud

Toàn bộ hệ thống chạy trên **một máy ảo Linux có Docker**. Máy chủ không cần cài Java, Maven hay Node:
mọi thứ được build bên trong Docker từ source.

## 1. Chuẩn bị máy chủ

| Yêu cầu | Tối thiểu | Ghi chú |
|---|---|---|
| Hệ điều hành | Ubuntu 22.04 / 24.04 | x86 hoặc ARM đều được |
| RAM | 4 GB | 6 service Java + MySQL + MongoDB + RabbitMQ + Redis; 8 GB thì thoải mái hơn |
| CPU | 2 vCPU | Lần build đầu mất 5–15 phút tuỳ máy |
| Ổ đĩa | 30 GB | Image Docker, dữ liệu và file người dùng tải lên |
| Cổng mở ra Internet | 80, 443 | Và 22 để SSH. Không mở cổng nào khác |

Máy ảo có thể thuê ở bất kỳ nhà cung cấp nào (AWS, Azure, Google Cloud, Oracle Cloud, DigitalOcean,
hoặc VPS trong nước). Nhiều nơi có gói miễn phí hoặc tín dụng cho sinh viên; điều kiện thay đổi theo
thời gian nên hãy xem trực tiếp trên trang của nhà cung cấp.

Nhớ mở cổng 80 và 443 trong **tường lửa của nhà cung cấp** (Security Group / Network Security Group /
Security List), không chỉ trong máy ảo.

## 2. Cài Docker

SSH vào máy chủ rồi chạy:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Đăng xuất SSH và đăng nhập lại để quyền nhóm `docker` có hiệu lực. Kiểm tra:

```bash
docker compose version
```

## 3. Lấy source

```bash
git clone https://github.com/<tài-khoản>/CO5185_KienTrucPhanMem_Zalo_Project.git zalolite
cd zalolite
```

(Repo riêng tư thì dùng Personal Access Token hoặc deploy key của GitHub.)

## 4. Cấu hình bí mật

```bash
cp .env.example .env
nano .env
```

Điền bốn giá trị ngẫu nhiên, mỗi giá trị sinh bằng lệnh `openssl rand -hex 24`:

| Biến | Dùng để |
|---|---|
| `JWT_SECRET` | Ký token đăng nhập. Đổi giá trị này sẽ đăng xuất mọi người dùng |
| `MYSQL_ROOT_PASSWORD` | Mật khẩu quản trị MySQL |
| `MYSQL_PASSWORD` | Mật khẩu tài khoản MySQL mà các service dùng |
| `RABBITMQ_PASSWORD` | Mật khẩu RabbitMQ |

`SITE_ADDRESS`:

- Chưa có tên miền: để `:80`, truy cập bằng `http://<IP máy chủ>`.
- Có tên miền: trỏ bản ghi DNS loại A về IP máy chủ, rồi đặt `SITE_ADDRESS=chat.ten-mien.com`.
  Chứng chỉ HTTPS được cấp tự động khi khởi động.

File `.env` chỉ nằm trên máy chủ, không commit lên git.

> Mật khẩu MySQL và RabbitMQ chỉ được áp dụng **lần khởi động đầu tiên** (khi volume còn trống).
> Muốn đổi sau này phải đổi bên trong MySQL/RabbitMQ, hoặc xoá volume (mất dữ liệu).

## 5. Khởi động

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Kiểm tra:

```bash
docker compose -f docker-compose.prod.yml ps
```

Mọi container phải ở trạng thái `Up` (hạ tầng có thêm `healthy`). Các service Java cần khoảng
1–2 phút sau khi `Up` mới sẵn sàng. Sau đó mở `http://<IP máy chủ>` hoặc `https://<tên miền>`.

Chạy bộ kiểm thử end-to-end từ máy cá nhân (cần Node 22+):

```bash
ZALOLITE_E2E_URL=https://chat.ten-mien.com node tests/e2e/smoke.spec.js
```

## 6. Vận hành

| Việc | Lệnh |
|---|---|
| Xem log một service | `docker compose -f docker-compose.prod.yml logs -f chat-service` |
| Cập nhật bản mới | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Khởi động lại một service | `docker compose -f docker-compose.prod.yml restart gateway` |
| Dừng (giữ dữ liệu) | `docker compose -f docker-compose.prod.yml down` |
| Dọn image cũ | `docker image prune -f` |

Sao lưu dữ liệu (chạy trong thư mục project; lệnh tự lấy mật khẩu từ container):

```bash
docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --databases user_db group_db stats_db' > mysql-backup.sql
docker compose -f docker-compose.prod.yml exec -T mongo mongodump --archive > mongo-backup.archive
```

File người dùng tải lên nằm trong volume `zalolite_media_data`.

## 7. Dùng trên điện thoại

Sau khi lên cloud, điện thoại chỉ cần mở địa chỉ của trang bằng trình duyệt. Camera, micro và
"Thêm vào màn hình chính" chỉ hoạt động khi trang chạy bằng **HTTPS**, tức là cần tên miền.

## Kiến trúc triển khai

```
Internet ──► Caddy (80/443, HTTPS) ──► nginx (web tĩnh)
                                         ├─ /api ─► API gateway ─► user / group / chat / media / statistics
                                         └─ /ws  ─► API gateway ─► chat-service (WebSocket)

Nội bộ Docker, không mở ra ngoài: MySQL (3 schema), MongoDB, Redis, RabbitMQ
```

So với `docker-compose.yml` dùng khi phát triển:

- Image được build từ source trong Docker (`Dockerfile` ở thư mục gốc).
- Không có mật khẩu mặc định; thiếu biến trong `.env` thì Compose từ chối khởi động.
- Chỉ Caddy mở cổng ra ngoài; giao diện quản lý RabbitMQ và cổng gateway 8080 không còn công khai.
- Ba database của ba service dùng chung một máy chủ MySQL (mỗi service một schema riêng) để vừa máy nhỏ.
- Access token sống 60 phút và tự làm mới bằng refresh token.

## Giới hạn cần biết

- Schema do Hibernate tự tạo/cập nhật (`ddl-auto: update`), chưa có công cụ migration.
- MongoDB và Redis không đặt mật khẩu; chúng chỉ truy cập được từ bên trong mạng Docker.
- File tải lên lưu trên ổ đĩa của máy chủ, chưa dùng object storage.
- Một máy chủ duy nhất: máy hỏng là hệ thống ngừng. Sao lưu định kỳ theo mục 6.
