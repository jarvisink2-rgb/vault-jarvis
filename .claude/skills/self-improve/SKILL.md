---
name: self-improve
description: Nightly self-improvement — sync exams from calendar, learn from the day's conversations, tune Jarvis's live persona and nudges, and propose (never apply) code improvements. Use for "self improve", "train yourself", "reprogram yourself".
---

# Self-improvement (nightly, while Boss sleeps)

Work through ALL steps, in order. Be conservative: small, reversible changes only. You are improving yourself — a broken Jarvis helps no one.

1. **Exam sync** — If google-calendar MCP tools are available, list events for the next 60 days. Any exam/test/mock/paper/SAT/deadline events → merge into the table in `Exams.md` (date `YYYY-MM-DD`, no duplicate rows, never delete existing rows). Also mirror countdown-worthy milestone dates from `TO DO.md`. Remove only rows whose dates are past.

1a. **Today's calendar into Directives** — Same tool, list events for just today. Any event that isn't already an exam-table entry (meetings, appointments, commitments, anything with a specific time today) → add as a bullet under the `## Today` section of `TO DO.md`, prefixed with its time (e.g. `- 3:00pm Orthodontist`). This is what the dashboard's DIRECTIVES / TO DO list actually renders, so today's calendar shows up there alongside manually-written todos. Don't duplicate an event already represented as a bullet; remove a synced bullet only once its time has passed today.

2. **Learn from the day** — Read `.claude/dashboard/convo-log.json`, `.claude/memory/memory.md`, and notes modified in the last 24h. Identify: recurring topics, moments Jarvis misread tone or context, requests he handled poorly, and what Boss responded well to.

3. **Tune persona** — Rewrite `.claude/dashboard/persona-learned.txt` (max 15 lines, plain prose, no markdown). It is injected into Jarvis's live persona at every session start, so keep only high-value guidance: this week's priorities (exams, IAs, SAT focus area), tone adjustments, running jokes worth keeping, phrases Boss liked or disliked. Never contradict CLAUDE.md or the base persona.

4. **Tune nudges** — Rewrite `.claude/dashboard/nudges.json`: a JSON array of up to 5 short spoken nudge lines tailored to this week (exam-aware, JARVIS voice, address "Boss", offers phrased as "Shall I…?" / "Might I suggest…"). Must be valid JSON. These are spoken aloud when Boss is idle.

5. **Code suggestions (proposal only)** — You may NOT edit Jarvis's code, scripts or config (`.claude/agent/`, `.claude/dashboard/` except the two tuning files above, `.claude/automations/`, `.env`, launchers). The sandbox blocks it, and the nightly guard restores any code change regardless. If you see a worthwhile improvement, describe it in the report as a proposal: the file, the exact change as a small diff, and why. The owner decides and applies it.

6. **Report** — Write `raw/<YYYY-MM-DD> Night Improvement.md` (frontmatter per vault conventions) with 5–15 lines: what you learned, what you changed (tuning files only), code proposals (as diffs, not applied), what you recommend Boss decide on. It lands in his inbox so the morning report surfaces it.
