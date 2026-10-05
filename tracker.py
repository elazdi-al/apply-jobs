#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Summer 2027 internship tracker, stored in summer2027.db (SQLite).

    uv run tracker.py names              CV tracks, plus companies and people already tracked
    uv run tracker.py check FILE...      validate research JSON files
    uv run tracker.py merge [FILE...]    merge research JSON into summer2027.db (default: research/inbox/*.json)
    uv run tracker.py selftest

Research JSON: {"companies": [...], "referrals": [...]}, field rules in validate_company / validate_referral.
Merging is idempotent and never writes status, last_contact, or notes: those are yours, set from the web page.
"""
import datetime
import json
import re
import shutil
import sqlite3
import sys
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB = ROOT / "summer2027.db"
INBOX = ROOT / "research" / "inbox"
MERGED = ROOT / "research" / "merged"

ROUTES = ("Direct application", "Referral opportunity")
INTERNSHIP = ("Posting open", "Recurring program", "Hires interns ad hoc", "No sign of internships")
STEPS = ("Email", "Apply")
STATUSES = ("New", "Emailed", "Applied", "Interviewing", "Offer", "Rejected", "Skipped")
REF_TYPES = ("Professor", "Researcher", "Alumni", "Lab / center", "Program / event", "Personal")
RELATIONSHIPS = ("Existing", "Warm", "Cold")
CV_ANGLES = {
    "security-generalist": "Early-stage security startups without posted roles, security consultancies",
    "offensive-research": "Offensive security, vulnerability research, pentest / red team, fuzzing and reverse-engineering tooling",
    "product-security-eng": "Security product companies hiring software engineers (AppSec, cloud security, detection platforms)",
    "ai-security": "AI / LLM security, AI red teaming, guardrails, agent security",
    "crypto-privacy": "Applied cryptography, privacy tech, confidential computing, blockchain security",
    "research-lab": "Industrial research labs, big-tech intern programs, public research institutions",
}
STEP_WHO_MAX, STEP_ASK_MAX = 40, 80
# Priority = weighted mean of the 1-5 scores, computed by SQLite so every reader gets the same number.
WEIGHTS = {"fit": 2, "access": 2, "momentum": 1}
TIERS = {"A": 4, "B": 3}


def one_of(column, options):
    quoted = ", ".join("'" + o.replace("'", "''") + "'" for o in options)
    return f"{column} TEXT NOT NULL CHECK ({column} IN ({quoted}))"


PRIORITY = "(" + " + ".join(f"{w} * {k}" for k, w in WEIGHTS.items()) + f") / {float(sum(WEIGHTS.values()))}"
TIER = "CASE " + " ".join(f"WHEN priority >= {floor} THEN '{t}'" for t, floor in TIERS.items()) + " ELSE 'C' END"
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  {one_of("route", ROUTES)},
  country TEXT NOT NULL,
  city TEXT,
  category TEXT NOT NULL,
  stage TEXT,
  what_they_do TEXT NOT NULL,
  signal TEXT,
  {one_of("internship_status", INTERNSHIP)},
  opportunity TEXT,
  referral_path TEXT,
  outreach_strategy TEXT NOT NULL,
  contact_target TEXT,
  {one_of("step", STEPS)},
  step_who TEXT NOT NULL,
  step_ask TEXT NOT NULL,
  {one_of("cv_variant", CV_ANGLES)},
  deadline TEXT,
  act_by TEXT,
  fit INTEGER NOT NULL CHECK (fit BETWEEN 1 AND 5),
  access INTEGER NOT NULL CHECK (access BETWEEN 1 AND 5),
  momentum INTEGER NOT NULL CHECK (momentum BETWEEN 1 AND 5),
  priority REAL GENERATED ALWAYS AS ({PRIORITY}) VIRTUAL,
  tier TEXT GENERATED ALWAYS AS ({TIER}) VIRTUAL,
  {one_of("status", STATUSES)} DEFAULT 'New',
  last_contact TEXT,
  notes TEXT,
  website TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  found_via TEXT,
  added TEXT NOT NULL,
  last_researched TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  {one_of("type", REF_TYPES)},
  affiliation TEXT NOT NULL,
  {one_of("relationship", RELATIONSHIPS)},
  connects_to TEXT NOT NULL,
  how_to_ask TEXT NOT NULL,
  link TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  added TEXT NOT NULL
);
"""

# How a later research run updates a field. fill: write when blank | refresh: newer non-empty wins
# union: merge URL lists | upgrade: Direct application -> Referral opportunity only
COMPANY_RULES = {
    "company": "fill", "route": "upgrade", "country": "fill", "city": "fill", "category": "fill", "stage": "fill",
    "what_they_do": "fill", "signal": "refresh", "internship_status": "refresh", "opportunity": "fill",
    "referral_path": "fill", "outreach_strategy": "fill", "contact_target": "fill",
    "step": "refresh", "step_who": "refresh", "step_ask": "refresh", "cv_variant": "fill", "deadline": "refresh",
    "fit": "fill", "access": "fill", "momentum": "fill", "website": "fill", "sources": "union", "found_via": "fill",
}
PERSON_RULES = {
    "name": "fill", "type": "fill", "affiliation": "fill", "relationship": "fill", "connects_to": "refresh",
    "how_to_ask": "fill", "link": "fill", "sources": "union",
}


def connect(path=DB):
    db = sqlite3.connect(path, timeout=5)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def norm(name):
    s = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"\b(ag|sa|gmbh|sas|sarl|ltd|limited|inc|bv|nv|srl|oy|ab|plc|llc|prof|dr)\b\.?", " ", s)
    return re.sub(r"[^a-z0-9]", "", s)


def _text(rec, key, errors, where, required=True, limit=None):
    v = rec.get(key)
    if v is None or (isinstance(v, str) and not v.strip()):
        if required:
            errors.append(f"{where}: missing '{key}'")
        return
    if not isinstance(v, str):
        errors.append(f"{where}: '{key}' must be a string")
    elif limit and len(v) > limit:
        errors.append(f"{where}: '{key}' must be at most {limit} characters, got {len(v)}")


def _choice(rec, key, options, errors, where):
    if rec.get(key) not in options:
        errors.append(f"{where}: '{key}' must be one of {list(options)}, got {rec.get(key)!r}")


def _sources(rec, errors, where):
    src = rec.get("sources")
    if not isinstance(src, list) or not src or not all(isinstance(u, str) and u.startswith("http") for u in src):
        errors.append(f"{where}: 'sources' must be a non-empty list of http(s) URLs")


def validate_company(rec, where):
    errors = []
    for key in ("company", "country", "category", "what_they_do", "outreach_strategy"):
        _text(rec, key, errors, where)
    for key in ("city", "website", "stage", "signal", "opportunity", "referral_path", "contact_target", "deadline", "found_via"):
        _text(rec, key, errors, where, required=False)
    _choice(rec, "route", ROUTES, errors, where)
    _choice(rec, "internship_status", INTERNSHIP, errors, where)
    _choice(rec, "cv_variant", CV_ANGLES, errors, where)
    _choice(rec, "step", STEPS, errors, where)
    _text(rec, "step_who", errors, where, limit=STEP_WHO_MAX)
    _text(rec, "step_ask", errors, where, limit=STEP_ASK_MAX)
    for key in ("fit", "access", "momentum"):
        v = rec.get(key)
        if not (isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 5):
            errors.append(f"{where}: '{key}' must be an integer 1-5, got {v!r}")
    if rec.get("route") == "Referral opportunity" and not rec.get("referral_path"):
        errors.append(f"{where}: Referral opportunity needs 'referral_path'")
    _sources(rec, errors, where)
    return errors


def validate_referral(rec, where):
    errors = []
    for key in ("name", "affiliation", "connects_to", "how_to_ask"):
        _text(rec, key, errors, where)
    _text(rec, "link", errors, where, required=False)
    _choice(rec, "type", REF_TYPES, errors, where)
    _choice(rec, "relationship", RELATIONSHIPS, errors, where)
    if rec.get("relationship") != "Existing":
        _sources(rec, errors, where)
    return errors


def validate(doc, where):
    if not isinstance(doc, dict) or not set(doc) <= {"companies", "referrals"}:
        return [f"{where}: top level must be an object with only 'companies' and 'referrals' arrays"]
    errors = []
    for i, rec in enumerate(doc.get("companies", [])):
        errors += validate_company(rec, f"{where} companies[{i}] {rec.get('company', '?')}")
    for i, rec in enumerate(doc.get("referrals", [])):
        errors += validate_referral(rec, f"{where} referrals[{i}] {rec.get('name', '?')}")
    return errors


def read_doc(path):
    try:
        doc = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as e:
        return None, [f"{path}: {e}"]
    return doc, validate(doc, str(path))


MONTHS = ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")
# Whole month names or their abbreviations, so "market" or "decision" never read as a month; "may" counts only before a number.
DATE = re.compile(
    r"\b(?:(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+)?"
    r"(january|february|march|april|june|july|august|september|october|november|december"
    r"|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec|may(?=\.?\s*\d))\b\.?"
)


def act_by(text, today):
    """First date ahead that the free-text timing names: YYYY-MM-DD for a named day or "now", YYYY-MM for a month, else None."""
    t = str(text or "").lower()
    if re.search(r"\b(now|this week|today|asap)\b", t):
        return today.isoformat()
    for m in DATE.finditer(t):
        month = MONTHS.index(m[2][:3]) + 1
        year = re.search(r"\b(20\d\d)\b", t[m.start():])
        year = int(year[1]) if year else today.year + (month < today.month)
        if (year, month) >= (today.year, today.month):
            return f"{year}-{month:02d}-{int(m[1]):02d}" if m[1] else f"{year}-{month:02d}"
    return None


def upsert(db, table, rules, key_field, records, today):
    added = updated = 0
    for rec in records:
        key = norm(rec[key_field])
        old = db.execute(f"SELECT * FROM {table} WHERE id = ?", (key,)).fetchone()
        if old is None:
            row = {k: rec.get(k) for k in rules} | {"id": key, "added": today.isoformat(), "sources": json.dumps(rec.get("sources") or [])}
            if table == "companies":
                row |= {"act_by": act_by(rec.get("deadline"), today), "last_researched": today.isoformat()}
            db.execute(f"INSERT INTO {table} ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", list(row.values()))
            added += 1
            continue
        changes = {}
        for k, rule in rules.items():
            new, was = rec.get(k), old[k]
            if rule == "union":
                have = json.loads(was)
                more = [u for u in new or [] if u not in have]
                if more:
                    changes[k] = json.dumps(have + more)
            elif new in (None, ""):
                continue
            elif (rule == "fill" and was in (None, "")) or (rule == "refresh" and new != was):
                changes[k] = new
            elif rule == "upgrade" and new == "Referral opportunity" and was != new:
                changes[k] = new
        updated += bool(changes)
        if "deadline" in changes:
            changes["act_by"] = act_by(changes["deadline"], today)
        if table == "companies":
            changes["last_researched"] = today.isoformat()
        if changes:
            db.execute(f"UPDATE {table} SET {', '.join(f'{k} = ?' for k in changes)} WHERE id = ?", [*changes.values(), key])
    return added, updated


def merge(paths, db_path=DB, merged_dir=MERGED, today=None):
    today = today or datetime.date.today()
    companies, referrals, good, failed = [], [], [], []
    for path in paths:
        doc, errors = read_doc(path)
        if errors or doc is None:
            failed += errors
            continue
        companies += doc.get("companies", [])
        referrals += doc.get("referrals", [])
        good.append(Path(path))
    with connect(db_path) as db:
        c_add, c_upd = upsert(db, "companies", COMPANY_RULES, "company", companies, today)
        r_add, r_upd = upsert(db, "people", PERSON_RULES, "name", referrals, today)
    db.close()
    for path in good:
        if path.parent.resolve() == (merged_dir.parent / "inbox").resolve():
            merged_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(path, merged_dir / f"{today.isoformat()}-{path.name}")
    print(f"companies: +{c_add} new, {c_upd} updated | people: +{r_add} new, {r_upd} updated | files merged: {len(good)}")
    for e in failed:
        print("SKIPPED", e)
    return not failed


def names(db_path=DB):
    print("CV TRACKS (cv_variant values):")
    for variant, targets in CV_ANGLES.items():
        print(f"  {variant}: {targets}")
    if not db_path.exists():
        return
    db = connect(db_path)
    for title, sql in (("COMPANIES", "SELECT company FROM companies ORDER BY company"), ("REFERRALS", "SELECT name FROM people ORDER BY name")):
        print(f"{title}:")
        for (name,) in db.execute(sql):
            print(f"  {name}")
    db.close()


def selftest():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        inbox = tmp / "research" / "inbox"
        inbox.mkdir(parents=True)
        base = {
            "company": "Foo Security AG", "country": "Switzerland", "category": "AppSec", "what_they_do": "w",
            "outreach_strategy": "o", "route": "Direct application", "internship_status": "Posting open",
            "cv_variant": "ai-security", "fit": 5, "access": 3, "momentum": 4, "signal": "seed", "sources": ["https://a"],
            "step": "Apply", "step_who": "jobs@foo.ch", "step_ask": "Send the CV", "deadline": "Apply by 23 October 2026",
        }
        ref = {"name": "Prof. X", "type": "Professor", "affiliation": "Example University", "relationship": "Existing",
               "connects_to": "Foo", "how_to_ask": "email"}
        (inbox / "a.json").write_text(json.dumps({"companies": [base], "referrals": [ref]}))
        db_path = tmp / "t.db"
        run = lambda: merge(sorted(inbox.glob("*.json")), db_path, tmp / "research" / "merged", datetime.date(2026, 10, 5))
        assert run()
        assert not list(inbox.glob("*.json")), "inbox archived"

        with connect(db_path) as db:
            db.execute("UPDATE companies SET status = 'Emailed', last_contact = '2026-10-06', fit = 2 WHERE id = 'foosecurity'")
        db.close()

        again = dict(base, company="Foo Security SA", signal="Series A", fit=5, route="Referral opportunity",
                     referral_path="via Prof. X", sources=["https://a", "https://b"], step="Email", step_who="Prof. X")
        other = dict(base, company="Bar", sources=["https://c"])
        (inbox / "b.json").write_text(json.dumps({"companies": [again, other]}))
        (inbox / "c.json").write_text(json.dumps({"companies": [dict(base, company="Bad", fit=9)]}))
        (inbox / "d.json").write_text(json.dumps({"companies": [dict(base, company="Long", step_ask="x" * 81)]}))
        assert not run(), "invalid file reported"
        assert (inbox / "c.json").exists() and (inbox / "d.json").exists(), "invalid files left in inbox"

        db = connect(db_path)
        rows = {r["company"]: r for r in db.execute("SELECT * FROM companies")}
        assert set(rows) == {"Foo Security AG", "Bar"}, rows
        foo = rows["Foo Security AG"]
        assert foo["status"] == "Emailed" and foo["last_contact"] == "2026-10-06", "your columns preserved"
        assert foo["fit"] == 2, "edited score preserved"
        assert foo["signal"] == "Series A" and foo["step"] == "Email", "refreshed"
        assert foo["route"] == "Referral opportunity", "route upgraded"
        assert json.loads(foo["sources"]) == ["https://a", "https://b"], "sources unioned"
        assert foo["priority"] == (2 * 2 + 2 * 3 + 4) / 5 and foo["tier"] == "C", (foo["priority"], foo["tier"])
        assert rows["Bar"]["tier"] == "A" and rows["Bar"]["status"] == "New" and rows["Bar"]["act_by"] == "2026-10-23"
        try:
            db.execute("UPDATE companies SET status = 'Maybe'")
            raise AssertionError("status outside STATUSES accepted")
        except sqlite3.IntegrityError:
            pass
        db.close()

        assert norm("Kudelski Security SA") == norm("Kudelski Security") == norm("Kudelski Security (Kudelski Group)")
        assert norm("Dr. Jane Doe") == norm("Jane Doe") and norm("Prof. Renée Müller") == norm("Renee Muller")
        d = datetime.date(2026, 10, 5)
        cases = {
            "Intern posting open now; contact before December 2026": "2026-10-05",
            "23 October 2026 per research run": "2026-10-23",
            "Rolling postings; career fair booth 8-9 October 2026": "2026-10-08",
            "Apply Oct-Dec 2026; offers published": "2026-10",
            "Rolling; reach out November 2026 to January 2027": "2026-11",
            "Summer Student Programme: end of January 2027": "2027-01",
            "Rolling; reach out by February": "2027-02",
            "Rolling": None,
            "Rolling; spring interns started April 2026, so reach out by Jan 2027": "2027-01",
            "Their 2026 stage started in February; enquire by Dec 2026": "2026-12",
            "A decision on the market may need a permit; pitch in Sept": "2027-09",
            "Deadline 3 May 2027": "2027-05-03",
        }
        for text, want in cases.items():
            assert act_by(text, d) == want, (text, act_by(text, d), want)
    print("selftest ok")


def main(argv):
    cmd, args = (argv[0], argv[1:]) if argv else ("help", [])
    if cmd == "names":
        names()
    elif cmd == "check":
        errors = [e for path in args for e in read_doc(path)[1]]
        print("\n".join(errors) if errors else f"OK ({len(args)} file(s))")
        return 1 if errors or not args else 0
    elif cmd == "merge":
        return 0 if merge(args or sorted(INBOX.glob("*.json"))) else 1
    elif cmd == "selftest":
        selftest()
    else:
        print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
