#!/bin/bash
# Jarvis automation: weekly-plan (headless)
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$VAULT" || exit 1
"$VAULT/.claude/agent/jarvis-run" -p "Run the weekly-plan skill now. Follow .claude/skills/weekly-plan/SKILL.md exactly." \
  --permission-mode acceptEdits --allowedTools WebSearch WebFetch TodoWrite Task mcp__google-calendar
/usr/bin/osascript -e 'display notification "weekly-plan finished, Boss." with title "JARVIS"' 2>/dev/null
