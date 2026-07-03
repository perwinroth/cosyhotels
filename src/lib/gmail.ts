// Create Gmail drafts as per@gotcosy.com via the API — the reliable version of the outreach button
// (compose URLs can't force a From). Auth: OAuth refresh token for gotcosy@gmail.com, where
// per@gotcosy.com is a verified "Send As" alias. Env: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET /
// GMAIL_REFRESH_TOKEN. Server-only.
const ACCOUNT = "gotcosy@gmail.com";
const FROM = "Got Cosy <per@gotcosy.com>"; // per@gotcosy.com must be a verified Send-As on ACCOUNT

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

function rawMessage({ to, subject, body }: { to: string; subject: string; body: string }): string {
  const headers = [
    `From: ${FROM}`,
    to ? `To: ${to}` : "",
    `Subject: ${encHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].filter(Boolean).join("\r\n");
  return Buffer.from(`${headers}\r\n\r\n${body}`, "utf8").toString("base64url");
}

// Create a draft in gotcosy@gmail.com from per@gotcosy.com. Returns the draft id + a link to Drafts.
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
