// Claude Haiku vision QA for stored hotel images. Answers one question per image:
// "is this an actual photo of the hotel/room/grounds, or non-photo junk?" — the thing
// URL/filename filtering can't catch (a real casino-table JPEG, a hotel's own logo,
// a 'Booking 9.2' review badge). Verdict is stored on hotel_images (vision_*), checked
// once, served forever — never called per visitor.
import Anthropic from "@anthropic-ai/sdk";

// Haiku 4.5 — cheap, vision-capable, ample for a coarse keep/reject. (effort param is NOT
// supported on Haiku and 400s, so we omit output_config.effort.)
export const IMAGE_QA_MODEL = process.env.IMAGE_QA_MODEL || "claude-haiku-4-5";

// Categories that make a COMPELLING social pin. Tight detail crops (a single pillow, a
// staircase), public landmarks (a cathedral), logos, badges, maps, stock placeholders and
// text-images are all rejected — they don't make someone want to book.
const GOOD = new Set(["room", "interior", "exterior", "amenity", "view"]);

export type ImageVerdict = { ok: boolean; label: string };

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM = `You classify ONE hotel photo for "Got Cosy", a site that ranks hotels by cosiness. The photo is shown and SHARED as the face of the hotel. Keep genuine, attractive photos of the hotel; reject only images that are clearly NOT cosy or not appealing as a hotel's face.

pin_worthy = true: a normal, pleasant, real photo of the hotel — a guest room, a warm or characterful interior (lounge, bar, restaurant, library, spa), the building/facade/garden/terrace/courtyard/pool, an inviting amenity, or a nice view. It need NOT be maximally cosy — a clean, pleasant room or an attractive exterior counts.

pin_worthy = false ONLY for clearly cold, corporate, utilitarian or non-hotel images:
- conference & meeting rooms, banquet / event / function / wedding halls, big empty corporate lobbies, sterile convention-style spaces
- a bathroom on its own, corridors, lifts, stairwells, gyms, car parks, reception desks, a totally bare/utilitarian room
- detail crops (a single pillow/tap), public landmarks/streets that are NOT the hotel, logos, review badges, maps/floorplans, food close-ups, people/portraits, placeholders, text/ads, screenshots, marketing collages, anything not the hotel

Default to KEEP for a normal, pleasant photo of the hotel. Use the closest label even when rejecting (a banquet hall = "interior" with pin_worthy=false).

Reply ONLY with JSON: {"label": "<single best category>", "pin_worthy": <true unless it matches a reject case above>}.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: {
      type: "string",
      enum: ["room", "interior", "exterior", "amenity", "view", "detail", "landmark", "logo", "badge", "map", "food", "person", "placeholder", "text", "unrelated", "unloadable"],
      description: "The single best category for the image.",
    },
    pin_worthy: { type: "boolean", description: "True ONLY if this is a wide, inviting, representative photo of the hotel (room/interior/exterior/amenity/view) that would make a traveller want to book. A detail crop, landmark, logo, badge, or placeholder is false." },
  },
  required: ["label", "pin_worthy"],
} as const;

/**
 * Classify one image URL. Returns { ok, label }. ok=true only for a genuine hotel photo.
 * Throws if ANTHROPIC_API_KEY is unset or the model refuses — callers catch per image.
 * A URL that isn't a raster image (or the model can't load) resolves to ok=false.
 */
export async function classifyHotelImage(url: string): Promise<ImageVerdict> {
  const client = getClient();
  if (!client) throw new Error("ANTHROPIC_API_KEY not configured");
  // Accept any absolute http(s) URL — many real photos are extensionless (Google Places
  // proxy, CDN transforms). Claude fetches by URL and judges the bytes, not the filename.
  // Callers must absolutize relative URLs (e.g. /api/places/photo) before calling.
  if (!/^https?:\/\//i.test(url)) {
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

  const parsed = JSON.parse(textBlock.text) as { label?: string; pin_worthy?: boolean };
  const label = String(parsed.label || "unloadable");
  // Trust the category over the boolean: pin-worthy only if BOTH agree it's a compelling shot.
  const ok = parsed.pin_worthy === true && GOOD.has(label);
  return { ok, label };
}
