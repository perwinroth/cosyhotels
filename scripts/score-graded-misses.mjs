// Prep a re-scoring batch from GRADED hotels the scorer over-rated and that now have a photo.
// Selection uses the human grade (current >= human + 2.5), but the human score is NOT written
// into the batch — so the in-session photo read stays honest (no teaching-to-the-test).
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import sharp from "sharp";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE);
const OUT="scripts/_score_batch";
const { data: g } = await db.from("hotel_grades").select("hotel_id,human_score").not("human_score","is",null);
const ids=g.map(r=>String(r.hotel_id)); const human=new Map(g.map(r=>[String(r.hotel_id),Number(r.human_score)]));
const cur=new Map();
for(let i=0;i<ids.length;i+=200){ const {data}=await db.from("cosy_scores").select("hotel_id,score,score_final").in("hotel_id",ids.slice(i,i+200));
  for(const r of data||[]) cur.set(String(r.hotel_id), typeof r.score_final==="number"?r.score_final:r.score); }
const img=new Map();
for(let i=0;i<ids.length;i+=200){ const {data}=await db.from("hotel_images").select("hotel_id,url,vision_ok,created_at").in("hotel_id",ids.slice(i,i+200)).order("created_at",{ascending:false});
  for(const im of data||[]){ const k=String(im.hotel_id),u=im.url||""; if(im.vision_ok===false||!u||u.includes("placehold.co"))continue; if(!img.has(k))img.set(k,u);} }
const pick=ids.filter(id=>cur.get(id)!=null && img.has(id) && cur.get(id) >= human.get(id)+2.5).sort((a,b)=>(cur.get(b)-human.get(b))-(cur.get(a)-human.get(a))).slice(0,14);
const {data:hotels}=await db.from("hotels").select("id,name,name_en,city,country,stars,rooms_count,reviews_count,rating,amenities").in("id",pick);
const hOf=new Map((hotels||[]).map(h=>[String(h.id),h]));
rmSync(OUT,{recursive:true,force:true}); mkdirSync(OUT,{recursive:true});
const batch=[]; let n=0;
for(const id of pick){ n++; const h=hOf.get(id),url=img.get(id); let imgFile=null;
  try{ const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{"user-agent":"Mozilla/5.0"}}); if(r.ok){ const fn=`${OUT}/${String(n).padStart(2,"0")}_${id}.jpg`; await sharp(Buffer.from(await r.arrayBuffer())).resize(900,900,{fit:"inside",withoutEnlargement:true}).jpeg({quality:82}).toFile(fn); imgFile=fn; } }catch{}
  batch.push({n,hotel_id:id,name:String(h?.name_en||h?.name||"").trim(),city:h?.city||"",country:h?.country||"",stars:h?.stars??null,rooms_count:h?.rooms_count??null,reviews_count:h?.reviews_count??null,rating:h?.rating??null,amenities:h?.amenities||[],current_score:cur.get(id),image_url:url,image_file:imgFile});
  console.log(`${String(n).padStart(2)}  cur ${cur.get(id)}  ${(batch[n-1].name||"").slice(0,32).padEnd(32)} ${imgFile?"img ok":"FAIL"}`);
}
writeFileSync(`${OUT}/batch.json`,JSON.stringify({hotels:batch},null,2));
console.log(`\n${batch.length} graded over-scores ready (human grade withheld from batch)`);
