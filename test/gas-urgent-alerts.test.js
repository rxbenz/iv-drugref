'use strict';
// ============================================================
// Urgent alerts (ประกาศด่วน) — GAS handlers, run against in-memory sheets.
//
// The defect these lock: the service worker polls checkUrgentAlerts on the
// ANALYTICS deployment while the admin panel writes through the ADMIN
// deployment. With the bound-spreadsheet getSS() those are DIFFERENT sheets,
// so an alert created in admin would never reach a single client. v5.73.0
// routes every alert operation through getAlertSS() (openById — the analytics
// spreadsheet the SW reads), so create/list/read/resolve all agree.
//
// In the sandbox: openById() → drugSS (the shared alert spreadsheet),
// getActiveSpreadsheet() → adminSS (the admin-bound one).
// ============================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { loadGas } = require('./helpers/load-gas');

const ADMIN = 'admin@test.local';
const EDITOR_USERS = [
  ['email', 'name', 'role'],
  ['admin@test.local', 'Test Admin', 'admin'],
  ['editor@test.local', 'Test Editor', 'editor'],
];

function setup() {
  const g = loadGas({ adminUsers: EDITOR_USERS });
  return g;
}

test('createUrgentAlert writes into the SHARED alert spreadsheet (the one the SW polls)', () => {
  const { sandbox, json } = setup();
  const res = json(sandbox.createUrgentAlert(ADMIN, {
    title: 'เรียกคืน Vancomycin lot A123', message: 'หยุดใช้ทันที', severity: 'high',
    type: 'recall', drugName: 'Vancomycin', actionRequired: 'ส่งคืนคลังยา',
  }));
  assert.strictEqual(res.success, true);
  assert.match(res.alertId, /^ALERT_\d+$/);

  // Present in the shared (openById) spreadsheet...
  const shared = sandbox.getAlertSS().getSheetByName('UrgentAlerts');
  assert.ok(shared, 'UrgentAlerts sheet created in the shared spreadsheet');
  assert.strictEqual(shared.rows.length, 2, 'header + 1 alert');
  // ...and NOT in the admin-bound one (that split was the bug).
  assert.strictEqual(sandbox.getSS().getSheetByName('UrgentAlerts'), null,
    'must not write to the admin-bound spreadsheet');
});

test('the SW poll (checkUrgentAlerts) sees an alert the admin just created', () => {
  const { sandbox, json } = setup();
  sandbox.createUrgentAlert(ADMIN, { title: 'ประกาศ A', message: 'ข้อความ A', severity: 'medium' });

  const poll = json(sandbox.handleCheckUrgentAlerts('0'));
  assert.strictEqual(poll.alerts.length, 1, 'the client poll returns the new alert');
  assert.strictEqual(poll.alerts[0].title, 'ประกาศ A');
  assert.strictEqual(poll.alerts[0].status, 'active');
  assert.strictEqual(poll.hasNew, true, 'flagged as new since ts=0');

  // `since` in the future → nothing new (but the alert still lists as active).
  const later = json(sandbox.handleCheckUrgentAlerts(String(Date.now() + 60000)));
  assert.strictEqual(later.hasNew, false);
  assert.strictEqual(later.alerts.length, 1);
});

test('resolveUrgentAlert hides the alert from clients', () => {
  const { sandbox, json } = setup();
  const id = json(sandbox.createUrgentAlert(ADMIN, { title: 'T', message: 'M' })).alertId;

  const res = json(sandbox.resolveUrgentAlert(ADMIN, { alertId: id }));
  assert.strictEqual(res.success, true);
  assert.strictEqual(json(sandbox.handleCheckUrgentAlerts('0')).alerts.length, 0,
    'resolved alerts are not pushed to clients');
  // The admin table still lists it (so it can be audited), marked resolved.
  const listed = json(sandbox.handleListUrgentAlerts(ADMIN)).alerts;
  assert.strictEqual(listed.length, 1);
  assert.strictEqual(listed[0].status, 'resolved');
});

test('handlers are reachable through the shared routing table (doGet/doPost)', () => {
  const { sandbox, json } = setup();
  const call = (action, data) => json(sandbox.routeApiAction(
    action, ADMIN, data || {}, { parameter: {} }));

  assert.strictEqual(call('createurgentalert', { title: 'R', message: 'M' }).success, true);
  assert.strictEqual(call('listurgentalerts').alerts.length, 1);
  const id = call('listurgentalerts').alerts[0].id;
  assert.strictEqual(call('resolveurgentalert', { alertId: id }).success, true);
  // Unknown actions still fall through (routeApiAction returns null).
  assert.strictEqual(sandbox.routeApiAction('nope', ADMIN, {}, { parameter: {} }), null);
});

test('permission + validation: non-admin blocked, empty fields rejected', () => {
  const { sandbox, json } = setup();
  const denied = json(sandbox.createUrgentAlert('editor@test.local', { title: 'T', message: 'M' }));
  assert.strictEqual(denied.permissionDenied, true, 'editor cannot broadcast to every user');
  assert.strictEqual(json(sandbox.handleListUrgentAlerts('editor@test.local')).permissionDenied, true);

  const empty = json(sandbox.createUrgentAlert(ADMIN, { title: '   ', message: '' }));
  assert.strictEqual(empty.success, false, 'blank title/message rejected');
  assert.strictEqual(json(sandbox.handleCheckUrgentAlerts('0')).alerts.length, 0, 'nothing written');
});

test('rows are written BY HEADER POSITION, not positionally', () => {
  const { sandbox, json } = setup();
  // Pre-create the sheet with a DIFFERENT column order than the code's default.
  const ss = sandbox.getAlertSS();
  const sheet = ss.insertSheet('UrgentAlerts');
  sheet.appendRow(['createdAt', 'title', 'id', 'status', 'severity', 'message']);

  json(sandbox.createUrgentAlert(ADMIN, { title: 'ชื่อเรื่อง', message: 'เนื้อหา', severity: 'high' }));

  const [headers, row] = sheet.rows;
  assert.strictEqual(row[headers.indexOf('title')], 'ชื่อเรื่อง');
  assert.strictEqual(row[headers.indexOf('message')], 'เนื้อหา');
  assert.strictEqual(row[headers.indexOf('severity')], 'high');
  assert.strictEqual(row[headers.indexOf('status')], 'active');
  assert.match(row[headers.indexOf('id')], /^ALERT_/);
});
