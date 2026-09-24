#!/bin/bash
# Runs one unattended Jarvis job with an integrity guard around it:
#   snapshot Jarvis's code → run the agent → restore anything the run changed in code/scripts/config.
# Works for every backend (the built-in agent is sandboxed anyway; Claude Code is not).
# The guard and this wrapper execute from a temp copy, so a run cannot rewrite them mid-flight.
#   usage: run-guarded.sh "<prompt>" [extra agent flags…]
set -u
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
if [ -z "${JARVIS_GUARD_COPY:-}" ]; then
  TMP="$(mktemp -d)"; cp "$0" "$TMP/run.sh"; cp "$(dirname "$0")/guard.js" "$TMP/guard.js"
  JARVIS_GUARD_COPY="$TMP" JARVIS_VAULT_DIR="$(cd "$(dirname "$0")/../.." && pwd)" exec /bin/bash "$TMP/run.sh" "$@"
fi
VAULT="$JARVIS_VAULT_DIR"; G="$JARVIS_GUARD_COPY/guard.js"
cd "$VAULT" || exit 1
node "$G" snapshot --vault "$VAULT"
"$VAULT/.claude/agent/jarvis-run" -p "$@"
node "$G" verify --vault "$VAULT" || osascript -e 'display notification "Guard reverted an unauthorised code change — see the log." with title "JARVIS"' 2>/dev/null
rm -rf "$JARVIS_GUARD_COPY"
