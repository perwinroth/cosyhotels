// Claude Haiku vision QA for stored hotel images. Answers one question per image:
// "is this an actual photo of the hotel/room/grounds, or non-photo junk?" — the thing
// URL/filename filtering can't catch (a real casino-table JPEG, a hotel's own logo,
// a 'Booking 9.2' review badge). Verdict is stored on hotel_images (vision_*), checked
// once, served forever — never called per visitor.
import Anthropic from "@anthropic-ai/sdk";

// Haiku 4.5 — cheap, vision-capable, ample for a coarse keep/reject. (effort param is NOT
// supported on Haiku and 400s, so we omit output_config.effort.)
export const IMAGE_QA_MODEL = process.env.IMAGE_QA_MODEL || "claude-haiku-4-5";

// Categories that ARE usable hotel imagery vs. the junk we want gone.
const GOOD = new Set(["room", "exterior", "interior", "amenity", "view"]);

export type ImageVerdict = { ok: boolean; label: string };

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM = `You are an image classifier for a hotel website. You are shown ONE image and must decide what it depicts. Reply with the single best category and whether it is a genuine photograph of the hotel itself (its rooms, interiors, exterior, grounds, pool, restaurant, or view).

Categories:
- room: a guest room or suite
- interior: lobby, lounge, hallway, spa, restaurant interior
- exterior: the building, facade, entrance, garden, pool, terrace
- amenity: a clear photo of a hotel facility (pool, gym, bar, breakfast spread laid in the hotel)
- view: the view from the hotel
- logo: a logo, wordmark, or brand graphic
- badge: a rating/review badge or score graphic (e.g. "9.2 Excellent"), award seal, certificate
- map: a map, floor plan, or directions graphic
- food: a generic stock food/drink close-up not tied to this hotel
- person: a portrait/selfie/headshot with no hotel context
- unrelated: anything else that is not the hotel (a casino table, a street scene, a random object, an ad)
- unloadable: the image is blank, broken, or cannot be interpreted

Be strict: only room/interior/exterior/amenity/view are usable. When genuinely unsure between a usable category and junk, choose the junk category — a wrong photo on social is worse than none.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      enum: ["room", "interior", "exterior", "amenity", "view", "logo", "badge", "map", "food", "person", "unrelated", "unloadable"],
      description: "The single best category for the image.",
    },
    is_hotel_photo: { type: "boolean", description: "True only if this is a real photograph of the hotel itself (room/interior/exterior/amenity/view)." },
  },
  required: ["label", "is_hotel_photo"],
} as const;

/**
 * Classify one image URL. Returns { ok, label }. ok=true only for a genuine hotel photo.
 * Throws if ANTHROPIC_API_KEY is unset or the model refuses — callers catch per image.
 * A URL that isn't a raster image (or the model can't load) resolves to ok=false.
 */
export async function classifyHotelImage(url: string): Promise<ImageVerdict> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!/^https?:\/\/\S+\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) {
    return { ok: false, label: "unloadable" };
  }

  const resp = await client.messages.create({
    model: IMAGE_QA_MODEL,
    max_tokens: 256,
    temperature: 0,
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [{ type: "image", source: { type: "url", url } }] }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (resp.stop_reason === "refusal") return { ok: false, label: "unloadable" };
  const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) return { ok: false, label: "unloadable" };

  const parsed = JSON.parse(textBlock.text) as { label?: string; is_hotel_photo?: boolean };
  const label = String(parsed.label || "unloadable");
  // Trust the category over the boolean: ok only if BOTH agree it's usable hotel imagery.
  const ok = parsed.is_hotel_photo === true && GOOD.has(label);
  return { ok, label };
}
