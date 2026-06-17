# SmartEnglish

SmartEnglish is organized as a frontend app, a main Backend API, and a dedicated AI Service.

```text
smartenglish/
|-- frontend/          # Vite React frontend
|-- backend/           # Python FastAPI Backend API, modular monolith
|-- ai-service/        # Python FastAPI service for AI workloads
|-- docs/              # project documentation
|-- docker-compose.yml
|-- Makefile
`-- README.md
```

## Services

| Service | Default URL | Description |
| --- | ---: | --- |
| Frontend | `http://localhost:3000` | User interface |
| Backend API | `http://localhost:4000` | Auth, users, dashboard, and business modules |
| AI Service | `http://localhost:4200` | AI provider boundary for prompts, quota, cache, and cost tracking |
| PostgreSQL | `localhost:5432` | Application database |
| Redis | `localhost:6379` | Cache/session dependency |

## Quick Start

```powershell
Set-Location "d:\DEAn\smartenglish"
docker compose --env-file .env.local up --build
```

For local development, see [run.md](run.md).
