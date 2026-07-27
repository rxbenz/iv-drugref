'use strict';
// ============================================================
// Test loader — runs the REAL Google Apps Script backend
// (gas-complete.js) in a Node vm sandbox with the Apps Script
// host services stubbed, so tests exercise the production
// handlers instead of a copy of their logic.
//
// gas-complete.js is a plain script of top-level `var`/`function`
// declarations (no side effects at load), so it can be evaluated
// directly; the host globals it calls (SpreadsheetApp, Logger,
// ContentService, …) are injected per test.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

/**
 * In-memory stand-in for a Sheet. `rows` includes the header row and is
 * mutated in place, so a test can assert on cells after a handler runs.
 * getDataRange().getValues() hands back copies — same as Apps Script, where
 * the snapshot a handler reads does not alias later writes.
 */
function makeSheet(name, rows) {
  const sheet = {
    name,
    rows,
    getName: () => name,
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange(r, c) {
      const api = {
        setValue(v) {
          while (rows.length < r) rows.push([]);
          const row = rows[r - 1];
          while (row.length < c) row.push('');
          row[c - 1] = v;
          return api;
        },
        setFontWeight: () => api,
        setBackground: () => api,
        getValue: () => (rows[r - 1] || [])[c - 1],
      };
      return api;
    },
    appendRow(row) { rows.push(row.slice()); return sheet; },
    setFrozenRows: () => sheet,
    deleteRow(i) { rows.splice(i - 1, 1); return sheet; },
  };
  return sheet;
}

/** In-memory stand-in for a Spreadsheet holding `sheets` by name. */
function makeSpreadsheet(sheets) {
  return {
    sheets,
    getSheetByName: (n) => sheets[n] || null,
    insertSheet(n) { sheets[n] = makeSheet(n, []); return sheets[n]; },
  };
}

/**
 * Evaluate gas-complete.js with host services stubbed.
 *   drugSheetRows  – rows (header row first) of the DrugData sheet
 *   adminUsers     – rows of AdminUsers; defaults to one admin
 * Returns the sandbox plus handles to the fake sheets and a json() helper
 * that unwraps what the handlers return through ContentService.
 */
function loadGas({ drugSheetRows, adminUsers } = {}) {
  const drugSheet = makeSheet('DrugData', drugSheetRows || []);
  const auditSheet = makeSheet('AuditLog', [['timestamp', 'user', 'action', 'drugId', 'drugName', 'details']]);
  const usersSheet = makeSheet('AdminUsers', adminUsers || [
    ['email', 'name', 'role'],
    ['admin@test.local', 'Test Admin', 'admin'],
  ]);

  const drugSS = makeSpreadsheet({ DrugData: drugSheet });
  const adminSS = makeSpreadsheet({ AuditLog: auditSheet, AdminUsers: usersSheet });

  const sandbox = {
    console,
    SpreadsheetApp: {
      openById: () => drugSS,
      getActiveSpreadsheet: () => adminSS,
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ _text: text, setMimeType() { return this; } }),
    },
    Logger: { log() {} },
    // Reached only by the best-effort Supabase dual-write, which is wrapped in
    // try/catch — left undefined so the sync is a no-op in tests.
    Utilities: undefined,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas-complete.js'), 'utf8'),
    sandbox, { filename: 'gas-complete.js' });

  return {
    sandbox,
    drugSheet,
    auditSheet,
    usersSheet,
    /** Unwrap a handler's ContentService response into a plain object. */
    json: (res) => JSON.parse(res._text),
    /** Rebuild the object getSheetData() would produce for a drug row. */
    rowObject: (rowIndex) => {
      const headers = drugSheet.rows[0];
      const row = drugSheet.rows[rowIndex];
      const o = {};
      headers.forEach((h, j) => { o[h] = row[j]; });
      return o;
    },
  };
}

// Header row of the production DrugData sheet: human-readable names, with the
// later-added workflow columns in lowercase (see CLAUDE.md). This layout is
// what silently swallowed every drug edit before v5.69.0.
const HUMAN_HEADERS = ['ID', 'Generic Name', 'Trade Name', 'Strength', 'ED/NED', 'HAD', 'Categories',
  'Reconst: Solvent', 'Reconst: Volume', 'Reconst: Conc',
  'Dilution: Diluent', 'Dilution: Volume', 'Dilution: Final Conc',
  'Admin: Route', 'Admin: Rate',
  'Stability: Reconst', 'Stability: Diluted', 'Stability: Storage',
  'Compat: Y-site', 'Compat: Incompatible',
  'Precautions', 'Monitoring', 'Reference', 'Usual Dose',
  'status', 'previousData', 'updatedAt'];

// Header row a sheet gets when handleCreateDrug creates it from scratch.
const CODE_HEADERS = ['id', 'generic', 'trade', 'strength', 'ed', 'had', 'categories', 'status',
  'reconst', 'dilution', 'admin', 'stability', 'compat', 'precautions', 'monitoring', 'ref',
  'createdBy', 'createdAt', 'updatedAt', 'previousData'];

module.exports = { loadGas, makeSheet, makeSpreadsheet, HUMAN_HEADERS, CODE_HEADERS };
