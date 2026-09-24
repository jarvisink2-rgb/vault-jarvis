#!/bin/bash
# Local automation: daily morning report → raw/
# Install (runs every day at 7:00):
#   crontab -e   and add the line:
#   0 7 * * * /bin/bash "/path/to/your/vault/.claude/automations/morning-report.sh" >> /tmp/jarvis-morning.log 2>&1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
VAULT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$VAULT" || exit 1
"$VAULT/.claude/agent/jarvis-run" -p "Run the morning-report skill now. Follow .claude/skills/morning-report/SKILL.md exactly." \
  --permission-mode acceptEdits
