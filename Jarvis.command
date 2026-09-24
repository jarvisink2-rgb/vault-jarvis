#!/bin/bash
# JARVIS launcher — double-click me, or run "jarvis" in Terminal (see README).
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
cd "$(dirname "$0")/.claude/dashboard" || exit 1

if curl -s --max-time 1 http://localhost:3333/stats >/dev/null 2>&1; then
  echo "Jarvis is already online, Boss."
else
  echo "Bringing Jarvis online…"
  nohup node server.js > /tmp/jarvis-server.log 2>&1 &
  for i in {1..10}; do
    sleep 0.5
    curl -s --max-time 1 http://localhost:3333/stats >/dev/null 2>&1 && break
  done
fi

# Arm remote (anywhere) access if Tailscale is installed and signed in
TSBIN="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
if [ -x "$TSBIN" ] && "$TSBIN" status >/dev/null 2>&1; then
  "$TSBIN" serve --bg 3333 >/dev/null 2>&1 && echo "Remote link armed — check ⚙ for the PHONE (ANYWHERE) address."
fi

if command -v open >/dev/null; then open "http://localhost:3333"; else xdg-open "http://localhost:3333" >/dev/null 2>&1 || echo "Open http://localhost:3333"; fi
