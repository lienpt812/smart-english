# Hướng dẫn chạy dự án (run)

Xem **`setup.md`** nếu bạn chưa cài Node, Docker và chưa chạy `npm install`.

Tất cả lệnh mẫu dưới đây dùng thư mục gốc:

```powershell
Set-Location "d:\DEAn\smartenglish"
```

## Địa chỉ và endpoint thường dùng

| Dịch vụ           | URL mặc định                          |
|-------------------|----------------------------------------|
| Frontend (Next.js)| `http://localhost:3000`                |
| Backend (API)     | `http://localhost:4000`                |
| Swagger UI        | `http://localhost:4000/api/docs`       |
| OpenAPI JSON      | `http://localhost:4000/api/openapi.json` |
| Health API        | `http://localhost:4000/health`         |

**Phase 1 — đăng nhập:** Frontend gửi JWT **credential** (GIS) tới `POST /api/auth/google`; API trả **access token** + **refresh token**. Gọi API được bảo vệ với header `Authorization: Bearer <accessToken>`. Chi tiết schema trong Swagger (`/api/docs`).

Cổng thay đổi khi bạn map khác trong `docker-compose.yml` hoặc đặt biến `PORT` cho backend.

---

## Cách 1 — Dev trên máy (khuyến nghị khi code)

PostgreSQL và Redis chạy trong Docker; **backend và frontend chạy bằng `npm run dev`** để có hot reload.

### Bước 1: Chỉ chạy DB và Redis

```powershell
Set-Location "d:\DEAn\smartenglish"
docker compose up -d postgres redis
```

Đợi vài giây cho healthcheck của Postgres là “healthy”. Kiểm tra:

```powershell
docker compose ps
```

### Bước 2: Chạy backend

`dotenv` tải file **`.env` trong thư mục làm việc hiện tại**. Vì bạn chạy `npm run dev` từ **`backend`**, cần có file **`smartenglish\backend\.env`** (xem bước tạo trong **`setup.md`**).

Terminal mới:

```powershell
Set-Location "d:\DEAn\smartenglish\backend"
npm run dev
```

Nếu chỉ mới tạo `.env` ở thư mục gốc `smartenglish`, sao chép nhanh vào backend:

```powershell
Copy-Item "d:\DEAn\smartenglish\.env" "d:\DEAn\smartenglish\backend\.env" -Force
```

### Bước 3: Chạy frontend

Terminal khác:

```powershell
Set-Location "d:\DEAn\smartenglish\frontend"
npm run dev
```

Nếu API không phải `http://localhost:4000`, tạo/chỉnh `frontend\.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Mở trình duyệt: **`http://localhost:3000`**.

---

## Cách 2 — Toàn bộ bằng Docker Compose

Build và chạy Postgres, Redis, backend, frontend cùng lúc:

```powershell
Set-Location "d:\DEAn\smartenglish"
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend + Swagger: `http://localhost:4000/api/docs`

Để chạy nền:

```powershell
docker compose up --build -d
```

Dừng và xóa container (giữ volume DB):

```powershell
docker compose down
```

Dừng và xóa luôn volume PostgreSQL (mất dữ liệu):

```powershell
docker compose down -v
```

---

## Gợi ý xử lý sự cố

- **Cổng 3000 / 4000 / 5432 / 6379 đã được dùng:** đổi map cổng trong `docker-compose.yml` hoặc dừng tiến trình đang chiếm cổng.
- **Health `false` trên `/health`:** đảm bảo `postgres` và `redis` đã lên; kiểm tra `DATABASE_URL` và `REDIS_URL` trùng với cách bạn chạy (localhost khi dev trên máy, tên service `postgres`/`redis` khi chạy trong Docker).
- **Swagger “Try it out” gọi sai host:** đặt `API_PUBLIC_URL` (ví dụ `http://localhost:4000`) trong môi trường backend — Docker Compose đã set sẵn cho service `backend`.
