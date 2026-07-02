#!/usr/bin/env node
// Standalone live progress page for the review-grounding pipeline.
//   node scripts/score-dashboard.mjs         # serves http://localhost:4599 (auto-refresh every 3s)
// Reads the two progress JSON files written by the scrape + score scripts. Works whether or not the
// Next dev server is running.
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.DASH_PORT || 4599);
// ---- live verification against the DB: zero generic copy + everything live rated ----
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const db = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;
const HEDGE = /(little detail|limited detail|details? (are|is)? ?(limited|scarce|sparse)|limited (data|detail|information)|not much (is )?known|name suggest|based on (its |the )?name|hard to (say|assess)|difficult to assess|impossible to assess|can'?t say much|few details|offer no concrete|no concrete detail|offer scant|offer little sense|offer limited concrete|sparse reviews|no mention of|reviews (offer|focus|don|mention)|appears to|seems to (offer|be|have)|promise of|carries the promise|hints? at|\bgenuine(ly)?\b|now closed|closed its doors|current closure|entirely unclear)/i;
const generic = (d) => !d || d.trim().length < 40 || HEDGE.test(d); // generic = empty/short/hedge/speculative/meta-commentary/closed
const rated = (notes) => /^review-scored/.test(notes || "") || notes === "vision-described:v2";
let vCache = { at: 0, data: null };
async function verify() {
  if (!db) return { error: "no DB env — run with: node --env-file=.env.local scripts/score-dashboard.mjs" };
  if (Date.now() - vCache.at < 12000 && vCache.data) return vCache.data;
  try {
    let off = 0, live = 0, notRated = 0, genericCopy = 0;
    for (;;) {
      const { data, error } = await db.from("cosy_scores").select("notes,description,score").gte("score", 5).range(off, off + 999);
      if (error) return { error: error.message };
      if (!data?.length) break;
      for (const r of data) { live++; if (!rated(r.notes)) notRated++; if (generic(r.description)) genericCopy++; }
      if (data.length < 1000) break; off += 1000;
    }
    vCache = { at: Date.now(), data: { live, notRated, genericCopy, done: notRated === 0 && genericCopy === 0 } };
    return vCache.data;
  } catch (e) { return { error: String(e.message).slice(0, 120) }; }
}
const SCRAPE = "scripts/backups/apify-scrape-progress.json";
const SCORE = "scripts/backups/score-describe-progress.json";
const read = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function bar(done, total, color) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return `<div class="bar"><div class="fill" style="width:${pct}%;background:${color}"></div><span>${pct}% · ${done ?? 0}/${total ?? 0}</span></div>`;
}
function ago(ts) { if (!ts) return "—"; const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? s + "s ago" : Math.round(s / 60) + "m ago"; }

function page(v) {
  const sc = read(SCRAPE) || {}, so = read(SCORE) || {};
  const vPanel = v?.error
    ? `<div class="card" style="border-color:#5a3a2a"><b class="run">verification unavailable</b> — ${esc(v.error)}</div>`
    : `<div class="card" style="border:2px solid ${v?.done ? "#2e7d4f" : "#5a4a2a"};background:${v?.done ? "#12241a" : "#191713"}">
<div style="font-size:17px;font-weight:700;color:${v?.done ? "#7fd1a0" : "#e9b872"}">${v?.done ? "✅ DONE — every live hotel is rated and has custom copy" : "⏳ Not done yet"}</div>
<div class="grid" style="margin-top:10px">
<div class="stat"><b>${v?.live ?? "—"}</b><span>live hotels (score ≥ 5)</span></div>
<div class="stat"><b class="${(v?.notRated ?? 1) === 0 ? "done" : "hid"}">${v?.notRated ?? "—"}</b><span>live but NOT rated</span></div>
<div class="stat"><b class="${(v?.genericCopy ?? 1) === 0 ? "done" : "hid"}">${v?.genericCopy ?? "—"}</b><span>live with generic/empty copy</span></div>
</div></div>`;
  const scoreRows = (so.recent || []).map((r) => `<tr><td>${esc(r.name)}</td><td class="c">${r.score == null ? '<span class="hid">hidden</span>' : esc(r.score)}</td><td class="c tier-${esc(r.tier)}">${esc(r.tier)}</td><td class="d">${esc(r.desc)}</td></tr>`).join("");
  const scrapeRows = (sc.recent || []).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.city)}</td><td class="c">${esc(r.reviews)}${r.note ? " · " + esc(r.note) : ""}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf8"><title>Cosy scoring — live progress</title>
<style>
:root{color-scheme:dark}body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;background:#0f0e0c;color:#eee;margin:0;padding:28px;max-width:1080px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;color:#e9b872;margin:26px 0 10px;letter-spacing:.02em}
.sub{color:#8a8a8a;margin:0 0 20px}
.card{background:#191713;border:1px solid #2a2620;border-radius:12px;padding:18px 20px;margin-bottom:14px}
.bar{position:relative;height:26px;background:#12100d;border-radius:7px;overflow:hidden;margin:8px 0}
.fill{position:absolute;inset:0 auto 0 0;transition:width .4s}.bar span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;text-shadow:0 1px 2px #000}
.grid{display:flex;gap:22px;flex-wrap:wrap;margin-top:8px}.stat{min-width:90px}.stat b{display:block;font-size:22px;color:#fff}.stat span{color:#8a8a8a;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 8px;border-top:1px solid #232019;vertical-align:top}
.c{text-align:center;white-space:nowrap}.d{color:#cfc8bd}.hid{color:#c0724f}
.tier-S{color:#7fd1a0;font-weight:700}.tier-H{color:#8ab4e0}.tier-V{color:#d0a24f}
.money{color:#7fd1a0;font-weight:700}.done{color:#7fd1a0}.run{color:#e9b872}
</style></head><body>
<h1>Got Cosy — review-grounding progress</h1>
<p class="sub">Every live hotel gets a review-grounded score + custom description. Auto-refreshes every 3s.</p>
<h2>0 · Confirmation (live DB check)</h2>
${vPanel}

<h2>1 · Scrape missing reviews (Google place-id + Apify)</h2>
<div class="card">
${bar(sc.done, sc.total, "#3d6ea5")}
<div class="grid">
<div class="stat"><b>${sc.matched ?? 0}</b><span>got reviews</span></div>
<div class="stat"><b>${sc.reviews ?? 0}</b><span>reviews</span></div>
<div class="stat"><b>${(sc.noMatch ?? 0) + (sc.noPlace ?? 0)}</b><span>no match</span></div>
<div class="stat"><b class="money">$${(sc.costUsd ?? 0).toFixed?.(2) ?? sc.costUsd ?? 0}</b><span>apify cost</span></div>
<div class="stat"><b class="${sc.finished ? "done" : "run"}">${sc.finished ? "done" : sc.total ? "running" : "idle"}</b><span>${ago(sc.updatedAt)}</span></div>
</div></div>

<h2>2 · Score + describe every live hotel (Haiku · Sonnet for top tier)</h2>
<div class="card">
${bar(so.processed, so.total, "#a5793d")}
<div class="grid">
<div class="stat"><b>${so.reviewScored ?? 0}</b><span>review-scored</span></div>
<div class="stat"><b>${so.sonnetUpgrades ?? 0}</b><span>sonnet prose</span></div>
<div class="stat"><b>${so.visionDescribed ?? 0}</b><span>vision text</span></div>
<div class="stat"><b>${so.hidden ?? 0}</b><span>hidden</span></div>
<div class="stat"><b>${so.kept ?? 0}</b><span>kept</span></div>
<div class="stat"><b>${so.failed ?? 0}</b><span>failed</span></div>
<div class="stat"><b class="money">$${(so.estCostUSD ?? 0).toFixed?.(2) ?? so.estCostUSD ?? 0}</b><span>llm cost / $${so.budgetUSD ?? 80}</span></div>
<div class="stat"><b class="${so.finished ? "done" : so.stopped ? "run" : so.total ? "run" : "run"}">${so.finished ? "done" : so.stopped ? "budget-stop" : so.total ? (so.execute ? "running" : "dry-run") : "idle"}</b><span>${ago(so.updatedAt)}</span></div>
</div></div>

<h2>Latest scored hotels</h2>
<div class="card"><table><tr><td><b>Hotel</b></td><td class="c"><b>score</b></td><td class="c"><b>tier</b></td><td><b>new description</b></td></tr>${scoreRows || '<tr><td colspan=4 style="color:#777">waiting…</td></tr>'}</table></div>

<h2>Latest scraped</h2>
<div class="card"><table><tr><td><b>Hotel</b></td><td><b>city</b></td><td class="c"><b>reviews</b></td></tr>${scrapeRows || '<tr><td colspan=3 style="color:#777">waiting…</td></tr>'}</table></div>
<script>setTimeout(()=>location.reload(),3000)</script>
</body></html>`;
}

createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  const v = await verify();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page(v));
}).listen(PORT, () => console.log(`progress dashboard → http://localhost:${PORT}`));
