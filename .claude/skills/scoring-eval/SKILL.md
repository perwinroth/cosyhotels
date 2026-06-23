---
name: scoring-eval
description: Measure the cosy score against the human grades for free (no Claude) — agreement %, signed bias, MAE, and correlation of the CURRENT cosy_scores vs hotel_grades. Use to check scoring quality before/after any recalibration or rescore.
disable-model-invocation: true
---

# Scoring Eval

Free DB-only check of how well the live cosy score matches human judgment. ALWAYS evaluate against the CURRENT `cosy_scores.score`, never the `hotel_grades.ai_score` snapshot (it's point-in-time and goes stale).

## Run

```bash
set -a && . ./.env.local && set +a
node --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE);
const { data: g } = await db.from("hotel_grades").select("hotel_id,cosy_verdict,human_score");
const ids = (g||[]).map(r=>r.hotel_id);
const cur = new Map();
for (let i=0;i<ids.length;i+=150){ const {data}=await db.from("cosy_scores").select("hotel_id,score,score_final").in("hotel_id",ids.slice(i,i+150));
  for(const r of data||[]) cur.set(String(r.hotel_id), typeof r.score_final==="number"?r.score_final:r.score); }
// good verdicts endorse the AI score; corrected verdicts supply human_score; drop unsure.
const rows=(g||[]).filter(r=>r.cosy_verdict!=="unsure").map(r=>{const c=cur.get(String(r.hotel_id));
  return {cur:c, hum:r.cosy_verdict==="good"?c:(r.human_score!=null?Number(r.human_score):null)};}).filter(r=>typeof r.cur==="number"&&r.hum!=null);
const err=rows.map(r=>r.cur-r.hum), mae=err.reduce((a,b)=>a+Math.abs(b),0)/err.length, bias=err.reduce((a,b)=>a+b,0)/err.length;
const xs=rows.map(r=>r.cur),ys=rows.map(r=>r.hum),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
let n=0,dx=0,dy=0;for(let i=0;i<xs.length;i++){n+=(xs[i]-mx)*(ys[i]-my);dx+=(xs[i]-mx)**2;dy+=(ys[i]-my)**2;}
const good=(g||[]).filter(r=>r.cosy_verdict==="good").length, assessed=(g||[]).filter(r=>r.cosy_verdict!=="unsure").length;
console.log(`graded: ${g.length}  agreement(good): ${(100*good/assessed).toFixed(0)}%`);
console.log(`vs CURRENT score (n=${rows.length}): mean AI ${mx.toFixed(2)} vs human ${my.toFixed(2)}  bias ${bias>=0?"+":""}${bias.toFixed(2)}  MAE ${mae.toFixed(2)}  corr ${(n/Math.sqrt(dx*dy)).toFixed(2)}`);
'
```

## Read the numbers

- **agreement** = % of graded hotels the human called "good". Honest ceiling ~85–90% (humans disagree ~10–15%).
- **bias** (ai − human): `+` = scores run hot. A blanket fix only makes sense if bias holds across the *population*, not just the graded (often featured) subset.
- **corr**: low corr = ranking problem (which hotel ranks above which) — fixable only by a rescore (costs Claude $), NOT by re-normalizing. Re-normalizing only moves the *level* (the display pins).
- The graded set is borderline/featured-biased, so don't read its median as the population median — check the full `cosy_scores` distribution separately.
