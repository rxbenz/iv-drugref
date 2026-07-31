'use strict';
// ============================================================
// LINE broadcast for urgent alerts (gas-complete.js, Phase 6)
//
// The in-app alert is the primary safety channel: it is written to the sheet and
// picked up by every client's service worker. LINE is a bonus reach. So the
// invariant locked here is that the ALERT SURVIVES ANY LINE FAILURE — a missing
// token, a 429 over quota, a network error — and that the failure is REPORTED
// rather than swallowed, so an admin never believes a broadcast went out when it
// did not.
//
// Broadcast also spends real money-ish quota (1 message per follower against a
// 300/month free ceiling), so the opt-in must be explicit and the quota endpoint
// must report honestly — including "followers unknown", which must not read as 0.
// ============================================================

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./helpers/load-gas');

const USER = 'admin@test.local';
const ALERT = {
  title: 'เรียกคืน Vancomycin lot A',
  message: 'พบตะกอนใน vial',
  severity: 'critical',
  drugName: 'Vancomycin',
  actionRequired: 'ส่งคืนคลังทันที',
};

// gas-complete.js resolves the alert sheet through getAlertSS() → getDrugSS(),
// which the harness backs with the DrugData spreadsheet; createUrgentAlert
// inserts the UrgentAlerts sheet when missing, so no fixture rows are needed.
function gas({ token = 'line-token', http } = {}) {
  return loadGas({
    scriptProperties: token ? { LINE_CHANNEL_ACCESS_TOKEN: token } : {},
    urlFetch: http,
  });
}
const okHttp = () => ({ code: 200, body: '{}' });

function alertRowCount(g) {
  const sheet = g.sandbox.getAlertSS().getSheetByName(g.sandbox.SHEETS.URGENT_ALERTS);
  return sheet ? sheet.rows.filter((r) => String(r[0] || '').startsWith('ALERT_')).length : 0;
}

test('opting in broadcasts the alert and reports success', () => {
  const g = gas({ http: okHttp });
  const res = g.json(g.sandbox.createUrgentAlert(USER, Object.assign({ lineBroadcast: true }, ALERT)));

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.line.sent, true);
  const bc = g.fetchCalls.find((c) => /message\/broadcast$/.test(c.url));
  assert.ok(bc, 'broadcast endpoint called');
  assert.strictEqual(bc.method, 'post');
  assert.match(bc.opts.headers.Authorization, /^Bearer line-token$/);
  const body = JSON.parse(bc.opts.payload);
  const text = body.messages[0].text;
  assert.match(text, /เรียกคืน Vancomycin lot A/, 'title in the message');
  assert.match(text, /ส่งคืนคลังทันที/, 'required action in the message');
  assert.match(text, /rxbenz\.github\.io\/iv-drugref/, 'app link in the message');
  assert.strictEqual(alertRowCount(g), 1);
});

test('a LINE failure must NOT fail the alert — and must be reported', () => {
  const g = gas({ http: () => ({ code: 429, body: '{"message":"You have reached your monthly limit."}' }) });
  const res = g.json(g.sandbox.createUrgentAlert(USER, Object.assign({ lineBroadcast: true }, ALERT)));

  assert.strictEqual(res.success, true, 'the in-app alert still goes out');
  assert.strictEqual(alertRowCount(g), 1, 'row written despite the LINE error');
  assert.strictEqual(res.line.sent, false);
  assert.match(res.line.error, /429/, 'the reason is surfaced, not swallowed');
});

test('no LINE token configured is survivable (alert unaffected)', () => {
  const g = gas({ token: null, http: okHttp });
  const res = g.json(g.sandbox.createUrgentAlert(USER, Object.assign({ lineBroadcast: true }, ALERT)));

  assert.strictEqual(res.success, true);
  assert.strictEqual(alertRowCount(g), 1);
  assert.strictEqual(res.line.sent, false);
  assert.match(res.line.error, /LINE_CHANNEL_ACCESS_TOKEN/);
});

test('without the opt-in nothing is sent and no quota is spent', () => {
  const g = gas({ http: okHttp });
  const res = g.json(g.sandbox.createUrgentAlert(USER, ALERT));

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.line, null, 'no LINE leg reported');
  assert.strictEqual(g.fetchCalls.filter((c) => /line\.me/.test(c.url)).length, 0);
});

test('quota endpoint reports remaining messages and the per-send cost', () => {
  const g = gas({ http: (url) => {
    if (/quota\/consumption/.test(url)) return { code: 200, body: '{"totalUsage":40}' };
    if (/message\/quota/.test(url)) return { code: 200, body: '{"type":"limited","value":300}' };
    if (/insight\/followers/.test(url)) return { code: 200, body: '{"status":"ready","followers":25}' };
    return okHttp();
  } });
  const q = g.json(g.sandbox.handleLineQuota(USER));

  assert.strictEqual(q.success, true);
  assert.strictEqual(q.limited, true);
  assert.strictEqual(q.limit, 300);
  assert.strictEqual(q.used, 40);
  assert.strictEqual(q.remaining, 260);
  assert.strictEqual(q.followers, 25, 'drives the "this will cost ~N messages" estimate');
});

test('unknown follower count stays null — never 0, which would read as "free"', () => {
  const g = gas({ http: (url) => {
    if (/insight\/followers/.test(url)) return { code: 400, body: '{"message":"no data"}' };
    if (/quota\/consumption/.test(url)) return { code: 200, body: '{"totalUsage":0}' };
    return { code: 200, body: '{"type":"limited","value":300}' };
  } });
  const q = g.json(g.sandbox.handleLineQuota(USER));

  assert.strictEqual(q.success, true, 'quota still usable without follower data');
  assert.strictEqual(q.remaining, 300);
  assert.strictEqual(q.followers, null);
});

test('an unlimited plan reports limited:false with no remaining count', () => {
  const g = gas({ http: (url) => {
    if (/quota\/consumption/.test(url)) return { code: 200, body: '{"totalUsage":12}' };
    if (/message\/quota/.test(url)) return { code: 200, body: '{"type":"none"}' };
    return okHttp();
  } });
  const q = g.json(g.sandbox.handleLineQuota(USER));

  assert.strictEqual(q.limited, false);
  assert.strictEqual(q.remaining, null);
});

test('linequota is routed (doGet), so the admin panel can reach it', () => {
  const g = gas({ http: (url) => {
    if (/quota\/consumption/.test(url)) return { code: 200, body: '{"totalUsage":0}' };
    return { code: 200, body: '{"type":"limited","value":300}' };
  } });
  const routed = g.sandbox.routeApiAction('linequota', USER, {}, {});
  assert.ok(routed, 'action reaches a handler (not the analytics fallthrough)');
  assert.strictEqual(g.json(routed).success, true);
});
