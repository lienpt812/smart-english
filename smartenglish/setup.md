# Hướng dẫn cài đặt (setup)

Tài liệu này mô tả **môi trường cần có** và **các bước chuẩn bị một lần** trước khi chạy dự án Smart English.

## Yêu cầu hệ thống

- **Node.js** phiên bản LTS (khuyến nghị **20+** hoặc **22**) kèm **npm**
- **Docker Desktop** (hoặc Docker Engine + Compose plugin) để chạy PostgreSQL và Redis — và tùy chọn chạy cả backend/frontend trong container

Kiểm tra nhanh trong PowerShell:

```powershell
node -v
npm -v
docker version
docker compose version
```

## Lấy mã nguồn và vào thư mục dự án

```powershell
Set-Location "d:\DEAn\smartenglish"
```

(Điều chỉnh đường dẫn nếu repo của bạn nằm chỗ khác.)

## Sao chép file môi trường

Tại thư mục gốc `smartenglish` (cùng cấp với `docker-compose.yml`):

```powershell
Copy-Item .env.example .env
```

Để chạy **`npm run dev` trong `backend`**, tạo (hoặc đồng bộ) **`backend\.env`** — `dotenv` đọc đúng file tại thư mục làm việc là `backend`:

```powershell
Copy-Item .env.example backend\.env
```

Tùy chọn cho Next.js: tạo **`frontend\.env.local`** với `NEXT_PUBLIC_API_URL=http://localhost:4000` để trỏ API rõ ràng khi dev.

Mở các file `.env` / `.env.local` và chỉnh nếu cần (mật khẩu DB, cổng, URL API public cho Swagger qua `API_PUBLIC_URL`).

## Cài dependency cho Backend

```powershell
Set-Location "d:\DEAn\smartenglish\backend"
npm install
npm run build
```

Lệnh `npm run build` dùng để xác nhận TypeScript biên dịch thành công; không bắt buộc mỗi lần dev nhưng nên chạy sau lần clone đầu tiên.

## Cài dependency cho Frontend

```powershell
Set-Location "d:\DEAn\smartenglish\frontend"
npm install
npm run build
```

Tương tự, build lần đầu giúp phát hiện lỗi cấu hình Next.js sớm.

## Chuẩn bị Docker (ảnh Postgres / Redis)

Không cần chạy lệnh tải ảnh thủ công: khi lần đầu bạn `docker compose up`, Docker sẽ kéo `postgres:16-alpine` và `redis:7-alpine`. Đảm bảo Docker đang **đang chạy** trước khi compose.

## Kiểm tra sau setup

| Hạng mục           | Mong đợi                          |
|--------------------|-----------------------------------|
| `backend\node_modules` | Tồn tại sau `npm install`     |
| `frontend\node_modules`| Tồn tại sau `npm install`     |
| File `.env`        | Đã tạo (từ `.env.example`)      |

Chi tiết cách khởi động dịch vụ (dev và Docker) xem **`run.md`**.
