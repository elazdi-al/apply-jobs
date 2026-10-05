---
name: jobs-setup
description: Set up apply-jobs after cloning. Installs what is missing, interviews the user about what they are looking for, writes profile.md and search.json, creates tracker.db, starts the page, and offers the first research run. Use for first-time setup or to change the search direction.
---

# Set up apply-jobs

Work from the repository root. The user's files (`profile.md`, `search.json`, `tracker.db`, `cv/`, `research/`) are gitignored; never commit them.

## 1. Tools

Run `bun --version` and `uv --version`. If one is missing, give the install command and wait:

- bun: `curl -fsSL https://bun.sh/install | bash`
- uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

Then run `bun install`.

## 2. Interview

If `profile.md` and `search.json` exist, summarize them in a few lines, ask what should change, and apply only that.

Otherwise ask for a CV or LinkedIn profile first (a file path or pasted text) and read it: it answers most background questions. Then ask only what is still unknown, in one batch, and a second if needed. Use AskUserQuestion when available.

- Background: name, current studies or job, experience, projects, skills, languages.
- Constraints: nationality or work rights, where they can move, remote, start date and duration.
- Direction: role type (internship, graduate, full-time), field and subfields, regions and cities, company size and stage, companies or sectors to avoid, whether to contact companies with no posted opening.
- Connections: professors, managers, colleagues, alumni networks, clubs, communities who could refer them, with exact names and titles.
- CVs: one CV, or tailored variants per kind of role?

Then propose the goal, tracks, and lenses in one message. Write the files once they confirm or adjust.

## 3. Write the files

`profile.md` is prose the research agents score against:

- One line: who they are and what they want.
- Background, experience, skills, languages.
- Work rights and location constraints, so agents flag permit issues.
- Existing connections, with titles and how they know each person.
- Optional notes for research: markets to search thoroughly, referral sources worth mapping.

`search.json`:

```json
{
  "title": "Summer 2027",
  "goal": "A summer 2027 data engineering internship in Germany or the Netherlands",
  "tracks": [
    { "id": "data-eng", "name": "Data engineering", "targets": "Companies hiring data or platform engineers" }
  ],
  "lenses": [
    { "key": "berlin", "title": "Berlin startups", "focus": "Seed to Series C startups in Berlin with data-heavy products. Skip large corporates; another lens covers them." }
  ]
}
```

- `title`: a few words for the page header.
- `tracks`: one per CV they would send; one is fine. Kebab-case ids. The CV for a track goes in `cv/<id>.pdf`.
- `lenses`: 4 to 9 research directions that barely overlap. Split by region and by theme, and say what each one skips because another covers it. Name concrete cities, ecosystems, accelerators, and events. Useful extras: large companies and formal programs (with deadlines), a scan of hiring posts on X or LinkedIn, and a referral map that lists the people in `profile.md` and the companies reachable through them.

Run `uv run tracker.py names` to confirm `search.json` parses.

## 4. Database and page

- `uv run tracker.py merge` creates `tracker.db` (nothing to merge yet).
- Start `bun run web` in the background and give the user http://127.0.0.1:4100.

## 5. First research

Ask whether to run the first research now; it starts one agent per lens and makes many web searches. If yes, follow the jobs-research skill.
