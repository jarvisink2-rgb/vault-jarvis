---
name: memory-consolidate
description: Nightly memory hygiene — dedupe and reorganize .claude/memory/memory.md, log the day's vault activity, keep the file sharp and under 150 lines. Use for "consolidate memory".
---

# Memory consolidation (nightly)

**Never touch `.claude/memory/profile.md`.** That file is the owner's pinned identity — name, subjects, targets, faith, interests, finances, standing preferences — hand-maintained and injected in full into every session. Do not rewrite it, do not trim it, and do not copy its contents into `memory.md`. If something in `memory.md` contradicts the profile, the profile wins: drop the stale bullet and note it in your report.

1. Read `.claude/memory/memory.md`. Reorganize into sections: `## Owner`, `## Preferences`, `## Study` (weak spots with dates), `## Company`, `## Running jokes`, `## Decisions`, `## Log`.
2. Merge duplicates, drop superseded/stale facts (keep the newest dated version), keep every bullet dated `YYYY-MM-DD`. This file is the ONE file you may fully rewrite — keep it under ~150 lines.
3. Scan the vault for files modified in the last 24h (skip `.claude/`, `.obsidian/`). Append ONE summary bullet to `## Log`: what was added/processed/learned today (e.g. "2026-07-12 — 2 raw notes processed to wiki; revision sheet A3 created; weak spot: normalization").
4. If weak spots in `## Study` are older than 14 days with no recurrence, move them to a `resolved` line.
5. Finish with a one-line report of what changed.
