---
name: gap-audit
description: Weekly syllabus coverage audit — compares vault notes against the official syllabus (IB by default) per subject and writes a Knowledge Gaps report to output/. Use for "audit my knowledge gaps".
---

# Knowledge-gap audit (weekly)

> **Curriculum:** the tables below are the built-in **IB** rubrics. If the owner's curriculum (see `.claude/jarvis.json` / the system prompt) is not IB — AP, A-Level, GCSE, national exams — use that curriculum's official criteria instead, looking them up if needed. Never mark non-IB work against IB criteria.

1. Subjects: take the owner's subject list from `.claude/memory/profile.md` or the vault map in `CLAUDE.md` (e.g. IB DP subjects with their topic codes).
2. For each subject: list what the vault actually covers (scan filenames, headings, frontmatter). Then compare against the current official IB syllabus topic list — use WebSearch to confirm topic lists where unsure (syllabuses change — check the current version).
3. Write `output/<today> Knowledge Gaps.md` (vault conventions: frontmatter `title`, `tags: [gap-audit, revision]`, `created`). Per subject, a table: `| Topic | Coverage | Evidence | Action |` where Coverage ∈ none/thin/solid, Evidence = wikilink to the note/heading, Action = concrete next note or revision task.
4. End with `## Top 5 priorities` — the five most exam-dangerous gaps across all subjects, each with a one-line reason (e.g. "appears every Paper 1").
5. Add a wikilink to the new report in `Home.md` under Exams & Prep (replace last week's link if present). Keep the spoken summary to 2 sentences.
