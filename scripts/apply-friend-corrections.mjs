// USE the 5 friends' 121 votes directly on the 25 hotels they rated. Where the panel STRONGLY
// disagrees with the AI (>=4 votes), nudge the score toward the panel — a 50/50 blend so we
// respect both the model and the audience (binary swipes are a strong signal, not an exact number).
// Downward corrections applied now (safe); upward ones listed for owner approval. Backup + grade.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE);
const EXECUTE=process.argv.includes("--execute");
const {data:votes}=await db.from("cosy_votes").select("hotel_id,vote");
const byH=new Map(); for(const v of votes){const k=String(v.hotel_id); if(!byH.has(k))byH.set(k,[]); byH.get(k).push(v.vote===true?1:0);}
const ids=[...byH.keys()];
const sc=new Map();
for(let i=0;i<ids.length;i+=200){const{data}=await db.from("cosy_scores").select("hotel_id,score,score_final,hotel:hotel_id!inner(name)").in("hotel_id",ids.slice(i,i+200));
  for(const r of data||[]) sc.set(String(r.hotel_id),{ai:typeof r.score_final==="number"?r.score_final:Number(r.score||0),name:r.hotel?.name||""});}
const panelImplied=frac=> frac<=0.1?3 : frac<=0.3?4 : frac>=0.9?8 : frac>=0.7?7 : 5; // binary→rough band
const rows=ids.map(id=>{const v=byH.get(id);const frac=v.reduce((a,b)=>a+b,0)/v.length;const a=sc.get(id)||{};const pi=panelImplied(frac);return{id,name:a.name,ai:a.ai,n:v.length,frac,blend:Math.round((0.5*a.ai+0.5*pi)*10)/10};});
// downward corrections: panel says clearly LESS cosy than AI (>=4 votes, blend below current)
const down=rows.filter(r=>r.n>=4 && r.blend < r.ai - 0.5);
const up=rows.filter(r=>r.n>=4 && r.blend > r.ai + 0.5);
const corr=(rs)=>{const m=a=>rs.reduce((s,r)=>s+a(r),0)/rs.length;const ma=m(r=>r.ai),mf=m(r=>r.frac);let c=0,va=0,vf=0;for(const r of rs){c+=(r.ai-ma)*(r.frac-mf);va+=(r.ai-ma)**2;vf+=(r.frac-mf)**2;}return c/Math.sqrt(va*vf);};
const before=corr(rows);
console.log(`DOWNWARD corrections (panel-confirmed over-scores, applying now):`);
for(const r of down) console.log(`  ${r.ai} → ${r.blend}  friends ${Math.round(r.frac*100)}% (${r.n}v)  ${r.name.slice(0,32)}`);
console.log(`\nUPWARD (panel loves, AI low — for your approval, NOT applied):`);
for(const r of up) console.log(`  ${r.ai} → ${r.blend}  friends ${Math.round(r.frac*100)}% (${r.n}v)  ${r.name.slice(0,32)}`);
// grade: correlation after applying downward (simulate)
const after=corr(rows.map(r=>down.find(d=>d.id===r.id)?{...r,ai:r.blend}:r));
console.log(`\nGRADE — AI↔friend correlation: before ${before.toFixed(2)} → after downward ${after.toFixed(2)}  ${after>before?"✓ improves":"✗ no improvement"}`);
if(!EXECUTE){console.log(`\nDRY-RUN — add --execute to apply the ${down.length} downward corrections (backup first).`);process.exit(0);}
mkdirSync("scripts/backups",{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
writeFileSync(`scripts/backups/friend-corrections-${stamp}.json`,JSON.stringify({down,up,before,after},null,2));
let done=0; for(const r of down){const{error}=await db.from("cosy_scores").update({score:r.blend,score_final:r.blend}).eq("hotel_id",r.id); if(!error)done++;}
console.log(`\ndone — ${done} panel-confirmed over-scores corrected (backup: scripts/backups/friend-corrections-${stamp}.json).`);
