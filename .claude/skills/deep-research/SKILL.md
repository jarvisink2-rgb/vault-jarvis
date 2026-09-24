---
name: deep-research
description: Multi-source deep research that consolidates prior vault context. Use for "deep research X" — pulls from the web and existing vault notes, writes a sourced brief to output/.
---

# Deep research

1. Search the vault first (Grep/Glob) for prior notes on the topic; list what's already known.
2. Research the web from multiple angles (news, docs, papers, competitor/company pages as relevant). Prefer primary sources; note publication dates.
3. Write `output/YYYY-MM-DD Deep Research - <topic>.md`:
   - frontmatter: `title`, `tags`, `type: research-brief`, `created`
   - **Key takeaways** (top, 5 bullets max)
   - Findings by theme, with inline source links
   - **Prior vault context** section wikilinking related notes
   - `## Sources` list
4. Add the brief to `Home.md` if it's durable reference material; also codify durable facts into `wiki/`.
