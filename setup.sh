#!/bin/bash
# One-time setup for V.A.U.L.T. Run from the vault folder:  bash setup.sh
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 18+ is required: https://nodejs.org"; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || { echo "Node.js 18+ is required (you have $(node -v))."; exit 1; }

[ -f .env ] || { cp .env.example .env; echo "Created .env — open it and paste your free Gemini key (https://aistudio.google.com/apikey)."; }
[ -f .claude/memory/profile.md ] || cp .claude/memory/profile.example.md .claude/memory/profile.md
[ -f .claude/memory/memory.md ] || cp .claude/memory/memory.example.md .claude/memory/memory.md

echo "Installing the dashboard's one dependency (free Edge neural voices)…"
( cd .claude/dashboard && npm install --silent ) || echo "npm install failed — voices fall back to the browser's built-in ones."

if command -v python3 >/dev/null; then
  read -r -p "Install local Whisper speech recognition (faster-whisper, ~500 MB model)? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] && python3 -m pip install --user faster-whisper || true
fi
chmod +x Jarvis.command "Jarvis Restart.command" .claude/agent/jarvis-run .claude/automations/*.sh
echo
echo "Done. Next: put your key in .env, then double-click Jarvis.command (macOS) or run:"
echo "  node .claude/dashboard/server.js    →  http://localhost:3333 in Chrome"
