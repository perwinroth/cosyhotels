#!/usr/bin/env node
// Turn the borderline review JSON (written by dedup-hotels.mjs) into a visual page, PRE-FLAGGED:
// each cluster is auto-classified likely-dupe / check / likely-distinct using the one canonical
// name logic (namesMatch from src/lib/hotelIdentity). Likely-dupes default to Merge; likely-distinct
// default to Keep-separate; "check" ones float to the top for your eye. You only adjust the unsure
// ones, then copy the emitted command. A human decision still gates every borderline merge.
//   node --import tsx scripts/borderline-review-html.mjs [scripts/backups/dedup-borderline-<ts>.json]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { namesMatch, siteListing } from '../src/lib/hotelIdentity.ts'

const arg = process.argv[2]
const file = arg || 'scripts/backups/' + readdirSync('scripts/backups').filter((f) => f.startsWith('dedup-borderline-')).sort().pop()
const clusters = JSON.parse(readFileSync(file, 'utf8'))

// PERSIST PRIOR DECISIONS: scripts/dedup-keep-separate.txt holds keeper ids the user has already
// reviewed and decided are NOT dupes. Those clusters come up pre-set to "Keep separate" so a
// regenerated page never throws away the user's work — they only re-touch what they want to change.
const keepSepFile = 'scripts/dedup-keep-separate.txt'
const keepSep = existsSync(keepSepFile) ? new Set(readFileSync(keepSepFile, 'utf8').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)) : new Set()

const AGGREGATORS = new Set(['booking.com', 'hilton.com', 'marriott.com', 'airbnb.com', 'expedia.com', 'hotels.com', 'ihg.com', 'accor.com']) // shared by many hotels — not an identity signal

// The WEBSITE is the decisive signal (the user's insight), compared as domain + per-hotel PATH SLUG
// so a group operator's sister hotels on one domain (keahotels.is/apotek-hotel vs /hotel-borg) are
// NOT treated as the same listing. Same full listing → confirmed dupe. Different listing → different
// hotels. Only when the site can't decide do we fall back to distance.
function classify(c) {
  const keeper = c.members.find((m) => m.keeper) || c.members[0]
  const others = c.members.filter((m) => m !== keeper)
  const lis = c.members.map((m) => siteListing(m.website))
  const usable = lis.every((l) => l && !AGGREGATORS.has(l.domain))
  if (usable) {
    const sameDomain = lis.every((l) => l.domain === lis[0].domain)
    const sameListing = lis.every((l) => l.domain === lis[0].domain && l.slug === lis[0].slug)
    if (sameListing) return { tag: 'dupe', label: 'same listing ✓', merge: true, why: lis[0].domain + (lis[0].slug ? '/' + lis[0].slug : '') }
    if (!sameDomain) return { tag: 'distinct', label: 'different websites', merge: false, why: [...new Set(lis.map((l) => l.domain))].join(' · ') }
    return { tag: 'distinct', label: 'same domain, different hotels', merge: false, why: [...new Set(lis.map((l) => l.domain + '/' + l.slug))].join(' · ') }
  }
  // website can't decide → distance
  const maxDist = Math.max(...c.members.map((m) => m.dist))
  const subName = others.every((o) => { const sa = keeper.name.toLowerCase().replace(/[^a-z0-9]/g, ''), sb = o.name.toLowerCase().replace(/[^a-z0-9]/g, ''); return sa.includes(sb) || sb.includes(sa) })
  if (maxDist <= 30 || (subName && maxDist <= 45)) return { tag: 'dupe', label: 'likely dupe', merge: true, why: 'no site · ' + maxDist + 'm' }
  if (maxDist >= 65) return { tag: 'distinct', label: 'likely distinct', merge: false, why: 'no site · ' + maxDist + 'm' }
  return { tag: 'check', label: 'check', merge: true, why: 'no site · ' + maxDist + 'm' }
}
const enriched = clusters.map((c) => ({ ...c, cls: classify(c) }))
// "check" first (needs your eye), then likely-distinct, then likely-dupe.
const order = { check: 0, distinct: 1, dupe: 2 }
enriched.sort((a, b) => order[a.cls.tag] - order[b.cls.tag])
const counts = enriched.reduce((o, c) => ((o[c.cls.tag] = (o[c.cls.tag] || 0) + 1), o), {})

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const host = (u) => { if (!u) return ''; try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '') } catch { return esc(u) } }
const card = (c, i) => {
  const reviewed = keepSep.has(String(c.keeperId))
  const merge = reviewed ? false : c.cls.merge // honor a prior "keep separate" decision
  return `
  <div class="cl ${c.cls.tag}${reviewed ? ' reviewed' : ''}" data-keeper="${esc(c.keeperId)}" data-merge="${merge ? 1 : 0}">
    <div class="hd"><span class="badge ${c.cls.tag}">${c.cls.label}</span>${reviewed ? '<span class="rv">you kept separate</span>' : ''}
      <button class="tog" onclick="tog(this)">${merge ? 'Merge ✓' : 'Keep separate'}</button></div>
    <div class="why">${esc(c.cls.why || '')}</div>
    <div class="rows">${c.members.map((m) => `
      <div class="row ${m.keeper ? 'keep' : ''}">
        <span class="sc">${m.score.toFixed(1)}</span>
        <div class="info">
          <div class="nm">${esc(m.name)}${m.keeper ? ' <em>keeper</em>' : ''}</div>
          <div class="meta">${esc(m.city || '')} · ${m.dist}m${m.website ? ` · <a href="${esc(m.website.startsWith('http') ? m.website : 'https://' + m.website)}" target="_blank" rel="noopener">${esc(host(m.website))} ↗</a>` : ' · <span class="nosite">no website</span>'}</div>
        </div>
      </div>`).join('')}</div>
  </div>`
}

const html = `<!doctype html><meta charset="utf8"><title>Borderline dedup review</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--amber:#d8b25a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:24px}
  h1{font-size:22px;margin:0 0 4px} .sub{color:var(--mut);margin-bottom:14px;max-width:760px}
  .legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;font-size:13px}
  .bar{position:sticky;top:0;background:var(--bg);padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:16px;z-index:5}
  .cmd{width:100%;background:#0a0e0c;color:var(--sage);border:1px solid var(--line);border-radius:10px;padding:12px;font:13px/1.5 ui-monospace,monospace;min-height:64px}
  .btn{background:var(--ember);color:#16201c;border:0;border-radius:9px;padding:9px 16px;font-weight:600;cursor:pointer;margin-top:8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
  .cl{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;border-left:4px solid var(--line)}
  .cl.dupe{border-left-color:var(--sage)} .cl.check{border-left-color:var(--amber)} .cl.distinct{border-left-color:var(--ember)}
  .cl[data-merge="0"]{opacity:.6}
  .rv{font-size:11px;color:var(--mut);background:#2a332d;padding:2px 7px;border-radius:5px}
  .cl.reviewed{border-left-style:dashed}
  .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .badge{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:6px}
  .badge.dupe{background:color-mix(in srgb,var(--sage) 22%,transparent);color:var(--sage)}
  .badge.check{background:color-mix(in srgb,var(--amber) 22%,transparent);color:var(--amber)}
  .badge.distinct{background:color-mix(in srgb,var(--ember) 22%,transparent);color:var(--ember)}
  .tog{background:var(--sage);color:#16201c;border:0;border-radius:7px;padding:5px 11px;font-weight:600;cursor:pointer;font-size:13px}
  .cl[data-merge="0"] .tog{background:#3a3f3b;color:var(--mut)}
  .why{color:var(--mut);font-size:12px;margin:-2px 0 8px;font-family:ui-monospace,monospace}
  .row{display:flex;gap:9px;align-items:flex-start;padding:4px 0} .row.keep .nm{color:var(--ember)}
  .sc{width:30px;color:var(--sage);font-weight:600;font-variant-numeric:tabular-nums;padding-top:1px} .info{flex:1} .nm{font-weight:500} em{color:var(--mut);font-style:normal;font-size:12px}
  .meta{color:var(--mut);font-size:12px} .meta a{color:var(--sage);text-decoration:none} .meta a:hover{text-decoration:underline} .nosite{color:#7a6a4a}
  .dot{width:10px;height:10px;border-radius:3px;display:inline-block;vertical-align:-1px;margin-right:5px}
</style>
<h1>Borderline dedup review — ${enriched.length} clusters</h1>
<div class="sub">Pairs the geo+name rule thinks are <em>probably</em> the same hotel but weren't confident enough to auto-merge. They're pre-flagged and ordered so the ones needing your eye come first. Adjust the toggles, then copy the command — only the clusters you leave on <b>Merge</b> get merged.</div>
<div class="legend">
  <span><span class="dot" style="background:var(--amber)"></span><b>check</b> (${counts.check || 0}) — your call, default Merge</span>
  <span><span class="dot" style="background:var(--ember)"></span><b>likely distinct</b> (${counts.distinct || 0}) — default Keep separate</span>
  <span><span class="dot" style="background:var(--sage)"></span><b>likely dupe</b> (${counts.dupe || 0}) — default Merge</span>
</div>
<div class="bar">
  <div style="color:var(--mut);font-size:13px;margin-bottom:6px">Run this to merge everything still set to <b>Merge</b> (held-back ones go to --reject):</div>
  <textarea class="cmd" id="cmd" readonly></textarea>
  <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('cmd').value)">Copy command</button>
  <span id="cnt" style="color:var(--mut);margin-left:12px"></span>
</div>
<div class="grid">${enriched.map(card).join('')}</div>
<script>
  function tog(b){const c=b.closest('.cl');const m=c.dataset.merge==='1'?'0':'1';c.dataset.merge=m;b.textContent=m==='1'?'Merge ✓':'Keep separate';build()}
  function build(){
    const reject=[...document.querySelectorAll('.cl')].filter(c=>c.dataset.merge==='0').map(c=>c.dataset.keeper);
    const merging=document.querySelectorAll('.cl').length-reject.length;
    const base='node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs --borderline --execute';
    document.getElementById('cmd').value=reject.length?base+' --reject '+reject.join(','):base;
    document.getElementById('cnt').textContent=merging+' merging · '+reject.length+' kept separate';
  }
  build();
</script>`

const out = 'borderline-review.html'
writeFileSync(out, html)
console.log(`Wrote ${out} from ${file}`)
console.log(`  ${enriched.length} clusters — check:${counts.check || 0}  likely-distinct:${counts.distinct || 0}  likely-dupe:${counts.dupe || 0}`)
