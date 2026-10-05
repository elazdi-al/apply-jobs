---
name: jobs-research
description: Find new companies to apply to or contact. Runs one research agent per lens in search.json, merges the results into tracker.db, and reports the best finds. Use when the user wants more companies, a research run, or a new direction explored.
argument-hint: "[lens keys or a new direction]"
---

# Research

Work from the repository root. If `search.json` or `profile.md` is missing, run the jobs-setup skill first.

1. Read `search.json` and `profile.md`. Run the lenses named in `$ARGUMENTS`, else all of them. If the user describes a direction no lens covers, propose a new lens (key, title, focus), add it to `search.json` once they agree, and run only that one.
2. Start one subagent per lens, all in one message so they run in parallel, each with this prompt:
   `Follow ${CLAUDE_SKILL_DIR}/brief.md. Lens key: <key>. Lens: <title>. Focus: <focus>`
3. When all are done, run `uv run tracker.py merge`. For each SKIPPED line, fix that file in `research/inbox/` and merge again.
4. Lenses overlap, so read `uv run tracker.py names` for one company under two names. Keep the better-researched row and delete the other from `tracker.db` with sqlite3. If the user already set its status or notes, ask first.
5. Report the companies and people added, the 3 to 5 best new targets with one line each, and any lens that came back empty. The page picks up new rows when its tab regains focus.
