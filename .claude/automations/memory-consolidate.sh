#!/bin/bash
# Jarvis automation: memory-consolidate (headless)
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$VAULT" || exit 1
"$VAULT/.claude/agent/jarvis-run" -p "Run the memory-consolidate skill now. Follow .claude/skills/memory-consolidate/SKILL.md exactly." \
  --permission-mode acceptEdits --allowedTools WebSearch WebFetch TodoWrite Task mcp__google-calendar
/usr/bin/osascript -e 'display notification "memory-consolidate finished, Boss." with title "JARVIS"' 2>/dev/null
