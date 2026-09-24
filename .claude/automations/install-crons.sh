#!/bin/bash
# Installs/refreshes all Jarvis scheduled automations (idempotent).
A="$(cd "$(dirname "$0")" && pwd)"
( crontab -l 2>/dev/null | grep -v '# jarvis-'
  echo "0 7 * * * /bin/bash \"$A/morning-report.sh\" >> /tmp/jarvis-morning.log 2>&1 # jarvis-morning"
  echo "30 23 * * * /bin/bash \"$A/memory-consolidate.sh\" >> /tmp/jarvis-memory.log 2>&1 # jarvis-memory"
  echo "0 18 * * 0 /bin/bash \"$A/weekly-plan.sh\" >> /tmp/jarvis-week.log 2>&1 # jarvis-week"
  echo "0 10 * * 6 /bin/bash \"$A/gap-audit.sh\" >> /tmp/jarvis-gaps.log 2>&1 # jarvis-gaps"
  echo "25 3 * * * /bin/bash \"$A/self-improve.sh\" >> /tmp/jarvis-improve.log 2>&1 # jarvis-improve"
) | crontab -
echo "Installed. Jarvis schedule:"; crontab -l | grep 'jarvis-'
