@echo off
REM Windows: restart Jarvis.
cd /d "%~dp0"
node .claude\start.js --restart %*
if errorlevel 1 pause
