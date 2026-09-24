#!/bin/bash
# Optional terminal setup (macOS / Linux). Windows or no terminal? Use the Obsidian plugin instead — see README.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js 18+ is required: https://nodejs.org  (or use the Obsidian plugin, which needs nothing)"; exit 1; }
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ] || { echo "Node.js 18+ is required (you have $(node -v))."; exit 1; }

[ -f .env ] || { cp .env.example .env; echo "Created .env — paste your free Gemini key into it (https://aistudio.google.com/apikey)."; }
[ -f .claude/memory/profile.md ] || cp .claude/memory/profile.example.md .claude/memory/profile.md
[ -f .claude/memory/memory.md ] || cp .claude/memory/memory.example.md .claude/memory/memory.md

if command -v python3 >/dev/null; then
  read -r -p "Install local Whisper speech recognition (faster-whisper, ~500 MB model)? [y/N] " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then python3 -m pip install --user faster-whisper || true; fi
fi
chmod +x Jarvis.command "Jarvis Restart.command" jarvis.sh .claude/agent/jarvis-run .claude/automations/*.sh 2>/dev/null || true
echo
echo "Done. Put your key in .env, then check it works:   npm run selftest"
echo "Start Jarvis:  ./Jarvis.command (macOS) · ./jarvis.sh (Linux) · npm start"
