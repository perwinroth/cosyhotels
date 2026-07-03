import { NextResponse } from "next/server";
import { createGmailDraft, gmailConfigured } from "@/lib/gmail";
import { outreachPitch } from "@/lib/outreachTemplates";

// Create a real Gmail draft (From per@gotcosy.com) for an outreach target. Auth: middleware gates
// /api/admin/* (panel cookie). Nothing is sent — Per reviews + sends the draft himself.
export async function POST(req: Request) {
  if (!gmailConfigured()) return NextResponse.json({ error: "gmail not configured" }, { status: 503 });
  const { outlet, fit, email } = await req.json().catch(() => ({}));
  if (!outlet || !fit) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { subject, body } = outreachPitch({ outlet: String(outlet), fit: String(fit) });
  const draft = await createGmailDraft({ to: email ? String(email) : "", subject, body });
  if (!draft) return NextResponse.json({ error: "draft creation failed" }, { status: 500 });
  return NextResponse.json({ ok: true, id: draft.id, link: draft.link });
}
