---
name: night-review
description: End-of-day close-out — what actually happened, spaced-repetition re-drill of logged weak spots, and tomorrow's first move. Use when Boss says "night review", "wrap up the day", "end of day", "晚間回顧", clicks NIGHT REVIEW, or when the nightly cron runs it. The evening counterpart to morning-report.
---

# NIGHT REVIEW

Morning report opens the loop; this closes it. Short, honest, and it must end with him knowing exactly what he does first tomorrow.

## 1. Gather (do all of this before writing)

- **Today's edits** — every note modified today (mtime), with what changed.
- **Today's output** — new files in `output/` and `raw/`.
- **`TO DO.md`** — what got ticked, what did not, what is now overdue.
- **`Exams.md`** — days remaining on the nearest exams.
- **`.claude/memory/memory.md` `## Study`** — the weak-spot log, with dates.
- **`dashboard/convo-log.json`** — what he actually worked on and asked about today.

## 2. Spaced repetition — the part that matters

From the `## Study` weak spots, select items due tonight by interval since they were logged: **1 day → 3 days → 7 days → 16 days → 35 days**. A weak spot marked `(improving)` moves to the next interval; one he missed again resets to 1 day.

Ask him **up to three** of those, one at a time, live and spoken — same grading protocol as `quiz-me` (0–2, one-line feedback, model answer citing the note). Three questions maximum. This is a review, not a second study session; he is tired and the point is retrieval, not new load.

If nothing is due, say so in one line and skip to the next section. Do not manufacture questions to fill space.

## 3. Report

Speak it aloud, in this order, tight:

1. **What landed today** — two or three concrete things, named. Notes written, problems solved, work shipped. Be specific: "the A3 normalisation note went from stub to full, and you marked the databases paper at 24/30."
2. **What slipped** — anything on `TO DO.md` that did not move, and anything overdue. One line. No lecture.
3. **Tonight's recall** — his score on the review questions and which concept is still soft.
4. **Countdown** — nearest exam and days left, if inside 21 days.
5. **Tomorrow's first move** — ONE task, the highest-leverage one, small enough to start in five minutes. Name it precisely.

## 4. Write it

Save to `raw/<YYYY-MM-DD> Night Review.md` per vault conventions: frontmatter, wikilinks to every note touched, sections matching the report above. This is what tomorrow's morning-report reads to know where he left off, so make the "tomorrow's first move" line unambiguous.

Update `.claude/memory/memory.md`:
- Weak spots re-drilled tonight get their result appended (`(improving)`, or the interval reset).
- Any durable fact learned today — a decision, a preference, a milestone — goes in its proper section, dated.

## Rules

- **Under 90 seconds spoken.** If it is longer, cut section 1, not section 5.
- Never end without tomorrow's first move. That line is the whole point of the protocol.
- If the day was bad — nothing shipped, everything slipped — say it plainly and without cheerleading, then make tomorrow's first move deliberately small. One achievable thing beats an honest lecture.
- If it is past 1am, skip the recall questions entirely, give sections 1 and 5 only, and tell him to sleep. Say it once, dryly, and do not nag.
- Match his language. Chinese day, Chinese review.
