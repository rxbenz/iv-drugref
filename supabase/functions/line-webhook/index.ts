// ============================================================
// Supabase Edge Function · line-webhook   (Deno)
// Receives LINE Messaging API webhooks, verifies X-Line-Signature, replies.
//   • text  → drug lookup (Flex card) / suggestions / not-found  (Phase 3)
//   • follow → greeting                                          (Phase 2)
// REFERENCE-LOOKUP ONLY — no dose/TDM calculation here (clinical safety).
//
// DEPLOY (Supabase dashboard → Edge Functions → "Via Editor"): paste these
// FOUR files (index.ts, verify.mjs, messages.mjs, matcher.mjs) into one
// function; set **Verify JWT = OFF** (LINE sends no Supabase JWT — security is
// the signature check). Secrets: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN.
// SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically by the platform.
// See docs/line-channel/03-webhook-bot.md.
// ============================================================
import { verifyLineSignature } from './verify.mjs';
import { buildHelp, buildGreeting, buildDrugFlex, buildSuggestions, buildNotFound } from './messages.mjs';
import { parseMessage, matchDrug } from './matcher.mjs';

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function json(status: number, obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Reply is FREE and unlimited on the LINE Messaging API (unlike broadcast).
async function replyMessage(replyToken: string, messages: unknown[], token: string): Promise<void> {
  await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages }),
  });
}

// ---- drug data: fetch-first from Supabase, 5-min in-memory cache ----
// Same source + shape the app reads (drugs?select=data&status=eq.approved).
// Degrades gracefully: on empty/error the reply becomes a "search in the app"
// link (the app has its own fallback dataset).
let _drugs: Array<Record<string, unknown>> | null = null;
let _drugsAt = 0;
const DRUG_TTL = 5 * 60 * 1000;

async function getDrugs(): Promise<Array<Record<string, unknown>>> {
  const now = Date.now();
  if (_drugs && now - _drugsAt < DRUG_TTL) return _drugs;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/drugs?select=data&status=eq.approved`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return _drugs ?? [];
    const rows = await res.json();
    const drugs = (Array.isArray(rows) ? rows : [])
      .map((r: Record<string, unknown>) => r?.data)
      .filter((d: Record<string, unknown>) => d && d.generic);
    if (drugs.length) { _drugs = drugs; _drugsAt = now; }
    return drugs.length ? drugs : (_drugs ?? []);
  } catch {
    return _drugs ?? [];
  }
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Fire-and-forget analytics into the shared events table (anon INSERT).
// The LINE userId is hashed — we never store the raw id.
async function logQuery(kind: string, query: string, matched: string | null, userId?: string): Promise<void> {
  try {
    const uid = userId ? 'line_' + (await sha256hex(userId)).slice(0, 16) : 'line-bot';
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({ type: 'LINE_QUERY', session_id: 'line-bot', user_id: uid, data: { kind, query, matched } }),
    });
  } catch { /* best-effort */ }
}

async function handleText(text: string, replyToken: string, userId: string | undefined, token: string): Promise<void> {
  const parsed = parseMessage(text);

  if (parsed.kind === 'drug') {
    const r = matchDrug(parsed.query, await getDrugs());
    if (r.status === 'found') {
      await replyMessage(replyToken, [buildDrugFlex(r.drug)], token);
      await logQuery('drug', parsed.query, String(r.drug.generic ?? ''), userId);
    } else if (r.status === 'suggest') {
      await replyMessage(replyToken, [buildSuggestions(parsed.query, r.candidates)], token);
      await logQuery('drug_suggest', parsed.query, null, userId);
    } else {
      await replyMessage(replyToken, [buildNotFound(parsed.query)], token);
      await logQuery('drug_none', parsed.query, null, userId);
    }
    return;
  }

  // help + (pair/renal — handled in Phase 4) → the menu for now
  await replyMessage(replyToken, buildHelp(), token);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(200, { ok: true });

  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
  const accessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  if (!(await verifyLineSignature(channelSecret, rawBody, signature))) {
    return json(403, { error: 'invalid signature' });
  }

  let body: { events?: unknown[] };
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    body = {};
  }
  const events = Array.isArray(body.events) ? body.events : [];

  for (const ev of events as Array<Record<string, any>>) {
    try {
      if (ev?.type === 'message' && ev?.message?.type === 'text' && ev?.replyToken) {
        await handleText(ev.message.text, ev.replyToken, ev.source?.userId, accessToken);
      } else if (ev?.type === 'follow' && ev?.replyToken) {
        await replyMessage(ev.replyToken, buildGreeting(), accessToken);
      }
    } catch (_e) {
      // Never fail the whole webhook because one event errored.
    }
  }

  return json(200, { ok: true });
});
