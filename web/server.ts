import { Database } from "bun:sqlite";
import { join } from "node:path";
import index from "./index.html";
import { STATUSES, type Company, type Person, type Tracker } from "./model.ts";

const port = Number(process.env.PORT ?? 4100);
const ROOT = join(import.meta.dir, "..");

// tracker.py creates the file and its schema on the first merge.
const db = new Database(join(ROOT, "tracker.db"), { readwrite: true, strict: true });
db.run("PRAGMA busy_timeout = 5000");

type Row<T> = Omit<T, "sources"> & { sources: string };
const companies = db.query<Row<Company>, []>("SELECT * FROM companies ORDER BY priority DESC, company");
const people = db.query<Row<Person>, []>("SELECT * FROM people ORDER BY name");
const one = db.query<Row<Company>, { id: string }>("SELECT * FROM companies WHERE id = $id");
const parse = <T>(row: Row<T>) => ({ ...row, sources: JSON.parse(row.sources) as string[] }) as T;

// Personal data: a page on another origin that rebinds its DNS to 127.0.0.1 still sends its own Host,
// and a cross-site write carries its own Origin.
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const origins = new Set([...hosts].map((h) => `http://${h}`));
const forbidden = () => new Response("Forbidden", { status: 403 });

const today = () => new Date().toLocaleDateString("sv-SE");

// Read on every request, so edits to search.json show without a restart.
type Search = { title: string; tracks: { id: string; name: string }[] };

async function tracker(): Promise<Response> {
  const search: Search = await Bun.file(join(ROOT, "search.json")).json();
  const variants = await Promise.all(
    search.tracks.map(async ({ id, name }) => ({ id, name, built: await Bun.file(join(ROOT, "cv", `${id}.pdf`)).exists() })),
  );
  const body: Tracker = {
    title: search.title,
    today: today(),
    companies: companies.all().map(parse<Company>),
    people: people.all().map(parse<Person>),
    variants,
  };
  return Response.json(body);
}

// The only fields the page writes; everything else belongs to research merges.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = {
  status: (v: unknown) => STATUSES.includes(v as never),
  last_contact: (v: unknown) => v === null || (typeof v === "string" && DATE.test(v)),
  notes: (v: unknown) => v === null || (typeof v === "string" && v.length <= 4000),
};

async function update(id: string, req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return new Response("Expected a JSON object", { status: 400 });
  const fields = Object.entries(body);
  if (fields.length === 0 || !fields.every(([k, v]) => k in FIELDS && FIELDS[k as keyof typeof FIELDS](v))) {
    return new Response("Invalid fields", { status: 400 });
  }
  const set = fields.map(([k]) => `${k} = $${k}`).join(", ");
  const { changes } = db.query(`UPDATE companies SET ${set} WHERE id = $id`).run({ ...body, id } as Record<string, string | null>);
  if (changes === 0) return new Response("Not found", { status: 404 });
  return Response.json(parse<Company>(one.get({ id })!));
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  development: true,
  routes: {
    "/": index,
    "/api/tracker": { GET: (req) => (hosts.has(req.headers.get("host") ?? "") ? tracker() : forbidden()) },
    "/api/companies/:id": {
      PATCH: (req) =>
        hosts.has(req.headers.get("host") ?? "") && origins.has(req.headers.get("origin") ?? "") ? update(req.params.id, req) : forbidden(),
    },
  },
  fetch: () => new Response("Not found", { status: 404 }),
});

console.log(`apply-jobs on ${server.url}`);
