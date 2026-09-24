#!/bin/sh
# Linux / any Unix: ./jarvis.sh   (add --restart to restart)
cd "$(dirname "$0")" && exec node .claude/start.js "$@"
