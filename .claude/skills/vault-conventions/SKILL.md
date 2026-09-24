---
name: vault-conventions
description: Formatting and organization conventions for this Obsidian vault. Use whenever creating or editing any note in the vault — frontmatter, wikilinks, MOC tables, naming, folder placement.
---

# Vault conventions

## Frontmatter (every note)
```yaml
---
title: Note Title
tags: [subject, topic-code, theme]
---
```
Company/planning docs add: `type`, `status`, `created`, `updated` (YYYY-MM-DD).

## Links
- `[[Note]]`, `[[Note#Heading|alias]]` for sections.
- Link concepts on first mention; use a `## Related` section when inline links would clutter.

## MOCs
- Tagged `MOC`, use tables: `| Topic | File | Summary |`.
- Model: `Computer science notes/00 — Index.md`. Every note must be reachable from `Home.md`.

## Placement & naming
- IB CS → `Computer science notes/` with topic-code prefixes (`A1 - `, `B4 - `).
- Project/company docs → `Projects/`. Single-file subjects stay at vault root.
- Never rename or delete owner files without being asked; additive edits only.

## Style
- Revision-friendly: short sections, tables, bold key terms, IB command terms where relevant.
