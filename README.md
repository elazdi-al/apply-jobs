# apply-jobs

Finds internship targets, tracks them in SQLite, and lists the next emails and applications on a local page.

```sh
bun install
uv run tracker.py merge   # creates summer2027.db
bun run web               # http://127.0.0.1:4100
```

Research runs through `.claude/workflows/internship-research.js` and reads your `profile.md`. Personal files (`profile.md`, `summer2027.db`, `cv/`, `research/`) stay out of git.
