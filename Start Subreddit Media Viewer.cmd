@echo off
setlocal
set "PROJECT_DIR=%~dp0"

if not exist "%PROJECT_DIR%package.json" (
  echo Could not find package.json in:
  echo %PROJECT_DIR%
  pause
  exit /b 1
)

set "NPM_CMD="
if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%AppData%\npm\npm.cmd" set "NPM_CMD=%AppData%\npm\npm.cmd"
if not defined NPM_CMD set "NPM_CMD=npm"

start "Subreddit Media Viewer Dev" cmd /k "cd /d \"%PROJECT_DIR%\" && \"%NPM_CMD%\" run dev"
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"
exit /b 0
