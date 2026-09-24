---
name: past-paper
description: Build and mark a timed exam-style past paper (IB by default) from Boss's own notes. Use when he says "past paper", "give me a paper", "exam practice", "mock", "考卷", "模擬考", or clicks PAST PAPER in the dashboard. Unlike quiz-me (live, one question at a time, spoken), this produces a written paper he sits under timed conditions, then marks it.
---

# PAST PAPER (timed written drill)

Two modes. Decide from what he asks, and say which mode you are in — one line, no preamble.

- **SET** — he wants a paper. Produce it, tell him the time limit, stop.
- **MARK** — he has answers to a paper you already set. Mark them against the markscheme.

If he clicks the dashboard chip with a topic, that is SET.

---

## SET mode

### 1. Scope it

Grep/Glob the WHOLE vault for the topic before writing a single question — notes live in subject folders, `wiki/`, and single-file subject notes at the root (see the vault map in `CLAUDE.md`). Read what you find. Every question must be answerable from his notes; if a syllabus point is thin in the vault, you may still ask it but mark it `[gap]` in the markscheme.

Check `Exams.md` — if the topic matches an exam under 14 days away, weight the paper toward that syllabus.

### 2. Choose the paper shape

> **Curriculum:** the tables below are the built-in **IB** rubrics. If the owner's curriculum (see `.claude/jarvis.json` / the system prompt) is not IB — AP, A-Level, GCSE, national exams — use that curriculum's official criteria instead, looking them up if needed. Never mark non-IB work against IB criteria.

| Subject | Shape |
|---|---|
| CS HL | Section A short-answer (2–5 marks each), then one extended question (7–9 marks). Use topic codes A1–B4. |
| Physics HL | MCQ ×4, then structured questions with working marks. State which data-booklet formulas apply. |
| Math AA HL | 3 short (Paper 1 style, no GDC) + 1 long (Paper 2 style, GDC allowed). Mark method vs answer separately (M1/A1). |
| Psychology | One SAQ (9 marks) + one ERQ prompt (22 marks) with a planning skeleton. |
| English A | Guided textual analysis on an unseen-style extract from a text he has studied (check his notes for the text list). |
| Chinese A | 繁體中文出題：文本分析題 + 一道 Paper 2 比較題（作品取自他筆記中讀過的文本）。 |
| TOK | One prescribed-title-style prompt + a knowledge-question breakdown. |
| SAT | Timed section: 10 grammar/rhetoric items or 10 math items, real SAT format. |

Default total: **30 marks, 45 minutes**, unless he asks otherwise.

### 3. Write it

Write to `output/<YYYY-MM-DD> Paper - <topic>.md` following vault conventions (frontmatter, tags). Structure:

```
## Instructions
Time: 45 minutes. No notes. Marks in brackets.

## Questions
1. ...  [4]
...

---
## MARKSCHEME — do not read until you have finished
<details>
```

Put the markscheme in the SAME file, below a clear divider, inside a `<details>` block so Obsidian collapses it. Each answer gets: the mark breakdown (one line per mark), the **exact note section it comes from**, and the command term's expectation ("*evaluate* needs a judgement, not just both sides").

### 4. Hand it over

Tell him: file name, marks, time limit, one sentence on what it targets. Offer to start a timer via the nudge system. Then stop — do not answer your own paper.

---

## MARK mode

1. Read the paper file and his answers (he may paste them, put them under `## My answers`, or upload a photo — read the image).
2. Mark strictly to the markscheme, question by question:
   - Award marks explicitly: `3/4 — got the mechanism, missed the trade-off mark.`
   - Quote the exact phrase that earned or lost the mark.
   - Name the failure type: knowledge gap · command-term miss · vague wording · no example · ran out of scope.
3. Total it, give the IB grade band if the subject has one, and be honest about it. A soft mark helps nobody two weeks out.
4. Write the marked script to `output/<YYYY-MM-DD> Paper Marked - <topic>.md`.
5. Append dated weak spots to `.claude/memory/memory.md` under `## Study` — same format quiz-me uses (`- 2026-07-25 — A3: writes 2NF definition without mentioning composite keys`). No duplicates; if a weak spot is already logged and he got it right this time, append `(improving)` to that line instead.
6. End with the single highest-leverage next action. One sentence.

---

## Rules

- Never write a question whose answer is not traceable to his notes or the syllabus — no invented content.
- Never reveal the markscheme in SET mode, even if he asks mid-paper. Offer a hint worth 0 marks instead.
- Match the language of the notes: Chinese texts get Chinese papers, 繁體中文.
- Working marks matter in Math and Physics — mark method even when the final answer is wrong.
- If he asks for "another one", vary the questions; never reissue the same paper.
