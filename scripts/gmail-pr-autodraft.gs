/**
 * Got Cosy - automatic PR-query triage (Google Apps Script).
 * Reads Source of Sources / HARO / SourceBottle / Featured digests in YOUR Gmail, uses Claude to
 * find queries relevant to Got Cosy, drafts grounded replies, and (a) pushes your phone via Telegram
 * with a one-tap editable "open, edit and Send" link, (b) drops a real Gmail draft as a fallback,
 * (c) emails you a summary. NEVER auto-sends - you review, edit, and hit Send yourself.
 *
 * SETUP: script.google.com -> New project -> paste this -> Save.
 *   Project Settings -> Script Properties -> add:
 *     ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   Then run install once and authorize. (Editing the code later needs no re-install.)
 */

var SENDERS = ['sourceofsources.com', 'helpareporter.com', 'helpareporter.net', 'sourcebottle.com', 'thesourcebottle.com', 'featured.com', 'noreply@connectively.us'];
var DONE_LABEL = 'cosy-pr-done';
var MODEL = 'claude-haiku-4-5';

var DATA = [
  'Got Cosy (gotcosy.com) has AI-scored 17,000+ hotels for cosiness. Ground every reply in these REAL findings - never invent a number or a hotel feature:',
  '- Stars barely predict cosiness: 2-star avg 4.9, 3-star 5.0, 4-star 5.1 (out of 10).',
  '- Independent hotels beat chains by ~45% (4.6 vs 3.1 / 10); chains are rare in the cosy set.',
  '- Genuine cosiness is rare: only ~1 in 150 hotels reaches elite-cosy (8+/10).',
  '- Italy is the cosiest country by volume; Japan has the highest concentration of elite-cosy stays (~1 in 27); the USA has the lowest average of the big markets (~3.5).',
  '- What drives it: warm light, natural materials, fireplaces, small/intimate scale, independent ownership, and reviews about feeling genuinely welcomed.',
  '- Honest accuracy ceiling (say it if asked): the score agrees with human raters about as well as two humans agree with each other (~0.43).',
  'Credential to close every reply with: Per Winroth, founder of Got Cosy (gotcosy.com).'
].join('\n');

var LANE = 'cosy / boutique / independent hotels; what makes a hotel feel cosy; hygge / slow / cosy travel; cosiest cities or destinations; hotel photos / design; romantic, quiet, or winter/autumn getaways; hotel-industry data and trends; cosy vs luxury. NOT relevant: generic travel, flights, points/deals, unrelated lifestyle - skip anything you would have to stretch for.';

function install() {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) ScriptApp.deleteTrigger(t[i]);
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
  run();
}

function run() {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Set ANTHROPIC_API_KEY in Script Properties first.');
  var label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var froms = SENDERS.map(function (s) { return 'from:' + s; }).join(' OR ');
  var threads = GmailApp.search('newer_than:2d -label:' + DONE_LABEL + ' (' + froms + ')', 0, 20);
  var failures = 0;
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var msgs = thread.getMessages();
    var body = msgs[msgs.length - 1].getPlainBody().slice(0, 12000);
    var items;
    // One bad triage call must never stall the whole pipeline: before this try/catch, an Anthropic
    // error on the FIRST digest aborted the run before any labeling, so every hourly run re-crashed
    // on the same thread and nothing was ever processed. Now: skip the thread (no label -> retried
    // next run), count it, and tell Per once at the end instead of dying silently.
    try {
      items = askClaude(key, body);
    } catch (e) {
      failures++;
      continue;
    }
    thread.addLabel(label);
    if (!items || !items.length) continue;
    var summary = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      // Backstop the LLM: only surface queries Per can act on for FREE. Drop anything whose only path
      // is a gated Substack/X/LinkedIn link with no real reply email (the model isn't reliable at this).
      if (!isActionable(it, body)) continue;
      var action = actionUrl(it);
      var hasEmail = it.channel === 'email' && it.replyTo;
      if (hasEmail) {
        try { GmailApp.createDraft(it.replyTo, it.subject || 'Re: your query', it.draft || ''); } catch (e) {}
      }
      // Honest label: only promise "Send" when there is an address; web-only queries get a "respond via
      // their form" link so Per is never told to send when no email exists (the Substack/gated case).
      var label = hasEmail ? 'Open, edit and Send (to ' + it.replyTo + '):' : 'No reply email in this digest - respond via their form/link:';
      notifyPhone('PR: ' + (it.outlet || 'Query') + (it.deadline ? ' deadline: ' + it.deadline : '') +
        '\nQ: ' + (it.query || '') + '\n\n' + (it.draft || '') + '\n\n' + label + '\n' + action);
      summary.push('### ' + (it.outlet || 'Query') + (it.deadline ? ' - deadline ' + it.deadline : '') +
        '\nQUERY: ' + (it.query || '') + '\n' + label + ' ' + action +
        (hasEmail ? ' (also in your Gmail Drafts)' : '') + '\n\n' + (it.draft || ''));
    }
    GmailApp.sendEmail(Session.getActiveUser().getEmail(),
      'Cosy PR - ' + summary.length + ' query(ies): ' + thread.getFirstMessageSubject().slice(0, 50),
      summary.join('\n\n---\n\n') + '\n\nRewrite each draft in your own voice before sending - platforms detect AI pitches.');
  }
  if (failures > 0) {
    try { notifyPhone('PR triage: ' + failures + ' digest(s) failed (Claude call error) - check ANTHROPIC_API_KEY in Script Properties and the Apps Script executions log.'); } catch (e) {}
  }
}

var GATED = /substack\.com|(^|\/\/)(x|twitter)\.com|linkedin\.com/i;
// True only if Per can respond for FREE: a real reply email, OR a first-party web form that is NOT a
// gated Substack/X/LinkedIn link. Critically, the email/link must LITERALLY appear in the digest text -
// this kills a model that hallucinates a plausible address (e.g. guessing name@gmail.com from a name).
function isActionable(it, digest) {
  if (!it) return false;
  var email = (it.replyTo || '').trim();
  var link = (it.link || '').trim();
  if (email.indexOf('@') > 0 && !GATED.test(email) && digest.indexOf(email) >= 0) return true;
  if (it.channel === 'web' && link && !GATED.test(link) && digest.indexOf(link) >= 0) return true;
  return false;
}

function actionUrl(it) {
  if (it.channel === 'email' && it.replyTo) {
    return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(it.replyTo) +
      '&su=' + encodeURIComponent(it.subject || 'Re: your query') + '&body=' + encodeURIComponent(it.draft || '');
  }
  return it.link || '(respond via the platform)';
}

function notifyPhone(text) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TELEGRAM_BOT_TOKEN'), chat = p.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chat) return;
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post', muteHttpExceptions: true,
    payload: { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: 'true' } });
}

function askClaude(key, digest) {
  var prompt = 'You triage journalist-request digests for Got Cosy and draft a TAILORED reply to each relevant query.\n' + DATA + '\n\nRELEVANT LANE: ' + LANE +
    '\n\nBelow is ONE digest email that usually lists several separate queries. Find ONLY the queries genuinely in the lane (skip anything you would have to stretch for).\n' +
    'HARD SKIP (never return these): any query whose ONLY way to respond is a Substack post URL, an x.com / twitter.com link, or a LinkedIn link with NO reply email printed next to it. Those are external requests whose contact is gated/paid and cannot be answered for free. Only return a query if it has a real reply email OR a first-party FREE submission form (a HARO/Featured reply address, a Source of Sources reporter email, or a SourceBottle call-out form).\n' +
    'Return ONLY a JSON array (no prose, no code fences). Each object has these keys:\n' +
    'outlet (the publication or reporter name), deadline (string, empty if none), query (the reporter actual question, one line), ' +
    'channel (EXACTLY one of these two strings: "email" or "web" - never anything else), ' +
    'replyTo (a valid reply EMAIL ADDRESS that contains an @ sign and APPEARS VERBATIM in the digest text - a reporter address, "respond to"/"email me at" address, a masked forwarding address such as name@helpareporter.net, or a mailto: target. NEVER guess, construct, or infer an email from a name or domain, and NEVER put a website/Substack/social URL here. Empty string if no email literally appears next to this query), ' +
    'link (the exact first-party free response form URL, only when channel is "web"; empty otherwise. A Substack/x.com/LinkedIn post is NOT a valid form - if that is the only link, DROP the whole query per the HARD SKIP rule), ' +
    'subject (a specific subject that names the query topic - never a generic "Re: your query"), ' +
    'draft (a 110-190 word reply following the DRAFT RULES below).\n\n' +
    'DRAFT RULES - each reply must be clearly tailored to its own query, not a template:\n' +
    '1. OPEN by directly addressing THIS reporter specific question in their own framing. Do NOT start two drafts the same way, and do NOT always lead with the independents-vs-chains stat.\n' +
    '2. Use only the ONE or TWO findings above most relevant to THIS query; ignore the rest. Never list all the stats.\n' +
    '3. Be concrete and useful: give a specific angle, or offer to share named example properties / the underlying data that fit their exact story.\n' +
    '4. Sound like a real founder wrote it fast: plain, confident, specific. No "I hope this finds you well", no marketing adjectives, vary sentence length.\n' +
    '5. Ground every claim ONLY in the findings above. Invent nothing - no numbers or hotel names not given.\n' +
    '6. End with exactly this line: Per Winroth, Got Cosy, gotcosy.com\n' +
    'If NO query is relevant, return exactly: []\n\nDIGEST:\n' + digest;
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }) });
  var j = JSON.parse(res.getContentText());
  var txt = (j.content && j.content[0] && j.content[0].text) || '';
  var s = txt.indexOf('['), e = txt.lastIndexOf(']');
  if (s < 0 || e < 0) return [];
  try { return JSON.parse(txt.slice(s, e + 1)); } catch (err) { return []; }
}
