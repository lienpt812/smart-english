SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -Command

BACKEND_DIR := backend
FRONTEND_DIR := frontend
AI_DIR := ai-service
COMPOSE_ENV_FILE := .env.local

.PHONY: help clean install install-backend install-frontend build build-backend build-frontend \
	install-ai build-ai dev-api dev-ai dev-frontend docker-up docker-up-build docker-down \
	docker-down-volumes docker-ps docker-logs db-up check-compose

help:
	@Write-Host "SmartEnglish commands"
	@Write-Host ""
	@Write-Host "Setup:"
	@Write-Host "  make install             Install backend, frontend, and AI service dependencies"
	@Write-Host "  make clean               Remove local build artifacts"
	@Write-Host ""
	@Write-Host "Build:"
	@Write-Host "  make build               Build backend and frontend"
	@Write-Host "  make build-backend       Build backend only"
	@Write-Host "  make build-frontend      Build frontend only"
	@Write-Host ""
	@Write-Host "Local dev:"
	@Write-Host "  make db-up               Start postgres and redis"
	@Write-Host "  make dev-api             Run Backend API modular monolith on :4000"
	@Write-Host "  make dev-ai              Run AI service on :4200"
	@Write-Host "  make dev-frontend        Run frontend on :3000"
	@Write-Host ""
	@Write-Host "Docker:"
	@Write-Host "  make docker-up-build     Build and run frontend, backend-api, ai-service, postgres, redis"
	@Write-Host "  make docker-up           Run all services"
	@Write-Host "  make docker-down         Stop services, keep volumes"
	@Write-Host "  make docker-down-volumes Stop services and remove volumes"
	@Write-Host "  make docker-ps           Show compose status"
	@Write-Host "  make docker-logs         Tail compose logs"

install: install-backend install-frontend install-ai

clean:
	if (Test-Path "$(BACKEND_DIR)\.venv") { Remove-Item -Recurse -Force "$(BACKEND_DIR)\.venv" }
	if (Test-Path "$(FRONTEND_DIR)\.next") { Remove-Item -Recurse -Force "$(FRONTEND_DIR)\.next" }
	if (Test-Path "$(FRONTEND_DIR)\out") { Remove-Item -Recurse -Force "$(FRONTEND_DIR)\out" }
	if (Test-Path "$(AI_DIR)\.venv") { Remove-Item -Recurse -Force "$(AI_DIR)\.venv" }
	Get-ChildItem -Path . -Recurse -Filter "*.log" | Remove-Item -Force

install-backend:
	cd $(BACKEND_DIR); python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt

install-frontend:
	cd $(FRONTEND_DIR); npm.cmd install

install-ai:
	cd $(AI_DIR); python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt

build: build-backend build-frontend build-ai

build-backend:
	cd $(BACKEND_DIR); python -m compileall app

build-frontend:
	cd $(FRONTEND_DIR); npm.cmd run build

build-ai:
	cd $(AI_DIR); python -m compileall app

db-up:
	docker compose up -d postgres redis

dev-api:
	cd $(BACKEND_DIR); .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 4000

dev-ai:
	cd $(AI_DIR); .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 4200

dev-frontend:
	cd $(FRONTEND_DIR); npm.cmd run dev

docker-up:
	docker compose --env-file $(COMPOSE_ENV_FILE) up

docker-up-build:
	docker compose --env-file $(COMPOSE_ENV_FILE) up --build

docker-down:
	docker compose --env-file $(COMPOSE_ENV_FILE) down

docker-down-volumes:
	docker compose --env-file $(COMPOSE_ENV_FILE) down -v

docker-ps:
	docker compose --env-file $(COMPOSE_ENV_FILE) ps

docker-logs:
	docker compose --env-file $(COMPOSE_ENV_FILE) logs -f

check-compose:
	docker compose --env-file $(COMPOSE_ENV_FILE) config
