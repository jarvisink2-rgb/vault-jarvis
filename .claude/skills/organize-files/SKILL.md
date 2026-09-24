---
name: organize-files
description: Tidy folder structure — collapse the vault's messy first layer into a School/ folder, restructure output/ into its four standard sections, and optionally tidy the first layer of ~/Documents. Use when Boss says "organize my files", "the sidebar is messy", "tidy the vault", "clean up the first layer", "sort my folders", "整理檔案", or clicks ORGANIZE FILES in the dashboard.
---

# ORGANIZE FILES

You move files and folders — the one thing an apology cannot undo. **Plan first, move only on his explicit yes, always leave a way back.**

**Default scope is the VAULT** (the folder Jarvis runs in) — that is the sidebar he looks at in Obsidian and the mess he usually means. Only work on `~/Documents` if he says "documents" or "desktop" explicitly.

---

## ⛔ Never move these

**In the vault root — moving any of these breaks Jarvis:**

| File / folder | Why it is pinned |
|---|---|
| `TO DO.md` | `server.js` reads it at the vault root for the DIRECTIVES panel and the daily briefing. |
| `Exams.md` | Read at the root for the EXAM COUNTDOWN panel, greetings and nudges. |
| `raw/` | The morning-report protocol writes here; greet/nudge check `raw/<today> Morning Report.md`. |
| `CLAUDE.md` | Claude Code loads project instructions from the project root only. |
| `Home.md` | The master MOC. Vault convention puts it at the root. |
| `.claude/` | Jarvis himself — skills, agents, memory, the dashboard. |
| `Jarvis.command`, `Jarvis Restart.command` | He double-clicks these from Finder and the Dock. |

**Everywhere:** `.obsidian/`, `.git/`, `node_modules/`, anything modified in the last hour, and — if you are ever working in `~/Documents` — the vault folder itself.

---

## Job 1 — the vault's first layer (the usual request)

Target:

```
<vault>/
  School/                     ← everything academic moves in here
    <Subject> notes/
    <Single-file subject>.md
  Projects/                   ← personal / side projects
  Personal/                   ← anything non-academic the owner wants kept separate
  output/  raw/  wiki/        ← pipeline folders, stay put
  Home.md  TO DO.md  Exams.md  CLAUDE.md  *.command   ← pinned, stay at root
```

So: **subject folders and loose subject notes move into `School/`.** Everything in the pinned list stays. Pipeline folders stay.

If a note clearly is not coursework, propose a home for it — don't assume.

**Moving notes does not break `[[wikilinks]]`.** Obsidian resolves them by basename, and so does Jarvis's own `resolveWiki`. You still need to update any MOC table that lists paths, and `Home.md`.

**Depth stops at `School/<Subject>/`.** Do not reorganise the inside of a subject folder unless asked.

---

## Job 2 — `output/`

`output/` ends up with exactly these four, always:

| Folder | Contents |
|---|---|
| `All output/` | Essays, deep research, revision sheets, quizzes, marked feedback, build logs, gap audits. |
| `Weekly Report/` | Weekly-plan output + `Weekly Reports.md`. |
| `Morning Report/` | Morning-report archive + `Morning Reports.md`. |
| `Other/` | Everything else — **you choose the sub-structure**, few folders beat many, one line of explanation each. |

Never rename these four, never add a fifth at the top level, never remove an empty one (leave a one-line README).

Archive morning reports out of `raw/` only when **older than 7 days**. **Never today's or yesterday's** — greet and nudge check for today's file and will think he was never briefed.

---

## Job 3 — `~/Documents` first layer (only when he asks for it)

Collapse subject folders into `~/Documents/School/`, keeping his folder spellings exactly — even typos; he navigates by muscle memory and silently correcting costs more than it gains. The vault folder stays at the first layer. Propose, don't assume, for CAS-ish folders and loose files.

---

## Procedure — every time

1. **Survey.** List what is actually there; never assume the structure.
2. **Check permissions.** Read `.claude/dashboard/folders.json`.
   - **The vault is always writable.** It sits inside `~/Documents`, which is granted read-only — that marking does **not** apply to the vault. Never refuse a vault reorganisation because a parent folder is read-only; that reasoning is wrong and the vault job needs no new permission from him.
   - A read-only grant blocks work **outside** the vault only. There, *plan and stop* — say so plainly and point at the GRANTED FOLDERS panel.
3. **Show the plan and STOP.** A `FROM → TO` table grouped by destination, plus a sketch of the resulting first layer so he can picture it. Uncertainties go under **NEEDS YOUR CALL**, never buried. Then wait.
4. **Move, on his yes.** Move only — never delete, never overwrite, never rename contents. On a name collision append ` (2)` and flag it. Move folders whole. Keep `YYYY-MM-DD` prefixes.
5. **Write the undo log** to `output/.organize/<YYYY-MM-DD-HHMM> moves.json` as `[{"from": "...", "to": "..."}]`, plus an `undo.md` saying what ran and the exact command that reverses it. "Undo the organize" = read the newest log, move everything back.
6. **Repair the path references.** Moving vault folders leaves stale paths in the files that describe the vault. `[[wikilinks]]` are fine (resolved by basename) — these are not. After any vault move, grep for the old paths and update every hit:

   | File | Why it matters |
   |---|---|
   | `CLAUDE.md` | **The most important one.** Its vault-map table is Jarvis's operating instructions, loaded every session. Stale paths here make him look in the wrong places forever. |
   | `Home.md` | Master MOC — its tables list paths. |
   | `.claude/agents/vault-librarian.md` | Names MOC paths it must rebuild. |
   | `.claude/commands/index.md` | Same. |
   | `.claude/skills/vault-conventions/SKILL.md` | Documents the folder layout. |
   | `.claude/skills/quiz-me/SKILL.md` | Tells you where to search for questions. |
   | `.claude/skills/past-paper/SKILL.md` | Same, per subject. |
   | `.claude/skills/gap-audit/SKILL.md` | Syllabus-coverage paths. |
   | `.claude/skills/organize-files/SKILL.md` | This file — its own examples. |

   Also update `folders.json` if a granted path moved, and list any broken Finder aliases or Dock items so he can fix them himself.

   Verify by grepping the old path strings afterwards and reporting a clean result. A move that leaves stale references is a half-finished job.
7. **Report** in under ten lines: counts per destination, the new first layer, skips and why, anything needing his call, where the undo log is.

---

## Hard rules

- Re-read the pinned list before every move.
- **Never delete anything** — not duplicates, not `.DS_Store`, not empty folders. List candidates; he decides.
- Read-only means read-only.
- Never move a file modified in the last hour.
- Keep his spellings.
- If a move looks clever but risky, don't. Copy and flag the original for him to remove.
