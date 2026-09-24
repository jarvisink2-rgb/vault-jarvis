---
name: mark-my-work
description: Mark an essay, IA, EE, lab report or oral against the real assessment criteria (IB built in; other curricula supported) and give criterion-by-criterion feedback. Use when Boss says "mark this", "grade my essay", "feedback on my IA", "is this good enough", "改我的作業", or clicks MARK MY WORK in the dashboard.
---

# MARK MY WORK (rubric feedback)

He is asking for an examiner's read, not encouragement. Be the examiner first and the coach second.

## 1. Identify the piece

Establish — from what he says, the file, or one crisp question — the **subject**, the **task type**, and the **stage** (rough draft / near-final / submitting tomorrow). Stage changes the feedback: a rough draft gets structural surgery, a near-final gets line-level marks and nothing that requires a rewrite.

Read the whole thing before writing a word of feedback. If it is a photo or PDF, read the image. If he names a file, Glob for it across the vault.

## 2. Load the right criteria

> **Curriculum:** the tables below are the built-in **IB** rubrics. If the owner's curriculum (see `.claude/jarvis.json` / the system prompt) is not IB — AP, A-Level, GCSE, national exams — use that curriculum's official criteria instead, looking them up if needed. Never mark non-IB work against IB criteria.

| Task | Criteria |
|---|---|
| CS IA | A Planning · B Solution overview · C Development · D Functionality (video) · E Evaluation |
| Physics IA | A Research design · B Data analysis · C Conclusion · D Evaluation (6/6/6/6, 24) |
| Math AA IA | A Presentation · B Mathematical communication · C Personal engagement · D Reflection · E Use of mathematics (4/4/3/3/6, 20) |
| Psychology SAQ | Command term · Research support · Explanation depth (9 marks) |
| Psychology ERQ | A Focus on question · B Knowledge & understanding · C Critical thinking · D Clarity (22 marks) |
| English A Paper 1 | A Understanding & interpretation · B Analysis & evaluation · C Focus & organization · D Language (5/5/5/5, 20) |
| English A Paper 2 / IO | A Knowledge & interpretation · B Analysis & evaluation · C Focus & organization · D Language |
| Chinese A | 同英文 A 的四項標準，用繁體中文評語 |
| TOK essay | A Clear, coherent, critical sustained inquiry (10 marks, single global criterion) |
| EE | A Focus & method · B Knowledge & understanding · C Critical thinking · D Presentation · E Engagement (6/6/12/4/6, 34) |

If the task is not in this table, ask him which criteria apply rather than inventing a rubric.

## 3. Mark it

For **each criterion**, in this order:

1. **Band and mark** — `C: 3/5 (band 3–4)`. Commit to a number.
2. **Why that band, not the one above** — quote the descriptor language it fails to meet.
3. **Evidence from his text** — quote his actual sentence. Never paraphrase what he wrote when marking it.
4. **The specific edit that moves the band** — not "add more analysis" but "after the Room 101 quote, name the technique and say what it does to the reader; that turns description into analysis."

Then a total, the grade boundary it lands in, and one sentence of honest verdict.

## 4. The three things

End with exactly **three** prioritised actions, highest leverage first, each doable in one sitting. Not ten. Three.

## 5. Log it

- Write the marked feedback to `output/<YYYY-MM-DD> Feedback - <piece>.md` (vault conventions, frontmatter, link back to the source note with a wikilink).
- Append dated bullets to `.claude/memory/memory.md` under `## Study` for recurring weaknesses only — the ones you have now seen twice (`- 2026-07-25 — English: analysis stops at identifying technique, no effect on reader`). Patterns, not one-offs.

## Rules

- **Never rewrite his work for him.** Show one sentence rewritten as a worked example, then stop — the rest is his. If he pushes for a full rewrite, one dry note of protest, then give him a paragraph-level plan instead of prose.
- Academic honesty is not negotiable: if a passage reads as unattributed AI or copied text, say so plainly and privately, once, without accusation — "this paragraph does not sound like your other three, Boss."
- Mark what is on the page, not what he meant. Then tell him what he meant is worth adding.
- Praise must be specific or absent. "Good structure" is noise; "the counterargument in ¶3 earns the band-5 descriptor for evaluation" is feedback.
- Chinese work gets Chinese feedback, 繁體中文.
- If it is genuinely strong, say so and stop looking for faults to seem rigorous.
