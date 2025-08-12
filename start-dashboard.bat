@echo off
echo Starting AI Dashboard Dev Mode...
REM Open a new terminal for Vite
start cmd /k "npm run dev"
REM Wait 3 seconds for Vite to start
timeout /t 3 >nul
REM Start Tauri in this terminal
npx tauri dev
pause
