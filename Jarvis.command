#!/bin/bash
# macOS: double-click to start Jarvis and open the HUD.  (Windows: Jarvis.bat · Linux: ./jarvis.sh)
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
cd "$(dirname "$0")" && node .claude/start.js "$@"
