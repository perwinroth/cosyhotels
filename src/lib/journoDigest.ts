// Journalist-query digest parser (journo-queries cron). SoS / HARO / Featured send plaintext
// digests with repeating query blocks — labels vary by sender and even by day, so this parses
// RESILIENTLY: split on common separators/markers, pull out whatever labelled fields exist, and
// if the structure is unclear fall back to storing the raw block as query_text. We never drop a
// block silently — worst case it lands as an unlabeled query_text for Per to read manually.
import crypto from "node:crypto";

export type ParsedQuery = {
  id: string;
  source: string;
  outlet: string | null;
  journalist: string | null;
  deadline: string | null;
  category: string | null;
  query_text: string;
  reply_to: string | null;
};

/** Classify the digest sender from the message's From header. */
export function sourceFromEmail(from: string): string {
  const m = from.match(/@([\w.-]+)/);
  const domain = (m?.[1] || "").toLowerCase();
  if (domain.includes("sourceofsources")) return "sourceofsources";
  if (domain.includes("helpareporter") || domain.includes("haro")) return "haro";
  if (domain.includes("featured.com")) return "featured";
  return domain || "unknown";
}

/** Stable id for a query: hash of source + a snippet of its text, so re-parsing the same digest
 *  (or a forwarded copy) never double-inserts. */
export function hashQueryId(source: string, snippet: string): string {
  return crypto.createHash("sha256").update(`${source}:${snippet.slice(0, 300)}`).digest("hex").slice(0, 40);
}

// Split a digest body into per-query blocks. Tries explicit separators first (===, ---, ***, or a
// "Query #N" / numbered header — the most common SoS/HARO layout); falls back to splitting on
// repeated "Summary:"/"Query:" markers if no separators are found.
function splitBlocks(text: string): string[] {
  const norm = text.replace(/\r\n/g, "\n").trim();
  if (!norm) return [];
  let parts = norm.split(/\n[ \t]*(?:[-=*_]{3,}|(?:query|inquiry|request)\s*#?\s*\d+\b[:.]?)[ \t]*\n/i);
  if (parts.length < 2) {
    parts = norm.split(/\n(?=[ \t]*(?:summary|query)[ \t]*:)/i);
  }
  return parts.map((p) => p.trim()).filter((p) => p.length > 30);
}

// Pull a labelled field's value out of a block, stopping at the next "Label:" line (or end of
// block) so multi-line values (e.g. a long Query field) are captured without swallowing the next
// field. Case-insensitive; tries each candidate label name in order.
function extractField(block: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`(?:^|\\n)[ \\t]*${name}[ \\t]*:[ \\t]*(.+?)(?=\\n[ \\t]*[A-Z][\\w \\-]{2,24}:|$)`, "is");
    const m = block.match(re);
    if (m && m[1].trim()) return m[1].trim().replace(/[ \t]+/g, " ");
  }
  return null;
}

// First plausible reply address in a block, preferring one that looks like a per-query reply
// alias (query-xxxx@, reply@, pitch@) over a generic sender/footer address.
function extractEmail(block: string): string | null {
  const emails = block.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  if (!emails.length) return null;
  return emails.find((e) => /reply|query|pitch|press|source/i.test(e)) ?? emails[0] ?? null;
}

// Digest navigation/index blocks — a table-of-contents-style list of query titles some senders
// (Featured especially) prepend to the actual queries — aren't real queries and would otherwise
// land on the board as an empty "new" row. Two heuristics, either is enough to skip:
//  1. the block's first non-empty line looks like a section header ("QUERIES FROM …", "INDEX …").
//  2. the block is mostly a numbered list of one-line items with NEITHER a reply address NOR a
//     Query:/Summary: marker — real query blocks always have one or the other.
// When neither heuristic clearly matches, we keep the block: losing a real query silently is worse
// than one unlabeled index row Per has to skip by hand.
function isIndexBlock(block: string): boolean {
  const firstLine = (block.split("\n").find((l) => l.trim().length > 0) || "").trim();
  if (/^\**\s*(QUERIES FROM|INDEX)/i.test(firstLine)) return true;

  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const numbered = lines.filter((l) => /^\d+[.):]\s/.test(l));
  const isNumberedList = numbered.length >= 2 && numbered.length / lines.length >= 0.6;
  if (!isNumberedList) return false;

  const hasMarkers = /(?:^|\n)[ \t]*(?:query|summary|reply[\s-]*to)[ \t]*:/i.test(block);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(block);
  return !hasMarkers && !hasEmail;
}

/** Parse one digest email body into individual queries. */
export function parseDigest(text: string, source: string): ParsedQuery[] {
  const out: ParsedQuery[] = [];
  for (const block of splitBlocks(text)) {
    if (isIndexBlock(block)) continue;
    const outlet = extractField(block, ["Media Outlet", "Outlet", "Publication", "Source"]);
    const journalist = extractField(block, ["Journalist", "Reporter", "Byline", "Name", "Author"]);
    const deadline = extractField(block, ["Deadline"]);
    const category = extractField(block, ["Category", "Topic"]);
    const summary = extractField(block, ["Summary", "Subject", "Headline"]);
    const body = extractField(block, ["Query", "Request", "Requirements", "Description"]);
    const query_text = [summary, body].filter(Boolean).join("\n\n").trim() || block;
    if (query_text.length < 20) continue; // boilerplate scrap (a lone separator/footer line)
    const reply_to = extractField(block, ["Reply to", "Reply-To", "Respond to", "Email"]) || extractEmail(block);
    out.push({ id: hashQueryId(source, query_text), source, outlet, journalist, deadline, category, query_text, reply_to });
  }
  return out;
}
