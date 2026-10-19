@echo off
REM SLOU on Windows: double-click this file to run the site on this PC.
REM First run installs the packages (a few minutes), later runs start straight away.
REM Stop the site by closing this window (or Ctrl+C).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version 22 from https://nodejs.org and run this again. & pause & exit /b 1)
if not exist node_modules (
  echo Installing packages, first run only...
  call npm install || (pause & exit /b 1)
)
echo Starting SLOU at http://localhost:1437
start "" cmd /c "timeout /t 8 >nul & start http://localhost:1437"
node app.js
pause
