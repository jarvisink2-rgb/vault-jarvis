#!/bin/bash
# JARVIS restart — kills whatever is on port 3333 and relaunches with the latest code.
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
echo "Taking Jarvis offline…"
PIDS=$(lsof -ti :3333)
[ -n "$PIDS" ] && kill $PIDS 2>/dev/null && sleep 1
# stubborn?
PIDS=$(lsof -ti :3333)
[ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null && sleep 1

cd "$(dirname "$0")/.claude/dashboard" || exit 1
echo "Bringing Jarvis back online…"
nohup node server.js > /tmp/jarvis-server.log 2>&1 &
for i in {1..10}; do
  sleep 0.5
  curl -s --max-time 1 http://localhost:3333/stats >/dev/null 2>&1 && break
done
# Arm remote (anywhere) access if Tailscale is installed and signed in
TSBIN="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
if [ -x "$TSBIN" ] && "$TSBIN" status >/dev/null 2>&1; then
  "$TSBIN" serve --bg 3333 >/dev/null 2>&1 && echo "Remote link armed — check ⚙ for the PHONE (ANYWHERE) address."
fi

if command -v open >/dev/null; then open "http://localhost:3333"; else xdg-open "http://localhost:3333" >/dev/null 2>&1 || echo "Open http://localhost:3333"; fi
echo "Done, Boss."
