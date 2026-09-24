#!/bin/bash
# Nightly self-improvement with safety rails — Jarvis retrains and reprograms himself while you sleep.
# Install: bash install-crons.sh   (runs 03:25 daily)
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
S="$VAULT/.claude/dashboard/server.js"
cd "$VAULT" || exit 1

# Safety rail 1: snapshot before he touches anything
cp "$S" "$S.pre-improve" 2>/dev/null

"$VAULT/.claude/agent/jarvis-run" -p "Run the self-improve skill now. Follow .claude/skills/self-improve/SKILL.md exactly." \
  --permission-mode acceptEdits \
  --allowedTools "WebSearch" "WebFetch" "mcp__google-calendar"

# Safety rail 2: if he broke his own server, roll back
if ! node --check "$S" >/dev/null 2>&1; then
  echo "$(date) self-improve: server.js failed syntax check — reverting"
  cp "$S.pre-improve" "$S"
fi

# Safety rail 3: persona/nudge files must stay sane
node -e "JSON.parse(require('fs').readFileSync('$VAULT/.claude/dashboard/nudges.json','utf8'))" 2>/dev/null \
  || echo "[]" > "$VAULT/.claude/dashboard/nudges.json"
