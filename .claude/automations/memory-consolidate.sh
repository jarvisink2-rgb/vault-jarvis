#!/bin/bash
# Jarvis automation: memory-consolidate (unattended). Install all schedules with: bash install-crons.sh
# Runs through run-guarded.sh, which restores any change the run makes to Jarvis's own code, scripts or config.
DIR="$(cd "$(dirname "$0")" && pwd)"
/bin/bash "$DIR/run-guarded.sh" "Run the memory-consolidate skill now. Follow .claude/skills/memory-consolidate/SKILL.md exactly." --permission-mode acceptEdits --allowedTools WebSearch WebFetch TodoWrite Task mcp__google-calendar
