#!/usr/bin/env node
// One-time Gmail OAuth capture → prints a refresh_token for BOTH creating drafts as per@gotcosy.com
// AND reading the mailbox (Sent/Inbox) for the outreach auto-sync cron.
// gotcosy@gmail.com is a CONSUMER account (no Workspace domain-wide delegation), so we use an OAuth
// "Desktop app" client + a stored refresh token. Run this ONCE, authorise as gotcosy@gmail.com.
//
//   1. Put the OAuth client's id + secret in .env.local:
//        GMAIL_CLIENT_ID=...apps.googleusercontent.com
//        GMAIL_CLIENT_SECRET=...
//   2. node --env-file=.env.local scripts/gmail-auth.mjs
//   3. A browser opens (or copy the printed URL). Log in as gotcosy@gmail.com, click Allow.
//   4. It prints GMAIL_REFRESH_TOKEN — add all three to Vercel (+ .env.local).
//
// ⚠️ RE-RUN REQUIRED: the scope now includes gmail.readonly (was compose-only). A refresh token
// minted before this change CANNOT read Sent/Inbox, so /api/cron/outreach-sync returns a graceful
// "needs readonly scope" error until you re-run this script and REPLACE GMAIL_REFRESH_TOKEN in both
// Vercel and .env.local with the value printed below. (prompt=consent re-issues a fresh token.)
import http from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("✗ Add GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET to .env.local first (from your OAuth 'Desktop app' client). Then re-run.");
  process.exit(1);
}
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
// compose = create/read/update/send drafts; readonly = read Sent/Inbox for the outreach auto-sync cron
const SCOPE = "https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly";
const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE,
  access_type: "offline", prompt: "consent", // prompt=consent forces a refresh_token every time
}).toString();

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) { res.writeHead(404); res.end(); return; }
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) { res.writeHead(400); res.end("no code"); return; }
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  }).then((r) => r.json());
  if (tok.refresh_token) {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<body style='font:16px system-ui;padding:3rem'>✓ Done — copy the refresh token from your terminal. You can close this tab.</body>");
    console.log("\n✓ SUCCESS. Add these three to Vercel + .env.local:\n");
    console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tok.refresh_token}\n`);
  } else {
    res.writeHead(500, { "content-type": "text/html" });
    res.end("<body style='font:16px system-ui;padding:3rem'>✗ No refresh token. Check the terminal.</body>");
    console.error("\n✗ token exchange failed:", JSON.stringify(tok, null, 2), "\n(If it says 'access_denied', add gotcosy@gmail.com as a Test user on the OAuth consent screen.)");
  }
  server.close();
});
server.listen(PORT, () => {
  console.log(`\nOpen this URL and log in as gotcosy@gmail.com, then click Allow:\n\n${authUrl}\n`);
  exec(`open "${authUrl}"`, () => {}); // best-effort auto-open on macOS
});
