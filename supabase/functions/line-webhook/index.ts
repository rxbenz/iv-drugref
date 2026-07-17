// ============================================================
// Supabase Edge Function · line-webhook   (Deno)
// Receives LINE Messaging API webhooks, verifies X-Line-Signature, replies.
// Phase 2: replies a Thai help menu to any text message; greets on follow.
// REFERENCE-LOOKUP ONLY — no dose/TDM calculation here (clinical safety).
//
// DEPLOY (Supabase dashboard → Edge Functions → "Via Editor"):
//   • paste these three files (index.ts, verify.mjs, messages.mjs)
//   • in the function's settings set **Verify JWT = OFF**
//     (LINE sends no Supabase JWT — security = the signature check below)
//   • Secrets (Edge Functions → Secrets):
//       LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN
//   • webhook URL = https://bzwbagojjpiazbeaahmg.supabase.co/functions/v1/line-webhook
// See docs/line-channel/03-webhook-bot.md for the full walkthrough.
// ============================================================
import { verifyLineSignature } from './verify.mjs';
import { buildHelp, buildGreeting } from './messages.mjs';

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

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
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Only POST carries webhook events; anything else → 200 (health checks).
  if (req.method !== 'POST') return json(200, { ok: true });

  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET') ?? '';
  const accessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature') ?? '';

  // Reject anything not genuinely signed by LINE.
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
  // LINE console "Verify" posts an empty events array → falls through to 200.

  for (const ev of events as Array<Record<string, any>>) {
    try {
      if (ev?.type === 'message' && ev?.message?.type === 'text' && ev?.replyToken) {
        await replyMessage(ev.replyToken, buildHelp(), accessToken);
      } else if (ev?.type === 'follow' && ev?.replyToken) {
        await replyMessage(ev.replyToken, buildGreeting(), accessToken);
      }
      // Other event types are acknowledged (200) without a reply.
    } catch (_e) {
      // Never fail the whole webhook because one event's reply errored.
    }
  }

  return json(200, { ok: true });
});
