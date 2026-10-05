import { Icon } from "./icons.tsx";
import { dueLabel, followUpOn, fullDate, host, isReferral, path, place, STATUSES, trackName, when, type Company, type Status, type Tracker } from "./model.ts";
import { Meter, Quiet, Section, Sentence, type Save } from "./ui.tsx";

const SCORES = [
  ["Fit", "fit", "How well the work matches your profile"],
  ["Access", "access", "How reachable the team is for you"],
  ["Momentum", "momentum", "Hiring signals: postings, funding, growth"],
] as const;
const SENT: Status[] = ["Emailed", "Applied"];
const lower = (label: string) => label.replace(/^(By|Today)\b/, (w) => w.toLowerCase());
// Research writes some plans as "1) ... 2) ..."; those read better as a numbered list.
const steps = (text: string) => (text.startsWith("1)") ? text.split(/(?:^|\s)\d\)\s+/).filter(Boolean) : [text]);

function timing(c: Company, today: string): string {
  if (c.status === "New") {
    if (!c.act_by) return "Rolling, no date";
    const due = dueLabel(c.act_by, today);
    return due === "Overdue" ? "Overdue" : `Due ${lower(due)}`;
  }
  if (!c.last_contact) return c.status;
  const f = followUpOn(c);
  const next = !f ? "" : f <= today ? ", follow up now" : `, follow up ${lower(dueLabel(f, today))}`;
  return `${c.status} on ${fullDate(c.last_contact)}${next}`;
}

export function CompanyPage({ company, data, failed, save }: { company: Company | null; data: Tracker | null; failed: boolean; save: Save }) {
  if (!data) return <Quiet failed={failed} />;
  const back = (
    <a className="back" href="#/">
      <Icon name="arrow-left" size={14} />
      Overview
    </a>
  );
  if (!company) {
    return (
      <>
        {back}
        <p className="quiet" data-heading tabIndex={-1}>
          No company at this address. It may have been renamed in the tracker.
        </p>
      </>
    );
  }
  const c = company;
  const built = data.variants.find((v) => v.id === c.cv_variant)?.built;
  // People rows name the companies they reach in free text, so match the step's contact or the name's first word.
  const stem = c.company.split(/[\s(]/)[0]!.toLowerCase();
  const people = data.people.filter((p) => p.name === c.step_who || (stem.length >= 4 && p.connects_to.toLowerCase().includes(stem)));
  const facts = [
    ["Category", c.category],
    ["Location", place(c)],
    ["Size", c.stage],
    ["Internships", c.internship_status],
  ] as const;

  const plan = steps(c.outreach_strategy);
  const setStatus = (status: Status) => save(c.id, SENT.includes(status) ? { status, last_contact: data.today } : { status });

  return (
    <article className="company">
      {back}
      <header className="memo-head">
        <h1 data-heading tabIndex={-1}>
          {c.company}
          <span className="chip" data-tier={c.tier}>
            Tier {c.tier}
          </span>
        </h1>
        <p className="verdict">{c.opportunity ?? c.what_they_do}</p>
      </header>

      <section className="plan" aria-label="Next step">
        <div className="plan-head">
          <Sentence c={c} kind={c.step} />
          <label className="status">
            <span className="sr-only">Status</span>
            <select value={c.status} onChange={(e) => setStatus(e.currentTarget.value as Status)} data-status={c.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "New" ? "Not started" : s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="ask">{c.step_ask}</p>
        <p className="when">{timing(c, data.today)}</p>
        {c.status === "New" && (
          <p className="when" data-missing={!built || undefined}>
            {built ? `Send cv/${c.cv_variant}.pdf` : `${trackName(c.cv_variant)} CV not built yet, tailor it from cv/cv.tex`}
          </p>
        )}
      </section>

      <dl className="facts">
        {facts.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>

      <div className="figures scores">
        <div>
          <p className="figure" data-tier={c.tier}>
            {c.priority.toFixed(1)}
          </p>
          <Meter value={c.priority - 1} max={4} tier={c.tier} />
          <p className="muted">Priority</p>
        </div>
        {SCORES.map(([label, key, hint]) => (
          <div key={key} title={hint}>
            <p className="figure">{c[key]}</p>
            <Meter value={c[key]} />
            <p className="muted">{label}</p>
          </div>
        ))}
      </div>

      <dl className="brief">
        <div>
          <dt>How to reach out</dt>
          <dd>
            {plan.length > 1 ? (
              <ol className="steps">
                {plan.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            ) : (
              c.outreach_strategy
            )}
          </dd>
        </div>
        {c.contact_target && (
          <div>
            <dt>Who to contact</dt>
            <dd>{c.contact_target}</dd>
          </div>
        )}
        <div>
          <dt>Route</dt>
          <dd>
            <span className="route" data-referral={isReferral(c) || undefined}>
              {isReferral(c) && <Icon name="users" size={14} />}
              {c.route}
            </span>
            {c.referral_path && <p>{c.referral_path}</p>}
          </dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{c.deadline ?? when(c.act_by, data.today)}</dd>
        </div>
        <div>
          <dt>What they do</dt>
          <dd>{c.what_they_do}</dd>
        </div>
        {c.signal && (
          <div>
            <dt>Recent signal</dt>
            <dd>{c.signal}</dd>
          </div>
        )}
      </dl>

      <Section title="Notes">
        <textarea
          key={c.id}
          className="notes"
          defaultValue={c.notes ?? ""}
          placeholder="Anything to remember: replies, names, dates"
          aria-label="Notes"
          rows={3}
          onBlur={(e) => {
            const notes = e.currentTarget.value.trim() || null;
            if (notes !== c.notes) save(c.id, { notes });
          }}
        />
      </Section>

      {people.length > 0 && (
        <Section title="People who can introduce you">
          <ul className="lines facts-list">
            {people.map((p) => (
              <li key={p.id}>
                <span>
                  <span className="sym">{p.name}</span>
                  <span className="chip" data-tone={p.relationship}>
                    {p.relationship}
                  </span>
                </span>
                <span>{p.how_to_ask}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sources" summary={c.found_via === "x.com" ? "Found on X" : undefined}>
        <ul className="lines sources">
          {c.website && (
            <li>
              <a href={c.website} target="_blank" rel="noreferrer">
                {host(c.website)}
              </a>
              <span className="muted">Website</span>
            </li>
          )}
          {c.sources.filter((url) => !c.website || host(url) + path(url) !== host(c.website) + path(c.website)).map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="clip">
                {host(url)}
                <span className="muted">{path(url)}</span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
