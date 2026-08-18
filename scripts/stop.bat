@echo off
:: Xiuxian Game - Stop server (silent)
:: Double-click to shut down the server on port 8613.
:: No popups, no windows. Silently does nothing if not running.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /C:":8613 " ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

exit /b
