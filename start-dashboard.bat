@echo off
setlocal enableextensions

echo === AI Dashboard Dev ===

REM 1) Kill anything listening on 5174 (Vite default) so Tauri can start cleanly.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {} }"

REM Small pause so the port is fully released
ping 127.0.0.1 -n 2 >nul

REM 2) Start Tauri dev (this will run `npm run dev` for you via beforeDevCommand)
npm run tauri:dev

endlocal
