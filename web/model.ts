// Mirrors the companies and people tables in tracker.db (tracker.py owns the schema).
export type Route = "Direct application" | "Referral opportunity";
export type Openings = "Posting open" | "Recurring program" | "Hires ad hoc" | "No sign of openings";
export type Tier = "A" | "B" | "C";
export type Relationship = "Existing" | "Warm" | "Cold";
export type Step = "Email" | "Apply";
export const STATUSES = ["New", "Emailed", "Applied", "Interviewing", "Offer", "Rejected", "Skipped"] as const;
export type Status = (typeof STATUSES)[number];

export type Company = {
  id: string;
  company: string;
  route: Route;
  country: string;
  city: string | null;
  category: string;
  stage: string | null;
  what_they_do: string;
  signal: string | null;
  openings: Openings;
  opportunity: string | null;
  referral_path: string | null;
  outreach_strategy: string;
  contact_target: string | null;
  step: Step;
  step_who: string;
  step_ask: string;
  cv_variant: string;
  deadline: string | null;
  // YYYY-MM-DD when the timing names a day (or says now), YYYY-MM when it names a month.
  act_by: string | null;
  fit: number;
  access: number;
  momentum: number;
  priority: number;
  tier: Tier;
  status: Status;
  last_contact: string | null;
  notes: string | null;
  website: string | null;
  sources: string[];
  found_via: string | null;
  added: string;
  last_researched: string;
};

export type Person = {
  id: string;
  name: string;
  type: string;
  affiliation: string;
  relationship: Relationship;
  connects_to: string;
  how_to_ask: string;
  link: string | null;
  sources: string[];
  added: string;
};

// A CV track from search.json, and whether cv/<id>.pdf exists.
export type Variant = { id: string; name: string; built: boolean };
export type Tracker = { title: string; today: string; companies: Company[]; people: Person[]; variants: Variant[] };
// The fields the page writes back; see FIELDS in server.ts.
export type Patch = Partial<Pick<Company, "status" | "last_contact" | "notes">>;

export type RouteFilter = "all" | "referral" | "direct";
export type View = { view: "home" } | { view: "company"; id: string };

export const companyHref = (c: Company) => `#/c/${c.id}`;
export function parseRoute(hash: string): View {
  const m = hash.match(/^#\/c\/([a-z0-9]+)$/);
  return m ? { view: "company", id: m[1]! } : { view: "home" };
}

export const isReferral = (c: Company) => c.route === "Referral opportunity";
export const place = (c: Company) => (c.city ? `${c.city}, ${c.country}` : c.country);

// Where each company stands. A new one waits on your email or application; after that, on them.
export const STAGES = [
  ["email", "To email"],
  ["apply", "To apply"],
  ["waiting", "Waiting"],
  ["interviewing", "Interviewing"],
  ["offer", "Offer"],
  ["closed", "Closed"],
] as const;
export type Stage = (typeof STAGES)[number][0];
const STAGE_OF: Record<Exclude<Status, "New">, Stage> = {
  Emailed: "waiting",
  Applied: "waiting",
  Interviewing: "interviewing",
  Offer: "offer",
  Rejected: "closed",
  Skipped: "closed",
};
export const stageOf = (c: Company): Stage => (c.status === "New" ? (c.step === "Email" ? "email" : "apply") : STAGE_OF[c.status]);
export const stageName = (s: Stage) => STAGES.find(([k]) => k === s)![1];

export const filterCompanies = (cs: Company[], stage: Stage | null, route: RouteFilter) =>
  cs.filter((c) => (!stage || stageOf(c) === stage) && (route === "all" || (route === "referral") === isReferral(c)));

export function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of items) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  return counts;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number?];
const monthOf = (iso: string) => iso.slice(0, 7);
const lastDay = (month: string) => new Date(Date.UTC(parts(month)[0], parts(month)[1], 0)).getUTCDate();
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// A month-only date sorts after the named days of its month: "any time in October" comes after "23 October".
const sortKey = (due: string) => (due.length === 7 ? `${due}-99` : due);

export const FOLLOW_UP_DAYS = 7;
const SENT: Status[] = ["Emailed", "Applied"];
export const followUpOn = (c: Company) => (SENT.includes(c.status) && c.last_contact ? addDays(c.last_contact, FOLLOW_UP_DAYS) : null);

export type Kind = Step | "Follow up";
export type Decision = { c: Company; kind: Kind; due: string };

// Everything to do by the end of this month: new companies whose timing has come, and sent emails or
// applications with no reply after a week. Fewer than `min` and the soonest later ones fill in.
export function decisions(cs: Company[], today: string, min = 5): Decision[] {
  const all: Decision[] = [];
  for (const c of cs) {
    if (c.status === "New" && c.act_by) all.push({ c, kind: c.step, due: c.act_by });
    const f = followUpOn(c);
    if (f && f <= today) all.push({ c, kind: "Follow up", due: f });
  }
  all.sort((a, b) => sortKey(a.due).localeCompare(sortKey(b.due)) || b.c.priority - a.c.priority);
  const thisMonth = all.filter((d) => sortKey(d.due) <= `${monthOf(today)}-99`).length;
  return all.slice(0, Math.max(thisMonth, min));
}

export const isThisWeek = (due: string, today: string) => sortKey(due) <= addDays(today, 7) || (due.length === 7 && due < monthOf(today));

// The heading a decision sits under: "This week" (overdue included), then "By 31 October" per month.
export function bucket(due: string, today: string): string {
  if (isThisWeek(due, today)) return "This week";
  return `By ${lastDay(monthOf(due))} ${monthLabel(monthOf(due), today, true)}`;
}
function monthLabel(month: string, today: string, long = false) {
  const [y, m] = parts(month);
  const name = (long ? LONG_MONTHS : MONTHS)[m - 1]!;
  return y === parts(today)[0] ? name : `${name} ${y}`;
}
const shortDate = (iso: string) => `${parts(iso)[2]} ${MONTHS[parts(iso)[1] - 1]}`;
export const fullDate = (iso: string) => `${shortDate(iso)} ${parts(iso)[0]}`;

// When a decision is due: "Today", "Overdue", "Thu 8 Oct", or "By 31 Oct" for a month.
export function dueLabel(due: string, today: string): string {
  if (sortKey(due) < today) return "Overdue";
  if (due === today) return "Today";
  if (due.length === 7) return `By ${lastDay(due)} ${MONTHS[parts(due)[1] - 1]}`;
  return daysBetween(today, due) <= 7 ? `${WEEKDAYS[new Date(due).getUTCDay()]} ${shortDate(due)}` : shortDate(due);
}

// The company list's compact timing cell: "Today", "8 Oct", "Nov", "Jan 2027", or "Rolling".
export function when(actBy: string | null, today: string): string {
  if (!actBy) return "Rolling";
  if (sortKey(actBy) < today) return "Overdue";
  if (actBy === today) return "Today";
  return actBy.length === 7 ? monthLabel(actBy, today) : shortDate(actBy);
}

export const ago = (iso: string, today: string) => {
  const n = daysBetween(iso, today);
  return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`;
};

export const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
export const path = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
};
