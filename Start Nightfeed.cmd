@echo off
setlocal
REM ============================================================
REM  Nightfeed — one-click launcher
REM  Starts the backend API (:3001) and the web app (:5173),
REM  then opens the app in your browser.
REM  Location-independent: works wherever this folder lives.
REM ============================================================
set "ROOT=%~dp0"

set "NPM_CMD=npm"
if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%AppData%\npm\npm.cmd" set "NPM_CMD=%AppData%\npm\npm.cmd"

if not exist "%ROOT%backend\package.json" (
  echo Could not find Nightfeed files next to this launcher:
  echo %ROOT%
  pause
  exit /b 1
)

REM Backend API on http://localhost:3001 (installs deps automatically on first run)
start "Nightfeed API" cmd /k "cd /d "%ROOT%backend" && (if not exist node_modules "%NPM_CMD%" install) && "%NPM_CMD%" run dev"

REM Frontend web app on http://localhost:5173 (installs deps automatically on first run)
start "Nightfeed Web" cmd /k "cd /d "%ROOT%frontend" && (if not exist node_modules "%NPM_CMD%" install) && "%NPM_CMD%" run dev"

REM Give the dev servers a moment to boot, then open the app
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0
