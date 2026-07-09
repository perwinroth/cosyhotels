// Create Gmail drafts as per@gotcosy.com via the API — the reliable version of the outreach button
// (compose URLs can't force a From). Auth: OAuth refresh token whose mailbox is per@gotcosy.com's
// verified "Send As" account — the token IS the account, so whichever inbox GMAIL_REFRESH_TOKEN was
// minted for is where drafts land and where the read helpers below search (currently being migrated
// to perwinroth@gmail.com — update ACCOUNT below to match whenever the token changes). Env:
// GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN. Server-only.
const ACCOUNT = "perwinroth@gmail.com"; // must match the mailbox GMAIL_REFRESH_TOKEN belongs to — only used to build the Drafts deep-link
const FROM = "Got Cosy <per@gotcosy.com>"; // per@gotcosy.com must be a verified Send-As on ACCOUNT.
// If it is NOT verified there, Gmail silently REWRITES From to the mailbox's primary address —
// the draft then sends from the bare personal account (2026-07-09 incident, same defect class as
// the sender-address incident). Two founder-side remedies: verify per@gotcosy.com as Send-As on
// ACCOUNT (Gmail Settings → Accounts → "Send mail as", Zoho SMTP), or re-mint GMAIL_REFRESH_TOKEN
// for gotcosy@gmail.com (where it is already the verified default) and update ACCOUNT to match.

export function gmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

async function accessToken(): Promise<string | null> {
  const client_id = process.env.GMAIL_CLIENT_ID, client_secret = process.env.GMAIL_CLIENT_SECRET, refresh_token = process.env.GMAIL_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id, client_secret, refresh_token }),
    }).then((x) => x.json());
    return r.access_token || null;
  } catch { return null; }
}

// RFC 2047-encode a header value if it has non-ASCII (em dashes, curly quotes, emoji).
const encHeader = (s: string) => (/[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=` : s);

// Header values must be single-line: an embedded CR/LF ends the RFC-822 header block early, so
// every later header (MIME-Version, Content-Type…) leaks into the visible body and the draft
// loses its real subject — exactly what a multiline parsed digest title did on 2026-07-09. Same
// guard also closes the header-injection hole for any parser-derived value.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

export function rawMessage({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const cleanTo = oneLine(to);
  const cleanSubject = oneLine(subject) || "Re: your query";
  const headers = [
    `From: ${FROM}`,
    cleanTo ? `To: ${cleanTo}` : "",
    `Subject: ${encHeader(cleanSubject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean).join("\r\n");
  return Buffer.from(`${headers}\r\n\r\n${body}`, "utf8").toString("base64url");
}

// Create a draft in the connected account (see ACCOUNT above) from per@gotcosy.com. Returns the draft id + a link to Drafts.
export async function createGmailDraft(msg: { to: string; subject: string; body: string }): Promise<{ id: string; link: string } | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ message: { raw: rawMessage(msg) } }),
    }).then((x) => x.json());
    if (!r.id) return null;
    return { id: r.id, link: `https://mail.google.com/mail/u/${ACCOUNT}/#drafts` };
  } catch { return null; }
}

// Delete a draft (used only by the setup self-test).
export async function deleteGmailDraft(id: string): Promise<boolean> {
  const token = await accessToken();
  if (!token) return false;
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  return r.ok;
}

// ── Mailbox READ helpers (badge-outreach auto-sync cron) ─────────────────────────────────────────
// The draft helpers above only need gmail.compose. Reading Sent/Inbox needs the additional
// gmail.readonly scope, so the refresh token must be re-minted via scripts/gmail-auth.mjs. A
// compose-only token 403s on messages.list — surfaced as GmailScopeError so the cron can tell
// "re-auth needed" apart from a transient failure and return its graceful "needs readonly scope" error.
const MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

/** Gmail 403 insufficient-scope (token lacks gmail.readonly). Distinct type so callers can catch it. */
export class GmailScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailScopeError";
  }
}

interface TokenResponse { access_token?: string; error?: string; error_description?: string }
interface MessagesListResponse { messages?: Array<{ id: string; threadId: string }> }

/** Exchange the stored refresh token for a short-lived access token. Throws a clear error if any of
 *  the three GMAIL_* env vars are missing, or if the token endpoint rejects the refresh token. */
export async function getAccessToken(): Promise<string> {
  const client_id = process.env.GMAIL_CLIENT_ID, client_secret = process.env.GMAIL_CLIENT_SECRET, refresh_token = process.env.GMAIL_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error("Gmail not configured — missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id, client_secret, refresh_token }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(`Gmail token refresh failed: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }
  return json.access_token;
}

/** Newest message id matching a Gmail `q` search, or null. Throws GmailScopeError on 403. */
async function firstMatch(q: string, accessToken: string): Promise<string | null> {
  const res = await fetch(`${MESSAGES_URL}?q=${encodeURIComponent(q)}&maxResults=1`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) {
    throw new GmailScopeError("Gmail 403 (insufficient scope) — refresh token lacks gmail.readonly. Re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN.");
  }
  if (!res.ok) {
    throw new Error(`Gmail messages.list failed (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => ({}))) as MessagesListResponse;
  return json.messages?.[0]?.id ?? null;
}

/** True if the connected account has SENT a message to `email` (Send-As per@gotcosy.com lands here too). */
export async function wasSentTo(email: string, accessToken: string): Promise<boolean> {
  return (await firstMatch(`in:sent to:${email}`, accessToken)) !== null;
}

/** True if the Inbox has a message FROM `email` — a reply (assumes replies to per@gotcosy.com land
 *  directly in the connected account's Inbox). */
export async function gotReplyFrom(email: string, accessToken: string): Promise<boolean> {
  return (await firstMatch(`in:inbox from:${email}`, accessToken)) !== null;
}

/** internalDate (epoch ms) of the newest message matching `q`, or null if none. */
async function newestDate(q: string, accessToken: string): Promise<number | null> {
  const id = await firstMatch(q, accessToken);
  if (!id) return null;
  const res = await fetch(`${MESSAGES_URL}/${id}?format=minimal`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 403) throw new GmailScopeError("Gmail 403 (insufficient scope) — refresh token lacks gmail.readonly.");
  if (!res.ok) throw new Error(`Gmail messages.get failed (HTTP ${res.status})`);
  const j = (await res.json().catch(() => ({}))) as { internalDate?: string };
  return j.internalDate ? Number(j.internalDate) : null;
}

/** True if the NEWEST send to `email` is more recent than any mailer-daemon bounce for it — i.e. the
 *  latest attempt actually delivered. A blocked send (e.g. Zoho's "unusual activity" block) leaves a
 *  Sent copy AND a bounce dated just after it, so `wasSentTo` alone can't tell delivered from blocked;
 *  this can. A later clean re-send (no new bounce) still reads as delivered even if an OLD bounce for
 *  the address lingers in the mailbox. */
export async function wasDeliveredTo(email: string, accessToken: string): Promise<boolean> {
  const sent = await newestDate(`in:sent to:${email}`, accessToken);
  if (sent === null) return false;
  const bounced = await newestDate(`from:mailer-daemon "${email}"`, accessToken);
  return bounced === null || sent > bounced;
}

// ── Journo-query digest reader (journo-queries cron) ─────────────────────────────────────────────
// Needs the same gmail.readonly scope as the mailbox helpers above.

/** Up to `max` message ids matching a Gmail `q` search (newest first), or [] if none. Throws
 *  GmailScopeError on 403. */
export async function searchMessageIds(q: string, accessToken: string, max = 10): Promise<string[]> {
  const res = await fetch(`${MESSAGES_URL}?q=${encodeURIComponent(q)}&maxResults=${max}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 403) {
    throw new GmailScopeError("Gmail 403 (insufficient scope) — refresh token lacks gmail.readonly. Re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN.");
  }
  if (!res.ok) {
    throw new Error(`Gmail messages.list failed (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => ({}))) as MessagesListResponse;
  return (json.messages || []).map((m) => m.id);
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}
interface GmailMessageFull {
  payload?: GmailMessagePart & { headers?: Array<{ name: string; value: string }> };
}

const b64urlDecode = (s: string) => Buffer.from(s, "base64url").toString("utf8");

/** Depth-first search for the first part whose mimeType matches and has a body — handles nested
 *  multipart/alternative + multipart/mixed structures used by digest senders. */
function findPart(part: GmailMessagePart | undefined, mimeType: string): GmailMessagePart | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const p of part.parts || []) {
    const found = findPart(p, mimeType);
    if (found) return found;
  }
  return null;
}

// Minimal HTML→text fallback for digests that only send text/html (no text/plain part).
const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Fetch one message's headers + plaintext body (prefers text/plain, falls back to text/html stripped
 *  of tags, falls back to a non-multipart body on the top-level payload). Returns null if the message
 *  can't be found/parsed. Throws GmailScopeError on 403 (readonly scope missing). */
export async function getMessagePlainText(
  id: string,
  accessToken: string,
): Promise<{ subject: string; from: string; date: string; text: string } | null> {
  const res = await fetch(`${MESSAGES_URL}/${id}?format=full`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 403) {
    throw new GmailScopeError("Gmail 403 (insufficient scope) — refresh token lacks gmail.readonly. Re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN.");
  }
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as GmailMessageFull | null;
  if (!json?.payload) return null;

  const headers = json.payload.headers || [];
  const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  const meta = { subject: header("Subject"), from: header("From"), date: header("Date") };

  const plain = findPart(json.payload, "text/plain");
  if (plain?.body?.data) return { ...meta, text: b64urlDecode(plain.body.data) };

  const html = findPart(json.payload, "text/html");
  if (html?.body?.data) return { ...meta, text: stripHtml(b64urlDecode(html.body.data)) };

  // Single-part message (no `parts` array — body sits directly on the top-level payload).
  if (json.payload.body?.data) {
    const raw = b64urlDecode(json.payload.body.data);
    return { ...meta, text: json.payload.mimeType === "text/html" ? stripHtml(raw) : raw };
  }
  return null;
}
