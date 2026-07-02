import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync } from "fs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const { data } = await db.from("cosy_scores").select("hotel_id,description").gte("score", 5).ilike("description", "%genuine%");
console.log("to fix:", data.length);
for (const r of data) {
  const resp = await ai.messages.create({ model: "claude-sonnet-4-6", max_tokens: 200, temperature: 0.4, messages: [{ role: "user", content: `Rewrite this hotel sentence, removing the words "genuine"/"genuinely" (use more specific wording) while keeping the same meaning and facts. Return ONLY the rewritten sentence:\n"${r.description}"` }] });
  let d = (resp.content.find((b) => b.type === "text")?.text || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
  if (d && !/\bgenuine(ly)?\b/i.test(d) && d.length > 40) {
    appendFileSync("scripts/backups/fix-genuine-tail.jsonl", JSON.stringify({ hotel_id: r.hotel_id, prev: r.description }) + "\n");
    await db.from("cosy_scores").update({ description: d }).eq("hotel_id", r.hotel_id);
    console.log("fixed:", d.slice(0, 80));
  } else console.log("skipped");
}
console.log("done");
