// Romanize a non-Latin hotel name to English/Latin script (Hepburn romaji, pinyin, etc.) so
// it can show on the English site. Claude Haiku — far more accurate than a generic unicode
// transliterator (proper readings, recognizes common English forms). Stored on hotels.name_en.
import Anthropic from "@anthropic-ai/sdk";

export const TRANSLIT_MODEL = process.env.TRANSLIT_MODEL || "claude-haiku-4-5";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM = `You romanize hotel names into Latin script for an English-language travel site.
- Output the standard romanized/English form a traveller would see: Hepburn romaji for Japanese, Hanyu Pinyin (with spaces, no tone marks) for Chinese, Revised Romanization for Korean, etc.
- If the name already has a well-known official English form, use that.
- Keep Latin words/numbers that are already in the name as-is (e.g. "OMO5京都祇園" → "OMO5 Kyoto Gion").
- Return ONLY the romanized hotel name — no city suffix, no quotes, no explanation.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { name_en: { type: "string", description: "The hotel name in Latin script." } },
  required: ["name_en"],
} as const;

export async function transliterateName(name: string): Promise<string | null> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  const resp = await client.messages.create({
    model: TRANSLIT_MODEL,
    max_tokens: 128,
    temperature: 0,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: name }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (resp.stop_reason === "refusal") return null;
  const block = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) return null;
  const parsed = JSON.parse(block.text) as { name_en?: string };
  const out = (parsed.name_en || "").trim();
  return out || null;
}
