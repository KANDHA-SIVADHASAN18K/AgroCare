@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" "backend\app.py"
) else (
  where py >nul 2>nul
  if errorlevel 1 (
    python "backend\app.py"
  ) else (
    py -3 "backend\app.py"
  )
)
