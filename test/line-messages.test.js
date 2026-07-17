'use strict';
// ============================================================
// LINE webhook pure-logic tests — message builders + signature verify.
// Imports the SAME .mjs modules the Deno function (supabase/functions/
// line-webhook) uses, so `npm test` (the CI deploy gate) covers the
// webhook's clinical-safety + security invariants without a Deno runtime.
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'supabase', 'functions', 'line-webhook');
const loadMessages = () => import(path.join(DIR, 'messages.mjs'));
const loadVerify = () => import(path.join(DIR, 'verify.mjs'));

test('every reply carries the clinical disclaimer + app link (lookup-only contract)', async () => {
  const { buildHelp, buildGreeting, DISCLAIMER, APP_BASE } = await loadMessages();
  for (const build of [buildHelp, buildGreeting]) {
    const msgs = build();
    assert.ok(Array.isArray(msgs) && msgs.length >= 1, 'returns a message array');
    assert.strictEqual(msgs[0].type, 'text');
    assert.ok(msgs[0].text.includes(DISCLAIMER), 'reply must include the disclaimer');
    assert.ok(msgs[0].text.includes(APP_BASE), 'reply must include the app link');
    // clinical safety: the bot must state it does NOT calculate doses
    assert.ok(/ไม่คำนวณขนาดยา/.test(msgs[0].text), 'reply must state no dose calculation');
  }
});

test('appLink builds app URLs from the shared base', async () => {
  const { appLink, APP_BASE } = await loadMessages();
  assert.strictEqual(appLink(), APP_BASE);
  assert.strictEqual(appLink('index.html?drug=meropenem'), APP_BASE + '/index.html?drug=meropenem');
});

test('signature verify: accepts a genuine LINE HMAC, rejects tampering', async () => {
  const { verifyLineSignature, computeSignature } = await loadVerify();
  const secret = 'test-channel-secret';
  const bodyGood = JSON.stringify({ events: [] });
  const sigB64 = Buffer.from(await computeSignature(secret, bodyGood)).toString('base64');

  assert.strictEqual(await verifyLineSignature(secret, bodyGood, sigB64), true, 'valid signature passes');
  assert.strictEqual(await verifyLineSignature(secret, bodyGood + ' ', sigB64), false, 'tampered body fails');
  assert.strictEqual(await verifyLineSignature('wrong-secret', bodyGood, sigB64), false, 'wrong secret fails');
  assert.strictEqual(await verifyLineSignature('', bodyGood, sigB64), false, 'empty secret fails');
  assert.strictEqual(await verifyLineSignature(secret, bodyGood, ''), false, 'empty signature fails');
  assert.strictEqual(await verifyLineSignature(secret, bodyGood, 'not-base64!!'), false, 'garbage signature fails without throwing');
});
