export const meta = {
  name: 'internship-research',
  description: 'Search X.com and the web for European cybersecurity internship targets and merge new ones into summer2027.db',
  whenToUse: 'Grow the summer 2027 internship tracker. Optional args: array of lens keys to run a subset (switzerland, france, dach-benelux, uk-nordics-rest, ai-security, crypto-privacy, corporate-programs, x-signals, referral-map).',
  phases: [
    { title: 'Research', detail: 'one agent per lens writes research/inbox/<lens>.json' },
    { title: 'Merge', detail: 'tracker.py merge into summer2027.db' },
  ],
}

const TRACKER = 'uv run tracker.py'

const NOT_THEMATIC = 'Skip companies whose core product is AI/LLM security, cryptography/privacy/blockchain security, and large corporates or research labs; other agents cover those.'

const LENSES = [
  { key: 'switzerland', title: 'Switzerland', focus: `Cybersecurity startups, scale-ups and specialist security firms in Switzerland (Zurich, Lausanne, Geneva, Bern, Zug, Ticino), including university spin-offs and Swiss security consultancies that take students. ${NOT_THEMATIC}` },
  { key: 'france', title: 'France', focus: `Cybersecurity startups, scale-ups, and offensive-security or research boutiques in France (Paris, Rennes, Lyon, Toulouse, Sophia Antipolis, Grenoble), including the Campus Cyber and Station F ecosystems. ${NOT_THEMATIC}` },
  { key: 'dach-benelux', title: 'Germany, Austria, Benelux', focus: `Cybersecurity startups, scale-ups, and offensive-security or research boutiques in Germany, Austria, the Netherlands, Belgium, and Luxembourg. ${NOT_THEMATIC}` },
  { key: 'uk-nordics-rest', title: 'UK, Ireland, Nordics, rest of Europe', focus: `Cybersecurity startups, scale-ups, and offensive-security or research boutiques in the UK, Ireland, the Nordics, the Baltics, Spain, Portugal, Italy, and Central and Eastern Europe. Note visa friction for the UK. ${NOT_THEMATIC}` },
  { key: 'ai-security', title: 'AI security (pan-European)', focus: 'AI and LLM security companies anywhere in Europe: AI red teaming, LLM firewalls and guardrails, agent security, model supply-chain security, and AI-native security operations. Non-European HQs only if they run a European engineering office that takes interns.' },
  { key: 'crypto-privacy', title: 'Cryptography, privacy, blockchain (pan-European)', focus: 'Applied cryptography (FHE, MPC, ZK, post-quantum), privacy-enhancing technology, confidential computing, hardware and embedded security, and blockchain or smart-contract security and auditing, anywhere in Europe.' },
  { key: 'corporate-programs', title: 'Corporates, labs, institutional programs', focus: 'Organisations with 500+ people, industrial research labs, and institutional programs in Europe offering security or systems internships for summer 2027: big-tech security teams in European offices, industrial research centres (especially around Zurich), Swiss public-sector cyber programs, international organisations, and security teams at large Swiss employers. Many deadlines fall between September and December 2026, so record the exact deadline and whether the posting is open today. Skip startups.' },
  { key: 'x-signals', title: 'X.com signal scan', focus: 'Search X.com (Twitter) posts from the last 12 months for: European cybersecurity startups announcing funding, launches, or hiring; founders or CTOs posting that they are hiring or open to interns; European security researchers mentioning internships at their companies; accelerator batches (YC, Entrepreneur First, Station F, Venture Kick, Kickstart Innovation, Founderful and similar) with European security startups. Use WebSearch with allowed_domains ["x.com", "twitter.com"] and exa queries that describe such posts. Verify every find on the company website. Set found_via to "x.com" and put the X post URL in sources. No category exclusions.' },
  { key: 'referral-map', title: 'Referral map', focus: `Build the referrals list and find companies reachable through academic or alumni ties.
(a) Referrals, 15 to 25 entries: faculty and labs at the candidate's universities in security, privacy, cryptography, and systems, the companies they collaborate with or spun off, partner centers, career fairs and security events in the coming months (with dates), alumni networks, and student CTF teams. profile.md lists sources worth mapping. Also add each existing connection listed in profile.md with relationship "Existing" (sources may be empty for these), saying which tracked or found companies they could plausibly help with and how to ask.
(b) Companies, 8 to 15 entries: spin-offs of security, privacy, or systems labs at the candidate's universities, and companies founded or led by alumni of those labs. Each needs route "Referral opportunity" and a concrete referral_path.` },
]

const EXAMPLE = {
  companies: [{
    company: 'Example Security AG', country: 'Switzerland', city: 'Zurich', website: 'https://example.com',
    category: 'AppSec', stage: 'Seed, ~15 people',
    what_they_do: 'Runtime protection for Kubernetes workloads.',
    signal: 'Raised CHF 6M seed, March 2026; three engineering roles open.',
    internship_status: 'No sign of internships',
    opportunity: 'Pitch a 3-month internship on detection rules for container escapes.',
    route: 'Referral opportunity',
    referral_path: 'CTO did a PhD in a systems security lab at the candidate\'s university; ask that lab\'s professor for an intro.',
    outreach_strategy: 'Short email to the CTO after the intro: one paragraph on fit, one concrete project idea, CV attached. Follow up after 7 days.',
    contact_target: 'CTO (named on team page)',
    step: 'Email', step_who: 'Prof. Jane Doe', step_ask: 'Ask for an intro to the CTO with one container-escape project idea',
    cv_variant: 'product-security-eng',
    deadline: 'Rolling; reach out before January 2027',
    fit: 4, access: 4, momentum: 4,
    sources: ['https://example.com/team', 'https://example.com/blog/seed'],
    found_via: 'web',
  }],
  referrals: [{
    name: 'Prof. Jane Doe', type: 'Professor', affiliation: 'Example University, Security Lab', relationship: 'Cold',
    connects_to: 'Example Security AG (lab spin-off)',
    how_to_ask: 'Email after attending her MSc course; ask whether she would forward a one-paragraph intro.',
    link: 'https://example.ethz.ch', sources: ['https://example.ethz.ch/people'],
  }],
}

const RULES = `FIELD RULES
- Required: company, country, category, what_they_do, route, internship_status, outreach_strategy, step, step_who, step_ask, cv_variant, fit, access, momentum, sources.
- route: "Direct application" (apply or cold-email the company yourself) or "Referral opportunity" (a professor, researcher, alumnus, or other connection can introduce him). Referral opportunity requires referral_path naming the concrete path.
- internship_status: "Posting open" | "Recurring program" | "Hires interns ad hoc" | "No sign of internships".
- cv_variant: one of the ids printed by the names command, matching the company type.
- fit (1-5): how well the work matches his profile. 5 = core security work in his strengths at a strong team.
- access (1-5): 5 = existing connection can introduce. 4 = evidenced tie to the candidate's universities, or a small team in the candidate's country with a reachable founder. 3 = small team elsewhere with a reachable founder, or an open posting. 2 = big-company portal. 1 = permit or language barrier.
- momentum (1-5): 5 = summer 2027 posting open or funding in the last 6 months plus active hiring. 3 = growing. 1 = quiet.
- outreach_strategy: concrete next steps (who, channel, angle, timing). opportunity: the specific internship or project to pitch.
- step, step_who, step_ask: the first email or application outreach_strategy calls for, shown to him as one line on his decision list. step is "Email" (writing to a person: a referral contact for an intro, or a named person at the company) or "Apply" (a posting, program, portal, form, or jobs@/careers@ inbox). step_who, at most 40 characters: the person's name with Prof./Dr. kept, else the address or portal ("careers@example.com", "EF job board"). step_ask, at most 80 characters: what it is for, starting with a verb, without repeating Email/Apply or the name ("Ask for an intro to the CTO", "Pitch a 3-month fuzzing project"). No semicolons, bullets, or long dashes.
- sources: URLs you actually opened. found_via: "web" or "x.com".
- Referrals: name, type ("Professor" | "Researcher" | "Alumni" | "Lab / center" | "Program / event" | "Personal"), affiliation, relationship ("Existing" | "Warm" | "Cold"), connects_to, how_to_ask, optional link, sources (may be empty only for Existing).`

const prompt = lens => `You are researching European cybersecurity internship targets for summer 2027 for one candidate. Your lens: ${lens.title}.
Work from the project root, your working directory; every path below is relative to it.

CANDIDATE
Read profile.md first: studies, experience, languages, work-permit situation, and existing connections. Score fit and access against it.

GOAL
Find 8 to 15 high-quality targets that are new to the tracker, including companies not advertising internships today that are worth contacting proactively. Prefer places where a motivated MSc student would do real security work. Quality over count: drop weak fits.

LENS
${lens.focus}

STEPS
1. Run \`date\` and \`${TRACKER} names\`. The names output lists valid cv_variant ids and every company and referral already tracked. Skip tracked companies unless you found a materially newer signal (new posting, deadline, funding); then you may include them with the new facts.
2. Load search tools with ToolSearch "select:mcp__exa__web_search_exa,mcp__exa__web_fetch_exa,WebSearch,WebFetch". Use exa (category:company and category:people help) and WebSearch. For X.com, use WebSearch with allowed_domains ["x.com", "twitter.com"]. If exa answers with a rate-limit error, continue with WebSearch and WebFetch only.
3. Verify each company by opening its website or careers page. It must be active in 2025-2026. Drop defunct companies and those fully absorbed by an acquirer.
4. Check founders and leadership for ties to the candidate's universities, or ties to the candidate's existing connections. An evidenced tie makes it a Referral opportunity with the path spelled out. Never invent a tie. Without evidence, route is "Direct application".
5. Never invent people. Name a person only when a page you opened states their current role; otherwise describe the role ("CTO", "Head of Research").
6. Write research/inbox/${lens.key}.json with the Write tool, shaped like this example:
${JSON.stringify(EXAMPLE, null, 2)}
7. Run \`${TRACKER} check research/inbox/${lens.key}.json\`. Fix every error and re-run until it prints OK. Do not run merge and do not touch summer2027.db.

${RULES}

Return the file path, counts, and up to 3 highlights (company plus one-line reason).`

const SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    companies: { type: 'integer' },
    referrals: { type: 'integer' },
    highlights: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'companies', 'referrals', 'highlights'],
}

const selected = Array.isArray(args) && args.length ? LENSES.filter(l => args.includes(l.key)) : LENSES
log(`Lenses: ${selected.map(l => l.key).join(', ')}`)

phase('Research')
const summaries = await parallel(selected.map(lens => () =>
  agent(prompt(lens), { label: `research:${lens.key}`, phase: 'Research', schema: SUMMARY })))
const missing = selected.filter((_, i) => !summaries[i]).map(l => l.key)
if (missing.length) log(`No result from: ${missing.join(', ')}`)

phase('Merge')
const merged = await agent(
  `Run \`${TRACKER} merge\` and return its full output verbatim. If it prints SKIPPED lines, also run \`${TRACKER} check\` on each skipped file and include that output.`,
  { label: 'merge', phase: 'Merge', effort: 'low' })

return { summaries: summaries.filter(Boolean), missing, merged }
