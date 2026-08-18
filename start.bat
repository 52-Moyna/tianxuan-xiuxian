@echo off
:: Xiuxian Game Launcher - Start server & open browser
:: Double-click to play; double-click stop.bat when done.

set "DP=%~dp0"
set "SVR=%DP%server.js"

:: --- Locate Node.js ---
set "NODE="
where node >%TEMP%\_xfind.txt 2>&1
if %ERRORLEVEL% EQU 0 set "NODE=node"
if not defined NODE (
  for /d %%U in ("C:\Users\*") do (
    if exist "%%U\.workbuddy\binaries\node\versions" (
      for /r "%%U\.workbuddy\binaries\node\versions" %%F in (node.exe) do set "NODE=%%F"
    )
  )
)
if not defined NODE (
  for %%P in ("%LOCALAPPDATA%\Programs\nodejs\node.exe" "C:\Program Files\nodejs\node.exe" "C:\Program Files (x86)\nodejs\node.exe") do (
    if exist %%P set "NODE=%%P"
  )
)
if not defined NODE (
  echo Node.js not found. Install from https://nodejs.org
  timeout /t 4 >nul
  exit /b
)

:: If server already running, just open browser
netstat -ano | findstr /C:":8613 " | findstr "LISTENING" >%TEMP%\_xchk.txt 2>&1
if not errorlevel 1 (
  start "" "http://127.0.0.1:8613"
  exit /b
)

:: Start server in background (no visible window)
start "" /b "%NODE%" "%SVR%"

:: Wait then open game in default browser
ping -n 3 127.0.0.1 >nul 2>&1
start "" "http://127.0.0.1:8613"

exit /b
