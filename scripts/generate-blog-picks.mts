// Generate the blog listicle picks: each cosy hotel assigned to EXACTLY ONE post (most-specific
// topic claims it first), each with a bespoke, grounded one-line reason it suits THAT topic —
// written by Haiku from the hotel's real description + signals + guest reviews, never invented.
// Writes src/data/blogPicks.json, which the blog pages render. Run:
//   npx tsx scripts/generate-blog-picks.mts            # dry-run, no Haiku, prints assignment
//   npx tsx scripts/generate-blog-picks.mts --execute  # generate reasons + write JSON
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { BLOG_POSTS } from "../src/data/blogPosts";
import { isLatin, displayCity, displayCountry } from "../src/lib/placeText";
import { stay22AllezUrl } from "../src/lib/affiliates";

for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.FAQ_MODEL || "claude-haiku-4-5";

const CHAIN_RE = /\b(marriott|hilton|hyatt|accor|radisson|kempinski|four seasons (hotel|resort)|ritz[- ]?carlton|intercontinental|sheraton|ibis|novotel|mercure|holiday inn|best western|wyndham|premier inn|travelodge|hampton (inn|by hilton)|doubletree|crowne plaza|ramada|sofitel|pullman|moxy|mama shelter|the hoxton|citizenm|25hours|hotel indigo|courtyard by marriott|tribute portfolio|curio collection|autograph collection)\b/i;

type Row = { score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { id: string; slug: string | null; name: string | null; name_en?: string | null; city: string | null; country: string | null; lat: number | null; lng: number | null } | null };

// 1) candidate pool: every hotel that clears the cosy bar, with what we know about it
const pool: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data } = await db.from("cosy_scores")
    .select("score,score_final,signals,description,hotel:hotel_id(id,slug,name,name_en,city,country,lat,lng)")
    .gte("score", 5).order("score", { ascending: false }).range(from, from + 999);
  if (!data || !data.length) break;
  pool.push(...(data as unknown as Row[]));
  if (data.length < 1000) break;
}
console.log(`pool: ${pool.length} hotels (score≥5)`);
const reviews: Record<string, string[]> = existsSync("scripts/backups/review-cache.json") ? JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")) : {};

const pub = (r: Row) => (typeof r.score_final === "number" ? r.score_final : (typeof r.score === "number" ? r.score : 0));
const posts = BLOG_POSTS.filter((p) => p.pick).sort((a, b) => (a.pick!.priority) - (b.pick!.priority));
const takenSlug = new Set<string>(), takenName = new Set<string>();

async function reason(r: Row, theme: string, topicLabel: string): Promise<string> {
  const h = r.hotel!;
  const name = String(h.name_en || h.name || "");
  const revs = (reviews[String(h.id)] || []).slice(0, 3).map((t) => `- ${String(t).slice(0, 220)}`).join("\n");
  const prompt = `You are writing ONE sentence for a "cosiest hotels for ${topicLabel}" list.
Hotel: ${name}${h.city ? `, ${h.city}` : ""}. Cosy score ${pub(r).toFixed(1)}/10.
Only these facts are true — never add anything else:
Description: ${r.description || "(none)"}
Signals: ${(r.signals || []).join("; ") || "(none)"}
${revs ? `Guest reviews:\n${revs}` : ""}
Write one sentence (max 28 words, British English, specific, no hype, no clichés like "nestled" or "hidden gem", do NOT repeat the hotel name) on why it suits ${theme}. If the facts don't clearly support that, say honestly what makes it cosy instead. End with a full stop.`;
  const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 90, messages: [{ role: "user", content: prompt }] });
  const txt = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim().replace(/^["“]|["”]$/g, "");
  return txt;
}

const out: Record<string, Array<{ slug: string; name: string; city: string; country: string; score: number; why: string; img: string | null; cta: string }>> = {};
for (const post of posts) {
  const pk = post.pick!;
  const candsAll = pool.filter((r) => {
    const h = r.hotel; if (!h || !h.slug) return false;
    const name = String(h.name_en || h.name || ""); if (!isLatin(name)) return false;
    if (takenSlug.has(String(h.slug)) || takenName.has(name.toLowerCase().replace(/[^a-z0-9]+/g, ""))) return false;
    if (pub(r) < (pk.minScore ?? 6.5)) return false;
    const hay = `${(r.signals || []).join(" ")} ${r.description || ""}`;
    return pk.chains ? CHAIN_RE.test(name) : pk.re ? pk.re.test(hay) : true;
  }).sort((a, b) => pub(b) - pub(a));
  // dedup within this post (same physical hotel can have two rows / two near-identical names)
  const seen = new Set<string>();
  const cands: Row[] = [];
  for (const r of candsAll) {
    const h = r.hotel!; const nk = String(h.name_en || h.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(String(h.slug)) || seen.has(nk)) continue;
    seen.add(String(h.slug)); seen.add(nk);
    cands.push(r);
    if (cands.length >= (pk.limit ?? 12)) break;
  }

  console.log(`\n${post.slug} (priority ${pk.priority}) → ${cands.length} picks`);
  const picks: typeof out[string] = [];
  for (const r of cands) {
    const h = r.hotel!;
    const name = String(h.name_en || h.name || "");
    takenSlug.add(String(h.slug)); takenName.add(name.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    const why = EXECUTE ? await reason(r, pk.theme, post.eyebrow.toLowerCase()) : "(dry-run)";
    console.log(`  ${pub(r).toFixed(1)}  ${name}${EXECUTE ? `\n        → ${why}` : ""}`);
    picks.push({ slug: String(h.slug), name, city: displayCity(String(h.city || ""), ""), country: displayCountry(String(h.country || "")), score: Number(pub(r).toFixed(1)), why, img: null, cta: stay22AllezUrl({ name, city: displayCity(String(h.city || ""), ""), country: displayCountry(String(h.country || "")), lat: h.lat, lng: h.lng, campaign: `blog-${post.slug}` }) });
  }
  out[post.slug] = picks;
}

// 2) vetted images for every chosen hotel
const allSlugs = Object.values(out).flat().map((p) => p.slug);
const idBySlug = new Map<string, string>();
for (const r of pool) if (r.hotel?.slug && allSlugs.includes(String(r.hotel.slug))) idBySlug.set(String(r.hotel.slug), String(r.hotel.id));
const ids = [...idBySlug.values()];
const imgByHotel = new Map<string, string>();
for (let i = 0; i < ids.length; i += 150) {
  const { data } = await db.from("hotel_images").select("hotel_id,url,created_at,vision_ok").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true).order("created_at", { ascending: false });
  for (const row of (data || []) as Array<{ hotel_id: string | null; url: string | null }>) {
    const hid = row.hotel_id ? String(row.hotel_id) : ""; const url = row.url ? String(row.url) : "";
    if (!hid || !url || url.includes("placehold.co")) continue;
    if (!imgByHotel.has(hid)) imgByHotel.set(hid, url);
  }
}
for (const picks of Object.values(out)) for (const p of picks) { const hid = idBySlug.get(p.slug); p.img = hid ? imgByHotel.get(hid) || null : null; }

if (EXECUTE) {
  writeFileSync("src/data/blogPicks.json", JSON.stringify(out, null, 2));
  console.log(`\nwrote src/data/blogPicks.json — ${allSlugs.length} unique hotels across ${Object.keys(out).length} posts`);
} else {
  console.log(`\nDRY-RUN — ${allSlugs.length} unique hotels assigned. Re-run with --execute to generate reasons + write JSON.`);
}
