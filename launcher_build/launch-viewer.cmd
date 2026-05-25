@echo off
setlocal
REM Nightfeed launcher (build version) — starts the API + web app, then opens the browser.
set "PROJECT_DIR=C:\Users\thr3e\OneDrive\Desktop\Nightfeed"

if not exist "%PROJECT_DIR%\backend\package.json" (
  echo Could not find Nightfeed files at:
  echo %PROJECT_DIR%
  pause
  exit /b 1
)

set "NPM_CMD="
if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%AppData%\npm\npm.cmd" set "NPM_CMD=%AppData%\npm\npm.cmd"
if not defined NPM_CMD set "NPM_CMD=npm"

start "Nightfeed API" cmd /k "cd /d \"%PROJECT_DIR%\backend\" && \"%NPM_CMD%\" run dev"
start "Nightfeed Web" cmd /k "cd /d \"%PROJECT_DIR%\frontend\" && \"%NPM_CMD%\" run dev"
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0
