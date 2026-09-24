#!/bin/bash
# Jarvis automation: morning-report (unattended). Install all schedules with: bash install-crons.sh
# Runs through run-guarded.sh, which restores any change the run makes to Jarvis's own code, scripts or config.
DIR="$(cd "$(dirname "$0")" && pwd)"
/bin/bash "$DIR/run-guarded.sh" "Run the morning-report skill now. Follow .claude/skills/morning-report/SKILL.md exactly." --permission-mode acceptEdits 
