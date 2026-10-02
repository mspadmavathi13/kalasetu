@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 18+ and run this again.
  pause
  exit /b 1
)
if not exist .env (
  echo Creating .env from .env.example...
  copy /Y .env.example .env >nul
  echo.
  echo IMPORTANT: open .env and add your BHASHINI key and ASR service ID.
  echo Then run this file again.
  pause
  exit /b 0
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo.
echo Starting KalaSetu...
call npm start
pause
