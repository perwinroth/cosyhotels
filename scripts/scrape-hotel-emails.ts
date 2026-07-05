#!/usr/bin/env node
// Harvest ONE publicly-listed contact email per badge-eligible hotel, from the hotel's OWN website,
// so Per can pitch a "Cosy Score badge" 1:1 via Gmail. Legitimate business outreach to PUBLISHED
// business contacts — scoped to the badge set (cosy_scores.score_final >= 7 with a hotels.website),
// NOT bulk harvesting. Pure fetch(): no Anthropic/API costs.
//
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts                 # DRY-RUN (no writes)
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts --limit 12       # dry-run pilot
//   node --env-file=.env.local --import tsx scripts/scrape-hotel-emails.ts --execute        # real run (backs up first)
//   flags: --limit N  --conc 4  --force (recheck already-checked)  --min 7 (score_final floor)
//
// Per hotel (score_final >= MIN, website set, email IS NULL, email_checked_at IS NULL unless --force):
//   1. Normalize the website URL; fetch homepage (realistic UA, 10s timeout, retry once on net error).
//   2. Follow up to 3 likely contact paths (nav hrefs + fallbacks /contact /kontakt /contatti /impressum …).
//   3. Extract candidates: mailto: first, then a conservative regex over decoded HTML (handles
//      "info (at) domain (dot) com" style obfuscations).
//   4. FILTER junk (image data, sentry, OTA/platform domains, noreply, example…), dedupe, RANK
//      (own-domain first; then info@ > hello@ > stay@ > booking(s)@ > reception@ > contact@ > office@ > else).
//   5. Store ONE best email + its source URL. ALWAYS set email_checked_at (found or not) so re-runs skip.
// Per-domain politeness: never hit the same host concurrently; small delay between requests.
// NOTE: JS-rendered / SPA sites won't yield emails via plain fetch — those are counted as misses.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const FORCE = args.includes("--force");
const flag = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min", "7")); // badge-eligible floor on cosy_scores.score_final
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

type Hotel = { id: string; name: string; website: string; email?: string | null; email_source?: string | null; email_checked_at?: string | null };

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
    } catch (e: any) {
      const net = e?.name === "AbortError" || e?.name === "TimeoutError" || /fetch failed|network|ENOTFOUND|ECONN|EAI_AGAIN/i.test(String(e?.message));
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

// ---- filtering + ranking -----------------------------------------------------------------------
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|postmaster|abuse|mailer-daemon|sentry|wixpress)/i;
const JUNK_DOMAIN = /(sentry\.io|sentry\.wixpress|example\.(com|org|net)|godaddy\.com|wixpress\.com|wix\.com|squarespace\.com|domain\.com|email\.com|yourdomain|sentry\.)/i;
const OTA_DOMAIN = /(booking\.com|expedia\.|tripadvisor\.|hotels\.com|agoda\.com|trivago\.|airbnb\.|hostelworld\.com|hrs\.|ctrip\.|trip\.com|kayak\.|priceline\.|hotelbeds\.)/i;
const IMG_LOCAL = /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i; // e.g. logo@2x.png captured as "…@2x.png"
function isValidEmail(e: string): boolean {
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

// scrape one hotel -> { email, source } | null (email null = checked, none found)
async function scrapeHotel(website: string): Promise<{ email: string | null; source: string | null }> {
  const url = normalizeUrl(website);
  if (!url) return { email: null, source: null };
  const host = hostOf(url);
  return withHost(host, async () => {
    const home = await fetchHtml(url);
    if (!home) return { email: null, source: null };
    // homepage candidates
    let best = pickBest(extractEmails(home.html), hostOf(home.finalUrl));
    if (best) return { email: best, source: home.finalUrl };
    // follow up to 3 contact pages, politely, sequentially
    for (const cu of contactUrls(home.finalUrl, home.html)) {
      await sleep(500);
      const page = await fetchHtml(cu);
      if (!page) continue;
      best = pickBest(extractEmails(page.html), hostOf(page.finalUrl));
      if (best) return { email: best, source: page.finalUrl };
    }
    return { email: null, source: null };
  });
}

// ---- load targets ------------------------------------------------------------------------------
// The email columns may not exist yet (migration unapplied) — detect and degrade to dry-run reporting.
async function emailColumnsExist(): Promise<boolean> {
  const { error } = await db.from("hotels").select("email,email_checked_at").limit(1);
  return !error;
}

async function loadTargets(hasCols: boolean): Promise<Hotel[]> {
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
  const cols = hasCols ? "id,name,website,email,email_source,email_checked_at" : "id,name,website";
  const hotels: Hotel[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from("hotels").select(cols).in("id", ids.slice(i, i + 300));
    if (error) { console.error("✗ hotels read:", error.message); process.exit(1); }
    for (const h of (data as any[]) || []) hotels.push(h as Hotel);
  }
  // must have a website; if columns exist, skip already-checked (unless --force)
  let targets = hotels.filter((h) => h.website && String(h.website).trim());
  if (hasCols && !FORCE) targets = targets.filter((h) => h.email == null && h.email_checked_at == null);
  if (LIMIT) targets = targets.slice(0, LIMIT);
  return targets;
}

// ---- run ---------------------------------------------------------------------------------------
async function main() {
  const hasCols = await emailColumnsExist();
  if (!hasCols) console.log("⚠ email columns not present on hotels yet (migration unapplied) — dry-run reporting only; --execute would no-op safely.\n");
  if (EXECUTE && !hasCols) { console.error("✗ refusing --execute: run supabase/2026_hotel_email.sql first (email columns missing)."); process.exit(1); }

  const targets = await loadTargets(hasCols);
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${targets.length} badge-eligible hotels with a website · min score_final ${MIN} · conc ${CONC}\n`);

  let processed = 0, found = 0, missed = 0, failed = 0;
  const sample: { name: string; website: string; email: string | null; source: string | null }[] = [];
  const startedAt = Date.now();

  const save = (finished = false) => { try { writeFileSync(STATE, JSON.stringify({ job: "scrape-hotel-emails", total: targets.length, processed, found, missed, failed, execute: EXECUTE, hasCols, startedAt, updatedAt: Date.now(), finished }, null, 2)); } catch { /* non-fatal */ } };

  async function writeRow(h: Hotel, email: string | null, source: string | null) {
    if (!EXECUTE) return;
    appendFileSync(BACKUP, JSON.stringify({ id: h.id, prev: { email: h.email ?? null, email_source: h.email_source ?? null, email_checked_at: h.email_checked_at ?? null } }) + "\n");
    const { error } = await db.from("hotels").update({ email, email_source: source, email_checked_at: new Date().toISOString() }).eq("id", h.id);
    if (error) { failed++; console.log(`  db err ${h.id}: ${error.message.slice(0, 60)}`); }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const h = targets[cursor++];
      try {
        const { email, source } = await scrapeHotel(h.website);
        if (email) found++; else missed++;
        if (sample.length < 40) sample.push({ name: h.name, website: h.website, email, source });
        await writeRow(h, email, source);
      } catch (e: any) { failed++; console.log(`  skip ${String(h.name).slice(0, 30)}: ${String(e?.message).slice(0, 50)}`); }
      processed++;
      if (processed % 5 === 0) { save(); console.log(`  ${processed}/${targets.length} · found ${found} miss ${missed} fail ${failed}`); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save(true);

  // sample table
  console.log("\n── sample (hotel · website → found email · source) ──");
  for (const s of sample) {
    const name = (s.name || "").slice(0, 28).padEnd(28);
    const site = (s.website || "").replace(/^https?:\/\//, "").slice(0, 30).padEnd(30);
    console.log(`  ${name} ${site} ${s.email ? "→ " + s.email + "  [" + (s.source || "").replace(/^https?:\/\//, "").slice(0, 40) + "]" : "→ (none)"}`);
  }
  const rate = processed ? ((found / processed) * 100).toFixed(1) : "0";
  console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"} · processed ${processed} · found ${found} (${rate}%) · missed ${missed} · failed ${failed}`);
  if (!EXECUTE) console.log(`projected coverage if executed: ~${found} of ${targets.length} badge-eligible hotels would get an email.`);
  if (EXECUTE) console.log(`backup: ${BACKUP} (per-row prev snapshot; restore = set columns back per id)`);

  if (EXECUTE && hasCols) {
    try { await db.from("job_runs").insert({ job: "scrape-hotel-emails", status: "done", finished_at: new Date().toISOString(), details: { total: targets.length, processed, found, missed, failed } }); console.log("job_runs audit record written"); }
    catch (e: any) { console.log("job_runs write failed:", String(e?.message).slice(0, 60)); }
  }
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
