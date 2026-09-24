#!/bin/bash
# Jarvis automation: gap-audit (headless)
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$VAULT" || exit 1
"$VAULT/.claude/agent/jarvis-run" -p "Run the gap-audit skill now. Follow .claude/skills/gap-audit/SKILL.md exactly." \
  --permission-mode acceptEdits --allowedTools WebSearch WebFetch TodoWrite Task mcp__google-calendar
/usr/bin/osascript -e 'display notification "gap-audit finished, Boss." with title "JARVIS"' 2>/dev/null
