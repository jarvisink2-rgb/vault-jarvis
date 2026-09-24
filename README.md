# V.A.U.L.T. — a J.A.R.V.I.S. for your Obsidian vault

A voice-first personal AI assistant that lives in your Obsidian vault. Talk to it, and it searches, reads and edits your notes, runs study drills, writes daily briefings and remembers you across sessions. It all runs locally from one Node.js server with a sci-fi HUD in the browser.

**Works with free models.** It isn't tied to one AI company. The built-in agent works with any OpenAI-compatible API:

| Provider | Cost | Setup |
|---|---|---|
| **Google Gemini** (default) | Free tier, no card needed | `GEMINI_API_KEY` from [AI Studio](https://aistudio.google.com/apikey) |
| Groq | Free tier | `JARVIS_PROVIDER=groq`, `GROQ_API_KEY`, `JARVIS_MODEL` |
| OpenRouter | Some models are free | `JARVIS_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `JARVIS_MODEL` |
| Ollama | Free, 100% offline | `JARVIS_PROVIDER=ollama`, `JARVIS_MODEL` |
| OpenAI / Anthropic | Paid | `JARVIS_PROVIDER=openai` or `anthropic` + key + `JARVIS_MODEL` |
| Claude Code CLI | Paid | `JARVIS_AGENT=claude` (the original backend, adds Gmail/Calendar) |

---

## Setup (5 minutes)

**You need:** [Node.js 18+](https://nodejs.org), Google Chrome (for the microphone), and optionally Python 3 for offline speech recognition.

```bash
git clone https://github.com/jarvisink2-rgb/vault-jarvis.git
cd vault-jarvis
bash setup.sh                 # creates .env, memory files, installs the voice package
```

1. Open `.env` and paste a free Gemini key after `GEMINI_API_KEY=`.
2. Start it: double-click **`Jarvis.command`** (macOS), or run `node .claude/dashboard/server.js`.
3. Open **http://localhost:3333** in Chrome and click the glowing core to talk.

**Using your existing Obsidian vault:** copy `.claude/`, `CLAUDE.md`, `.env`, `TO DO.md`, `Exams.md` and the two `.command` files into the root of your vault. Then edit the vault map in `CLAUDE.md` to match your folders. Or keep this repo where it is and set `JARVIS_VAULT=~/path/to/your/vault` in `.env`.

Tell Jarvis about yourself in `.claude/memory/profile.md`. That file is loaded into every conversation.

---

## What it does

- **Voice in, voice out.** Mic modes cycle OFF → WAKE "JARVIS" → CONVO. You can talk over him to interrupt. Speech recognition uses the browser, or local Whisper if you install it. Voices are free Microsoft Edge neural voices, with optional ElevenLabs.
- **He reads before he answers.** A BM25 index over every note (it handles English and Chinese) is searched on every turn, so answers cite your actual notes.
- **Vault nervous system.** He sees your edits within about 20 seconds and knows every note's path.
- **Persistent memory.** `profile.md` (pinned) and `memory.md` (auto-distilled from conversations) are injected into each session.
- **One-click skills (protocols):** Study Mode (live spoken quiz), Past Paper, Mark My Work (IB rubrics), Morning Report, Night Review (spaced repetition), Deep Research, Process Inbox, Link Notes, Rebuild Index, Weekly Plan, Gap Audit, Revision Sheet, Organize Files.
- **HUD:** ⌘K vault search, a note viewer with clickable wikilinks, a force-directed link graph, an exam countdown, a to-do list, themes, and a full English / 繁體中文 UI.
- **Phone:** same Wi-Fi via ⚙ → PHONE, or from anywhere with voice via [Tailscale](https://tailscale.com).
- **Automations (cron):** `bash .claude/automations/install-crons.sh` schedules the morning report, nightly memory consolidation, the weekly plan, the gap audit and nightly self-improvement.

Skills are plain Markdown in `.claude/skills/*/SKILL.md`, so you can edit them or add your own. The agent sees the list automatically.

---

## How the model-agnostic agent works

The dashboard was first built on the Claude Code CLI (`claude -p`). `.claude/agent/vault-agent.js` is a zero-dependency drop-in replacement. It accepts the same flags and emits the same `stream-json` events, but runs its own tool-use loop against whichever model you configure.

```
Browser HUD ─▶ server.js ─▶ vault-agent.js ─▶ Gemini / Groq / Ollama / … (OpenAI-compatible API)
                                  │
                                  └─ tools: read_file · write_file · edit_file · move_file · list_files
                                            grep · web_search · web_fetch · delegate_task (sub-agents)
```

- **Sandboxed:** the agent can only reach the vault plus the folders you grant in ⚙ → GRANTED FOLDERS. Granted folders are read-only unless you tick write access. It has **no delete tool and no shell**.
- **Web search:** keyless DuckDuckGo by default. Set `TAVILY_API_KEY` or `BRAVE_API_KEY` (both have free tiers) for more reliable results.
- **Sessions:** conversations resume through `.claude/agent-sessions/`. This folder is git-ignored.
- **CLI use:** `.claude/agent/jarvis-run -p "Run the morning-report skill now."`

**Limitation:** Gmail and Google Calendar need MCP connectors, and only the Claude Code backend has those (`JARVIS_AGENT=claude`). With other models, the INBOX BRIEF, DRAFT REPLY and CALENDAR BRIEF chips tell you they aren't available.

---

## Privacy

Everything personal stays on your machine and is **git-ignored**: `.env`, `memory.md`, `profile.md`, conversation logs, sessions, persona notes and folder grants. Your notes are sent only to the model provider you choose. Pick Ollama if you want nothing to leave your computer. Note that free-tier API providers may use your prompts to improve their models, so check their terms.

## Project layout

```
.claude/
  agent/        vault-agent.js (agent loop) · llm.js (streaming client) · tools.js · providers.js · jarvis-run
  dashboard/    server.js (HUD + API, port 3333) · whisper_server.py · video_ingest.py
  skills/       one folder per protocol (SKILL.md)
  agents/       sub-agent roles · commands/  slash-command prompts
  automations/  cron scripts
  memory/       profile.md + memory.md (created by setup.sh, git-ignored)
CLAUDE.md       vault rules the agent reads first
TO DO.md · Exams.md · Home.md · raw/ · wiki/ · output/
```

## License

MIT — see [LICENSE](LICENSE).
