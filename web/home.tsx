import { useState } from "react";
import { Icon } from "./icons.tsx";
import {
  ago,
  bucket,
  companyHref,
  decisions,
  dueLabel,
  filterCompanies,
  followUpOn,
  isReferral,
  isThisWeek,
  stageName,
  stageOf,
  when,
  type Company,
  type Decision,
  type Patch,
  type Person,
  type RouteFilter,
  type Stage,
  type Tracker,
} from "./model.ts";
import { Meter, More, Quiet, Section, Sentence, useFold, type Save } from "./ui.tsx";

type Props = {
  data: Tracker | null;
  failed: boolean;
  stage: Stage | null;
  onStage: (s: Stage | null) => void;
  routeFilter: RouteFilter;
  onRouteFilter: (r: RouteFilter) => void;
  save: Save;
};

export function Home(props: Props) {
  const { data } = props;
  if (!data) return <Quiet failed={props.failed} />;
  return (
    <>
      <Next data={data} save={props.save} />
      <InProgress data={data} />
      <Companies {...props} data={data} />
      <People people={data.people} />
    </>
  );
}

type Settled = { prev: Patch; label: string };
const DONE: Record<Decision["kind"], [Patch["status"] | undefined, string]> = {
  Email: ["Emailed", "Emailed"],
  Apply: ["Applied", "Applied"],
  "Follow up": [undefined, "Followed up"],
};

function Next({ data, save }: { data: Tracker; save: Save }) {
  const { today } = data;
  // A row you just settled keeps its place, drawn from its previous values, so Undo stays where you clicked.
  const [settled, setSettled] = useState<Record<string, Settled>>({});
  const view = data.companies.map((c) => (settled[c.id] ? { ...c, ...settled[c.id]!.prev } : c));
  const list = decisions(view, today);
  const week = decisions(data.companies, today).filter((d) => isThisWeek(d.due, today)).length;

  const settle = (d: Decision, patch: Patch, label: string) => {
    const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, d.c[k as keyof Patch]])) as Patch;
    setSettled((s) => ({ ...s, [d.c.id]: { prev, label } }));
    save(d.c.id, patch);
  };
  const undo = (d: Decision) => {
    save(d.c.id, settled[d.c.id]!.prev);
    setSettled(({ [d.c.id]: _, ...rest }) => rest);
  };

  const groups: [string, Decision[]][] = [];
  for (const d of list) {
    const label = bucket(d.due, today);
    const last = groups.at(-1);
    if (last?.[0] === label) last[1].push(d);
    else groups.push([label, [d]]);
  }

  return (
    <section className="next" aria-label="Next decisions">
      <h1 className="headline" data-heading tabIndex={-1}>
        {week} <span className="unit">to do this week</span>
      </h1>
      {groups.map(([label, ds]) => (
        <div key={label} className="group">
          <h2 className="sublabel">{label}</h2>
          <ol className="decisions">
            {ds.map((d) => {
              const [status, label] = DONE[d.kind];
              return (
                <DecisionRow
                  key={d.c.id}
                  d={d}
                  today={today}
                  settled={settled[d.c.id]}
                  onDone={() => settle(d, status ? { status, last_contact: today } : { last_contact: today }, label)}
                  onSkip={() => settle(d, { status: "Skipped" }, "Skipped")}
                  onUndo={() => undo(d)}
                />
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}

function DecisionRow(props: { d: Decision; today: string; settled?: Settled; onDone: () => void; onSkip: () => void; onUndo: () => void }) {
  const { d, today, settled } = props;
  const { c, kind } = d;
  // "Any time this month" is already the heading's "By 31 October"; only named days and late ones need a date.
  const due = d.due.length === 7 && !isThisWeek(d.due, today) ? null : dueLabel(d.due, today);
  return (
    <li className="decision" data-settled={settled ? true : undefined}>
      <a className="row" href={companyHref(c)}>
        <Sentence c={c} kind={kind} />
        <span className="ask">{kind === "Follow up" ? `${c.status} ${ago(c.last_contact!, today)}, no reply yet` : c.step_ask}</span>
        {due && (
          <span className="due" data-late={due === "Overdue" || due === "Today" || undefined}>
            {due}
          </span>
        )}
      </a>
      <span className="acts">
        {settled ? (
          <>
            <span className="settled-label">{settled.label}</span>
            <button type="button" onClick={props.onUndo} aria-label={`Undo ${settled.label.toLowerCase()} for ${c.company}`}>
              Undo
            </button>
          </>
        ) : (
          <>
            <button type="button" className="done" data-kind={kind} onClick={props.onDone} aria-label={`Mark ${c.company} done`}>
              Done
            </button>
            <button type="button" onClick={props.onSkip} aria-label={`Skip ${c.company}`}>
              Skip
            </button>
          </>
        )}
      </span>
    </li>
  );
}

const PROGRESS: Partial<Record<Company["status"], number>> = { Offer: 0, Interviewing: 1, Applied: 2, Emailed: 2 };

function InProgress({ data }: { data: Tracker }) {
  const { today } = data;
  const rows = data.companies
    .filter((c) => c.status in PROGRESS && !((followUpOn(c) ?? "9999") <= today))
    .sort((a, b) => PROGRESS[a.status]! - PROGRESS[b.status]! || (b.last_contact ?? "").localeCompare(a.last_contact ?? ""));
  if (rows.length === 0) return null;
  return (
    <Section title="In progress" summary={`${rows.length} waiting on a reply`}>
      <ol className="rows progress">
        {rows.map((c) => {
          const f = followUpOn(c);
          return (
            <li key={c.id}>
              <a className="row" href={companyHref(c)}>
                <span className="chip" data-stage={stageOf(c)}>
                  {stageName(stageOf(c))}
                </span>
                <span className="who">
                  <span className="name sym">{c.company}</span>
                  <span className="why">
                    {c.status === "Applied" ? `Applied via ${c.step_who}` : c.status === "Emailed" ? `Emailed ${c.step_who}` : c.status}
                    {c.last_contact && ` ${ago(c.last_contact, today)}`}
                  </span>
                </span>
                <span className="muted r">{f && `Follow up ${dueLabel(f, today)}`}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

const ROUTE_FILTERS: [RouteFilter, string][] = [
  ["all", "All"],
  ["referral", "Referral"],
  ["direct", "Direct"],
];

function Companies({ data, stage, onStage, routeFilter, onRouteFilter }: Props & { data: Tracker }) {
  const shown = filterCompanies(data.companies, stage, routeFilter);
  const fold = useFold(shown, 12);
  return (
    <Section
      id="companies"
      title="Companies"
      className="companies"
      summary={
        <>
          {stage && (
            <button type="button" className="clear" data-stage={stage} onClick={() => onStage(null)} aria-label={`Clear the ${stageName(stage)} filter`}>
              {stageName(stage)} <span aria-hidden="true">×</span>
            </button>
          )}
          <span className="spans" role="group" aria-label="Route">
            {ROUTE_FILTERS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={routeFilter === value} onClick={() => onRouteFilter(value)}>
                {label}
              </button>
            ))}
          </span>
        </>
      }
    >
      <ol className="rows">
        <li className="row head" aria-hidden="true">
          <span>{shown.length} by priority</span>
          <span>Route</span>
          <span>Next</span>
          <span className="r">Priority</span>
        </li>
        {fold.shown.map((c) => (
          <li key={c.id}>
            <CompanyRow c={c} today={data.today} />
          </li>
        ))}
      </ol>
      {shown.length === 0 && <p className="quiet">No company matches these filters.</p>}
      <More fold={fold} />
    </Section>
  );
}

function CompanyRow({ c, today }: { c: Company; today: string }) {
  return (
    <a className="row" href={companyHref(c)}>
      <span className="who">
        <span className="name">
          <span className="sym">{c.company}</span> <span className="muted">{c.country}</span>
        </span>
        <span className="why">{c.opportunity ?? c.what_they_do}</span>
      </span>
      <span className="route" data-referral={isReferral(c) || undefined}>
        {isReferral(c) && <Icon name="users" size={14} />}
        {isReferral(c) ? "Referral" : "Direct"}
      </span>
      {c.status === "New" ? (
        <span className={c.act_by ? "" : "muted"}>{when(c.act_by, today)}</span>
      ) : (
        <span className="chip" data-stage={stageOf(c)}>
          {c.status}
        </span>
      )}
      <span className="prio">
        <Meter value={c.priority - 1} max={4} tier={c.tier} />
        <span data-tier={c.tier}>{c.priority.toFixed(1)}</span>
      </span>
    </a>
  );
}

const CLOSENESS = { Existing: 0, Warm: 1, Cold: 2 } as const;

function People({ people }: { people: Person[] }) {
  const sorted = [...people].sort((a, b) => CLOSENESS[a.relationship] - CLOSENESS[b.relationship] || a.name.localeCompare(b.name));
  const fold = useFold(sorted, 6);
  const known = people.filter((p) => p.relationship === "Existing").length;
  return (
    <Section title="People who can introduce you" summary={`${known} you already know`}>
      <ol className="rows people">
        {fold.shown.map((p) => (
          <li key={p.id} className="row">
            <span className="who">
              <span className="name">
                <span className="sym">{p.name}</span> <span className="muted">{p.affiliation}</span>
              </span>
              <span className="why">{p.connects_to}</span>
            </span>
            <span className="chip" data-tone={p.relationship}>
              {p.relationship}
            </span>
          </li>
        ))}
      </ol>
      <More fold={fold} />
    </Section>
  );
}
