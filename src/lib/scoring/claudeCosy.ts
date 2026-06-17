// Claude-based cosiness scoring for PERSISTED hotels (scored on add + via cron).
// One messages.create call per hotel: returns a 0–100 score plus user-facing signals
// and a one-line description. The live per-request OSM path keeps its heuristic scorer
// (osmCosy.ts) — a synchronous Claude call per search result is not viable.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import path from "path";
import { type HotelFeatures, score100to10 } from "./cosy";

export type ClaudeCosy = {
  score100: number; // 0..100 (Claude raw)
  score10: number; // 0..10 (mapped for UI/CI)
  signals: string[]; // 3..5, user-facing
  penalties: string[]; // 1..3, internal
  description: string; // one sentence, user-facing
  confidence: "low" | "medium" | "high";
  model: string;
};

export type ClaudeCosyInput = HotelFeatures & {
  stars?: number;
  reviews?: string[]; // optional review snippets to feed the NLP signal
};

export const COSY_SCORING_MODEL = process.env.COSY_SCORING_MODEL || "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

let _rubric: string | null = null;
function rubric(): string {
  if (_rubric != null) return _rubric;
  try {
    _rubric = readFileSync(path.join(process.cwd(), "SCORING_PROMPT.md"), "utf8");
  } catch {
    _rubric = "Score how cosy a hotel is from 0 (corporate/sterile) to 100 (intimate and warm).";
  }
  return _rubric;
}

// JSON-schema can't enforce numeric ranges or array lengths — we instruct those in the
// prompt and clamp/trim in code. additionalProperties:false is required for strict output.
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", description: "Cosiness 0–100; higher is cosier." },
    signals: { type: "array", items: { type: "string" }, description: "Top 3–5 cosy signals, user-facing." },
    penalties: { type: "array", items: { type: "string" }, description: "Top 1–3 anti-cosy signals." },
    description: { type: "string", description: "One warm sentence shown to users." },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["score", "signals", "penalties", "description", "confidence"],
} as const;

function buildPayload(input: ClaudeCosyInput): string {
  const lines: string[] = ["Score this hotel for cosiness. Data:"];
  const push = (label: string, v: unknown) => {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
    lines.push(`- ${label}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  };
  push("Name", input.name);
  push("City", input.city);
  push("Country", input.country);
  push("Star rating", input.stars);
  push("Guest rating (0–10)", input.rating);
  push("Reviews count", input.reviewsCount);
  push("Rooms count", input.roomsCount);
  push("Amenities", input.amenities);
  push("Website", input.website);
  push("Description", input.description);
  if (input.reviews && input.reviews.length) {
    lines.push("- Review snippets:");
    for (const r of input.reviews.slice(0, 12)) lines.push(`  • ${r.replace(/\s+/g, " ").slice(0, 400)}`);
  }
  return lines.join("\n");
}

/**
 * Score one persisted hotel with Claude. Throws if ANTHROPIC_API_KEY is unset or the
 * request is refused — callers (cron / admin route) should catch and skip/log per hotel.
 */
export async function claudeCosyScore(input: ClaudeCosyInput): Promise<ClaudeCosy> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");

  const resp = await client.messages.create({
    model: COSY_SCORING_MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    // Stable rubric cached so a scoring batch is ~cache-read priced per hotel.
    system: [{ type: "text", text: rubric(), cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: buildPayload(input) }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (resp.stop_reason === "refusal") throw new Error("cosy_scoring_refused");

  const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) throw new Error("cosy_scoring_no_output");

  const parsed = JSON.parse(textBlock.text) as {
    score?: number;
    signals?: string[];
    penalties?: string[];
    description?: string;
    confidence?: string;
  };

  const score100 = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const conf = parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : "medium";
  return {
    score100,
    score10: score100to10(score100),
    signals: (parsed.signals || []).filter(Boolean).slice(0, 5),
    penalties: (parsed.penalties || []).filter(Boolean).slice(0, 3),
    description: (parsed.description || "").trim(),
    confidence: conf as "low" | "medium" | "high",
    model: COSY_SCORING_MODEL,
  };
}
