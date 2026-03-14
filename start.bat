@echo off
cd /d "%~dp0"
start /min "" cmd /c "node server/index.js"
timeout /t 2 /nobreak >nul
start http://localhost:3000
