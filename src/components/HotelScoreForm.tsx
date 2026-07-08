"use client";
import { useState } from "react";

type Result = { score10: number; score100: number; signals: string[]; description: string; confidence: string };

export default function HotelScoreForm() {
  const [form, setForm] = useState({ name: "", city: "", country: "", website: "", description: "", amenities: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/score-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) setError(json?.error || "Something went wrong.");
      else setResult(json as Result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)" };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Hotel name *</label>
          <input className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2" style={inputStyle} placeholder="The Snug Inn" {...field("name")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2" style={inputStyle} placeholder="Edinburgh" {...field("city")} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2" style={inputStyle} placeholder="Scotland" {...field("country")} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Website</label>
          <input className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2" style={inputStyle} placeholder="https://…" {...field("website")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amenities (comma-separated)</label>
          <input className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2" style={inputStyle} placeholder="fireplace, garden, library, sauna" {...field("amenities")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Describe your hotel</label>
          <textarea className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 min-h-[96px]" style={inputStyle} placeholder="What makes your hotel cosy: the rooms, character, setting, feel…" {...field("description")} />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg text-white px-5 py-2.5 font-medium disabled:opacity-60"
          style={{ background: "var(--ember)" }}
        >
          {loading ? "Scoring…" : "Get my cosy score"}
        </button>
        {error && <p className="text-sm" style={{ color: "var(--ember-ink)" }}>{error}</p>}
      </form>

      <div>
        {result ? (
          <div className="rounded-2xl border p-6" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
            <div className="text-sm" style={{ color: "var(--muted)" }}>Cosy score</div>
            <div className="font-display text-5xl font-semibold mt-1" style={{ color: result.score100 >= 50 ? "var(--sage)" : "var(--ember)" }}>
              {result.score100}<span className="text-2xl" style={{ color: "var(--muted)" }}>/100</span>
            </div>
            <div className="mt-2 text-sm font-medium" style={{ color: result.score100 >= 50 ? "var(--sage)" : "var(--ember)" }}>
              {result.score100 >= 50 ? "✓ Cosy enough to be listed on Got Cosy?" : "Not cosy enough to be listed yet (50+ needed)."}
            </div>
            {result.description && <p className="mt-3 text-sm" style={{ color: "var(--foreground)" }}>{result.description}</p>}
            {result.signals?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.signals.map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: "color-mix(in srgb, var(--sage) 24%, transparent)", color: "var(--sage)", background: "color-mix(in srgb, var(--sage) 13%, transparent)" }}>{s}</span>
                ))}
              </div>
            )}
            {result.score100 < 50 && (
              <p className="mt-4 text-sm" style={{ color: "var(--muted)", lineHeight: 1.65 }}>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>What makes a stay cosy: </span>
                small room counts · fireplaces or wood stoves · warm, low lighting · soft textiles &amp; natural materials · an intimate lounge, library or bar · character over corporate. Add these (and real photos), then resubmit.
              </p>
            )}
            <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>Confidence: {result.confidence}</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
            Your AI cosy score and the signals we detected will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
