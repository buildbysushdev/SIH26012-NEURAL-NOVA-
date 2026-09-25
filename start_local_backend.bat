@echo off
title MPLADS AI Backend Server (SIH 2026)
echo ======================================================================
echo  MPLADS Risk Intelligence System — Local AI Backend (77,312 records)
echo  Team Neural Nova (SIH26102)
echo ======================================================================
echo.

echo Checking and freeing port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Terminating stale process on port 8000 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Activating Python virtual environment and starting server...
echo URL: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo.
if exist "backend\.venv\Scripts\python.exe" (
    "backend\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude "*.csv" --reload-exclude "*.log" --reload-exclude "uploads/*"
) else if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude "*.csv" --reload-exclude "*.log" --reload-exclude "uploads/*"
) else (
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude "*.csv" --reload-exclude "*.log" --reload-exclude "uploads/*"
)
pause
