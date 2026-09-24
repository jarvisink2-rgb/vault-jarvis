---
name: process-inbox
description: Processes raw/ inbox — turns dumps, captures, and transcripts into clean wiki notes or additions to existing subject notes. Use for "process my inbox / clean up raw".
---

# Process inbox

For each unprocessed file in `raw/` (no `status: processed` in frontmatter, skip README and today's morning report):
1. Classify: study material → relevant subject note/folder; project material → `Projects/` or `wiki/`; general knowledge → `wiki/`.
2. Codify: rewrite cleanly with frontmatter, headings, tables, wikilinks; merge into an existing note when one fits (additive — never overwrite owner content).
3. Link: add wikilinks both ways; update `Home.md`/MOCs for new notes.
4. Mark the raw file's frontmatter `status: processed` and add `processed_to: [[target note]]`. Do not delete raw files.
5. Report: table of raw file → destination.
