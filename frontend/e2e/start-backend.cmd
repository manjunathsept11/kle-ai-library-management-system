@echo off
rem Throwaway backend for Playwright: fresh seeded DB on :8001 (never touches var/library.db).
cd /d %~dp0..\..\backend
set DATABASE_URL=sqlite:///./var/e2e.db
del /q var\e2e.db var\e2e.db-wal var\e2e.db-shm 2>nul
.venv\Scripts\python.exe -m alembic upgrade head || exit /b 1
.venv\Scripts\python.exe -m scripts.seed || exit /b 1
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001
