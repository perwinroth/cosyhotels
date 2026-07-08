// Shared journalist-reply generation — the source library, prompt, and Sonnet call used by BOTH the
// journo-queries cron (auto-drafts good-fit queries into Gmail) and the /growth/journo board's
// manual "Draft with AI → Gmail" button (any row, any fit score — Per's call to force-draft a
// low-fit query). One place means the reply a journalist eventually sees is identical regardless of
// which path created it. Server-only (uses ANTHROPIC_API_KEY).
import Anthropic from "@anthropic-ai/sdk";

const SONNET = "claude-sonnet-4-6";

export type ReplyQuery = {
  source: string;
  outlet: string | null;
  deadline: string | null;
  category: string | null;
  query_text: string;
};

// The ONLY facts the draft model is allowed to cite. Hardcoded so a hallucinated stat can never
// reach a journalist — if a claim isn't in here, it doesn't go in the email.
export const SOURCE_LIBRARY = `SOURCE LIBRARY (the ONLY facts you may cite — never invent a fact, hotel, or number beyond this list):
- GotCosy analyzed guest-review language across 17,727 hotels; report + methodology + 164-city tiers + free CSVs: https://gotcosy.com/en/data/cosiest-hotel-towns
- Host-gap: in the 10 cosiest towns in the data, 74% of hotels' review evidence mentions a host, owner or family member, vs 26% in 8 large cities.
- Guesthouse-type naming (guesthouse/B&B/pension etc. in the listing name): 31% of hotels in the cosiest towns vs 10% in the large cities.
- "Boutique" appears in review evidence 53 times in the large cities' data vs 3 times in the towns'; big-city boutique hotels average a 6.30 cosy score vs 6.01 for big-city hotels overall.
- Among reviews that mention atmosphere, "quiet" is the single most common theme — 35.6% of 9,437 atmosphere-mentioning reviews.
- The cosy score is near-uncorrelated with generic guest star ratings (r=0.10, n=7,048) — cosiness and overall rating measure different things.
- Founder: Per, runs GotCosy (a small hotel-discovery site that scores hotels for cosiness by reading guest reviews).`;

const DRAFT_RULES = `RULES for the reply you write (voice: .claude/skills/copywriting, pitch-email section — a human answering a colleague, never a brand pitching):
- 80-140 words. Short, uneven paragraphs. Contractions. Write like Per talks, not like a company.
- FIRST SENTENCE answers their actual question. No introduction, no "I run a site that...", no throat-clearing. Who Per is comes later, in one plain line.
- ONE finding maximum, translated to a human scale ("three out of four of those hotels" beats "74% of review evidence"). A single two-sided comparison counts as one finding; never a second, unrelated stat. The rest of the data is something they can ask for, not something you recite.
- NEVER invent a fact, hotel name, or number that isn't in the source library. If you round a library number, round DOWN or say "about" — 17,727 hotels is "about 17,700" or "nearly eighteen thousand", never "tens of thousands".
- If you offer specific review-evidence lines, you MUST label them "condensed by our scoring model from review text — not verbatim guest quotes."
- Offer ONE thing shaped for their story (a custom cut, the raw file, a specific comparison) in one sentence.
- End with a short, one-word-answerable question.
- BANNED (these read as AI/PR sludge and get the email deleted): "I hope this finds you well", compliment openers, "delve/pivotal/underscore/testament", "not just X but Y" constructions, three-item rhythm ("X, Y, and Z" everywhere), uniform paragraph lengths, any sentence that sounds like a press release. Maximum ONE em dash in the whole email (the signoff dash doesn't count).
- Sign off exactly: "Per — gotcosy.com"
- Plain email prose. No subject line, no markdown, no bullet lists unless the query specifically asks for a list.
Reply with ONLY the email body text — nothing else.`;

function buildDraftPrompt(q: ReplyQuery): string {
  return `You are drafting a reply, AS PER (founder of GotCosy), to a journalist's source request pulled from a PR digest (${q.source}). Write a reply that could credibly help with their story.

${SOURCE_LIBRARY}

${DRAFT_RULES}

THE JOURNALIST'S QUERY${q.outlet ? ` (outlet: ${q.outlet})` : ""}${q.deadline ? ` (deadline: ${q.deadline})` : ""}:
${q.query_text}`;
}

let _client: Anthropic | null = null;
export function getAnthropicClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function draftReply(q: ReplyQuery): Promise<string | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  try {
    const resp = await client.messages.create({
      model: SONNET,
      max_tokens: 500,
      temperature: 0.4,
      messages: [{ role: "user", content: buildDraftPrompt(q) }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (resp.stop_reason === "refusal") return null;
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock ? textBlock.text.trim() : null;
  } catch {
    return null;
  }
}

export function subjectFor(q: ReplyQuery): string {
  const base = (q.category ? `${q.category}: ` : "") + q.query_text.replace(/\s+/g, " ").trim();
  return `Re: ${base.slice(0, 90)}`;
}
