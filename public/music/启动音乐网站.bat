@echo off
title Music Site - close this window to stop
cd /d "%~dp0"
set PORT=8766
echo.
echo   Starting music site at http://localhost:%PORT%
echo   Keep this window open. Close it to stop the site.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:%PORT%"
where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes serve -l %PORT% .
) else (
  echo   Node.js not found, using Python instead...
  python -m http.server %PORT%
)
pause
