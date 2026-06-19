// Internal gallery of the social pins that get pushed to Blotato. Renders the SAME cityPin
// payload that /api/social/next serves to the n8n/Make → Blotato flow, so what you see here
// is exactly what gets published (image, title, description, link, board, tags). Noindexed.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { populatedCities, cityPin, type CityPin } from "@/lib/social";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Social posts", robots: { index: false, follow: false } };

export default async function PostsPage() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();
  if (!db) {
    return (
      <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: 32 }}>
        Supabase not configured.
      </div>
    );
  }

  const cities = await populatedCities(db);
  // Build pins with BOUNDED concurrency. Firing all (200+) Supabase queries at once
  // overflows the stack in the concurrent fetch path (RangeError: Maximum call stack
  // size exceeded) and hangs ~60s; small batches are reliable and fast.
  type Failure = { city: string; reason: string };
  const pins: CityPin[] = [];
  const failures: Failure[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < cities.length; i += CONCURRENCY) {
    await Promise.all(
      cities.slice(i, i + CONCURRENCY).map(async (c) => {
        try {
          const pin = await cityPin(db, c.city, base);
          if (pin.items.length > 0) pins.push(pin);
          else failures.push({ city: c.city, reason: "no hotels scored ≥ 5" });
        } catch (e) {
          failures.push({ city: c.city, reason: e instanceof Error ? e.message : "pin build error" });
        }
      })
    );
  }
  pins.sort((a, b) => a.city.localeCompare(b.city));
  failures.sort((a, b) => a.city.localeCompare(b.city));

  return (
    <div style={{ minHeight: "100vh", background: "#0F1512", color: "#F3EEE6", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Social posts → Blotato</h1>
        <p style={{ color: "#9DA89F", marginTop: 8, fontSize: 15 }}>
          {pins.length} ready pin{pins.length === 1 ? "" : "s"} from {cities.length} populated cit{cities.length === 1 ? "y" : "ies"}.
          This is the exact payload <code style={{ color: "#E08A4B" }}>/api/social/next</code> serves to the publish flow — cycle with{" "}
          <code style={{ color: "#E08A4B" }}>?after=&lt;city&gt;</code>. Only cities with AI-scored hotels (score ≥ 5) appear.
        </p>

        {failures.length > 0 && (
          <div style={{ marginTop: 24, background: "#221A16", border: "1px solid #3a2a20", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E08A4B" }}>
              Not publishable: {failures.length} cit{failures.length === 1 ? "y" : "ies"}
            </div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#C7CFC8", fontSize: 13, lineHeight: 1.7 }}>
              {failures.map((f) => (
                <li key={f.city}>
                  <strong>{f.city}</strong> — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pins.length === 0 && (
          <p style={{ color: "#9DA89F", marginTop: 40 }}>No pins ready yet — no populated city has hotels scored ≥ 5.</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24, marginTop: 28 }}>
          {pins.map((pin) => (
            <div key={pin.city} style={{ background: "#16201A", border: "1px solid #243029", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* The actual pin image (1000×1500) shown at card width. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pin.imageUrl} alt={`Pin for ${pin.city}`} loading="lazy" decoding="async" style={{ width: "100%", display: "block", aspectRatio: "2 / 3", objectFit: "cover", background: "#0F1512" }} />
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{pin.title}</div>
                <div style={{ fontSize: 13, color: "#C7CFC8", lineHeight: 1.5 }}>{pin.description}</div>

                <div style={{ fontSize: 12, color: "#9DA89F" }}>
                  <strong style={{ color: "#E08A4B" }}>Board:</strong> {pin.board}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pin.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, background: "#243029", color: "#C7CFC8", borderRadius: 999, padding: "3px 9px" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: "#9DA89F" }}>
                  <strong style={{ color: "#E08A4B" }}>Hotels ({pin.items.length}):</strong>
                  <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
                    {pin.items.map((it) => {
                      const i = it.lastIndexOf("~");
                      const name = i >= 0 ? it.slice(0, i) : it;
                      const score = i >= 0 ? it.slice(i + 1) : "";
                      return (
                        <li key={it}>
                          {name} {score && <span style={{ color: "#D8B25A" }}>· {score}/10</span>}
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <a href={pin.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7FB4FF", wordBreak: "break-all" }}>
                  {pin.link}
                </a>
                <a href={pin.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#9DA89F", wordBreak: "break-all" }}>
                  image: {pin.imageUrl}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
