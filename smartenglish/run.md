# Huong dan chay du an

Tat ca lenh mau duoi day dung thu muc goc:

```powershell
Set-Location "d:\DEAn\smartenglish"
```

## Kien truc thu muc

```text
smartenglish/
|-- frontend/          # React/Next.js frontend under src/
|-- backend/           # Python FastAPI Backend API chinh
|-- ai-service/        # Python FastAPI AI service rieng
|-- docs/              # tai lieu du an
|-- docker-compose.yml
|-- Makefile
`-- README.md
```

Backend API la modular monolith cho nghiep vu chinh. AI Service duoc tach rieng de quan ly prompt, provider, quota, cache va chi phi AI.

| Thanh phan | URL mac dinh | Vai tro |
|---|---:|---|
| Frontend | `http://localhost:3000` | UI |
| Backend API | `http://localhost:4000` | Auth, users, dashboard va cac module nghiep vu |
| AI Service | `http://localhost:4200` | Gemini/AI gateway |
| PostgreSQL | `localhost:5432` | Database |
| Redis | `localhost:6379` | Cache/session dependency |

## Endpoint nhanh

- Backend health: `http://localhost:4000/health`
- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/openapi.json`
- AI health: `http://localhost:4200/health`

## Dev local

### 1. Cai dependencies

```powershell
make install
```

Neu may chua co `make`, chay thu cong:

```powershell
Set-Location "d:\DEAn\smartenglish\backend"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

Set-Location "d:\DEAn\smartenglish\frontend"
npm install

Set-Location "d:\DEAn\smartenglish\ai-service"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 2. Chay PostgreSQL va Redis

```powershell
docker compose --env-file .env.local up -d postgres redis
```

### 3. Chay Backend API

```powershell
Set-Location "d:\DEAn\smartenglish\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

### 4. Chay AI Service

```powershell
Set-Location "d:\DEAn\smartenglish\ai-service"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 4200
```

### 5. Chay Frontend

```powershell
Set-Location "d:\DEAn\smartenglish\frontend"
npm run dev
```

Mo trinh duyet: `http://localhost:3000`.

## Docker Compose

```powershell
docker compose --env-file .env.local up --build
```

Compose se chay: `frontend`, `backend-api`, `ai-service`, `postgres`, `redis`.

Dung container:

```powershell
docker compose --env-file .env.local down
```

Dung va xoa volume DB:

```powershell
docker compose --env-file .env.local down -v
```
