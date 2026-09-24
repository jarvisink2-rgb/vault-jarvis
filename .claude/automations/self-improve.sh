#!/bin/bash
# Jarvis automation: self-improve (unattended). Install all schedules with: bash install-crons.sh
# Runs through run-guarded.sh, which restores any change the run makes to Jarvis's own code, scripts or config.
DIR="$(cd "$(dirname "$0")" && pwd)"
/bin/bash "$DIR/run-guarded.sh" "Run the self-improve skill now. Follow .claude/skills/self-improve/SKILL.md exactly." --permission-mode acceptEdits --allowedTools WebSearch WebFetch mcp__google-calendar
# The tuning files he may rewrite must stay valid (the dashboard hot-loads them).
VAULT="$(cd "$DIR/../.." && pwd)"
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$VAULT/.claude/dashboard/nudges.json" 2>/dev/null \
  || echo "[]" > "$VAULT/.claude/dashboard/nudges.json"
