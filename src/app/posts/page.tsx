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
          // A photo carousel needs ≥1 real hotel photo. Distinguish "no scores" from
          // "scored but no real photos" so we know what each city is missing.
          if (pin.slides.length > 0) pins.push(pin);
          else if (pin.items.length > 0) failures.push({ city: c.city, reason: "scored hotels have no real photos" });
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
          {pins.length} ready carousel{pins.length === 1 ? "" : "s"} from {cities.length} populated cit{cities.length === 1 ? "y" : "ies"}.
          Each is the exact <code style={{ color: "#E08A4B" }}>/api/social/next</code> payload — real photos of the top-5 cosy hotels
          (score ≥ 5), one slide each. <code style={{ color: "#E08A4B" }}>@?</code> = hotel Instagram handle for n8n to enrich so the
          post can @mention them. Cycle with <code style={{ color: "#E08A4B" }}>?after=&lt;city&gt;</code>.
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
              {/* THE CAROUSEL — one real hotel photo per slide, name + score overlaid. This is what publishes. */}
              <div style={{ display: "flex", overflowX: "auto", gap: 2, scrollSnapType: "x mandatory" }}>
                {pin.slides.map((s, i) => (
                  <div key={`${s.name}-${i}`} style={{ position: "relative", flex: "0 0 70%", scrollSnapAlign: "start", aspectRatio: "4 / 5", background: "#0F1512" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.photo} alt={s.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(15,21,18,.85)", color: "#F3EEE6", fontSize: 12, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>#{i + 1}</div>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 10px 8px", background: "linear-gradient(transparent,rgba(15,21,18,.92))" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#D8B25A", fontWeight: 700 }}>{s.score.toFixed(1)}/10 {s.instagram ? `· ${s.instagram}` : "· @? (n8n)"}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{pin.title}</div>
                <div style={{ fontSize: 12, color: "#9DA89F" }}>
                  {pin.slides.length} real-photo slide{pin.slides.length === 1 ? "" : "s"} · board: {pin.board}
                </div>
                <div style={{ fontSize: 13, color: "#C7CFC8", lineHeight: 1.5 }}>{pin.description}</div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pin.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, background: "#243029", color: "#C7CFC8", borderRadius: 999, padding: "3px 9px" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <a href={pin.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7FB4FF", wordBreak: "break-all" }}>
                  {pin.link}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
