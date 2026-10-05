# Research brief

You research one lens of a job search and write what you find to a JSON file. The prompt that sent you here gives your lens key, title, and focus. Work from the repository root; every path is relative to it.

## Read first

- `search.json`: `goal` is what the candidate wants; `tracks` lists the CV variants.
- `profile.md`: the candidate's background, experience, languages, work rights, and existing connections. Score fit and access against it.
- Run `date` and `uv run tracker.py names`: the CV track ids and every company and person already tracked.

## Goal

Find 8 to 15 strong targets new to the tracker, including companies with no posted opening that are worth contacting. Quality over count: drop weak fits. Skip tracked companies unless you found a materially newer signal (posting, deadline, funding); then include them with the new facts.

## Steps

1. Search with WebSearch and WebFetch, plus any search MCP that is connected (for example Exa, loaded with ToolSearch). For social posts, use WebSearch with `allowed_domains` such as `["x.com"]` or `["linkedin.com"]`.
2. Verify each company on its own website or careers page. It must have been active in the last year. Drop defunct companies and those absorbed by an acquirer.
3. Check founders and leadership for ties to the candidate's schools, employers, or connections. An evidenced tie makes the route "Referral opportunity", with the path spelled out. Never invent a tie.
4. Never invent people. Name a person only when a page you opened states their current role; otherwise name the role ("CTO", "Head of Research").
5. Write `research/inbox/<lens key>.json`, shaped like the example below.
6. Run `uv run tracker.py check research/inbox/<lens key>.json`. Fix every error and re-run until it prints OK. Do not run merge.
7. Reply with the file path, the counts, and up to 3 highlights (company plus one-line reason).

## Example

```json
{
  "companies": [
    {
      "company": "Example Labs GmbH", "country": "Germany", "city": "Berlin", "website": "https://example.com",
      "category": "Developer tools", "stage": "Seed, about 15 people",
      "what_they_do": "Observability for data pipelines.",
      "signal": "Raised EUR 6M seed in March 2026; three engineering roles open.",
      "openings": "No sign of openings",
      "opportunity": "Pitch a 3-month internship on pipeline anomaly detection.",
      "route": "Referral opportunity",
      "referral_path": "The CTO did a PhD in the candidate's university lab; ask that lab's professor for an intro.",
      "outreach_strategy": "Short email to the CTO after the intro: one paragraph on fit, one project idea, CV attached. Follow up after 7 days.",
      "contact_target": "CTO (named on the team page)",
      "step": "Email", "step_who": "Prof. Jane Doe", "step_ask": "Ask for an intro to the CTO with one project idea",
      "cv_variant": "data-eng",
      "deadline": "Rolling; reach out before January 2027",
      "fit": 4, "access": 4, "momentum": 4,
      "sources": ["https://example.com/team", "https://example.com/blog/seed"],
      "found_via": "web"
    }
  ],
  "referrals": [
    {
      "name": "Prof. Jane Doe", "type": "Professor", "affiliation": "Example University, Data Systems Lab", "relationship": "Cold",
      "connects_to": "Example Labs GmbH (CTO is a former PhD student)",
      "how_to_ask": "Email after attending her course; ask whether she would forward a one-paragraph intro.",
      "link": "https://example.edu/doe", "sources": ["https://example.edu/lab/people"]
    }
  ]
}
```

## Field rules

- Required: company, country, category, what_they_do, route, openings, outreach_strategy, step, step_who, step_ask, cv_variant, fit, access, momentum, sources.
- route: "Direct application" (the candidate applies or cold-emails) or "Referral opportunity" (someone can introduce them). Referral opportunity requires referral_path naming the concrete path.
- openings: "Posting open" | "Recurring program" | "Hires ad hoc" | "No sign of openings".
- cv_variant: the track id that matches the company.
- fit (1-5): how well the work matches the candidate. 5 = core work in their strengths, at a strong team.
- access (1-5): 5 = an existing connection can introduce. 4 = evidenced tie to their school or past employer, or a small local team with a reachable founder. 3 = a small team elsewhere with a reachable founder, or an open posting. 2 = a big-company portal. 1 = a work-permit or language barrier.
- momentum (1-5): 5 = a matching posting is open, or funding in the last 6 months plus active hiring. 3 = growing. 1 = quiet.
- opportunity: the specific role or project to pitch. outreach_strategy: concrete next steps (who, channel, angle, timing).
- deadline: the timing in words ("Posting open now", "Apply by 23 October 2026", "Rolling; reach out by January 2027"). The tracker dates the decision from the first date it names.
- step, step_who, step_ask: the first email or application that outreach_strategy calls for, shown as one line on the decision list. step is "Email" (writing to a person: a referral contact for an intro, or a named person at the company) or "Apply" (a posting, program, portal, form, or jobs@ / careers@ inbox). step_who, at most 40 characters: the person's name with any title, else the address or portal ("careers@example.com"). step_ask, at most 80 characters: what it is for, starting with a verb, without repeating Email/Apply or the name ("Ask for an intro to the CTO"). No semicolons, bullets, or long dashes.
- sources: URLs you actually opened. found_via: "web", or the site where you found it, such as "x.com".
- referrals: name, type ("Professor" | "Researcher" | "Alumni" | "Lab / center" | "Program / event" | "Personal"), affiliation, relationship ("Existing" | "Warm" | "Cold"), connects_to, how_to_ask, optional link, sources (may be empty only for Existing).
