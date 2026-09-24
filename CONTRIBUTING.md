# Contributing

Thanks for helping! Jarvis has **zero npm dependencies** — just Node 18+.

```bash
npm test          # offline suite (mock model) — must pass
npm run selftest  # live check against the model in your .env
npm run build     # builds the Obsidian plugin into dist/
```

## Code map

| Path | What it is |
|---|---|
| `.claude/agent/vault-agent.js` | The agent loop. CLI-compatible with `claude -p` (flags + `stream-json`), so the dashboard can use either. |
| `.claude/agent/llm.js` | Streaming client for any OpenAI-compatible `/chat/completions` (tool calls, retries, Gemini thought signatures). |
| `.claude/agent/providers.js` | Provider presets (base URL, key env var, default models). |
| `.claude/agent/tools.js` | Vault tools + sandbox (vault + granted folders, read-only grants, no delete/shell). |
| `.claude/agent/google.js` | Gmail/Calendar tools + OAuth (PKCE, loopback). Read + drafts only. |
| `.claude/agent/selftest.js` | Live smoke test. |
| `.claude/dashboard/server.js` | HTTP routes only. |
| `.claude/dashboard/lib/config.js` | Paths, env, owner settings, `honor()` (name/pronoun rewriting). |
| `lib/persona.js` | JARVIS persona + per-session context (profile, memory, exams, directives, vault map). |
| `lib/agent.js` | Warm worker for conversation (`/ask`) and one-shot skill runs (`/run`). |
| `lib/backend.js` | Chooses vault-agent vs Claude Code CLI. |
| `lib/memory.js` | Profile/memory snippets, conversation log, background memory distillation. |
| `lib/vault.js` · `lib/search.js` | Note listing, change feed, link graph · BM25 retrieval. |
| `lib/voice.js` | Edge/ElevenLabs TTS, Whisper STT sidecar. |
| `lib/skills.js` · `lib/nudges.js` · `lib/stats.js` · `lib/grants.js` · `lib/net.js` | HUD chips · proactive lines · dashboard numbers · folder grants · auth/LAN/Tailscale. |
| `.claude/dashboard/public/` | The HUD (`index.html`, `style.css`, `app.js`), inlined into one response at serve time. |
| `.claude/skills/*/SKILL.md` | Protocols (plain Markdown). |
| `obsidian-plugin/` | Plugin source + build script (embeds the runtime into `dist/main.js`). |
| `test/` | `node:test` suites with a mock LLM (`mock-llm.js`) and an Obsidian API stub. |

## Conventions

- Keep it dependency-free. If you truly need a library, vendor a bundled copy (see `lib/vendor/`).
- Text shown to or about the owner is written as "Boss"/"sir"/"he"; `honor()` rewrites it for the configured owner. Use it for any new user-facing string.
- Tools return readable strings; errors become tool results, not crashes.
- New tools must respect the sandbox (`Sandbox.resolve` / `resolveWritable`).

## Releasing the plugin

Bump `version` in `manifest.json` (and `versions.json`, `package.json`), commit, then push a tag equal to the version (e.g. `git tag 1.0.1 && git push origin 1.0.1`). The Release workflow tests, builds and attaches `main.js`, `manifest.json`, `styles.css`.
