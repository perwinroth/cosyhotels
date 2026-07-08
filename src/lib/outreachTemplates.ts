// Outreach pitch templates keyed by `fit`, and a Gmail-compose deep link builder.
// Shared by the /growth panel (one-tap "Draft in Gmail") and the local command centre so the
// copy stays identical. The link opens Gmail (in the gotcosy@gmail.com account) with to/subject/body
// pre-filled — you review & send from per@gotcosy.com (the default Send-As); nothing is auto-sent.
const SITE = "https://gotcosy.com";
type Pitch = { subject: string; body: string };

export const TEMPLATES: Record<string, (outlet: string) => Pitch> = {
  "data-study": (o) => ({
    subject: 'Data: we scored 17,000 hotels on "cosiness", and stars barely matter',
    body: `Hi,\n\nI run gotcosy.com; we used AI to score 17,000+ hotels on how cosy they are (warmth, intimacy, character), from their photos and guest reviews. A few findings that might suit ${o}:\n\n- Stars barely predict cosiness: a 4-star is on average ~0.2 of a point cosier than a 2-star\n- Independent hotels beat chains by ~45%\n- Only about 1 in 150 hotels is genuinely cosy\n\nFull study and method: ${SITE}/en/what-makes-a-hotel-cosy\nHappy to share the underlying data, charts or a quote.\n\nThanks,\nPer, Got Cosy`,
  }),
  "hotelier-asset": (o) => ({
    subject: 'The photos that make a hotel look "cold": data from 17,000 listings',
    body: `Hi,\n\nI run gotcosy.com. From scoring 17,000+ hotel listings we found the exact photo types that make a hotel look cold (logos, landmarks, stock people, award badges) and what reads as genuinely cosy instead. Could make a useful, data-backed piece for ${o}.\n\nThe guide: ${SITE}/en/make-your-hotel-look-cosy\nHappy to share the reject data or real examples.\n\nThanks,\nPer, Got Cosy`,
  }),
  listicle: (o) => ({
    subject: `The cosiest hotels, ranked: happy to share data with ${o}`,
    body: `Hi,\n\nI run gotcosy.com: AI cosiness rankings across 17,000+ hotels. Happy to put together a "cosiest hotels in [your city/region]" list for ${o}, or share the rankings / Cosy Index for you to reference.\n\nThe Index: ${SITE}/en/cosy-index\n\nThanks,\nPer, Got Cosy`,
  }),
  "expert-source": (o) => ({
    subject: "Source on cosy hotels / hygge travel (data-backed)",
    body: `Hi,\n\nI run gotcosy.com; I have scored 17,000+ hotels on cosiness and can speak, with data, on what actually makes a hotel cosy, where they cluster, cosy vs luxury, hygge travel and more. Happy to be a source for ${o}.\n\n${SITE}\n\nThanks,\nPer, Got Cosy`,
  }),
};

// Gmail compose deep link (mobile + desktop): opens a pre-filled, editable draft you send yourself.
// Compose opens in the gotcosy@gmail.com account, where per@gotcosy.com is the default "Send As"
// alias — so the outgoing From is per@gotcosy.com (Gmail compose URLs can't set From directly, only
// the account). Requires being signed into gotcosy@gmail.com in that browser.
const GMAIL_ACCOUNT = "gotcosy@gmail.com";
// The pitch (subject + body) for a target — shared by the compose-URL and the Gmail-API draft paths.
export function outreachPitch(row: { outlet: string; fit: string }): { subject: string; body: string } {
  return (TEMPLATES[row.fit] || TEMPLATES["data-study"])(row.outlet);
}
export function gmailComposeUrl(row: { email?: string; outlet: string; fit: string }): string {
  const t = (TEMPLATES[row.fit] || TEMPLATES["data-study"])(row.outlet);
  const p = new URLSearchParams({ view: "cm", fs: "1", to: row.email || "", su: t.subject, body: t.body });
  return `https://mail.google.com/mail/u/${GMAIL_ACCOUNT}/?` + p.toString();
}
