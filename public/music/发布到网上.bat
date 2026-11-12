@echo off
title Publish music site to Vercel
cd /d "%~dp0"
where npx >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo   Node.js is not installed. Please install it from https://nodejs.org  then run this again.
  echo.
  pause
  exit /b
)
echo.
echo   Publishing D:\...\site to Vercel ...
echo   (First time: it will ask you to log in and a few setup questions.)
echo.
npx --yes vercel@latest --prod
echo.
echo   Copy the "Production" URL above and send it to Claude to make the QR codes.
echo.
pause
