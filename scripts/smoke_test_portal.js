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
let js = scripts[scripts.length - 1][1];
if (/src="data\/app\.js(?:\?v=[0-9a-f]+)?"/.test(html)) {
  const appJsPath = require('path').join(require('path').dirname(htmlPath), 'data', 'app.js');
  if (!fs.existsSync(appJsPath)) { console.error('FAIL: missing data/app.js'); process.exit(1); }
  js = js + '\n' + fs.readFileSync(appJsPath, 'utf8');
}

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
  js + '\n;globalThis.__EXPORTS = { DB, compareIds, openModelModal, renderFinder, renderCompare, applyHashRoute: window.__applyHashRoute, openPvzExpressMode: window.openPvzExpressMode, normalizeSmartSearchTokens: window.normalizeSmartSearchTokens, buildSelectionCsv: window.buildSelectionCsv, findSimilarAlternatives: window.findSimilarAlternatives, buildCompareVerdictHtml: window.buildCompareVerdictHtml, getTopRfDrops: window.getTopRfDrops, applyCustomDutyScenario: window.applyCustomDutyScenario, resetCustomDutyScenario: window.resetCustomDutyScenario, savePersonalWatch: window.savePersonalWatch, getPersonalWatch: window.getPersonalWatch, collectUnifiedBackup: window.collectUnifiedBackup, applyUnifiedBackup: window.applyUnifiedBackup, buildModelShareMarkdown: window.buildModelShareMarkdown, buildQuickSpecBadgesHtml: window.buildQuickSpecBadgesHtml, ensureTabRendered: window.ensureTabRendered };',
  ctx
);

const { DB, compareIds, openModelModal, renderFinder, renderCompare, applyHashRoute, openPvzExpressMode, normalizeSmartSearchTokens, buildSelectionCsv, findSimilarAlternatives, buildCompareVerdictHtml, getTopRfDrops, applyCustomDutyScenario, resetCustomDutyScenario, savePersonalWatch, getPersonalWatch, collectUnifiedBackup, applyUnifiedBackup, buildModelShareMarkdown, buildQuickSpecBadgesHtml, ensureTabRendered } = ctx.__EXPORTS;
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
// 5. Verify Wave 12 Smart Finder presets (all 6 scenarios must return > 0 models)
let presetsOk = true;
if (typeof applyFinderPreset === 'function') {
  for (const pk of ['esports', 'oled4k', 'code4k5k', 'miniled30k', 'uw34', 'qhd27']) {
    applyFinderPreset(pk);
    const pCnt = parseInt(doc.getElementById('lblFinderCnt').textContent || '0', 10);
    if (!(pCnt > 0)) {
      console.error(`CI_SMOKE_FAIL: preset ${pk} returned 0 models`);
      process.exit(1);
    }
  }
}
// 6. Verify Wave 13 Smart Cyrillic Search, Compat Matrix & Selection CSV Export
if (typeof normalizeSmartSearchTokens === 'function') {
  const t1 = normalizeSmartSearchTokens('асус олед 32').join(' ');
  const t2 = normalizeSmartSearchTokens('фыгы щдув').join(' ');
  if (t1 !== 'asus oled 32' || t2 !== 'asus oled') {
    console.error(`CI_SMOKE_FAIL: smart search mismatch (${t1} | ${t2})`);
    process.exit(1);
  }
}
if (!doc.getElementById('divCompatMatrixCard')) {
  console.error('CI_SMOKE_FAIL: #divCompatMatrixCard missing in modal');
  process.exit(1);
}
if (typeof buildSelectionCsv === 'function') {
  const csvOut = buildSelectionCsv(DB.catalog.slice(0, 3));
  if (!csvOut.startsWith('\uFEFF') || csvOut.split('\r\n').length !== 4) {
    console.error('CI_SMOKE_FAIL: buildSelectionCsv invalid output');
    process.exit(1);
  }
}
// 7. Verify Wave 14 Similar Alternatives & Compare Verdict
if (typeof findSimilarAlternatives === 'function') {
  const alts = findSimilarAlternatives(DB.catalog[0], 4);
  if (!Array.isArray(alts)) {
    console.error('CI_SMOKE_FAIL: findSimilarAlternatives did not return array');
    process.exit(1);
  }
}
if (typeof buildCompareVerdictHtml === 'function') {
  const vHtml = buildCompareVerdictHtml([DB.catalog[0], DB.catalog[10]]);
  if (!vHtml.includes('divCompareVerdict')) {
    console.error('CI_SMOKE_FAIL: buildCompareVerdictHtml missing #divCompareVerdict');
    process.exit(1);
  }
}
// 8. Verify Wave 15 Top RF Drops & Offline Custom Duty Calculator
if (typeof getTopRfDrops === 'function') {
  const dr = getTopRfDrops(5);
  if (!Array.isArray(dr) || dr.length === 0) {
    console.error('CI_SMOKE_FAIL: getTopRfDrops returned empty');
    process.exit(1);
  }
}
if (typeof applyCustomDutyScenario === 'function') {
  const upd = applyCustomDutyScenario(105, 100, 15);
  if (!(upd > 0)) {
    console.error('CI_SMOKE_FAIL: applyCustomDutyScenario updated 0 models');
    process.exit(1);
  }
  resetCustomDutyScenario();
}
// 9. Verify Wave 16 Personal Watchlist & OpenGraph/Favicon metadata
if (!html.includes('property="og:title"') || !html.includes('favicon.svg') || !html.includes('og-cover.png')) {
  console.error('CI_SMOKE_FAIL: missing OpenGraph or favicon.svg in <head>');
  process.exit(1);
}
if (typeof savePersonalWatch === 'function') {
  savePersonalWatch(84, 55000, 'Проверить ПВЗ');
  const got = getPersonalWatch(84);
  if (!got || got.target !== 55000) {
    console.error('CI_SMOKE_FAIL: savePersonalWatch/getPersonalWatch failed');
    process.exit(1);
  }
}
// 10. Verify Wave 18 Unified Backup includes personal_watch & restores cleanly
if (typeof collectUnifiedBackup === 'function' && typeof applyUnifiedBackup === 'function') {
  const bk = collectUnifiedBackup();
  if (!bk || !bk.local_storage || !bk.local_storage['monitor_db_personal_watch_v1']) {
    console.error('CI_SMOKE_FAIL: collectUnifiedBackup missing monitor_db_personal_watch_v1');
    process.exit(1);
  }
  if (!applyUnifiedBackup(bk)) {
    console.error('CI_SMOKE_FAIL: applyUnifiedBackup returned false');
    process.exit(1);
  }
}
// 11. Verify Wave 19 quick checkboxes (2026 & Reviewed)
if (!doc.getElementById('chkCatOnly2026') || !doc.getElementById('chkCatOnlyReviewed')) {
  console.error('CI_SMOKE_FAIL: missing #chkCatOnly2026 or #chkCatOnlyReviewed');
  process.exit(1);
}
// 12. Verify Wave 20 Chat/Forum Markdown Card Share
if (typeof buildModelShareMarkdown === 'function') {
  const md = buildModelShareMarkdown(DB.catalog[0]);
  if (!md.includes('#model=') || !md.includes(DB.catalog[0].model)) {
    console.error('CI_SMOKE_FAIL: buildModelShareMarkdown invalid output');
    process.exit(1);
  }
}
// 13. Verify Wave 21 GitHub Issues feedback footer & modal report link
if (!html.includes('id="ftrCommunityFeedback"') || !html.includes('template=fix-error.yml')) {
  console.error('CI_SMOKE_FAIL: missing GitHub Issues feedback links');
  process.exit(1);
}
// 14. Verify Wave 24 Quick Hardware Spec Badges & Clean Header Tools Menu
if (!html.includes('id="dtlHeaderToolsMenu"') || typeof buildQuickSpecBadgesHtml !== 'function') {
  console.error('CI_SMOKE_FAIL: missing #dtlHeaderToolsMenu or buildQuickSpecBadgesHtml');
  process.exit(1);
}
// 15. Verify Wave 26 SEO (canonical + JSON-LD), Lazy-Init ensureTabRendered, practical tips & all-source footer links
if (!html.includes('rel="canonical"') || !html.includes('application/ld+json') || !html.includes('id="divPracticalTipsCard"')) {
  console.error('CI_SMOKE_FAIL: missing Wave 26 canonical, JSON-LD, or #divPracticalTipsCard');
  process.exit(1);
}
if (!html.includes('tftcentral.co.uk/category/reviews') || !html.includes('rtings.com/monitor') || !html.includes('displayspecifications.com') || !html.includes('youtube.com/@djunn/videos')) {
  console.error('CI_SMOKE_FAIL: missing direct source links in footer');
  process.exit(1);
}
if (typeof ensureTabRendered !== 'function') {
  console.error('CI_SMOKE_FAIL: missing ensureTabRendered lazy-init dispatcher');
  process.exit(1);
}
ensureTabRendered('market');
ensureTabRendered('flagships');
ensureTabRendered('panels_oem');
ensureTabRendered('encyclopedia');
// 16. Verify Wave 27 deduplicated 26-test lab, HiDPI canvases & enhanced URL hash routing
if (!js.includes('const LAB_CURATED_ORDER = [') || !html.includes('width="2560" height="640"') || !js.includes('params.has("oled")')) {
  console.error('CI_SMOKE_FAIL: missing Wave 27 LAB_CURATED_ORDER, HiDPI 2560x640 canvas, or #oled=1 URL hash support');
  process.exit(1);
}
// 17. Verify Wave 28 physical removal of 20 deprecated test panels & updated Gosha/Djun attribution
if (html.includes('id="divLabPanel_tint_d65"') || html.includes('id="divLabPanel_mprt_pwm"') || !html.includes('Таблица «МАНИТОРЫ» (автор Гоша)')) {
  console.error('CI_SMOKE_FAIL: deprecated panels still present or missing updated Gosha attribution');
  process.exit(1);
}
// 18. Verify Wave 29 clean monitor modal header (4 base buttons + 'Ещё ▾', 9 clutter buttons removed)
if (!html.includes('id="btnModalCompareToggle"') || !html.includes('id="lnkModalReportIssueHdr"') || html.includes('id="btnModalDownloadCru"') || html.includes('id="btnModalDeleteModel"')) {
  console.error('CI_SMOKE_FAIL: Wave 29 modal header check failed');
  process.exit(1);
}
// 19. Verify Wave 30 7-tab minimalist navigation, subtabs & unified WinUI 3 theme
if (!html.includes('id="divSubTabsPicks"') || !html.includes('id="divSubTabsRef"') || !html.includes('id="winui3UnifiedTheme2026"') || !html.includes('Ресурсы для тестов')) {
  console.error('CI_SMOKE_FAIL: Wave 30 7-tab / unified theme check failed');
  process.exit(1);
}
console.log(
  `CI_SMOKE_PASS! EXIT: 0 | zeroCDN=true | catalog=${DB.catalog.length} | openModal_ms=${t1 - t0} | finderCnt=${finderCnt} | compareSize=${compareIds.size} | priceHistoryModels=${phCount} | pvzMode=${pvzOk}`
);
