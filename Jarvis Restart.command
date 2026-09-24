#!/bin/bash
# macOS: restart Jarvis (picks up new code and settings).
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
cd "$(dirname "$0")" && node .claude/start.js --restart "$@"
