#!/usr/bin/env node
// Repeatable SEO crawl audit. Fetches the sitemap index → every child → every URL, and checks:
//   HTTP status · final URL after redirects · <link rel=canonical> · is-self-canonical ·
//   meta robots / X-Robots-Tag (indexable?) · title · meta description · first JSON-LD url ·
//   old/postcode-led slug pattern · malformed/placeholder pattern.
// Also probes a fixed junk-URL list that MUST 404. Emits a CSV + a pass/fail summary vs the
// acceptance criteria (0 redirected / old-slug / noindex / 404 / internal URLs in any sitemap).
//
// Usage:
//   node scripts/seo-audit.mjs                       # audit prod (https://gotcosy.com)
//   BASE=http://localhost:3112 node scripts/seo-audit.mjs
//   node scripts/seo-audit.mjs --sample 300          # cap hotels sitemap to N random URLs (fast)
//   node scripts/seo-audit.mjs --out report.csv
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE || "https://gotcosy.com").replace(/\/$/, "");
const args = process.argv.slice(2);
const SAMPLE = args.includes("--sample") ? Number(args[args.indexOf("--sample") + 1]) : Infinity;
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "seo-audit.csv";
const CONCURRENCY = 12;

const MALFORMED = /[{}$<>]|%[0-9a-f]{2}|search_term_string|\b(undefined|null|nan)\b/i;
const OLD_SLUG = /\/hotels\/[0-9]{2,7}(-[0-9]{2,7})?-/; // postcode-led hotel slug
const INTERNAL = /\/(api|admin|growth|outreach|badge-outreach|today|posts|go|follow|grade|rate|status|brand)(\/|$)/;

// Fetch every URL at BASE's origin (so we can audit a local server whose sitemap still emits
// absolute gotcosy.com URLs). Host-agnostic path comparison keeps the self-canonical check valid.
const atBase = (u) => u.replace(/^https?:\/\/[^/]+/, BASE);
const pathOf = (u) => { try { return new URL(u, BASE).pathname.replace(/\/$/, "") || "/"; } catch { return u; } };

async function fetchInfo(url) {
  const info = { url, status: 0, final_url: url, canonical: "", robots: "", xrobots: "", title: "", description: "", jsonld_url: "", redirected: false };
  try {
    const res = await fetch(atBase(url), { redirect: "follow", headers: { "user-agent": "seo-audit" } });
    info.status = res.status;
    info.final_url = res.url;
    info.redirected = res.redirected || pathOf(res.url) !== pathOf(url);
    info.xrobots = res.headers.get("x-robots-tag") || "";
    const html = await res.text();
    info.canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || "";
    info.robots = (html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i) || [])[1] || "";
    info.title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
    info.description = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1] || "";
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ld) {
      const u = (m[1].match(/"url"\s*:\s*"([^"]+)"/) || [])[1];
      if (u) { info.jsonld_url = u; break; }
    }
  } catch (e) {
    info.error = String(e.message || e);
  }
  return info;
}

function classify(u, info, inSitemap) {
  const issues = [];
  const noindex = /noindex/i.test(info.robots) || /noindex/i.test(info.xrobots);
  const selfCanon = !info.canonical || pathOf(info.canonical) === pathOf(info.final_url);
  if (info.error) issues.push(`fetch-error:${info.error}`);
  if (info.status >= 500) issues.push(`5xx:${info.status}`);
  else if (info.status >= 400) issues.push(`${info.status}`);
  if (inSitemap) {
    if (info.status !== 200) issues.push("sitemap-non-200");
    if (info.redirected) issues.push("sitemap-redirected");
    if (noindex) issues.push("sitemap-noindex");
    if (!selfCanon) issues.push("sitemap-not-self-canonical");
    if (INTERNAL.test(u)) issues.push("sitemap-internal-url");
    if (OLD_SLUG.test(u)) issues.push("sitemap-old-slug");
    if (MALFORMED.test(u)) issues.push("sitemap-malformed");
  }
  if (info.jsonld_url && OLD_SLUG.test(info.jsonld_url)) issues.push("jsonld-old-slug");
  return { noindex, selfCanon, issues };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function main() {
  console.log(`SEO audit → ${BASE}`);
  const idxXml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  let children = locs(idxXml);
  if (!children.length) children = ["sitemap-static", "sitemap-cities", "sitemap-collections", "sitemap-hotels", "sitemap-blog"].map((s) => `${BASE}/${s}.xml`);
  console.log(`children: ${children.length}`);

  const urlSet = new Map(); // url -> sitemap file
  for (const child of children) {
    const cu = child.startsWith("http") ? child : `${BASE}${child}`;
    let urls = locs(await (await fetch(cu)).text());
    if (/hotels/.test(cu) && urls.length > SAMPLE) {
      // deterministic sample: every Nth
      const step = Math.ceil(urls.length / SAMPLE);
      urls = urls.filter((_, i) => i % step === 0);
    }
    for (const u of urls) urlSet.set(u, cu.split("/").pop());
    console.log(`  ${cu.split("/").pop()}: ${urls.length}`);
  }

  const all = [...urlSet.keys()];
  console.log(`auditing ${all.length} URLs…`);
  const rows = await mapLimit(all, CONCURRENCY, async (u) => {
    const info = await fetchInfo(u);
    const { noindex, selfCanon, issues } = classify(u, info, true);
    return {
      url: u, status: info.status, final_url: info.final_url, canonical: info.canonical,
      is_self_canonical: selfCanon, is_indexable: info.status === 200 && !noindex,
      in_sitemap: urlSet.get(u), issue_type: issues.join(";"),
      recommended_fix: issues.length ? "remove-from-sitemap-or-fix-route" : "",
    };
  });

  // Junk URLs that MUST 404
  const junk = ["/randomjunk123", "/sitemap-nonexistent.xml", "/en/hotels/undefined", "/en/hotels/%7Bsearch_term_string%7D", "/xx/cosy-index", "/fr/hotels/null"];
  const junkResults = await mapLimit(junk, 6, async (p) => ({ p, status: (await fetch(`${BASE}${p}`, { redirect: "manual" }).catch(() => ({ status: 0 }))).status }));

  const csv = ["url,status,final_url,canonical,is_self_canonical,is_indexable,in_sitemap,issue_type,recommended_fix",
    ...rows.map((r) => [r.url, r.status, r.final_url, r.canonical, r.is_self_canonical, r.is_indexable, r.in_sitemap, r.issue_type, r.recommended_fix]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  writeFileSync(OUT, csv);

  const problems = rows.filter((r) => r.issue_type);
  const junkBad = junkResults.filter((j) => j.status !== 404 && j.status !== 410);
  console.log(`\n=== RESULTS ===`);
  console.log(`sitemap URLs audited: ${rows.length}`);
  console.log(`sitemap URLs with issues: ${problems.length}`);
  for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p.url} [${p.issue_type}]`);
  console.log(`\njunk URLs (must 404): ${junk.length}, still reachable: ${junkBad.length}`);
  for (const j of junkBad) console.log(`  ✗ ${j.p} → ${j.status}`);
  console.log(`\nCSV: ${OUT}`);
  const pass = problems.length === 0 && junkBad.length === 0;
  console.log(`\nACCEPTANCE: ${pass ? "PASS ✓" : "FAIL ✗"}`);
  process.exit(pass ? 0 : 1);
}
main();
