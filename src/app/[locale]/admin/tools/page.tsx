"use client";
import { useState } from "react";

type JSONValue = null | boolean | number | string | JSONValue[] | { [k: string]: JSONValue };
type Resp = { ok: boolean; status: number; json?: JSONValue; text?: string };

function useAction() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<Resp | null>(null);
  async function run(url: string, init?: RequestInit) {
    setLoading(true);
    setResp(null);
    try {
      const r = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
      const ct = r.headers.get('content-type') || '';
      let body: JSONValue | undefined = undefined;
      if (ct.includes('application/json')) {
        try { body = await r.json(); } catch {}
        setResp({ ok: r.ok, status: r.status, json: body });
      } else {
        const t = await r.text();
        setResp({ ok: r.ok, status: r.status, text: t });
      }
    } catch (e) {
      setResp({ ok: false, status: 0, text: String(e) });
    } finally {
      setLoading(false);
    }
  }
  return { loading, resp, run };
}

export default function AdminTools() {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [pages, setPages] = useState("1");
  const [max, setMax] = useState("200");
  const [coverageCities, setCoverageCities] = useState("");
  const env = useAction();
  const backfillAmenities = useAction();
  const backfillImages = useAction();
  const refreshCity = useAction();
  const refreshTopDaily = useAction();
  const ensureFeatured = useAction();
  const guidesCoverage = useAction();
  const amenitiesStats = useAction();

  const base = ""; // same origin

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Admin Tools</h1>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Environment</h2>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={env.loading} onClick={() => env.run(`${base}/api/health/env`)}>GET /api/health/env</button>
        </div>
        {env.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(env.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Backfill Amenities</h2>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={backfillAmenities.loading} onClick={() => backfillAmenities.run(`${base}/api/admin/backfill-amenities`, { method: 'POST' })}>POST /api/admin/backfill-amenities</button>
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={backfillAmenities.loading} onClick={() => backfillAmenities.run(`${base}/api/admin/backfill-amenities`)}>GET (schedule)</button>
        </div>
        {backfillAmenities.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(backfillAmenities.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Backfill Images</h2>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={backfillImages.loading} onClick={() => backfillImages.run(`${base}/api/admin/backfill-images`, { method: 'POST' })}>POST /api/admin/backfill-images</button>
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={backfillImages.loading} onClick={() => backfillImages.run(`${base}/api/admin/backfill-images`)}>GET (schedule)</button>
        </div>
        {backfillImages.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(backfillImages.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Refresh City (scraper)</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className="border rounded px-2 py-1" placeholder="City (required)" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="Country (optional)" value={country} onChange={(e) => setCountry(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="pages (default 1)" value={pages} onChange={(e) => setPages(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="max (default 200)" value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-1.5 rounded border hover:bg-zinc-50"
            disabled={refreshCity.loading || !city.trim()}
            onClick={() => {
              const qp = new URLSearchParams({ city: city.trim() });
              if (country.trim()) qp.set('country', country.trim());
              if (pages.trim()) qp.set('pages', pages.trim());
              if (max.trim()) qp.set('max', max.trim());
              refreshCity.run(`${base}/api/cron/refresh-city?${qp.toString()}`, { method: 'POST' });
            }}
          >
            POST /api/cron/refresh-city
          </button>
          <button
            className="px-3 py-1.5 rounded border hover:bg-zinc-50"
            disabled={refreshCity.loading || !city.trim()}
            onClick={() => {
              const qp = new URLSearchParams({ city: city.trim() });
              if (country.trim()) qp.set('country', country.trim());
              if (pages.trim()) qp.set('pages', pages.trim());
              if (max.trim()) qp.set('max', max.trim());
              refreshCity.run(`${base}/api/cron/refresh-city?${qp.toString()}`);
            }}
          >
            GET (schedule)
          </button>
        </div>
        {refreshCity.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(refreshCity.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Top & Featured</h2>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={refreshTopDaily.loading} onClick={() => refreshTopDaily.run(`${base}/api/cron/refresh-top-daily`, { method: 'POST' })}>POST /api/cron/refresh-top-daily</button>
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={ensureFeatured.loading} onClick={() => ensureFeatured.run(`${base}/api/cron/ensure-featured`, { method: 'POST' })}>POST /api/cron/ensure-featured</button>
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={ensureFeatured.loading} onClick={() => ensureFeatured.run(`${base}/api/cron/ensure-featured`)}>GET ensure-featured</button>
        </div>
        {(refreshTopDaily.resp || ensureFeatured.resp) && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(refreshTopDaily.resp || ensureFeatured.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Guides Coverage</h2>
        <div className="mt-2 flex gap-2 items-center">
          <input className="border rounded px-2 py-1 flex-1" placeholder="cities comma-separated (optional)" value={coverageCities} onChange={(e) => setCoverageCities(e.target.value)} />
          <button
            className="px-3 py-1.5 rounded border hover:bg-zinc-50"
            disabled={guidesCoverage.loading}
            onClick={() => {
              const qp = new URLSearchParams();
              if (coverageCities.trim()) qp.set('cities', coverageCities.trim());
              guidesCoverage.run(`${base}/api/health/guides-coverage${qp.toString() ? `?${qp.toString()}` : ''}`);
            }}
          >
            GET /api/health/guides-coverage
          </button>
        </div>
        {guidesCoverage.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(guidesCoverage.resp, null, 2)}</pre>
        )}
      </section>

      <section className="mt-6 rounded border border-zinc-200 bg-white p-4">
        <h2 className="font-medium">Amenities Stats</h2>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1.5 rounded border hover:bg-zinc-50" disabled={amenitiesStats.loading} onClick={() => amenitiesStats.run(`${base}/api/health/amenities-stats`)}>GET /api/health/amenities-stats</button>
        </div>
        {amenitiesStats.resp && (
          <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(amenitiesStats.resp, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
