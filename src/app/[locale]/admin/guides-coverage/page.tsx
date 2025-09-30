"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  city: string;
  slug: string;
  candidates: number;
  unique_by_source_or_sig: number;
  have_scores: number;
  cosy_ge_7: number;
  chosen_9_algo: number;
  brand_caps_applied: boolean;
};

export default function GuidesCoveragePage({ params }: { params: { locale: string } }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/health/guides-coverage`, { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        setRows((json.results || []) as Row[]);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.city.toLowerCase().includes(term) || r.slug.toLowerCase().includes(term));
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Guides Coverage</h1>
      <p className="mt-2 text-zinc-600">Supabase-only coverage by city. Shows candidates, unique matches, scored entries, cosy ≥ 7, and how many the guide would render.</p>
      <div className="mt-4 flex items-center gap-2">
        <input
          className="border border-zinc-300 rounded-lg px-3 py-2 w-full max-w-md"
          placeholder="Filter by city or slug…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && <span className="text-sm text-zinc-500">Loading…</span>}
      </div>
      <div className="mt-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="px-2 py-2">City</th>
              <th className="px-2 py-2">Slug</th>
              <th className="px-2 py-2">Candidates</th>
              <th className="px-2 py-2">Unique</th>
              <th className="px-2 py-2">Have scores</th>
              <th className="px-2 py-2">Cosy ≥ 7</th>
              <th className="px-2 py-2">Chosen (algo)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.slug} className="border-b hover:bg-zinc-50">
                <td className="px-2 py-2">{r.city}</td>
                <td className="px-2 py-2"><a className="text-teal-700 hover:underline" href={`/${params.locale}/guides/${r.slug}`}>{r.slug}</a></td>
                <td className="px-2 py-2 tabular-nums">{r.candidates}</td>
                <td className="px-2 py-2 tabular-nums">{r.unique_by_source_or_sig}</td>
                <td className="px-2 py-2 tabular-nums">{r.have_scores}</td>
                <td className="px-2 py-2 tabular-nums">{r.cosy_ge_7}</td>
                <td className="px-2 py-2 tabular-nums">{r.chosen_9_algo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

