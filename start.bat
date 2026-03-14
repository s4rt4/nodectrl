@echo off
title NodeCtrl Server
cd /d "%~dp0"
echo.
echo   ^|  NodeCtrl is starting...
echo   ^|  http://localhost:3000
echo.

:: Open browser after 2s in background
start /b "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: Run node in this window (stays visible, error will show if crash)
node server/index.js

echo.
echo   Server stopped. Press any key to exit...
pause >nul
