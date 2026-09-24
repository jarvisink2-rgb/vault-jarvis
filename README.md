# V.A.U.L.T. — a J.A.R.V.I.S. for your Obsidian vault

[![CI](https://github.com/jarvisink2-rgb/vault-jarvis/actions/workflows/ci.yml/badge.svg)](https://github.com/jarvisink2-rgb/vault-jarvis/actions/workflows/ci.yml)

A voice-first personal AI assistant that lives in your Obsidian vault. Talk to it, and it searches, reads and edits your notes, quizzes you, marks your essays against real rubrics, writes daily briefings, reads your mail and calendar, and remembers you across sessions. All of it runs locally with a sci-fi HUD.

**Free to run.** It isn't tied to one AI company:

| Provider | Cost | What you need |
|---|---|---|
| **Google Gemini** (default) | Free tier, no card | A key from [AI Studio](https://aistudio.google.com/apikey) |
| Groq | Free tier | Key + model id |
| OpenRouter | Some models free | Key + model id |
| Ollama | Free, 100% offline | [Ollama](https://ollama.com) + a model with tool calling |
| OpenAI / Anthropic | Paid | Key + model id |
| Any OpenAI-compatible URL | – | Base URL + model id |

---

## Install — pick one

### A. Obsidian plugin (no terminal)

1. Install the **VAULT Jarvis** plugin:
   - **While it's awaiting review for the Community Plugins directory:** install [BRAT](https://obsidian.md/plugins?id=obsidian42-brat), run *BRAT: Add a beta plugin*, and paste `jarvisink2-rgb/vault-jarvis`.
   - Or download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/jarvisink2-rgb/vault-jarvis/releases) into `<vault>/.obsidian/plugins/vault-jarvis/`.
2. Enable it, open **Settings → VAULT Jarvis**, and paste your free Gemini key.
3. Click the 🤖 ribbon icon. On first run the plugin installs Jarvis into your vault's `.claude/` folder and starts the local server. **You don't need Node.js**, because it can use Obsidian's built-in runtime.

**Voice:** typing works everywhere, but the microphone is most reliable in Chrome. Click **Open in browser (voice)** to use the same HUD there.

### B. Terminal (macOS, Linux, Windows)

Requires [Node.js 18+](https://nodejs.org). There are no npm dependencies.

```bash
git clone https://github.com/jarvisink2-rgb/vault-jarvis.git && cd vault-jarvis
cp .env.example .env          # paste GEMINI_API_KEY=...
npm run selftest              # ~20 s live check against your model
npm start                     # → http://localhost:3333 in Chrome
```

On macOS you can double-click `Jarvis.command` instead of `npm start`. On Windows, double-click `Jarvis.bat`; on Linux, run `./jarvis.sh`. To use an existing vault, copy `.claude/`, `CLAUDE.md`, `.env`, `TO DO.md` and `Exams.md` into it, or set `JARVIS_VAULT=~/path/to/vault` in `.env`.

---

## Make it yours

- **What it calls you:** set your name, pronouns and curriculum in the plugin settings, in `.env` (`JARVIS_OWNER_NAME`, `JARVIS_OWNER_PRONOUN`, `JARVIS_CURRICULUM`) or in `.claude/jarvis.json`. The whole persona, UI, greetings and nudges adapt. The default is "Boss", in the style of Stark's JARVIS.
- **Who you are:** `.claude/memory/profile.md` is loaded into every conversation.
- **Your vault layout:** edit the vault map in `CLAUDE.md`.
- **Curriculum:** the study protocols ship with IB rubrics. Set another curriculum (AP, A-Level, GCSE, …) and Jarvis uses that curriculum's official criteria instead.
- **Skills:** these are plain Markdown in `.claude/skills/*/SKILL.md`. Edit them or add your own; the agent sees them automatically.

## What it does

- **Voice in, voice out.** Mic modes cycle OFF → WAKE "JARVIS" → CONVO, and you can talk over him to interrupt. Speech recognition uses the browser or local Whisper. Voices are free Microsoft Edge neural voices (bundled), with optional ElevenLabs.
- **He reads before he answers.** A BM25 index over every note (it handles English and Chinese) is searched on every turn, and answers cite your notes.
- **Vault nervous system.** He sees your edits within about 20 seconds and knows every note's path.
- **Memory.** Your pinned profile plus a `memory.md` that is distilled automatically from your conversations.
- **One-click protocols:** Study Mode (spoken quiz), Past Paper, Mark My Work, Morning Report, Night Review (spaced repetition), Deep Research, Process Inbox, Link Notes, Rebuild Index, Weekly Plan, Gap Audit, Revision Sheet, Organize Files, Inbox Brief, Draft Reply, Calendar Brief.
- **HUD:** ⌘K search, a note viewer with clickable wikilinks, a link graph, an exam countdown, a to-do list, themes, and a full English / 繁體中文 UI.
- **Phone:** same Wi-Fi via ⚙ → PHONE, or from anywhere with voice via [Tailscale](https://tailscale.com).
- **Automations:** `bash .claude/automations/install-crons.sh` (macOS/Linux) schedules the morning report, memory consolidation, the weekly plan, the gap audit and nightly self-improvement.

## Gmail & Calendar (optional, any model)

Jarvis talks to Google's APIs directly, so this works with Gemini, Ollama or any other provider. It can **read** mail, **create drafts** and read or create calendar events. **It has no send tool:** you always press Send yourself. Email content is treated as untrusted data, and attempts to instruct Jarvis through an email are quoted back to you.

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Gmail API** and the **Google Calendar API**.
2. Set up **Google Auth Platform → Branding** (any app name). Under Audience, choose **External** and add yourself as a test user.
3. Go to **Clients → Create client → Desktop app**, then copy the ID and secret into the plugin settings or `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
4. Click **Sign in with Google** in the plugin, or run `npm run google:auth`.

While the app is in **Testing** status, Google expires the sign-in after 7 days. To avoid re-signing weekly, set the audience to **In production**. You'll see an "unverified app" warning; it's your own app, so continue.

## Check it works

```bash
npm run selftest    # live: plain reply · tool calling + note edit · dashboard streaming protocol · Google (if connected)
npm test            # offline test suite (mock model), runs in CI on macOS, Windows and Linux
```

If the self-test fails, it tells you why: rate limit, bad key, unknown model, or a model without tool support.

## How it works

```
Obsidian plugin ─┐
Browser / phone ─┴─▶ .claude/dashboard/server.js ──▶ .claude/agent/vault-agent.js ──▶ Gemini · Groq · Ollama · … (OpenAI-compatible)
                        lib/  (persona, memory,          tools: read · write · edit · move · list · grep · web_search · web_fetch
                               search, voice, …)                delegate_task · gmail_* · calendar_*   (no delete, no shell)
                        public/ (HUD: html/css/js)
```

- **Sandboxed:** the agent can reach only the vault and the folders you grant in ⚙ → GRANTED FOLDERS. Granted folders are read-only unless you tick write access.
- **Claude Code still works:** set `JARVIS_AGENT=claude` to use the Claude Code CLI as the backend.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for the code map.

## Privacy & disclosures

- **Network:** your prompts and the note excerpts they need go **only to the model provider you choose**. With Ollama, nothing leaves your computer. Web search uses DuckDuckGo, or Tavily/Brave if you add a key. Speech uses Microsoft Edge TTS (or ElevenLabs if configured). Gmail and Calendar use Google's APIs with your own OAuth client.
- **Local server:** Jarvis runs an HTTP server on port 3333. Requests from other devices need the random access key.
- **Files:** the plugin writes Jarvis's code into `.claude/` in your vault. It never overwrites your notes, skills or memory, and backs up customised code as `.bak-*`.
- **Kept local and git-ignored:** keys (`.env`, plugin `data.json`), `memory.md`, `profile.md`, conversation logs, the Google token and sessions.
- Free-tier API providers may use prompts to improve their models, so check their terms.
- No telemetry, no accounts, no payments.

## License

MIT, see [LICENSE](LICENSE). Bundled: [msedge-tts](https://www.npmjs.com/package/msedge-tts) (MIT) and its dependencies (MIT/ISC/BSD-3-Clause); their licenses are preserved in `.claude/dashboard/lib/vendor/msedge-tts.js`.
