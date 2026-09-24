@echo off
REM Windows: double-click to start Jarvis and open the HUD.
cd /d "%~dp0"
node .claude\start.js %*
if errorlevel 1 pause
