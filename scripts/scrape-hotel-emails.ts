#!/usr/bin/env node
// Harvest ONE publicly-listed contact email + the Instagram/Facebook handles from each hotel's OWN
// website, so Per can reach the hotel 1:1 (Gmail pitch or IG DM) about its Cosy Score badge.
// Legitimate B2B outreach to PUBLISHED business contacts; one contact per hotel; one-send + opt-out
// honored downstream (hotel_outreach.hotel_id PK enforces a single contact across ALL channels).
// Pure fetch(): no Anthropic/API costs.
//
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts                        # DRY-RUN, score>=7
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts --all-websites --limit 30  # dry-run pilot, ALL sites
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts --all-websites --execute    # real run over every unchecked website
//   flags: --all-websites (every hotel with a website, ignore score)  --limit N  --conc 4
//          --skip-queued (leave hotels already in hotel_outreach untouched)
//          --force (recheck already-checked)  --min 7 (score_final floor; ignored with --all-websites)
//
// Per target hotel (website set; email_checked_at IS NULL unless --force):
//   1. Normalize + fetch homepage (realistic UA, 10s timeout, retry once on net error).
//   2. From that HTML: extract email candidates AND Instagram/Facebook handles (footer/header links).
//   3. If no email on the homepage, follow up to 3 contact pages (/contact /kontakt /impressum …),
//      harvesting email + any still-missing social handle from each.
//   4. FILTER junk emails, dedupe, RANK (own-domain first; info@ > hello@ > …). Pick ONE best email.
//   5. Store: email + email_source + email_checked_at (found or not). instagram/facebook are written
//      ONLY when currently null (never clobber curated handles); social_checked_at always stamped.
// Per-domain politeness: never hit the same host concurrently; small delay between requests.
// NOTE: JS-rendered / SPA sites won't yield contacts via plain fetch — counted as misses.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const FORCE = args.includes("--force");
const ALL = args.includes("--all-websites"); // every hotel with a website, regardless of score
const SKIP_QUEUED = args.includes("--skip-queued"); // also leave hotels already in the outreach book untouched
const flag = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min", "7")); // badge-eligible floor on cosy_scores.score_final (score-gated mode)
const LIMIT = Number(flag("--limit", "0")) || 0;
const CONC = Number(flag("--conc", "4"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY);

const STATE = "scripts/backups/scrape-hotel-emails-progress.json";
const BACKUP = `scripts/backups/scrape-hotel-emails-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 10000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Hotel = {
  id: string; name: string; website: string; city?: string | null;
  email?: string | null; email_source?: string | null; email_checked_at?: string | null;
  instagram?: string | null; facebook?: string | null; social_checked_at?: string | null;
};

// Experiment controls — NEVER scrape (a new surface must exclude controls at birth). Mirrors
// src/lib/controlMarkets.ts isFacetMintControlCity: EXACT match on the normalised city, so "New York"
// (→ "new-york") and "Yorkshire" can never match "york". Venice/Venezia excluded wholesale (conservative).
const CONTROL_CITIES = ["savannah", "york", "fez", "venice", "venice-historic", "venezia"];
const isControlCity = (city?: string | null) =>
  !!city && CONTROL_CITIES.includes(String(city).toLowerCase().trim().replace(/\s+/g, "-"));
type Scraped = { email: string | null; source: string | null; instagram: string | null; facebook: string | null };

// ---- URL + host helpers ------------------------------------------------------------------------
function normalizeUrl(raw: string): string | null {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try { const u = new URL(s); if (!/\./.test(u.hostname)) return null; return u.toString(); } catch { return null; }
}
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return ""; } };
// registrable-ish tail (last two labels) so info@mail.hotel.com still counts as the hotel's own domain
const regDomain = (host: string) => host.split(".").slice(-2).join(".");

// ---- fetch with realistic UA, timeout, one retry on network error ------------------------------
async function fetchHtml(url: string): Promise<{ finalUrl: string; html: string } | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*", "Accept-Language": "en,de,fr,it,es;q=0.8" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(ct)) return null;
      const html = await res.text();
      return { finalUrl: res.url || url, html };
    } catch (e) {
      const err = e as { name?: string; message?: string } | null;
      const net = err?.name === "AbortError" || err?.name === "TimeoutError" || /fetch failed|network|ENOTFOUND|ECONN|EAI_AGAIN/i.test(String(err?.message));
      if (net && attempt === 0) { await sleep(800); continue; }
      return null; // give up (bad cert, DNS, timeout twice, etc.)
    }
  }
  return null;
}

// ---- contact-path discovery --------------------------------------------------------------------
const CONTACT_HINTS = /contact|kontakt|contatti|contacto|impressum|imprint|about|reach|get-in-touch|nous-contacter|contact-us/i;
const FALLBACK_PATHS = ["/contact", "/contact-us", "/kontakt", "/contatti", "/contacto", "/impressum", "/about"];
function contactUrls(baseUrl: string, html: string, max = 3): string[] {
  const base = new URL(baseUrl);
  const out = new Set<string>();
  // 1) hrefs in the page whose text/path hints at a contact page (same host only)
  const hrefRe = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) && out.size < max * 3) {
    const href = m[1];
    if (!CONTACT_HINTS.test(href)) continue;
    try { const u = new URL(href, base); if (u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "")) out.add(u.toString().split("#")[0]); } catch { /* skip */ }
  }
  // 2) common fallback paths
  for (const p of FALLBACK_PATHS) { try { out.add(new URL(p, base).toString()); } catch { /* skip */ } }
  return [...out].filter((u) => u !== baseUrl).slice(0, max);
}

// ---- email extraction --------------------------------------------------------------------------
const EMAIL_RE = /[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,24}/gi;
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&commat;/gi, "@").replace(/&period;/gi, ".").replace(/&amp;/gi, "&")
    .replace(/%40/gi, "@");
}
// de-obfuscate "info (at) domain (dot) com" / "info [at] domain [dot] com" / "info AT domain DOT com"
function deobfuscate(s: string): string {
  return s
    .replace(/\s*[([{]\s*(?:at|@)\s*[)\]}]\s*/gi, "@")
    .replace(/\s+(?:at)\s+/gi, "@")
    .replace(/\s*[([{]\s*(?:dot|punkt|point)\s*[)\]}]\s*/gi, ".")
    .replace(/\s+(?:dot|punkt)\s+/gi, ".");
}
function extractEmails(html: string): string[] {
  const found = new Set<string>();
  // mailto: links first (highest signal) — capture before ? params
  const mailtoRe = /mailto:\s*([^"'?>\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html))) { const e = decodeEntities(m[1]).toLowerCase(); if (e.includes("@")) found.add(e); }
  // then a conservative regex over decoded + de-obfuscated visible text
  const text = deobfuscate(decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")));
  for (const e of text.match(EMAIL_RE) || []) found.add(e.toLowerCase());
  return [...found];
}

// ---- social handle extraction (mirrors src/lib/hotelSocial.ts) ---------------------------------
// Non-account paths that share these domains — never a hotel's handle.
const IG_SKIP = /^(p|reel|reels|explore|stories|share|about|developer|directory|accounts|legal|tv|web)$/i;
const FB_SKIP = /^(sharer|share|dialog|tr|plugins|profile\.php|pages|groups|events|watch|help|policies|login|home\.php)$/i;
// Unconfigured/template social links a theme ships with — never a real handle.
const SOCIAL_PLACEHOLDER = /^(replace_?me|your_?(user)?name|your_?handle|your_?page|username|handle|profile|pagename|page|account|yourbusiness|example|test|home)$/i;
const cleanHandle = (h: string) => h.replace(/[/?#].*$/, "").replace(/^@/, "").trim();
function extractSocial(html: string, hostRe: RegExp, skip: RegExp): string | null {
  const re = new RegExp(`https?://(?:www\\.|m\\.)?${hostRe.source}/(@?[A-Za-z0-9_.-]+)`, "gi");
  for (const m of html.matchAll(re)) {
    const h = cleanHandle(m[1]);
    if (!h || h.length < 2 || skip.test(h) || SOCIAL_PLACEHOLDER.test(h)) continue;
    return h;
  }
  return null;
}

// ---- filtering + ranking -----------------------------------------------------------------------
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|postmaster|abuse|mailer-daemon|sentry|wixpress)/i;
const JUNK_DOMAIN = /(sentry\.io|sentry\.wixpress|example\.(com|org|net)|godaddy\.com|wixpress\.com|wix\.com|squarespace\.com|domain\.com|email\.com|yourdomain|sentry\.|tambourine\.com|cendyn\.com|travelclick\.com)/i;
const OTA_DOMAIN = /(booking\.com|expedia\.|tripadvisor\.|hotels\.com|agoda\.com|trivago\.|airbnb\.|hostelworld\.com|hrs\.|ctrip\.|trip\.com|kayak\.|priceline\.|hotelbeds\.)/i;
const IMG_LOCAL = /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i; // e.g. logo@2x.png captured as "…@2x.png"
function isValidEmail(e: string): boolean {
  if (/%/.test(e)) return false; // URL-encoding artifacts (e.g. SafeLinks "05%7c02%7cmolly@…") — never a real address
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/i.test(e)) return false;
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;
  if (IMG_LOCAL.test(e) || /@\d+x\./i.test(e)) return false;        // image sprite artifacts
  if (JUNK_LOCAL.test(local)) return false;
  if (JUNK_DOMAIN.test(domain) || OTA_DOMAIN.test(domain)) return false;
  if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(domain)) return false; // domain that's actually a file
  if (local.length > 64 || domain.length > 100) return false;
  if (/[^a-z0-9._%+-]/i.test(local)) return false; // stray html chars leaked in
  return true;
}
const PREFIX_RANK = ["info", "hello", "stay", "bookings", "booking", "reservations", "reception", "reservation", "contact", "office", "hotel", "welcome", "mail"];
function prefixScore(local: string): number {
  const l = local.toLowerCase();
  for (let i = 0; i < PREFIX_RANK.length; i++) if (l === PREFIX_RANK[i] || l.startsWith(PREFIX_RANK[i])) return PREFIX_RANK.length - i;
  return 0;
}
// pick ONE best email: prefer the hotel's own registrable domain, then prefix priority, then shorter local
function pickBest(emails: string[], siteHost: string): string | null {
  const site = regDomain(siteHost);
  const valid = [...new Set(emails.map((e) => e.toLowerCase()))].filter(isValidEmail);
  if (!valid.length) return null;
  valid.sort((a, b) => {
    const [la, da] = a.split("@");
    const [lb, dbb] = b.split("@");
    const ownA = regDomain(da) === site ? 1 : 0;
    const ownB = regDomain(dbb) === site ? 1 : 0;
    if (ownA !== ownB) return ownB - ownA;
    const pa = prefixScore(la), pb = prefixScore(lb);
    if (pa !== pb) return pb - pa;
    return la.length - lb.length;
  });
  return valid[0];
}

// ---- per-host politeness lock (never hit the same host concurrently) ---------------------------
const hostBusy = new Set<string>();
async function withHost<T>(host: string, fn: () => Promise<T>): Promise<T> {
  while (hostBusy.has(host)) await sleep(150);
  hostBusy.add(host);
  try { return await fn(); } finally { hostBusy.delete(host); }
}

// scrape one hotel -> email (null = checked, none found) + best-effort IG/FB handles.
// Socials are harvested from every page we fetch for email; first plausible handle per platform wins.
async function scrapeHotel(website: string): Promise<Scraped> {
  const empty: Scraped = { email: null, source: null, instagram: null, facebook: null };
  const url = normalizeUrl(website);
  if (!url) return empty;
  const host = hostOf(url);
  return withHost(host, async () => {
    const acc: Scraped = { ...empty };
    const harvestSocial = (html: string) => {
      if (!acc.instagram) acc.instagram = extractSocial(html, /instagram\.com/, IG_SKIP);
      if (!acc.facebook) acc.facebook = extractSocial(html, /facebook\.com/, FB_SKIP);
    };
    const home = await fetchHtml(url);
    if (!home) return acc;
    harvestSocial(home.html);
    acc.email = pickBest(extractEmails(home.html), hostOf(home.finalUrl));
    if (acc.email) acc.source = home.finalUrl;
    // follow up to 3 contact pages when we still need the email or a social handle
    if (!acc.email || !acc.instagram || !acc.facebook) {
      for (const cu of contactUrls(home.finalUrl, home.html)) {
        if (acc.email && acc.instagram && acc.facebook) break;
        await sleep(500);
        const page = await fetchHtml(cu);
        if (!page) continue;
        harvestSocial(page.html);
        if (!acc.email) {
          const best = pickBest(extractEmails(page.html), hostOf(page.finalUrl));
          if (best) { acc.email = best; acc.source = page.finalUrl; }
        }
      }
    }
    return acc;
  });
}

// ---- load targets ------------------------------------------------------------------------------
const SELECT_COLS = "id,name,website,city,email,email_source,email_checked_at,instagram,facebook,social_checked_at";
// The contact columns may not exist yet (migration unapplied) — detect and degrade to dry-run reporting.
async function contactColumnsExist(): Promise<boolean> {
  const { error } = await db.from("hotels").select("email,email_checked_at,instagram,social_checked_at").limit(1);
  return !error;
}

// Every hotel_id already in the outreach book (any channel/status), paginated past the 1k REST cap.
async function outreachHotelIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let off = 0;
  for (;;) {
    const { data, error } = await db.from("hotel_outreach").select("hotel_id").range(off, off + 999);
    if (error) { console.error("✗ hotel_outreach read:", error.message); process.exit(1); }
    if (!data?.length) break;
    for (const r of data) ids.add(String(r.hotel_id));
    if (data.length < 1000) break;
    off += 1000;
  }
  return ids;
}

async function loadTargets(hasCols: boolean): Promise<Hotel[]> {
  const cols = hasCols ? SELECT_COLS : "id,name,website,city";
  const hotels: Hotel[] = [];
  if (ALL) {
    // EVERY hotel with a website, paginated straight off `hotels` — no score gate.
    let off = 0;
    for (;;) {
      const { data, error } = await db.from("hotels").select(cols).not("website", "is", null).order("id").range(off, off + 999);
      if (error) { console.error("✗ hotels read:", error.message); process.exit(1); }
      if (!data?.length) break;
      for (const h of data as unknown[]) hotels.push(h as Hotel);
      if (data.length < 1000) break;
      off += 1000;
    }
  } else {
    // badge-eligible hotel ids: cosy_scores.score_final >= MIN
    const ids: string[] = [];
    let off = 0;
    for (;;) {
      const { data, error } = await db.from("cosy_scores").select("hotel_id").gte("score_final", MIN).range(off, off + 999);
      if (error) { console.error("✗ cosy_scores read:", error.message); process.exit(1); }
      if (!data?.length) break;
      for (const r of data) ids.push(String(r.hotel_id));
      if (data.length < 1000) break;
      off += 1000;
    }
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await db.from("hotels").select(cols).in("id", ids.slice(i, i + 300));
      if (error) { console.error("✗ hotels read:", error.message); process.exit(1); }
      for (const h of (data as unknown[]) || []) hotels.push(h as Hotel);
    }
  }
  // must have a website; if columns exist, skip already-checked (unless --force)
  let targets = hotels.filter((h) => h.website && String(h.website).trim());
  if (hasCols && !FORCE) targets = targets.filter((h) => h.email == null && h.email_checked_at == null);
  // NEVER scrape experiment-control cities (a new surface excludes controls at birth).
  const beforeCtl = targets.length;
  targets = targets.filter((h) => !isControlCity(h.city));
  const ctlDropped = beforeCtl - targets.length;
  // Optional (--skip-queued): leave the outreach book untouched — skip any hotel already queued/contacted,
  // so a newly-found email can never re-lane a hotel out of the running IG wave. Default: enrich everyone
  // (one contact per hotel is still guaranteed structurally by the hotel_outreach.hotel_id PK).
  let outreachDropped = 0;
  if (SKIP_QUEUED) {
    const inBook = await outreachHotelIds();
    const before = targets.length;
    targets = targets.filter((h) => !inBook.has(String(h.id)));
    outreachDropped = before - targets.length;
  }
  if (ctlDropped || outreachDropped) console.log(`  (excluded ${ctlDropped} control-city + ${outreachDropped} already-in-outreach hotels)`);
  if (LIMIT) targets = targets.slice(0, LIMIT);
  return targets;
}

// ---- run ---------------------------------------------------------------------------------------
async function main() {
  const hasCols = await contactColumnsExist();
  if (!hasCols) console.log("⚠ contact columns not present on hotels yet (migration unapplied) — dry-run reporting only; --execute would no-op safely.\n");
  if (EXECUTE && !hasCols) { console.error("✗ refusing --execute: run supabase/2026_hotel_email.sql + 2026_hotel_social.sql first (columns missing)."); process.exit(1); }

  const targets = await loadTargets(hasCols);
  const scope = ALL ? "ALL hotels with a website" : `badge-eligible (score_final >= ${MIN})`;
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${targets.length} ${scope} · unchecked · conc ${CONC}\n`);

  let processed = 0, found = 0, missed = 0, failed = 0, igFound = 0, fbFound = 0;
  const sample: (Scraped & { name: string; website: string })[] = [];
  const startedAt = Date.now();

  const save = (finished = false) => { try { writeFileSync(STATE, JSON.stringify({ job: "scrape-hotel-contacts", scope, total: targets.length, processed, found, missed, failed, igFound, fbFound, execute: EXECUTE, hasCols, startedAt, updatedAt: Date.now(), finished }, null, 2)); } catch { /* non-fatal */ } };

  async function writeRow(h: Hotel, s: Scraped) {
    if (!EXECUTE) return;
    appendFileSync(BACKUP, JSON.stringify({ id: h.id, prev: { email: h.email ?? null, email_source: h.email_source ?? null, email_checked_at: h.email_checked_at ?? null, instagram: h.instagram ?? null, facebook: h.facebook ?? null, social_checked_at: h.social_checked_at ?? null } }) + "\n");
    const now = new Date().toISOString();
    const patch: Record<string, string | null> = { email: s.email, email_source: s.source, email_checked_at: now, social_checked_at: now };
    // fill-nulls-only for socials: never clobber a curated/existing handle
    if (s.instagram && h.instagram == null) patch.instagram = s.instagram;
    if (s.facebook && h.facebook == null) patch.facebook = s.facebook;
    const { error } = await db.from("hotels").update(patch).eq("id", h.id);
    if (error) { failed++; console.log(`  db err ${h.id}: ${error.message.slice(0, 60)}`); }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const h = targets[cursor++];
      try {
        const s = await scrapeHotel(h.website);
        if (s.email) found++; else missed++;
        if (s.instagram && h.instagram == null) igFound++;
        if (s.facebook && h.facebook == null) fbFound++;
        if (sample.length < 40) sample.push({ ...s, name: h.name, website: h.website });
        await writeRow(h, s);
      } catch (e) { failed++; console.log(`  skip ${String(h.name).slice(0, 30)}: ${String((e as { message?: string })?.message).slice(0, 50)}`); }
      processed++;
      if (processed % 5 === 0) { save(); console.log(`  ${processed}/${targets.length} · email ${found} miss ${missed} · ig ${igFound} fb ${fbFound} · fail ${failed}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save(true);

  // sample table
  console.log("\n── sample (hotel · website → email · ig · fb) ──");
  for (const s of sample) {
    const name = (s.name || "").slice(0, 24).padEnd(24);
    const site = (s.website || "").replace(/^https?:\/\//, "").slice(0, 26).padEnd(26);
    const em = s.email ? "✉ " + s.email : "✉ (none)";
    const ig = s.instagram ? " · ig @" + s.instagram : "";
    const fb = s.facebook ? " · fb " + s.facebook : "";
    console.log(`  ${name} ${site} ${em}${ig}${fb}`);
  }
  const rate = processed ? ((found / processed) * 100).toFixed(1) : "0";
  console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"} · processed ${processed} · email ${found} (${rate}%) · ig ${igFound} · fb ${fbFound} · missed ${missed} · failed ${failed}`);
  if (!EXECUTE) console.log(`projected if executed: ~${found} emails, ~${igFound} new IG, ~${fbFound} new FB across ${targets.length} sites.`);
  if (EXECUTE) console.log(`backup: ${BACKUP} (per-row prev snapshot; restore = set columns back per id)`);

  if (EXECUTE && hasCols) {
    try { await db.from("job_runs").insert({ job: "scrape-hotel-contacts", status: "done", finished_at: new Date().toISOString(), details: { scope, total: targets.length, processed, found, igFound, fbFound, missed, failed } }); console.log("job_runs audit record written"); }
    catch (e) { console.log("job_runs write failed:", String((e as { message?: string })?.message).slice(0, 60)); }
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
