// Reddit lead-finder core (WP5), ported from scripts/find-reddit-threads.mjs for the weekly cron.
// Surfaces threads where people ask for cosy/boutique hotel recommendations in cities we cover, via
// Apify's Google-search actor (site:reddit.com …) — which dodges Reddit's API/IP block and needs no
// Reddit credentials. READ-ONLY: we search + parse, then callers insert leads to reddit_leads. We
// NEVER auto-post to Reddit (ban-safe); Per replies MANUALLY from /growth. The manual script remains
// the source of truth for ad-hoc runs; this module is the serverless twin used by the cron route.

// Cities we have guide pages for (from src/data/cityGuides.ts) — leads for these are the most
// actionable because we can reply with a real ranked guide link. Keep in sync with the manual script.
export const REDDIT_CITIES = [
  "Paris", "Edinburgh", "Amsterdam", "Prague", "Bruges", "Venice", "Florence", "Barcelona",
  "Copenhagen", "Santorini", "New York City", "San Francisco", "Charleston", "Savannah", "Quebec City",
  "Kyoto", "Ubud", "Queenstown", "Sydney", "Tokyo", "Reykjavik", "Lucerne", "Salzburg", "Porto", "Dubrovnik",
];

const ACTOR = "apify~google-search-scraper";

export const queryFor = (city: string) =>
  `site:reddit.com cosy OR boutique OR "where to stay" hotel recommendation ${city}`;

// A result is a lead if it's a real thread AND the title reads like a request, not an article/promo.
const THREAD_RE = /reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)\//i;
const REQUEST_RE = /recommend|where to stay|looking for|suggestion|best|worth|advice|help|any (good|nice)|\?/i;
const NOISE_RE = /lego|minecraft|for sale|selling|my (photos|trip report)/i;

export type RedditLead = {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  snippet: string;
  query: string;
  city: string;
};

type ActorResult = {
  items: Array<Record<string, unknown>>;
  costUsd: number;
  status: string;
};

// Run the Apify Google-search actor over a batch of queries in ONE run (mirrors the manual script's
// batching). Polls with a bounded budget and returns whatever items exist — even on a RUNNING/timeout
// status — so the caller gets partial results instead of a 504. `maxWaitMs` caps total poll time.
export async function runActor(
  queries: string[],
  token: string,
  maxWaitMs = 200_000,
): Promise<ActorResult> {
  const input = {
    queries: queries.join("\n"),
    maxPagesPerQuery: 1,
    resultsPerPage: 10,
    countryCode: "us",
    languageCode: "en",
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
  };
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => r.json());
  const runId = start?.data?.id as string | undefined;
  const dsId = start?.data?.defaultDatasetId as string | undefined;
  if (!runId || !dsId) throw new Error("actor start failed: " + JSON.stringify(start).slice(0, 200));

  const deadline = Date.now() + maxWaitMs;
  let run: { status?: string; usageTotalUsd?: number } | undefined;
  do {
    await new Promise((r) => setTimeout(r, 4000));
    run = (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`).then((r) => r.json()))?.data;
  } while (run && ["READY", "RUNNING"].includes(run.status || "") && Date.now() < deadline);

  const items = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${token}&clean=true`).then((r) => r.json());
  return { items: Array.isArray(items) ? items : [], costUsd: run?.usageTotalUsd ?? 0, status: run?.status ?? "UNKNOWN" };
}

// Pure: map each dataset item (one per query) back to its city and collect deduped candidate leads.
// Same filtering as the manual script (real thread + request-like title, minus noise). Dedup key is
// the Reddit thread id (m[2]) — matches the reddit_leads primary key.
export function parseLeads(items: Array<Record<string, unknown>>, cities: string[]): RedditLead[] {
  const leads = new Map<string, RedditLead>();
  for (const it of items) {
    const rawTerm = (it.searchQuery as { term?: string } | string | undefined);
    const q = typeof rawTerm === "string" ? rawTerm : (rawTerm?.term || "");
    const city = cities.find((c) => String(q).includes(c)) || "";
    const organic = (it.organicResults as Array<Record<string, unknown>> | undefined) || [];
    for (const o of organic) {
      const url = (o.url as string) || "";
      const m = THREAD_RE.exec(url);
      if (!m) continue;
      const title = ((o.title as string) || "").replace(/\s*:\s*r\/\w+\s*$/i, "").trim();
      if (NOISE_RE.test(title) || !REQUEST_RE.test(title)) continue;
      const id = m[2];
      if (!leads.has(id)) {
        leads.set(id, {
          id,
          subreddit: m[1],
          title,
          url: url.split("?")[0],
          snippet: (((o.description as string) || (o.snippet as string) || "")).slice(0, 400),
          query: String(q),
          city,
        });
      }
    }
  }
  return [...leads.values()];
}

// Rotating city subset so all cities are covered every ~3 weeks within the serverless time budget.
// 25 cities in 3 groups of <=9; the group is picked by ISO week so successive Mondays advance through
// the list. Deterministic and stateless.
const GROUPS = 3;
export function citiesForWeek(weekOfYear: number, all: string[] = REDDIT_CITIES): string[] {
  const size = Math.ceil(all.length / GROUPS);
  const start = (weekOfYear % GROUPS) * size;
  return all.slice(start, start + size);
}

export function isoWeek(d = new Date()): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
