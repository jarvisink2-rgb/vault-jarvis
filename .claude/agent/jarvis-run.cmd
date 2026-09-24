@echo off
REM Windows headless runner (same flags as `claude -p`). Uses the built-in agent unless JARVIS_AGENT=claude.
if /I "%JARVIS_AGENT%"=="claude" (claude %*) else (node "%~dp0vault-agent.js" %*)
