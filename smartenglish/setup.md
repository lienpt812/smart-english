# Huong dan cai dat

Tai lieu nay mo ta moi truong can co de chay SmartEnglish sau khi backend chuyen sang FastAPI.

## Yeu cau he thong

- Node.js LTS 20+ hoac 22+ kem npm cho frontend Next.js
- Python 3.12+ cho Backend API FastAPI va AI Service FastAPI
- Docker Desktop hoac Docker Engine + Compose plugin de chay PostgreSQL, Redis va tuy chon chay tat ca service

Kiem tra nhanh:

```powershell
node -v
npm -v
python --version
docker version
docker compose version
```

## Thu muc du an

```powershell
Set-Location "d:\DEAn\smartenglish"
```

## Sao chep file moi truong

```powershell
Copy-Item .env.example .env
Copy-Item .env.example backend\.env
Copy-Item .env.example ai-service\.env
```

Frontend doc `frontend\.env.local`, dam bao co:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Neu chay bang Docker Compose, cac bien nay can co trong file goc `.env.local`
vi frontend production can dong goi `NEXT_PUBLIC_*` luc build.

Backend FastAPI can cac bien chinh:

```env
DATABASE_URL=postgresql://smartenglish:smartenglish@localhost:5432/smartenglish
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
AI_SERVICE_URL=http://localhost:4200
GOOGLE_CLIENT_ID=...
JWT_SECRET=change-me-dev-secret-min-16chars
```

## Cai Backend API FastAPI

```powershell
Set-Location "d:\DEAn\smartenglish\backend"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m compileall app
```

## Cai AI Service

```powershell
Set-Location "d:\DEAn\smartenglish\ai-service"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m compileall app
```

## Cai Frontend Next.js

```powershell
Set-Location "d:\DEAn\smartenglish\frontend"
npm install
npm run build
```

## Chay bang Docker Compose

```powershell
Set-Location "d:\DEAn\smartenglish"
docker compose --env-file .env.local up --build
```

Chi tiet cach chay dev local xem `run.md`.
