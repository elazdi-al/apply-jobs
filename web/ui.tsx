import { useState, type ReactNode } from "react";
import { Icon } from "./icons.tsx";
import type { Company, Patch, Tier } from "./model.ts";

export type Save = (id: string, patch: Patch) => void;

export function Section(props: { title: string; summary?: ReactNode; className?: string; id?: string; children: ReactNode }) {
  return (
    <section id={props.id} className={`section${props.className ? ` ${props.className}` : ""}`}>
      <header>
        <h2>{props.title}</h2>
        {props.summary ? <div className="digest">{props.summary}</div> : null}
      </header>
      {props.children}
    </section>
  );
}

type Fold<T> = { shown: T[]; total: number; limit: number; open: boolean; toggle: () => void };

export function useFold<T>(items: T[], limit = 6): Fold<T> {
  const [open, setOpen] = useState(false);
  return { shown: open ? items : items.slice(0, limit), total: items.length, limit, open, toggle: () => setOpen((o) => !o) };
}

export function More({ fold }: { fold: Fold<unknown> }) {
  if (fold.total <= fold.limit) return null;
  return (
    <button type="button" className="more" aria-expanded={fold.open} onClick={fold.toggle}>
      {fold.open ? "Show fewer" : `Show all ${fold.total}`}
      <Icon name="caret-down" size={14} />
    </button>
  );
}

export function Quiet({ failed, message = "Could not read the tracker." }: { failed: boolean; message?: string }) {
  return <p className="quiet">{failed ? message : "Loading"}</p>;
}

export function Meter({ value, max = 5, tier }: { value: number; max?: number; tier?: Tier }) {
  return (
    <span className="meter" data-tier={tier}>
      <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </span>
  );
}

// The decision as a sentence: [Email] Prof. Jane Doe about Example AG, [Apply] Example AG via its careers page.
export function Sentence({ c, kind }: { c: Company; kind: Company["step"] | "Follow up" }) {
  const referral = c.route === "Referral opportunity";
  return (
    <span className="sentence">
      <span className="kind" data-kind={kind}>
        {kind}
      </span>
      {kind === "Apply" ? (
        <span className="clip">
          <span className="sym">{c.company}</span> <span className="muted">via</span> {c.step_who}
        </span>
      ) : (
        <span className="clip">
          <span className="sym">{c.step_who}</span> <span className="muted">{referral ? "about" : "at"}</span> {c.company}
        </span>
      )}
    </span>
  );
}
