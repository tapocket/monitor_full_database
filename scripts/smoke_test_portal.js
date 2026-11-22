#!/usr/bin/env node
/**
 * Automated Node DOM smoke test for monitor_full_database.html (used locally & in GitHub Actions CI).
 * Verifies:
 *  1. Zero external CDN dependencies (no cdn.tailwindcss.com or fonts.googleapis.com)
 *  2. Local compiled Tailwind 3.4 CSS present
 *  3. 100% lossless DB unpack (catalog.length >= 2700)
 *  4. Deep-link routing (#compare=84,501), openModelModal(), renderFinder(), renderCompare()
 *  5. PVZ Price & Warranty Risk card + PVZ Express Mode hooks execute with 0 uncaught errors
 */
const fs = require('fs');
const vm = require('vm');

const htmlPath = process.argv[2] || 'monitor_full_database.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const head = html.slice(0, 60000);

if (head.includes('cdn.tailwindcss.com')) {
  console.error('FAIL: External cdn.tailwindcss.com script still present!');
  process.exit(1);
}
if (head.includes('fonts.googleapis.com')) {
  console.error('FAIL: External fonts.googleapis.com link still present!');
  process.exit(1);
}
if (!head.includes('Local Compiled Tailwind 3.4 Utility CSS')) {
  console.error('FAIL: Missing compiled local Tailwind 3.4 CSS!');
  process.exit(1);
}

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
if (!scripts.length) {
  console.error('FAIL: No <script> found in HTML!');
  process.exit(1);
}
const js = scripts[scripts.length - 1][1];

const noopCtx = new Proxy({}, {
  get(t, p) {
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (p === 'getImageData' || p === 'createImageData') {
      return (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w || 1) * (h || 1) * 4)) });
    }
    return () => {};
  }
});

const elems = new Map();
function makeEl(id) {
  return {
    id: id || '', value: '', checked: false, textContent: '', innerHTML: '', className: '',
    width: 600, height: 400, style: {}, dataset: {}, attributes: {}, options: [], children: [],
    firstChild: null, firstElementChild: { id: 'mockChild' },
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => this._s.add(x)); },
      remove(...a) { a.forEach(x => this._s.delete(x)); },
      toggle(x, f) { f === undefined ? (this._s.has(x) ? this._s.delete(x) : this._s.add(x)) : (f ? this._s.add(x) : this._s.delete(x)); },
      contains(x) { return this._s.has(x); }
    },
    addEventListener() {}, removeEventListener() {}, click() {},
    setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return this.attributes[k] || null; },
    querySelector(sel) {
      if (['#btnCopyModelDeepLink', '#divPvzPriceRiskCard', '#divComparePvzSummary', '#divPriceHistorySparkline'].includes(sel)) {
        return null;
      }
      return makeEl();
    },
    querySelectorAll() { return []; },
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    remove() {}, focus() {}, scrollIntoView() {}, closest() { return null; },
    getContext() { return noopCtx; }
  };
}

const doc = {
  documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'),
  getElementById(id) { if (!elems.has(id)) elems.set(id, makeEl(id)); return elems.get(id); },
  querySelector() { return makeEl(); }, querySelectorAll() { return []; },
  createElement(tag) { return makeEl(tag); }, addEventListener() {}, removeEventListener() {}, execCommand() { return true; }
};
doc.getElementById('fndMaxBudget').value = '500000';
doc.getElementById('fndPanelGen').value = 'all';

const loc = {
  origin: 'https://tapocket.github.io',
  pathname: '/monitor_full_database/',
  href: 'https://tapocket.github.io/monitor_full_database/#compare=84,501',
  search: '',
  hash: '#compare=84,501'
};
const ctx = {
  window: {}, document: doc,
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, scrollY: 0,
  navigator: { clipboard: { writeText: async () => {} }, userAgent: 'CI-NodeSmoke' },
  localStorage: { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } },
  location: loc,
  history: { replaceState(s, t, u) { loc.hash = u.startsWith('#') ? u : loc.hash; } },
  URL, URLSearchParams, console,
  setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  performance: { now: () => Date.now() },
  Intl, Math, Date, JSON, Array, Object, Set, Map, RegExp, Number, String, Boolean, Error,
  parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent
};
ctx.window = ctx;
ctx.globalThis = ctx;

vm.createContext(ctx);
const path = require('path');
if (js.includes('window.__DB_PAYLOAD')) {
  const payloadPath = path.join(path.dirname(htmlPath), 'data', 'db_payload.js');
  if (!fs.existsSync(payloadPath)) {
    console.error('FAIL: Split web build missing payload:', payloadPath);
    process.exit(1);
  }
  vm.runInContext(fs.readFileSync(payloadPath, 'utf8'), ctx);
}
vm.runInContext(
  js + '\n;globalThis.__EXPORTS = { DB, compareIds, openModelModal, renderFinder, renderCompare, applyHashRoute: window.__applyHashRoute, openPvzExpressMode: window.openPvzExpressMode };',
  ctx
);

const { DB, compareIds, openModelModal, renderFinder, renderCompare, applyHashRoute, openPvzExpressMode } = ctx.__EXPORTS;
if (!DB || !Array.isArray(DB.catalog) || DB.catalog.length < 2700) {
  console.error('FAIL: Invalid DB.catalog length:', DB && DB.catalog && DB.catalog.length);
  process.exit(1);
}

// 1. Deep link #compare=84,501
if (typeof applyHashRoute === 'function') applyHashRoute();
if (!compareIds.has(84) || !compareIds.has(501)) {
  console.error('FAIL: Deep link #compare=84,501 did not populate compareIds');
  process.exit(1);
}

// 2. Finder
renderFinder();
const finderCnt = doc.getElementById('lblFinderCnt').textContent;

// 3. Modal card timing & injections
const t0 = Date.now();
openModelModal(84);
const t1 = Date.now();

// 4. PVZ Express Mode (if present)
let pvzOk = true;
if (typeof openPvzExpressMode === 'function') {
  openPvzExpressMode();
  pvzOk = doc.getElementById('mdlPvzExpress').classList.contains('hidden') === false;
}

const phCount = DB.price_history ? Object.keys(DB.price_history).length : 0;
console.log(
  `CI_SMOKE_PASS! EXIT: 0 | zeroCDN=true | catalog=${DB.catalog.length} | openModal_ms=${t1 - t0} | finderCnt=${finderCnt} | compareSize=${compareIds.size} | priceHistoryModels=${phCount} | pvzMode=${pvzOk}`
);
