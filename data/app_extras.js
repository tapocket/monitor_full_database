(() => {
const catTabs = document.querySelectorAll('.lab-cat-tab');
const labBtns = Array.from(document.querySelectorAll('.lab-tool-btn'));
const searchInp = document.getElementById('inpLabSearch');
let activeLabCat = 'all';
function classifyLabBtn(btn) {
const txt = (btn.textContent + ' ' + (btn.dataset.labTool || '')).toLowerCase();
if (/пиксел|пвз|сетк|биты|равномерн|тинт|glow|bleed|dse|banding|инверси|помех/.test(txt)) return 'pvz';
if (/ufo|ghost|отклик|overdrive|vrr|гц|hz|mprt|bfi|кадр|лаг|реакц|aim|мыши|24p|строб|вспыш/.test(txt)) return 'motion';
if (/hdr|fald|bloom|abl|градиент|гамма|контраст|цвет|srgb|p3|кожи|ярк|черн|чёрн/.test(txt)) return 'color';
return 'text';
}
labBtns.forEach(b => { b.dataset.labCatGroup = classifyLabBtn(b); });
function filterLabButtons() {
const q = (searchInp ? searchInp.value : '').trim().toLowerCase();
labBtns.forEach(b => {
const matchCat = (activeLabCat === 'all') || (b.dataset.labCatGroup === activeLabCat);
const matchQ = !q || b.textContent.toLowerCase().includes(q);
b.style.display = (matchCat && matchQ) ? '' : 'none';
});
}
catTabs.forEach(t => {
t.addEventListener('click', () => {
activeLabCat = t.dataset.labCat || 'all';
catTabs.forEach(x => {
x.classList.remove('bg-indigo-600', 'text-white');
x.classList.add('bg-slate-700', 'text-slate-200');
});
t.classList.remove('bg-slate-700', 'text-slate-200');
t.classList.add('bg-indigo-600', 'text-white');
filterLabButtons();
});
});
if (searchInp) searchInp.addEventListener('input', filterLabButtons);
let measuredHz = 60;
(function measureOnce() {
let frames = 0, t0 = performance.now();
function tick(now) {
frames++;
if (now - t0 >= 800) {
measuredHz = Math.round((frames * 1000) / (now - t0));
const warn = document.getElementById('lblHz60Warning');
if (warn && measuredHz <= 62) warn.classList.remove('hidden');
return;
}
requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
})();
const mdl = document.getElementById('mdlExpressPvzWizard');
const stage = document.getElementById('pvzStageCanvas');
const stepBadge = document.getElementById('pvzStepBadge');
const stepTitle = document.getElementById('pvzStepTitle');
const btnSub = document.getElementById('btnPvzSubNext');
const btnPrev = document.getElementById('btnPvzPrev');
const btnNext = document.getElementById('btnPvzNext');
const btnClose = document.getElementById('btnPvzClose');
const btnLaunch = document.getElementById('btnLaunchExpressPvzWizard');
if (!mdl || !stage || !btnLaunch) return;
const pixelColors = [
{ name: 'Чёрный (горящие пиксели и засветы)', bg: '#000000', fg: '#94a3b8' },
{ name: 'Белый (тёмные пиксели и тинт)', bg: '#ffffff', fg: '#334155' },
{ name: 'Красный (субпиксель R)', bg: '#ff0000', fg: '#ffffff' },
{ name: 'Зелёный (субпиксель G)', bg: '#00ff00', fg: '#0f172a' },
{ name: 'Синий (субпиксель B)', bg: '#0000ff', fg: '#ffffff' }
];
let stepIdx = 0, subIdx = 0, animId = null;
function stopAnim() { if (animId) { cancelAnimationFrame(animId); animId = null; } }
function renderWizardStep() {
stopAnim();
stepBadge.textContent = `Шаг ${stepIdx + 1} / 5`;
btnSub.classList.add('hidden');
btnNext.textContent = stepIdx === 4 ? '✓ Завершить' : 'Далее →';
if (stepIdx === 0) {
const c = pixelColors[subIdx % pixelColors.length];
stepTitle.textContent = `Битые пиксели — ${c.name}`;
btnSub.classList.remove('hidden');
mdl.style.background = c.bg;
stage.innerHTML = `<div style="color:${c.fg};opacity:0.55;font-size:13px;font-weight:700;">${c.name} — нажмите «Сменить заливку» или пробел</div>`;
} else if (stepIdx === 1) {
stepTitle.textContent = 'Равномерность серого (5% / 10% / 25% / 50% Grey) и сетка координат';
mdl.style.background = '#0d0d0d';
const cells = [];
const cols = ["A","B","C","D","E","F","G","H"];
for (let r = 1; r <= 6; r++) for (let c = 0; c < 8; c++) cells.push(`<div style="border:1px solid rgba(148,163,184,0.22);display:flex;align-items:flex-start;justify-content:flex-start;padding:4px;font-size:10px;color:rgba(148,163,184,0.45);">${cols[c]}${r}</div>`);
stage.innerHTML = `
<div id="pvzGreyGrid" style="display:none;position:absolute;inset:0;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(6,1fr);pointer-events:none;">${cells.join("")}</div>
<div style="position:relative;z-index:2;background:rgba(15,23,42,0.72);padding:12px 16px;border-radius:12px;border:1px solid #334155;max-width:600px;">
<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:8px;">
<button type="button" data-gbg="#0d0d0d" class="pvz-gbtn bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded">5% Grey</button>
<button type="button" data-gbg="#1a1a1a" class="pvz-gbtn bg-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded">10% Grey</button>
<button type="button" data-gbg="#404040" class="pvz-gbtn bg-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded">25% Grey</button>
<button type="button" data-gbg="#808080" class="pvz-gbtn bg-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded">50% Grey</button>
<button type="button" id="btnTogglePvzGrid" class="bg-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded">📐 Сетка A1–H6</button>
</div>
<div style="color:#cbd5e1;font-size:12px;">Переключайте яркость серого для проверки Vertical Banding, DSE и засветов. Включите сетку A1–H6, чтобы зафиксировать точную координату дефекта на фото для ПВЗ.</div>
</div>`;
stage.querySelectorAll(".pvz-gbtn").forEach(b => b.addEventListener("click", () => { mdl.style.background = b.dataset.gbg; }));
const gbtn = document.getElementById("btnTogglePvzGrid");
const gEl = document.getElementById("pvzGreyGrid");
if (gbtn && gEl) gbtn.addEventListener("click", () => { gEl.style.display = (gEl.style.display === "grid") ? "none" : "grid"; });
} else if (stepIdx === 2) {
stepTitle.textContent = 'Равномерность белого и цветовой тинт';
mdl.style.background = '#e5e7eb';
stage.innerHTML = `<div style="color:#475569;font-size:13px;max-width:560px;">Проверьте, нет ли розового/зеленоватого оттенка по краям экрана (Tint) и грязных пятен на однородном светлом фоне (DSE).</div>`;
} else if (stepIdx === 3) {
stepTitle.textContent = `Плавность движения, шлейфы (Ghosting) и реальные Гц (~${measuredHz} Гц)`;
mdl.style.background = '#1e293b';
stage.innerHTML = `<canvas id="pvzMotionCanvas" width="900" height="220" style="max-width:95%;border-radius:12px;border:1px solid #475569;background:#0f172a;"></canvas><div style="color:#cbd5e1;font-size:12px;margin-top:10px;">Фактическая частота браузера: <b style="color:#34d399;">~${measuredHz} Гц</b>. Следите взглядом за бегущим блоком — оценивайте тёмный шлейф и белую корону Overdrive.</div>`;
const cvs = document.getElementById('pvzMotionCanvas');
const ctx = cvs ? cvs.getContext('2d') : null;
let x = 0, lastT = performance.now();
function loop(now) {
const dt = (now - lastT) / 1000; lastT = now;
x = (x + 560 * dt) % (cvs.width + 80);
ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
ctx.fillStyle = '#38bdf8'; ctx.fillRect(x - 60, 40, 56, 56);
ctx.fillStyle = '#f8fafc'; ctx.fillRect(x - 60, 124, 56, 56);
animId = requestAnimationFrame(loop);
}
if (ctx) animId = requestAnimationFrame(loop);
} else {
stepTitle.textContent = 'Итоговый чек-лист приёмки в ПВЗ';
mdl.style.background = '#0f172a';
stage.innerHTML = `<div class="bg-slate-800 border border-slate-600 rounded-2xl p-5 max-w-xl text-left space-y-2.5 text-sm text-slate-100">
<div class="text-base font-extrabold text-emerald-400">📋 Финальная проверка перед выкупом</div>
<label class="flex items-center gap-2"><input type="checkbox" /> Нет ярких горящих пикселей в центре экрана</label>
<label class="flex items-center gap-2"><input type="checkbox" /> Нет резких засветов, пятен давления или обрыва шлейфа</label>
<label class="flex items-center gap-2"><input type="checkbox" /> Частота в Windows выставлена на максимум (сейчас браузер видит ~${measuredHz} Гц)</label>
<label class="flex items-center gap-2"><input type="checkbox" /> Проверен комплект: блок питания, кабели DP/HDMI, отсутствие сколов корпуса</label>
<div class="pt-2 space-y-2 border-t border-slate-700">
<input id="inpPvzReportModel" type="text" placeholder="Модель монитора (например: Innocn GA27T1M)" class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white" />
<button type="button" id="btnPrintPvzReport" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-3 py-2 rounded-lg">🖨 Сохранить PDF-отчёт осмотра ПВЗ</button>
</div>
<div class="text-xs text-amber-300 pt-1">Если обнаружен дефект — оформляйте отказ сразу в ПВЗ до закрытия заказа (ст. 26.1 ЗоЗПП).</div>
</div>`;
const pBtn = document.getElementById("btnPrintPvzReport");
if (pBtn) pBtn.addEventListener("click", () => {
const mTxt = (document.getElementById("inpPvzReportModel")?.value || "Монитор (без названия)");
const checks = [...stage.querySelectorAll("label")].map(l => {
const cb = l.querySelector("input[type=checkbox]");
return `<li>${cb && cb.checked ? "✅" : "❌"} ${l.textContent.trim()}</li>`;
}).join("");
const w = window.open("", "_blank");
if (!w) return;
w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Акт осмотра ПВЗ — ${mTxt}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111;line-height:1.5;}h1{font-size:18px;margin-bottom:4px;}ul{list-style:none;padding:0;}li{margin:6px 0;}</style>
</head><body><h1>Акт экспресс-осмотра монитора в ПВЗ</h1><div><b>Модель:</b> ${mTxt} | <b>Дата:</b> ${new Date().toLocaleString("ru-RU")} | <b>Замер браузера:</b> ~${measuredHz} Гц</div><hr/><ul>${checks}</ul><p style="font-size:12px;color:#444;margin-top:16px;">Сформировано в автономной Тест-Лаборатории monitor_full_database (ст. 26.1 / ст. 18 ЗоЗПП).</p></body></html>`);
w.document.close();
setTimeout(() => { w.focus(); w.print(); }, 150);
});
}
}
function closeWizard() {
stopAnim();
mdl.classList.add('hidden');
if (document.fullscreenElement && document.exitFullscreen) {
document.exitFullscreen().catch(() => {});
}
}
btnLaunch.addEventListener('click', () => {
stepIdx = 0; subIdx = 0;
mdl.classList.remove('hidden');
renderWizardStep();
if (mdl.requestFullscreen) mdl.requestFullscreen().catch(() => {});
});
btnSub.addEventListener('click', () => { subIdx++; renderWizardStep(); });
btnPrev.addEventListener('click', () => { if (stepIdx > 0) { stepIdx--; renderWizardStep(); } });
btnNext.addEventListener('click', () => { if (stepIdx < 4) { stepIdx++; renderWizardStep(); } else closeWizard(); });
btnClose.addEventListener('click', closeWizard);
document.addEventListener('keydown', (e) => {
if (mdl.classList.contains('hidden')) return;
if (e.key === 'Escape') closeWizard();
else if (e.key === 'ArrowRight') { if (stepIdx < 4) { stepIdx++; renderWizardStep(); } }
else if (e.key === 'ArrowLeft') { if (stepIdx > 0) { stepIdx--; renderWizardStep(); } }
else if (e.key === ' ') { e.preventDefault(); if (stepIdx === 0) { subIdx++; renderWizardStep(); } else if (stepIdx < 4) { stepIdx++; renderWizardStep(); } }
});
})();
(() => {
const capsEl = document.getElementById('lblHdrCaps');
if (capsEl) {
const isHdr = window.matchMedia && window.matchMedia('(dynamic-range: high)').matches;
const isP3 = window.matchMedia && window.matchMedia('(color-gamut: p3)').matches;
const is2020 = window.matchMedia && window.matchMedia('(color-gamut: rec2020)').matches;
const depth = (window.screen && window.screen.colorDepth) ? window.screen.colorDepth : 24;
capsEl.textContent = `${isHdr ? '✅ HDR Активен (dynamic-range: high)' : 'ℹ SDR режим (включите HDR в ОС)'} • Охват: ${is2020 ? 'Rec.2020' : (isP3 ? 'Display-P3' : 'sRGB')} • ${depth}-bit`;
}
const aplBox = document.getElementById('divHdrAplBox');
document.querySelectorAll('.hdr-apl-btn').forEach(btn => {
btn.addEventListener('click', () => {
const pct = btn.dataset.apl || '14';
if (aplBox) { aplBox.style.width = pct + '%'; aplBox.style.height = pct + '%'; }
document.querySelectorAll('.hdr-apl-btn').forEach(b => {
b.classList.remove('bg-amber-600', 'text-white');
b.classList.add('bg-slate-700', 'text-slate-200');
});
btn.classList.remove('bg-slate-700', 'text-slate-200');
btn.classList.add('bg-amber-600', 'text-white');
});
});
if (window.location && /^https?:/.test(window.location.protocol)) {
fetch('./data/prices_rf_snapshot.json').then(r => r.ok ? r.json() : null).then(snap => {
if (!snap || !Array.isArray(snap.items) || typeof DB === 'undefined') return;
let updated = 0;
snap.items.forEach(s => {
const key = String(s.model_match || '').toLowerCase();
if (!key) return;
DB.catalog.forEach(m => {
if (String(m.model || '').toLowerCase().includes(key)) {
m.price_retail_rf = s.retail_rf_rub || m.price_retail_rf;
m.price_mp_rf = s.mp_rf_rub || m.price_mp_rf;
m.min_rub = s.min_90d_rub || m.min_rub;
updated++;
}
});
});
if (updated > 0 && typeof showToast === 'function') {
showToast(`🔄 Загружены актуальные цены РФ (${snap.updated_at})`);
}
}).catch(() => {});
if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('./sw.js').catch(() => {});
}
}
})();
(() => {
const _ICC_PROFILES = [{"panel_cell":"AUO M270QAN07.S","panel_type":"27\" 4K 160Hz / FHD 320Hz Fast IPS Mini-LED (S-TW)","example_models":["KTC M27P6S","Innocn GA27V1M MAX","Hisense G9 27G9K"],"recommended_overdrive":"Standard / Level 2 (баланс без Overshoot)","osd_preset":"User / Custom + Local Dimming: High (HDR) / Low или Off (рабочий стол)","srgb_clamp_tip":"Использовать novideo_srgb (NVIDIA) или Windows 11 ACM для честной гаммы 2.20 с открытыми RGB-ползунками","win11_hdr_calib":{"min_nits":0,"max_nits":1400,"max_full_nits":800}},{"panel_cell":"LG Display Primary RGB Tandem WOLED","panel_type":"26.5\"–31.5\" 4th-Gen Tandem WOLED (RGWB / RGB-Stripe)","example_models":["ASUS ROG Swift OLED PG259QWS Ace","ASUS ROG Swift OLED PG32UCWM","LG UltraGear 45GX950A"],"recommended_overdrive":"Не требуется (нативный отклик OLED 0.03–0.1 мс)","osd_preset":"HDR TrueBlack 400/500 (точная кривая PQ EOTF) + Uniform Brightness Вкл в SDR","srgb_clamp_tip":"В режиме sRGB Mode обычно доступна регулировка яркости; для точной гаммы 2.2 лучше профиль Racing/User + Windows ACM","win11_hdr_calib":{"min_nits":0,"max_nits":1300,"max_full_nits":335}},{"panel_cell":"Samsung QD-OLED Gen 3 / Gen 4","panel_type":"26.5\"–31.5\" 4K 240Hz / QHD 360–500Hz QD-OLED","example_models":["MSI MPG 321URX QD-OLED","ASUS ROG Swift OLED PG32UCDM","GIGABYTE AORUS FO32U2P","Samsung Odyssey OLED G8 S32HG802S"],"recommended_overdrive":"Не требуется (0.03 мс GtG)","osd_preset":"TrueBlack 400 (минимальный ABL в играх) или Peak 1000 (кино в темноте)","srgb_clamp_tip":"Встроенный sRGB режим точный (ΔE < 1.5); при работе с текстом включить ClearType / MacType","win11_hdr_calib":{"min_nits":0,"max_nits":1000,"max_full_nits":250}},{"panel_cell":"BOE MV270QHM-NF2 / NF8","panel_type":"27\" QHD 180–240Hz Fast IPS","example_models":["Xiaomi Redmi G27Q 2025/2026","Xiaomi G Pro 27i (с Mini-LED)","Samsung Odyssey G5 S27AG50 (EU)"],"recommended_overdrive":"Fast / Normal (избегать Extreme из-за светлых корон)","osd_preset":"Standard / User, Color Temp: Warm / 6500K","srgb_clamp_tip":"Широкий охват P3 — зажать через novideo_srgb / AMD Adrenalin Color Temp Control Выкл","win11_hdr_calib":{"min_nits":0,"max_nits":1000,"max_full_nits":600}},{"panel_cell":"CSOT SG2701G03-3 / SG3402H03-1","panel_type":"27\" QHD / 34\" UWQHD Fast HVA Mini-LED","example_models":["TCL 27R83U","TCL 34R83Q","Titan Army P275MS+"],"recommended_overdrive":"Medium / Fast (прогреть матрицу 15 мин для минимизации Black Smearing)","osd_preset":"Local Dimming: High (у HVA нативный контраст 4000:1 скрывает ореолы)","srgb_clamp_tip":"Проверить точку белого (часто уходит в холодный ~7000K) и снизить Blue Gain на 3–5 пунктов","win11_hdr_calib":{"min_nits":0,"max_nits":1600,"max_full_nits":800}}];
let _histByModel = {};
if (window.location && /^https?:/.test(window.location.protocol)) {
const ym = new Date().toISOString().slice(0, 7);
fetch(`./data/price_history/${ym}.jsonl`).then(r => r.ok ? r.text() : "").then(txt => {
txt.split(/\r?\n/).forEach(line => {
if (!line.trim()) return;
try {
const rec = JSON.parse(line);
const k = String(rec.model_match || "").toLowerCase();
if (!k) return;
(_histByModel[k] = _histByModel[k] || []).push(rec);
} catch (e) {}
});
}).catch(() => {});
}
function matchIccProfile(item) {
const hay = `${item.pmodel || ""} ${item.ptype || ""} ${item.model || ""}`.toLowerCase();
for (const p of _ICC_PROFILES) {
const cellKey = String(p.panel_cell || "").toLowerCase().split(" ")[0];
if (cellKey.length >= 4 && hay.includes(cellKey)) return p;
if (Array.isArray(p.example_models) && p.example_models.some(ex => hay.includes(String(ex).toLowerCase()))) return p;
}
if (hay.includes("qd-oled")) return _ICC_PROFILES.find(p => p.panel_cell.includes("QD-OLED")) || null;
if (hay.includes("tandem") || hay.includes("woled")) return _ICC_PROFILES.find(p => p.panel_cell.includes("WOLED")) || null;
if (hay.includes("hva") || hay.includes("csot")) return _ICC_PROFILES.find(p => p.panel_cell.includes("CSOT")) || null;
return null;
}
function buildSparklineSvg(points) {
if (!points.length) return "";
const w = 240, h = 44, pad = 6;
const minV = Math.min(...points), maxV = Math.max(...points);
const span = Math.max(1, maxV - minV);
const coords = points.map((v, i) => {
const x = points.length === 1 ? w / 2 : pad + (i / (points.length - 1)) * (w - pad * 2);
const y = h - pad - ((v - minV) / span) * (h - pad * 2);
return `${x.toFixed(1)},${y.toFixed(1)}`;
});
return `<svg viewBox="0 0 ${w} ${h}" class="w-full h-11" style="max-width:260px;"><polyline fill="none" stroke="#10b981" stroke-width="2.2" points="${coords.join(" ")}" />${coords.map(c => `<circle cx="${c.split(",")[0]}" cy="${c.split(",")[1]}" r="2.8" fill="#34d399" />`).join("")}</svg>`;
}
function injectCardAddon(modelObj) {
const body = document.getElementById("mdlBody") || document.querySelector("#mdlDetail .overflow-y-auto");
if (!body || !modelObj) return;
const old = document.getElementById("divModalRfSparklineAndIcc");
if (old) old.remove();
const mp = Number(modelObj.price_mp_rf || modelObj.hand || modelObj.rub || 0);
const retail = Number(modelObj.price_retail_rf || 0);
const min90 = Number(modelObj.min_rub || Math.round(mp * 0.92) || 0);
const histKey = Object.keys(_histByModel).find(k => String(modelObj.model || "").toLowerCase().includes(k));
const histPts = histKey ? _histByModel[histKey].map(x => x.mp_rf_rub || x.retail_rf_rub).filter(Boolean) : [Math.round(mp * 1.05), min90, mp].filter(x => x > 0);
const icc = matchIccProfile(modelObj);
const wrap = document.createElement("div");
wrap.id = "divModalRfSparklineAndIcc";
wrap.className = "mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs";
wrap.innerHTML = `
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
<div class="font-extrabold text-slate-800">📈 Цены РФ (Розница vs Маркетплейсы) и 90-дневный тренд</div>
<div class="flex flex-wrap gap-2 text-[11px]">
<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">МП / Ozon на руки: ${mp ? mp.toLocaleString("ru-RU") + " ₽" : "Н/Д"}</span>
<span class="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">Розница РФ (DNS/Ситилинк): ${retail > 0 ? retail.toLocaleString("ru-RU") + " ₽" : "Под заказ / CN"}</span>
<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Мин. 90 дн.: ${min90 ? min90.toLocaleString("ru-RU") + " ₽" : "Н/Д"}</span>
</div>
${buildSparklineSvg(histPts)}
<div id="divRfWarrantyDiff" class="text-[11px] font-semibold text-slate-700 pt-1">
${retail > 0 && mp > 0 && retail !== mp
? `⚖️ Разница розницы РФ vs МП: <b class="${retail > mp ? "text-amber-700" : "text-emerald-700"}">${retail > mp ? "+" : ""}${(retail - mp).toLocaleString("ru-RU")} ₽ (${retail > mp ? "+" : ""}${Math.round((retail - mp) / mp * 100)}%)</b>`
: "⚖️ Цена едина по каналу поставки"}
</div>
<div class="flex flex-wrap gap-1.5 pt-1">
<a target="_blank" rel="noopener" href="https://github.com/tapocket/monitor_full_database/issues/new?template=new-panel-revision.yml&title=${encodeURIComponent("[Ревизия] " + (modelObj.model || ""))}" class="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">🔍 Сообщить ревизию [CELL]</a>
<a target="_blank" rel="noopener" href="https://github.com/tapocket/monitor_full_database/issues/new?template=price-update-rf.yml&title=${encodeURIComponent("[Цена РФ] " + (modelObj.model || ""))}" class="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">💰 Обновить цену РФ</a>
</div>
</div>
<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
<div class="flex items-center justify-between gap-2">
<div class="font-extrabold text-slate-800">🎨 Эталонный пресет OSD / ICC по матрице</div>
${icc ? `<div class="flex gap-1"><button type="button" id="btnCopyIccPreset" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">📋 Копировать</button><button type="button" id="btnDownloadIccTxt" class="bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold px-2 py-0.5 rounded">💾 .txt</button></div>` : ""}
</div>
${icc ? `
<div class="text-[11px] text-slate-700 space-y-1">
<div><b>Панель:</b> ${icc.panel_cell}</div>
<div><b>Overdrive:</b> ${icc.recommended_overdrive}</div>
<div><b>OSD:</b> ${icc.osd_preset}</div>
<div><b>Win11 HDR:</b> Min ${icc.win11_hdr_calib.min_nits} / Max ${icc.win11_hdr_calib.max_nits} / Full ${icc.win11_hdr_calib.max_full_nits} нит</div>
</div>
` : `<div class="text-[11px] text-slate-500">Точный профиль ICC для этой панели ещё собирается — ориентируйтесь на блок калибровки выше.</div>`}
</div>
`;
body.prepend(wrap);
const cbtn = document.getElementById("btnCopyIccPreset");
const dbtn = document.getElementById("btnDownloadIccTxt");
if (dbtn && icc) {
dbtn.addEventListener("click", () => {
const txt = `Профиль калибровки и OSD: ${modelObj.model}\nПанель [CELL]: ${icc.panel_cell}\nOverdrive: ${icc.recommended_overdrive}\nOSD: ${icc.osd_preset}\nsRGB Clamp: ${icc.srgb_clamp_tip}\nWindows 11 HDR: Min ${icc.win11_hdr_calib.min_nits} / Max ${icc.win11_hdr_calib.max_nits} / Full ${icc.win11_hdr_calib.max_full_nits} нит\n`;
const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = `${String(modelObj.model || "monitor").replace(/[^a-zA-Z0-9_-]+/g, "_")}_OSD_ICC.txt`;
a.click();
if (typeof showToast === "function") showToast("💾 Файл пресета OSD/ICC сохранён!");
});
}
if (cbtn && icc) {
cbtn.addEventListener("click", () => {
const txt = `${modelObj.model} (${icc.panel_cell})\nOverdrive: ${icc.recommended_overdrive}\nOSD: ${icc.osd_preset}\nsRGB: ${icc.srgb_clamp_tip}\nWin11 HDR: Min ${icc.win11_hdr_calib.min_nits} / Max ${icc.win11_hdr_calib.max_nits} / Full ${icc.win11_hdr_calib.max_full_nits}`;
if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { if (typeof showToast === "function") showToast("🎨 Пресет OSD / ICC скопирован!"); });
});
}
}
if (typeof openModelModal === "function") {
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen(id);
try {
const item = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === Number(id)) : null;
if (item) injectCardAddon(item);
} catch (e) {}
};
}
})();
(() => {
const btn = document.getElementById("btnFilterMin90d");
if (!btn) return;
btn.addEventListener("click", () => {
const searchEl = document.getElementById("inpSearch") || document.querySelector("input[type=search], input[placeholder*=Поиск]");
if (searchEl) {
searchEl.value = "OLED";
searchEl.dispatchEvent(new Event("input", { bubbles: true }));
}
if (typeof showToast === "function") showToast("🔥 Показаны актуальные OLED-модели со сверкой цен РФ (DNS / Ситилинк / Ozon)");
});
})();
(() => {
const _origPrompt = window.prompt;
let _cachedRfSnap = null;
async function getSnap() {
if (_cachedRfSnap) return _cachedRfSnap;
try {
if (window.location && /^https?:/.test(window.location.protocol)) {
const r = await fetch("./data/prices_rf_snapshot.json?t=" + Date.now());
if (r.ok) _cachedRfSnap = await r.json();
}
} catch (e) {}
return _cachedRfSnap;
}
getSnap();
window.prompt = function(message, defaultVal) {
const msg = String(message || "");
if (msg.includes("CORS/Captcha") || msg.includes("витрины (₽)")) {
if (_cachedRfSnap && Array.isArray(_cachedRfSnap.items)) {
const urlMatch = msg.match(/https?:\/\/[^\s]+/);
const targetUrl = urlMatch ? urlMatch[0] : "";
const hit = _cachedRfSnap.items.find(it =>
(it.url && targetUrl && targetUrl.includes(it.url.split("?")[0])) ||
(it.model_match && msg.toLowerCase().includes(String(it.model_match).toLowerCase()))
);
if (hit && (hit.mp_rf_rub || hit.retail_rf_rub)) {
const p = hit.mp_rf_rub || hit.retail_rf_rub;
if (typeof showToast === "function") showToast(`✅ Цена обновлена из серверного снимка РФ (${hit.store}): ${p.toLocaleString("ru-RU")} ₽`);
return String(p);
}
}
const mdl = document.getElementById("mdlSmartPriceSync");
const info = document.getElementById("lblSmartPriceInfo");
const inp = document.getElementById("inpSmartPriceVal");
const lnk = document.getElementById("lnkSmartStoreOpen");
if (mdl && info && inp) {
const urlMatch = msg.match(/https?:\/\/[^\s]+/);
info.textContent = "Прямой запрос из браузера к маркетплейсам ограничен политикой CORS. Введите цену с витрины вручную или обновите серверный снимок prices_rf_snapshot.json (через VPS / GitHub Actions).";
inp.value = defaultVal || "";
if (lnk) {
if (urlMatch) { lnk.href = urlMatch[0]; lnk.classList.remove("hidden"); }
else { lnk.classList.add("hidden"); }
}
mdl.classList.remove("hidden");
const close = () => mdl.classList.add("hidden");
document.getElementById("btnCloseSmartPrice").onclick = close;
document.getElementById("btnCancelSmartPrice").onclick = close;
document.getElementById("btnSaveSmartPrice").onclick = () => {
const val = Number(inp.value);
if (val > 0 && typeof showToast === "function") {
showToast(`💾 Цена ${val.toLocaleString("ru-RU")} ₽ сохранена локально`);
}
close();
};
return null;
}
}
return _origPrompt.apply(window, arguments);
};
})();
/* MODERN_UI_TESTLAB_JS_START */
(function() {
/* === UNIVERSAL 3x HiDPI SUPER-SAMPLING ENGINE FOR ALL 41 TEST CANVASES === */
function upgradeAllLabCanvasesHiDPI() {
try {
const lab = document.getElementById("divBuiltInTestLab");
if (!lab || typeof HTMLCanvasElement === "undefined") return;
const protoW = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width");
const protoH = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
if (!protoW || !protoH || !protoW.set || !protoH.set) return;
const canvases = Array.from(lab.querySelectorAll("canvas"));
canvases.forEach(cnv => {
if (cnv._hidpiUpgraded) return;
const origW = Number(cnv.getAttribute("width")) || protoW.get.call(cnv) || 960;
const origH = Number(cnv.getAttribute("height")) || protoH.get.call(cnv) || 250;
const scale = origW >= 1400 ? 2 : 3;
let logicalW = origW;
let logicalH = origH;
protoW.set.call(cnv, Math.round(logicalW * scale));
protoH.set.call(cnv, Math.round(logicalH * scale));
cnv.dataset.hidpiScale = String(scale);
cnv.dataset.physW = String(Math.round(logicalW * scale));
cnv.dataset.physH = String(Math.round(logicalH * scale));
const origGetCtx = cnv.getContext.bind(cnv);
cnv.getContext = function(type, opts) {
const ctx = origGetCtx(type, opts);
if (type === "2d" && ctx && typeof ctx.setTransform === "function") {
ctx.setTransform(scale, 0, 0, scale, 0, 0);
try {
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
} catch (e) {}
}
return ctx;
};
try {
Object.defineProperty(cnv, "width", {
configurable: true,
get() { return logicalW; },
set(v) {
const nv = Math.max(1, Number(v) || origW);
logicalW = nv;
const pw = Math.round(nv * scale);
protoW.set.call(cnv, pw);
cnv.dataset.physW = String(pw);
const ctx = origGetCtx("2d");
if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
});
Object.defineProperty(cnv, "height", {
configurable: true,
get() { return logicalH; },
set(v) {
const nv = Math.max(1, Number(v) || origH);
logicalH = nv;
const ph = Math.round(nv * scale);
protoH.set.call(cnv, ph);
cnv.dataset.physH = String(ph);
const ctx = origGetCtx("2d");
if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
});
} catch (e) {}
cnv._hidpiUpgraded = true;
});
const redrawNames = [
"renderSharpnessAndSiemensCanvas",
"drawLabOffAxisGlowCanvas", "drawLabHdrClippingCanvas", "drawLabTintD65Canvas",
"drawLabSubpixelFringingCanvas", "drawLabFlashbangFaldCanvas", "drawLabPixelGridPhotoCanvas",
"drawLabAblWindowSizerCanvas", "drawLabFontScalingPpiCanvas", "drawLabReactionLagCanvas",
"drawLabBitDepthRampCanvas", "drawLabRealSizeRulerCanvas", "drawLabFaldStarfieldCanvas",
"drawLabNearBlackBandingCanvas", "drawLabPsuAplTortureCanvas", "drawLabAimFrametimeCanvas",
"drawLabColorBlindHueCanvas", "drawLabVaGammaConeCanvas", "drawLabChroma444Canvas",
"drawLabAudioStereoDacCanvas", "drawLabMousePollingSyncCanvas", "drawLabCornerConvergenceCanvas",
"drawLabDscHandshakeTimerCanvas", "drawLabCodeExcelThemesCanvas", "drawLabAspectCropSimCanvas",
"drawLabGlowBleedDetectorCanvas", "drawLabHdrAplClippingCanvas", "drawLabSmoothPursuitTrainerCanvas",
"drawLabNineZoneTintCanvas", "drawLabPixelWalkInversionCanvas", "drawLabNearBlackCrushCanvas",
"drawLabFaldCursorBloomCanvas", "drawLabSrgbP3ClampCanvas"
];
redrawNames.forEach(fnName => {
try {
const fn = (typeof window !== "undefined" && typeof window[fnName] === "function") ? window[fnName] : null;
if (fn) fn();
} catch (e) {}
});
} catch (e) {}
}
function setupCleanHeaderMenu() {
try {
const header = document.querySelector("header");
if (!header || document.getElementById("btnHeaderToolsMenu")) return;
const secondaryIds = [
"btnToggleCalc",
"btnSyncLivePrices",
"btnOpenGpuCalc",
"btnOpenMultiMonCalc",
"btnOpenShareSelectionModal",
"btnOpenCmdPalette",
"btnOpenPwaModal",
"btnOpenManageDb"
];
const btnCompare = document.getElementById("btnGoCompare");
const toolbar = btnCompare && btnCompare.parentElement;
if (!toolbar) return;
const wrap = document.createElement("div");
wrap.className = "hdr-tools-popover";
const toggleBtn = document.createElement("button");
toggleBtn.id = "btnHeaderToolsMenu";
toggleBtn.type = "button";
toggleBtn.className = "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5";
toggleBtn.innerHTML = "🛠️ Инструменты <span class='text-[10px] opacity-75'>▾</span>";
toggleBtn.title = "Дополнительные инструменты: калькулятор пошлины, GPU/кабель, 2–3 экрана, бэкап, управление базой";
const menu = document.createElement("div");
menu.id = "divHeaderToolsDropdown";
menu.className = "hdr-tools-menu";
secondaryIds.forEach(id => {
const b = document.getElementById(id);
if (b) {
menu.appendChild(b);
b.addEventListener("click", () => menu.classList.remove("open"));
}
});
toggleBtn.addEventListener("click", (e) => {
if (e && e.stopPropagation) e.stopPropagation();
menu.classList.toggle("open");
});
document.addEventListener("click", (e) => {
if (menu.classList.contains("open") && e && e.target && !wrap.contains(e.target)) {
menu.classList.remove("open");
}
});
wrap.appendChild(toggleBtn);
wrap.appendChild(menu);
toolbar.insertBefore(wrap, btnCompare);
} catch (e) {}
}
const LAB_CURATED_ORDER = [
{ id: "pixels", label: "1. 🔲 Битые пиксели, заливки и 5% серый (OLED)" },
{ id: "glow_bleed_detector", label: "2. 🔦 IPS Glow vs Backlight Bleed и углы обзора" },
{ id: "nine_zone_tint", label: "3. ⚖️ 9-зонный тинт и равномерность белого 6500K" },
{ id: "pixel_grid_photo", label: "4. 📸 Сетка секторов (A1–H6) для фото дефектов в ПВЗ" },
{ id: "audio_stereo_dac", label: "5. 🔊 Динамики L/R, фаза и 3.5 мм ЦАП монитора" },
{ id: "ufo", label: "6. 🛸 UFO: отклик, шлейфы, Overdrive и пропуск кадров" },
{ id: "hz_divider", label: "7. 🏁 Сравнение 60 vs 120 vs 240 vs Макс. Гц" },
{ id: "vrr_coil", label: "8. 📉 VRR Flicker (G-Sync / FreeSync) и писк БП" },
{ id: "strobe_crosstalk", label: "9. ⚡ Строб BFI / DyAc / Pulsar (Strobe Crosstalk 5 зон)" },
{ id: "pixel_walk_inversion", label: "10. 🏁 Инверсия пикселей (Pixel Walk / Vcom Flicker)" },
{ id: "reaction_lag", label: "11. 🎯 Время реакции и задержка кадра (60–540 Гц)" },
{ id: "dsc_handshake_timer", label: "12. ⏱ Секундомер Alt+Tab и задержки DSC 1.2a" },
{ id: "mouse_polling_sync", label: "13. 🖱 Частота опроса мыши (125–8000 Гц) и синхронизация" },
{ id: "cinema_judder", label: "14. 🎬 Детектор рывков кино 24p (3:2 Pulldown Judder)" },
{ id: "fald", label: "15. 🌑 Ореолы зон Mini-LED (FALD Blooming) и OLED ABL" },
{ id: "near_black_banding", label: "16. 🌫 Однородность 1%–15% серого (OLED Banding и Black Crush)" },
{ id: "real_hdr", label: "17. 🌞 Реальный HDR (окна APL 2%–100% и клиппинг PQ)" },
{ id: "gradients", label: "18. 🌈 Градиенты 8/10-бит, тени (RGB 1–24) и света (235–254)" },
{ id: "srgb_p3_clamp", label: "19. 🎨 Перенасыщение Wide-Gamut P3, sRGB Clamp и Windows ACM" },
{ id: "color_blind_hue", label: "20. 👁 Различимость оттенков (Hue Step 1°–5°) и цветовое зрение" },
{ id: "sharpness_geo", label: "21. 🎯 Резкость (Sharpness), сетка 1:1 и Звезда Сименса" },
{ id: "subpixel_fringing", label: "22. 🔬 Микроскоп субпикселей и цветной каймы OLED (1px)" },
{ id: "chroma_444", label: "23. 🔤 Chroma 4:4:4 vs 4:2:0 и микротекст 6–14px" },
{ id: "code_excel_themes", label: "24. ⌨️ Чтение кода (IDE), Excel и масштабирование шрифтов" },
{ id: "real_size_ruler", label: "25. 📐 Экранная линейка (см / дюймы) и сравнение 24″–34″" },
{ id: "aspect_crop_sim", label: "26. 🖥 Режимы скейлинга, Dual-Mode и кроп 24.5″ / 21:9" }
];
const LAB_CURATED_MAP = new Map(LAB_CURATED_ORDER.map((x, idx) => [x.id, { ...x, num: idx + 1 }]));
const LAB_CATEGORIES = [
{ id: "pvz", label: "🔍 1. Приёмка ПВЗ (1–5)", tools: ["pixels", "glow_bleed_detector", "nine_zone_tint", "pixel_grid_photo", "audio_stereo_dac"] },
{ id: "motion", label: "⚡ 2. Отклик, Гц и VRR (6–14)", tools: ["ufo", "hz_divider", "vrr_coil", "strobe_crosstalk", "pixel_walk_inversion", "reaction_lag", "dsc_handshake_timer", "mouse_polling_sync", "cinema_judder"] },
{ id: "oled_color", label: "🌑 3. OLED, HDR и Цвет (15–20)", tools: ["fald", "near_black_banding", "real_hdr", "gradients", "srgb_p3_clamp", "color_blind_hue"] },
{ id: "text", label: "🔤 4. Резкость и Шрифты (21–26)", tools: ["sharpness_geo", "subpixel_fringing", "chroma_444", "code_excel_themes", "real_size_ruler", "aspect_crop_sim"] },
{ id: "all", label: "📦 Все 26 тестов (1–26)", tools: LAB_CURATED_ORDER.map(x => x.id) }
];
const LAB_GUIDES = {
pixels: {
title: "Битые пиксели, засветы и 5% серый (OLED)",
check: "Откройте полноэкранные заливки (Белый, Чёрный, Красный, Зелёный, Синий, 5% Серый) и осмотрите экран с 40–50 см.",
ok: "Однородное поле без светящихся цветных точек; лёгкое свечение углов IPS (IPS Glow) исчезает при взгляде перпендикулярно.",
bad: "Яркие «горящие» субпиксели в центре, тёмные пятна/пыль под матрицей или резкие вертикальные полосы на 5% сером у OLED."
},
ufo: {
title: "Отклик матрицы, шлейфы и Overdrive (UFO • 2560×640 HiDPI)",
check: "Следите взглядом за движущимся НЛО на тёмном, сером и светлом фоне; подберите режим Overdrive в меню монитора.",
ok: "Контуры НЛО и 3 жёлтых окна чёткие, без длинного чёрного хвоста (на VA) и без белых/инверсных ореолов на светлом фоне.",
bad: "Тёмные разводы на чёрном (VA Black Smearing) или яркие белые контуры позади НЛО — снизьте Overdrive на 1 ступень."
},
fald: {
title: "Ореолы зон Mini-LED (FALD Blooming • 2560×740 HiDPI) и OLED ABL",
check: "Перемещайте светлый объект на абсолютно чёрном фоне при высокой яркости (особенно в HDR).",
ok: "Чёткий контур без широкого серого облака вокруг; на OLED ореолы отсутствуют полностью (0%).",
bad: "Крупные квадратные засветы вокруг курсора или сильное «дыхание» яркости на соседних участках."
},
gradients: {
title: "Градиенты 8/10-бит, тени (RGB 1–24) и света",
check: "Проверьте плавность переходов и видимость самых тёмных квадратов RGB 2–8 на расстоянии работы.",
ok: "Плавный переход без резких ступенек (бандинга); различимы оттенки начиная с RGB 3–5 и выше.",
bad: "Все тёмные квадраты сливаются в чёрный (Black Crush) или видны грубые цветные полосы — проверьте режим 10-bit и Full RGB 0–255."
},
sharpness_geo: {
title: "Резкость (Sharpness), сетка 1:1 и Звезда Сименса (2560×640 HiDPI)",
check: "Смотрите на тонкие линии 1 px и центр звезды Сименса в родном разрешении монитора (масштаб 100%).",
ok: "Линии ровные без двойных белых контуров; в центре звезды нет цветного муара.",
bad: "Белые ореолы вокруг линий — резкость (Sharpness) в OSD завышена, снизьте до заводского нейтрального значения (обычно 50 или 0)."
},
vrr_coil: {
title: "Мерцание VRR (G-Sync / FreeSync Flicker) и писк БП",
check: "Запустите тест на тёмно-сером фоне при включённом VRR и прислушайтесь к задней стенке монитора.",
ok: "Ровная яркость без пульсаций в тёмных участках, отсутствие высокочастотного писка дросселей.",
bad: "Заметное мерцание яркости на тёмно-сером (особенность OLED/VA при скачках FPS) — ограничьте FPS чуть ниже Гц или включите VRR Anti-Flicker."
},
near_black_banding: {
title: "Однородность 1%–15% серого (OLED Banding & DSE)",
check: "В полумраке оцените равномерность полос 2%, 5%, 10% серого по всей ширине экрана.",
ok: "Плавное поле; у нового OLED лёгкая неравномерность часто выравнивается после 1–2 циклов Pixel Refresh.",
bad: "Резкие вертикальные тёмные/розовые полосы, заметные в тёмных интерфейсах и играх даже после очистки пикселей."
},
real_hdr: {
title: "Реальный HDR и удержание яркости (окна APL 2%–100%)",
check: "Включите HDR в Windows (Win+Alt+B) и переключайте размер белого окна от 2% до 100%.",
ok: "Окна 2–10% заметно ярче обычного SDR, детали в светах не сливаются в одно белое пятно.",
bad: "Тусклая серая картинка (откалибруйте через Windows HDR Calibration) или агрессивное падение яркости при открытии окон."
}
};
function setupNativeTestLab() {
try {
const lab = document.getElementById("divBuiltInTestLab");
if (!lab || document.getElementById("divModernLabCategories")) return;
const btnWrap = document.getElementById("divLabToolButtonsWrap");
const toolBtns = Array.from(lab.querySelectorAll(".lab-tool-btn[data-lab-tool]"));
if (!btnWrap || !toolBtns.length) return;
const catBar = document.createElement("div");
catBar.id = "divModernLabCategories";
catBar.className = "flex flex-wrap items-center gap-1.5 pt-1";
const btnByTool = new Map(toolBtns.map(b => [b.dataset.labTool, b]));
toolBtns.forEach(btn => {
const meta = LAB_CURATED_MAP.get(btn.dataset.labTool);
if (!meta) {
btn.setAttribute("data-lab-deprecated", "1");
btn.style.display = "none";
} else {
btn.textContent = meta.label;
btn.removeAttribute("data-lab-deprecated");
const panel = document.getElementById("divLabPanel_" + meta.id);
if (panel) {
const hEl = panel.querySelector(".font-bold.text-sm");
if (hEl && /Стенд №\d+/.test(hEl.textContent)) {
hEl.textContent = hEl.textContent.replace(/Стенд №\d+/, "Стенд №" + meta.num);
}
}
}
});
LAB_CURATED_ORDER.forEach(item => {
const b = btnByTool.get(item.id);
if (b && btnWrap.appendChild) btnWrap.appendChild(b);
});
let activeCatId = "pvz";
function applyCategory(catId) {
activeCatId = catId;
const cat = LAB_CATEGORIES.find(c => c.id === catId) || LAB_CATEGORIES[0];
catBar.querySelectorAll(".lab-cat-pill").forEach(p => {
p.classList.toggle("active", p.dataset.catId === cat.id);
});
let firstVisible = null;
toolBtns.forEach(btn => {
const t = btn.dataset.labTool;
const show = !cat.tools || cat.tools.includes(t);
if (show) {
btn.removeAttribute("data-cat-hidden");
btn.classList.remove("hidden");
if (!firstVisible) firstVisible = btn;
} else {
btn.setAttribute("data-cat-hidden", "1");
}
});
const activeBtn = toolBtns.find(b => b.className.indexOf("bg-indigo-600") !== -1);
if ((!activeBtn || activeBtn.getAttribute("data-cat-hidden") === "1") && firstVisible) {
firstVisible.click();
}
}
LAB_CATEGORIES.forEach(cat => {
const pill = document.createElement("button");
pill.type = "button";
pill.className = "lab-cat-pill";
pill.dataset.catId = cat.id;
pill.textContent = cat.label;
pill.addEventListener("click", () => applyCategory(cat.id));
catBar.appendChild(pill);
});
const guideCard = document.createElement("div");
guideCard.id = "divLabNativeGuideCard";
guideCard.className = "flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs";
guideCard.innerHTML = '<div class="space-y-1 flex-1">'
+ '<div class="flex flex-wrap items-center gap-2">'
+ '<span id="lblLabGuideTitle" class="font-extrabold text-sky-300 text-sm">Битые пиксели, засветы и 5% серый</span>'
+ '<span id="lblLabCanvasResBadge" class="bg-slate-800 border border-slate-600 text-slate-300 px-2 py-0.5 rounded-md text-[11px] font-semibold">Экран: 1:1 HiDPI</span>'
+ '</div>'
+ '<div id="lblLabGuideCheck" class="text-slate-300"></div>'
+ '<div class="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">'
+ '<span class="text-emerald-300"><b>✅ Норма:</b> <span id="lblLabGuideOk" class="text-slate-200"></span></span>'
+ '<span class="text-rose-300"><b>❌ Брак / внимание:</b> <span id="lblLabGuideBad" class="text-slate-200"></span></span>'
+ '</div></div>'
+ '<div class="flex items-center gap-2 shrink-0">'
+ '<button type="button" id="btnLabActiveFullscreen" class="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3.5 py-2 rounded-xl shadow text-xs transition">⛶ Активный стенд на весь экран</button>'
+ '</div>';
btnWrap.parentElement.insertBefore(catBar, btnWrap);
btnWrap.parentElement.insertBefore(guideCard, btnWrap.nextSibling);
function updateGuide(toolId, btnText) {
const g = LAB_GUIDES[toolId] || {
title: (btnText || toolId).replace(/^\d+\.\s*/, ""),
check: "Оцените тестовый паттерн в родном разрешении монитора (масштаб браузера 100%) на рабочем расстоянии.",
ok: "Ровная геометрия, плавные переходы без артефактов, стабильная картинка без мерцания.",
bad: "Выраженные полосы, двоение контуров, засветы или пропуск кадров — проверьте кабель DP/HDMI, Гц и режим Overdrive."
};
const tEl = document.getElementById("lblLabGuideTitle");
const cEl = document.getElementById("lblLabGuideCheck");
const oEl = document.getElementById("lblLabGuideOk");
const bEl = document.getElementById("lblLabGuideBad");
const rEl = document.getElementById("lblLabCanvasResBadge");
if (tEl) tEl.textContent = g.title;
if (cEl) cEl.textContent = "Что проверять: " + g.check;
if (oEl) oEl.textContent = g.ok;
if (bEl) bEl.textContent = g.bad;
const panel = document.getElementById("divLabPanel_" + toolId);
const cnv = panel ? panel.querySelector("canvas") : null;
const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? Number(window.devicePixelRatio).toFixed(2).replace(/\.00$/, "") : "1";
if (rEl) {
const pw = (cnv && cnv.dataset && cnv.dataset.physW) ? cnv.dataset.physW : (cnv ? cnv.width : 0);
const ph = (cnv && cnv.dataset && cnv.dataset.physH) ? cnv.dataset.physH : (cnv ? cnv.height : 0);
const sc = (cnv && cnv.dataset && cnv.dataset.hidpiScale) ? cnv.dataset.hidpiScale : "1";
rEl.textContent = cnv
? "Холст: " + pw + "×" + ph + " px (HiDPI " + sc + "× суперсэмплинг)"
: "Режим: нативный 1:1 • DPR " + dpr + "×";
}
}
let currentToolId = "pixels";
toolBtns.forEach(btn => {
btn.addEventListener("click", () => {
currentToolId = btn.dataset.labTool;
updateGuide(currentToolId, btn.textContent.trim());
});
});
const searchInp = document.getElementById("inpLabSearch");
if (searchInp) {
searchInp.addEventListener("input", () => {
const q = (searchInp.value || "").trim().toLowerCase();
if (q) {
toolBtns.forEach(btn => {
const match = btn.textContent.toLowerCase().indexOf(q) !== -1 || (btn.dataset.labTool || "").toLowerCase().indexOf(q) !== -1;
if (match) btn.removeAttribute("data-cat-hidden");
else btn.setAttribute("data-cat-hidden", "1");
});
} else {
applyCategory(activeCatId);
}
});
}
const btnFs = document.getElementById("btnLabActiveFullscreen");
if (btnFs) {
btnFs.addEventListener("click", () => {
const panel = document.getElementById("divLabPanel_" + currentToolId);
const target = (panel && panel.querySelector("canvas")) || panel || lab;
try {
if (target && target.requestFullscreen) target.requestFullscreen();
} catch (e) {}
});
}
document.addEventListener("fullscreenchange", () => {
const activeBtn = lab.querySelector('.lab-tool-btn[data-lab-tool="' + currentToolId + '"]');
if (activeBtn) setTimeout(() => activeBtn.click(), 60);
});
applyCategory("pvz");
updateGuide("pixels", "");
} catch (e) {}
}
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", () => {
setupCleanHeaderMenu();
upgradeAllLabCanvasesHiDPI();
setupNativeTestLab();
});
} else {
setupCleanHeaderMenu();
upgradeAllLabCanvasesHiDPI();
setupNativeTestLab();
}
})();
/* FULL_GUIDED_TEST_SUITE_JS_START */
(function() {
const STEPS = [
{
id: "pixels",
title: "1. Битые и горящие пиксели (клик по экрану меняет цвет)",
check: "Кликайте по экрану (или выбирайте цвет ниже) и осмотрите матрицу с 40–50 см. Нажмите H, чтобы убрать панель.",
ok: "Чистое однородное поле без светящихся точек и чёрных пылинок.",
bad: "Постоянно горящий цветной субпиксель или чёрная точка в центральной зоне.",
modes: [
{ k: "white", l: "Белый" }, { k: "black", l: "Чёрный" },
{ k: "red", l: "Красный" }, { k: "green", l: "Зелёный" }, { k: "blue", l: "Синий" },
{ k: "cyan", l: "Бирюзовый" }, { k: "magenta", l: "Пурпурный" }, { k: "yellow", l: "Жёлтый" }
]
},
{
id: "glow",
title: "2. Засветы по краям и IPS Glow",
check: "Приглушите свет, посмотрите на углы прямо по центру, затем отклонитесь на 30°.",
ok: "Мягкое свечение IPS исчезает при взгляде перпендикулярно; на OLED — абсолютный чёрный.",
bad: "Резкие жёлтые/белые «фонарики» у рамки (Backlight Bleed), не исчезающие под прямым углом.",
modes: [{ k: "pure", l: "Чистый чёрный" }, { k: "markers", l: "С разметкой углов" }]
},
{
id: "oled_grey",
title: "3. Однородность серого, OLED Banding и выгорание (Burn-In)",
check: "5% серый выявляет вертикальные полосы WOLED/DSE; 25% и 50% серый — следы выгорания панели задач.",
ok: "Ровное серое поле без резких полос и отпечатков статичных окон.",
bad: "Заметные вертикальные полосы (vertical banding) или остаточные контуры интерфейса.",
modes: [{ k: "5", l: "5% Серый (Banding)" }, { k: "10", l: "10% Серый" }, { k: "25", l: "25% Серый (Burn-In)" }, { k: "50", l: "50% Серый (DSE)" }]
},
{
id: "tint",
title: "4. Баланс белого D65 и цветовой тинт (9 зон)",
check: "Сравните левую, центральную и правую части белого поля на предмет розового/зелёного сдвига.",
ok: "Одинаковая нейтральная температура белого по всей ширине экрана.",
bad: "Одна половина экрана заметно розовит, а другая зеленит/желтит.",
modes: [{ k: "grid", l: "9 зон с сеткой" }, { k: "clean", l: "Сплошной белый D65" }]
},
{
id: "gradients",
title: "5. Градиенты 8/10-бит, Тени (Black Crush) и Света",
check: "Оцените плавность градиента и видимость тёмных квадратов RGB 1–16 и светлых RGB 240–255.",
ok: "Плавный переход без грубых ступенек; различимы оттенки начиная с RGB 3–5.",
bad: "Квадраты RGB 2–10 сливаются в чёрный или видны резкие цветные полосы (проверьте 10-bit и Full RGB).",
modes: [{ k: "gray", l: "Серый + Тени/Света" }, { k: "rgb", l: "RGB-градиенты" }]
},
{
id: "ufo",
title: "6. Отклик матрицы, Шлейфы, Overdrive (UFO) + Осциллограф Frame-Time",
check: "Следите глазами за НЛО на 3 фонах; справа сверху показан живой график стабильности кадров (мс).",
ok: "Чёткий силуэт НЛО без чёрных хвостов (VA) и белых ореолов (Overshoot), ровная линия Frame-Time.",
bad: "Тёмные разводы на чёрном или яркие белые контуры позади НЛО — снизьте Overdrive на 1 шаг.",
modes: [{ k: "960", l: "960 px/s" }, { k: "1440", l: "1440 px/s (240+ Гц)" }, { k: "1920", l: "1920 px/s (TestUFO 3.0)" }]
},
{
id: "hz_compare",
title: "7. Сравнение герцовок (Макс. Гц vs ÷2 vs ÷4) и Sample-and-Hold",
check: "Сравните чёткость контуров и текста на 3 полосах с разной частотой кадров прямо на вашем экране.",
ok: "Верхняя полоса (родные Гц) заметно чётче и плавнее нижних — высокая герцовка реально работает.",
bad: "Все 3 полосы выглядят одинаково размытыми — проверьте, что в Windows выставлена максимальная частота.",
modes: [{ k: "960", l: "960 px/s" }, { k: "1440", l: "1440 px/s" }, { k: "bfi", l: "Демо BFI (строб)" }]
},
{
id: "frameskip",
title: "8. Пропуск кадров (Frame Skipping) и реальная частота Гц",
check: "Снимите бегущий квадрат на камеру смартфона с выдержкой 1/10–1/15 сек — следите за пропусками.",
ok: "Непрерывная цепочка белых квадратов подряд и ровная линия на графике Frame-Time.",
bad: "Чёрные разрывы внутри цепочки (пропуск кадров) или частота застряла на 60 Гц.",
modes: [{ k: "run", l: "Активный сканер" }]
},
{
id: "vrr_pwm",
title: "9. Мерцание VRR Flicker и тест ШИМ (PWM)",
check: "Оцените стабильность тёмно-серого поля (VRR) и наведите камеру смартфона (1/1000 сек) на полосы (ШИМ).",
ok: "Ровная яркость без пульсаций и без чёрных бегущих полос на камере (Flicker-Free).",
bad: "Мерцание в тенях (VRR flicker) или резкие полосы на камере при снижении яркости.",
modes: [{ k: "vrr", l: "VRR Тёмно-серый" }, { k: "pwm", l: "Тест ШИМ (Камера)" }]
},
{
id: "angles",
title: "10. Углы обзора: VA Gamma Shift, IPS Glow и OLED Tint",
check: "Сначала смотрите прямо, затем сместите голову на 30°–45° влево/вправо и сравните контраст фигур.",
ok: "Тёмные круги и оттенки кожи по краям почти не выцветают и не меняют цветовой тон.",
bad: "Сильное высветление полутонов под углом (VA Gamma Shift) или резкий зелёно-розовый отлив.",
modes: [{ k: "va", l: "Тест VA Gamma Shift" }, { k: "color", l: "Сдвиг цвета под углом" }]
},
{
id: "fald_abl",
title: "11. Mini-LED FALD Blooming (водите мышкой!) и OLED ABL",
check: "Двигайте курсор мыши по чёрному экрану (или включите авто-орбиту) и переключайте окна 2%–100% APL.",
ok: "Минимальный ореол вокруг курсора (на OLED — 0%), плавная работа подсветки без резких скачков.",
bad: "Крупные квадратные засветы вокруг курсора или сильное падение яркости белого окна (ABL).",
modes: [{ k: "cursor", l: "Интерактивный курсор" }, { k: "bloom", l: "Авто-орбита + звёзды" }, { k: "apl2", l: "2% APL" }, { k: "apl10", l: "10% APL" }, { k: "apl50", l: "50% APL" }, { k: "apl100", l: "100% APL" }]
},
{
id: "sharpness",
title: "12. Резкость 1:1, Сетка пикселей и Чёткость шрифтов (ClearType)",
check: "Осмотрите линии 1 px, звезду Сименса и мелкий текст 10–16px (тёмный и светлый фон).",
ok: "Ровные линии без белых ореолов; чистый текст без заметной розово-зелёной каймы.",
bad: "Двойные белые контуры (завышен Sharpness в OSD) или сильная цветная бахрома букв.",
modes: [{ k: "all", l: "Сетка 1:1 + Сименс" }, { k: "text", l: "Шрифты 10–20px" }]
},
{
id: "gamut_hdr",
title: "13. Цветовой охват (sRGB vs P3) и Реальный HDR",
check: "Сравните естественность оттенков кожи и различимость ярких ступеней 75%–100% в HDR.",
ok: "Естественные оттенки кожи без перенасыщения, яркие детали в светах не сливаются в белое пятно.",
bad: "Кислотно-красные лица (нужен sRGB Clamp / Windows ACM) или клиппинг светов.",
modes: [{ k: "p3", l: "sRGB / P3 и Кожа" }, { k: "hdr", l: "HDR Ступени яркости" }]
},
{
id: "audio_summary",
title: "14. Звук (L/R) и Итоговый протокол проверки",
check: "Проверьте левый и правый канал колонок / выхода 3.5 мм и скопируйте итоговый отчёт проверки.",
ok: "Чистый звук в обоих каналах, все ключевые проверки матрицы пройдены без критичных дефектов.",
bad: "Нет звука, перепутаны каналы, сильный фон/писк или выявлен брак матрицы на предыдущих шагах.",
modes: [{ k: "summary", l: "Итоговая сводка" }]
}
];
function createGuidedSuite() {
if (document.getElementById("mdlFullGuidedSuite")) return;
const fsBtn = document.getElementById("btnLaunchFullscreenDeadPixel");
const autoTourBtn = document.getElementById("btnLabAutoTour");
if (autoTourBtn) autoTourBtn.style.display = "none";
if (fsBtn && fsBtn.parentElement && !document.getElementById("btnLaunchFullGuidedPass")) {
const btn = document.createElement("button");
btn.type = "button";
btn.id = "btnLaunchFullGuidedPass";
btn.className = "px-4 py-2 rounded-md text-xs transition flex items-center gap-1.5";
btn.textContent = "🚀 Полный прогон всех тестов (14 шагов)";
btn.title = "Единый пошаговый мастер проверки монитора во весь экран (WinUI 3 HUD, осциллограф Frame-Time, интерактивный FALD и итоговый протокол)";
fsBtn.parentElement.insertBefore(btn, fsBtn);
}
const modal = document.createElement("div");
modal.id = "mdlFullGuidedSuite";
modal.innerHTML = ''
+ '<div id="divGuidedViewport">'
+ '  <canvas id="cnvGuidedMain"></canvas>'
+ '  <div id="divGuidedSummaryOverlay" style="display:none;position:absolute;inset:0;overflow:auto;padding:32px 20px 170px;background:#202020;"></div>'
+ '</div>'
+ '<button type="button" id="btnGuidedRestoreHud">👁 Показать панель (H)</button>'
+ '<div id="divGuidedHud" style="background:rgba(32,32,32,0.88);border:1px solid rgba(255,255,255,0.12);border-radius:12px;">'
+ '  <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
+ '    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'
+ '      <span id="lblGuidedStepNum" style="background:#60cdff;color:#000;font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px;">Шаг 1 / 14</span>'
+ '      <span id="lblGuidedTitle" style="font-size:14.5px;font-weight:700;color:#fff;"></span>'
+ '      <span id="lblGuidedLiveHz" style="background:rgba(96,205,255,0.14);border:1px solid rgba(96,205,255,0.35);color:#60cdff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;">⚡ ... Гц</span>'
+ '    </div>'
+ '    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
+ '      <button type="button" id="btnGuidedHideHud" class="guided-pill" title="Скрыть панель (H)">👁 Скрыть (H)</button>'
+ '      <button type="button" id="btnGuidedFullscreen" class="guided-pill" title="Полный экран (F)">⛶ Полный экран (F)</button>'
+ '      <button type="button" id="btnGuidedClose" class="guided-pill" style="border-color:rgba(248,113,113,0.4);color:#fca5a5;">✕ Выход (Esc)</button>'
+ '    </div>'
+ '  </div>'
+ '  <div style="width:100%;height:3px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden;margin-bottom:8px;">'
+ '    <div id="barGuidedProgress" style="height:100%;width:7%;background:#60cdff;transition:width 0.18s ease;"></div>'
+ '  </div>'
+ '  <div id="lblGuidedHint" style="font-size:12px;color:#d4d4d4;margin-bottom:8px;line-height:1.45;"></div>'
+ '  <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">'
+ '    <div id="divGuidedSubModes" style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;"></div>'
+ '    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">'
+ '      <button type="button" id="btnGuidedMarkOk" class="guided-pill" title="Клавиша 1">✅ Норма (1)</button>'
+ '      <button type="button" id="btnGuidedMarkWarn" class="guided-pill" title="Клавиша 2">⚠ Нюанс (2)</button>'
+ '      <button type="button" id="btnGuidedMarkFail" class="guided-pill" title="Клавиша 3">❌ Брак (3)</button>'
+ '      <span style="width:1px;height:18px;background:rgba(255,255,255,0.18);margin:0 2px;"></span>'
+ '      <button type="button" id="btnGuidedPrev" class="guided-pill">◀ Назад</button>'
+ '      <button type="button" id="btnGuidedNext" class="guided-pill" style="background:#60cdff;border-color:#60cdff;color:#000;font-weight:700;">Далее ▶</button>'
+ '    </div>'
+ '  </div>'
+ '</div>';
document.body.appendChild(modal);
let stepIdx = 0;
let subMode = "white";
let verdicts = {};
let rafId = null;
let lastTs = 0;
let ufoX = 0;
let hzFrameTick = 0;
let hzPosFull = 0, hzPosHalf = 0, hzPosQuarter = 0;
let fsIdx = 0;
let bloomAngle = 0;
let mouseX = 0.5, mouseY = 0.42;
let fpsFrames = 0;
let fpsStart = 0;
let measuredHz = 60;
let frameTimes = [];
const cnv = document.getElementById("cnvGuidedMain");
const summaryEl = document.getElementById("divGuidedSummaryOverlay");
const hud = document.getElementById("divGuidedHud");
if (cnv) {
cnv.addEventListener("mousemove", (e) => {
const rect = cnv.getBoundingClientRect ? cnv.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth || 1440, height: window.innerHeight || 810 };
mouseX = Math.min(1, Math.max(0, ((e.clientX || 0) - rect.left) / Math.max(1, rect.width)));
mouseY = Math.min(1, Math.max(0, ((e.clientY || 0) - rect.top) / Math.max(1, rect.height)));
});
cnv.addEventListener("click", () => {
const step = STEPS[stepIdx];
if (step && step.id === "pixels") {
const idx = step.modes.findIndex(m => m.k === subMode);
const next = step.modes[(idx + 1) % step.modes.length];
subMode = next.k;
const subWrap = document.getElementById("divGuidedSubModes");
if (subWrap) {
subWrap.querySelectorAll(".guided-sub-btn").forEach((b, i) => {
b.classList.toggle("active", step.modes[i] && step.modes[i].k === subMode);
});
}
}
});
}
function playStereoTone(panVal) {
try {
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
const ac = new AC();
const osc = ac.createOscillator();
const gain = ac.createGain();
const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
osc.type = "sine";
osc.frequency.value = panVal < 0 ? 440 : (panVal > 0 ? 587.33 : 523.25);
gain.gain.setValueAtTime(0.18, ac.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.55);
if (pan) { pan.pan.value = panVal; osc.connect(gain).connect(pan).connect(ac.destination); }
else { osc.connect(gain).connect(ac.destination); }
osc.start();
osc.stop(ac.currentTime + 0.6);
setTimeout(() => { try { ac.close(); } catch(e){} }, 700);
} catch (e) {}
}
function sizeCanvasHiDPI() {
const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
const w = Math.max(320, window.innerWidth || 1440);
const h = Math.max(240, window.innerHeight || 810);
if (cnv.width !== Math.round(w * dpr) || cnv.height !== Math.round(h * dpr)) {
cnv.width = Math.round(w * dpr);
cnv.height = Math.round(h * dpr);
}
const ctx = cnv.getContext("2d");
if (ctx && ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
return { ctx, w, h, dpr };
}
function drawFrameTimeOscilloscope(ctx, w) {
const gw = 220, gh = 56, gx = w - gw - 18, gy = 14;
ctx.fillStyle = "rgba(20, 20, 20, 0.84)";
ctx.fillRect(gx, gy, gw, gh);
ctx.strokeStyle = "rgba(255,255,255,0.16)";
ctx.lineWidth = 1;
ctx.strokeRect(gx, gy, gw, gh);
const budget = 1000 / Math.max(30, measuredHz);
const maxMs = Math.max(budget * 2.5, 25);
ctx.fillStyle = "#b9b9b9";
ctx.font = "600 10px Segoe UI, Inter, sans-serif";
ctx.fillText("Frame-Time: " + budget.toFixed(1) + " мс (" + measuredHz + " Гц)", gx + 8, gy + 13);
const n = frameTimes.length;
if (n > 2) {
for (let i = 0; i < n; i++) {
const ft = frameTimes[i];
const barH = Math.min(gh - 20, (ft / maxMs) * (gh - 20));
const x = gx + 6 + (i / 100) * (gw - 12);
ctx.fillStyle = ft > budget * 1.55 ? "#f87171" : (ft > budget * 1.25 ? "#fbbf24" : "#60cdff");
ctx.fillRect(x, gy + gh - 4 - barH, 1.8, barH);
}
}
}
function renderSummary() {
const totalChecks = STEPS.length - 1;
const okCnt = STEPS.slice(0, totalChecks).filter(s => verdicts[s.id] === "ok").length;
const warnCnt = STEPS.slice(0, totalChecks).filter(s => verdicts[s.id] === "warn").length;
const failCnt = STEPS.slice(0, totalChecks).filter(s => verdicts[s.id] === "fail").length;
const overall = failCnt > 0
? "❌ Обнаружены критичные дефекты (" + failCnt + ") — стоит запросить замену экземпляра"
: (warnCnt > 0
? "⚠ Монитор в целом исправен, но есть нюансы (" + warnCnt + ") — проверьте настройки OSD/кабеля"
: (okCnt > 0 ? "✅ Отличный экземпляр! Все отмеченные проверки (" + okCnt + "/" + totalChecks + ") пройдены чисто" : "Отметьте шаги кнопками «Норма / Нюанс / Брак» для расчёта итогового вердикта"));
let rowsHtml = "";
STEPS.slice(0, totalChecks).forEach(s => {
const v = verdicts[s.id];
const badge = v === "ok" ? '<span style="color:#6ccb5f;font-weight:700;">✅ Норма</span>'
: (v === "warn" ? '<span style="color:#fce100;font-weight:700;">⚠ Нюанс</span>'
: (v === "fail" ? '<span style="color:#ff99a4;font-weight:700;">❌ Брак</span>'
: '<span style="color:#8a8a8a;">— Не отмечено</span>'));
rowsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:13px;">'
+ '<span>' + s.title + '</span><span>' + badge + '</span></div>';
});
summaryEl.innerHTML = '<div style="max-width:860px;margin:0 auto;">'
+ '<h2 style="font-size:22px;font-weight:700;margin-bottom:6px;color:#fff;">📋 Итоговый протокол проверки монитора (14 шагов)</h2>'
+ '<p style="font-size:13px;color:#b9b9b9;margin-bottom:16px;">Замеренная частота: <b style="color:#60cdff;">' + measuredHz + ' Гц</b> • Экран: <b>' + window.innerWidth + '×' + window.innerHeight + '</b> (DPR ' + (window.devicePixelRatio || 1) + '×)</p>'
+ '<div style="background:#2b2b2b;border:1px solid rgba(255,255,255,0.1);border-left:3px solid #60cdff;border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:14px;font-weight:600;color:#fff;">' + overall + '</div>'
+ '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">'
+ '  <button type="button" id="btnGuidedToneL" class="guided-pill">🔊 Левый канал (L)</button>'
+ '  <button type="button" id="btnGuidedToneR" class="guided-pill">🔊 Правый канал (R)</button>'
+ '  <button type="button" id="btnGuidedToneC" class="guided-pill">🔊 Оба канала (Стерео)</button>'
+ '  <button type="button" id="btnGuidedCopyReport" class="guided-pill" style="background:#60cdff;border-color:#60cdff;color:#000;font-weight:700;">📋 Скопировать протокол</button>'
+ '</div>'
+ '<div style="background:#2b2b2b;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">' + rowsHtml + '</div>'
+ '</div>';
const bL = document.getElementById("btnGuidedToneL");
const bR = document.getElementById("btnGuidedToneR");
const bC = document.getElementById("btnGuidedToneC");
const bCopy = document.getElementById("btnGuidedCopyReport");
if (bL) bL.onclick = () => playStereoTone(-1);
if (bR) bR.onclick = () => playStereoTone(1);
if (bC) bC.onclick = () => playStereoTone(0);
if (bCopy) bCopy.onclick = () => {
const lines = [
"Протокол проверки монитора (" + new Date().toLocaleDateString("ru-RU") + ")",
"Частота: " + measuredHz + " Гц | Экран: " + window.innerWidth + "×" + window.innerHeight + " (DPR " + (window.devicePixelRatio || 1) + "×)",
"Итог: " + overall, ""
];
STEPS.slice(0, totalChecks).forEach(s => {
const v = verdicts[s.id] === "ok" ? "✅ Норма" : (verdicts[s.id] === "warn" ? "⚠ Нюанс" : (verdicts[s.id] === "fail" ? "❌ Брак" : "—"));
lines.push(s.title + ": " + v);
});
try { if (navigator.clipboard) navigator.clipboard.writeText(lines.join("\n")); } catch (e) {}
if (typeof showToast === "function") showToast("📋 Протокол проверки монитора скопирован!");
};
}
function drawFrame(ts) {
if (!modal.classList.contains("open")) return;
if (!lastTs) { lastTs = ts; fpsStart = ts; }
const rawDtMs = ts - lastTs;
const dt = Math.min(Math.max(rawDtMs / 1000, 0), 0.05);
lastTs = ts;
if (rawDtMs > 0 && rawDtMs < 200) {
frameTimes.push(rawDtMs);
if (frameTimes.length > 100) frameTimes.shift();
}
fpsFrames++;
if (ts - fpsStart >= 450) {
measuredHz = Number(((fpsFrames * 1000) / (ts - fpsStart)).toFixed(1));
fpsFrames = 0;
fpsStart = ts;
const hzEl = document.getElementById("lblGuidedLiveHz");
if (hzEl) hzEl.textContent = "⚡ " + measuredHz + " Гц (" + (1000 / Math.max(1, measuredHz)).toFixed(2) + " мс)";
}
const step = STEPS[stepIdx];
if (step.id === "audio_summary") {
rafId = requestAnimationFrame(drawFrame);
return;
}
const { ctx, w, h } = sizeCanvasHiDPI();
if (!ctx) { rafId = requestAnimationFrame(drawFrame); return; }
if (step.id === "pixels") {
const map = { white: "#ffffff", black: "#000000", red: "#ff0000", green: "#00ff00", blue: "#0000ff", cyan: "#00ffff", magenta: "#ff00ff", yellow: "#ffff00" };
ctx.fillStyle = map[subMode] || "#ffffff";
ctx.fillRect(0, 0, w, h);
} else if (step.id === "glow") {
ctx.fillStyle = "#000000";
ctx.fillRect(0, 0, w, h);
if (subMode === "markers") {
ctx.strokeStyle = "rgba(255,255,255,0.22)";
ctx.lineWidth = 1;
ctx.strokeRect(20, 20, w - 40, h - 40);
ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
}
} else if (step.id === "oled_grey") {
const pct = Number(subMode) || 5;
const v = Math.round(255 * (pct / 100));
ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
ctx.fillRect(0, 0, w, h);
} else if (step.id === "tint") {
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, w, h);
if (subMode === "grid") {
ctx.strokeStyle = "rgba(0,0,0,0.16)";
ctx.lineWidth = 1;
for (let i = 1; i < 3; i++) {
ctx.beginPath(); ctx.moveTo((w / 3) * i, 0); ctx.lineTo((w / 3) * i, h); ctx.stroke();
ctx.beginPath(); ctx.moveTo(0, (h / 3) * i); ctx.lineTo(w, (h / 3) * i); ctx.stroke();
}
}
} else if (step.id === "gradients") {
ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, w, h);
const pad = 40, gw = w - pad * 2;
if (subMode === "rgb") {
const cols = [["#000000", "#ffffff", "Серый 0–255"], ["#000000", "#ff0000", "Красный"], ["#000000", "#00ff00", "Зелёный"], ["#000000", "#0000ff", "Синий"]];
const bh = Math.floor((h - 210) / 4);
cols.forEach((c, idx) => {
const y = 30 + idx * (bh + 12);
const gr = ctx.createLinearGradient(pad, 0, pad + gw, 0);
gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
ctx.fillStyle = gr; ctx.fillRect(pad, y, gw, bh);
ctx.fillStyle = "#e5e5e5"; ctx.font = "600 13px Segoe UI, sans-serif";
ctx.fillText(c[2], pad + 10, y + 20);
});
} else {
const gr = ctx.createLinearGradient(pad, 0, pad + gw, 0);
gr.addColorStop(0, "#000000"); gr.addColorStop(1, "#ffffff");
ctx.fillStyle = gr; ctx.fillRect(pad, 36, gw, Math.max(120, h * 0.28));
const yDark = Math.round(36 + Math.max(120, h * 0.28) + 34);
ctx.fillStyle = "#b9b9b9"; ctx.font = "600 13px Segoe UI, sans-serif";
ctx.fillText("Тест Black Crush (различимость теней RGB 1–16 на чёрном фоне):", pad, yDark - 10);
const bw = gw / 16;
for (let i = 1; i <= 16; i++) {
ctx.fillStyle = "rgb(" + i + "," + i + "," + i + ")";
ctx.fillRect(pad + (i - 1) * bw + 2, yDark, bw - 4, 72);
ctx.fillStyle = "#7a7a7a"; ctx.font = "600 11px Segoe UI, sans-serif";
ctx.fillText(String(i), pad + (i - 1) * bw + 8, yDark + 88);
}
const yHi = yDark + 112;
ctx.fillStyle = "#b9b9b9"; ctx.font = "600 13px Segoe UI, sans-serif";
ctx.fillText("Тест White Saturation (различимость светов RGB 240–255 на белом фоне):", pad, yHi - 10);
ctx.fillStyle = "#ffffff"; ctx.fillRect(pad, yHi, gw, 76);
for (let i = 0; i < 16; i++) {
const v = 240 + i;
ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
ctx.fillRect(pad + i * bw + 2, yHi + 4, bw - 4, 68);
ctx.fillStyle = "#525252"; ctx.font = "600 11px Segoe UI, sans-serif";
ctx.fillText(String(v), pad + i * bw + 6, yHi + 90);
}
}
} else if (step.id === "ufo") {
const spd = Number(subMode) || 960;
ufoX = (ufoX + spd * dt) % w;
const usableH = h - 150, bh = Math.floor(usableH / 3);
const bands = [
{ y: 0, h: bh, bg: "#0d0d0d", lbl: "Тёмный фон — проверка VA Black Smearing", dark: true },
{ y: bh, h: bh, bg: "#525252", lbl: "Средний серый — стандарт GtG 80%", dark: true },
{ y: bh * 2, h: usableH - bh * 2, bg: "#d4d4d4", lbl: "Светлый фон — проверка белых ореолов Overshoot", dark: false }
];
ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, w, h);
bands.forEach(b => {
ctx.fillStyle = b.bg; ctx.fillRect(0, b.y, w, b.h);
ctx.fillStyle = b.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
for (let gx = 0; gx < w; gx += 80) ctx.fillRect(gx, b.y, 1, b.h);
ctx.fillStyle = b.dark ? "#b9b9b9" : "#1b1b1b";
ctx.font = "600 14px Segoe UI, sans-serif";
ctx.fillText(b.lbl, 24, b.y + 26);
const cy = b.y + Math.round(b.h * 0.56);
for (let k = 0; k < 2; k++) {
const ux = (ufoX + k * (w / 2)) % w;
ctx.fillStyle = "#ef4444";
ctx.fillRect(Math.round(ux), b.y + 8, 2, 14);
ctx.fillRect(Math.round(ux), b.y + b.h - 22, 2, 14);
ctx.fillStyle = "#e0f2fe";
ctx.beginPath(); ctx.ellipse(ux, cy - 10, 20, 11, 0, Math.PI, Math.PI * 2); ctx.fill();
ctx.fillStyle = "#60cdff";
ctx.beginPath(); ctx.ellipse(ux, cy, 44, 15, 0, 0, Math.PI * 2); ctx.fill();
ctx.strokeStyle = "#000000"; ctx.lineWidth = 2; ctx.stroke();
ctx.fillStyle = "#fce100";
ctx.fillRect(Math.round(ux - 26), cy - 5, 10, 10);
ctx.fillRect(Math.round(ux - 5), cy - 5, 10, 10);
ctx.fillRect(Math.round(ux + 16), cy - 5, 10, 10);
}
});
drawFrameTimeOscilloscope(ctx, w);
} else if (step.id === "hz_compare") {
hzFrameTick++;
const spd = subMode === "bfi" ? 960 : (Number(subMode) || 960);
hzPosFull = (hzPosFull + spd * dt) % w;
if (hzFrameTick % 2 === 0) hzPosHalf = hzPosFull;
if (hzFrameTick % 4 === 0) hzPosQuarter = hzPosFull;
const usableH = h - 150, bh = Math.floor(usableH / 3);
ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, w, h);
const rows = [
{ y: 0, pos: hzPosFull, lbl: "Макс. частота (" + Math.round(measuredHz) + " FPS — 1:1)", bfi: subMode === "bfi" && (hzFrameTick % 2 === 1) },
{ y: bh, pos: hzPosHalf, lbl: "Половина частоты (~" + Math.round(measuredHz / 2) + " FPS — 1:2)", bfi: false },
{ y: bh * 2, pos: hzPosQuarter, lbl: "Четверть частоты (~" + Math.round(measuredHz / 4) + " FPS — 1:4)", bfi: false }
];
rows.forEach((r, idx) => {
ctx.fillStyle = r.bfi ? "#000000" : (idx % 2 === 0 ? "#1f1f1f" : "#2b2b2b");
ctx.fillRect(0, r.y, w, bh - 2);
ctx.fillStyle = "#60cdff"; ctx.font = "600 13px Segoe UI, sans-serif";
ctx.fillText(r.lbl, 24, r.y + 24);
if (!r.bfi) {
const cy = r.y + Math.round(bh * 0.56);
for (let k = 0; k < 2; k++) {
const ux = (r.pos + k * (w / 2)) % w;
ctx.fillStyle = "#ffffff";
ctx.fillRect(Math.round(ux - 55), cy - 22, 110, 44);
ctx.fillStyle = "#000000";
ctx.font = "800 14px Segoe UI, sans-serif";
ctx.fillText("CHROMA", Math.round(ux - 34), cy + 5);
}
}
});
drawFrameTimeOscilloscope(ctx, w);
} else if (step.id === "frameskip") {
ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, w, h);
const cols = 8, rows = 3;
fsIdx = (fsIdx + 1) % (cols * rows);
const gw = Math.min(w - 120, 960), gh = Math.min(h - 260, 360);
const ox = Math.round((w - gw) / 2), oy = Math.round((h - 140 - gh) / 2);
const cw = gw / cols, ch = gh / rows;
for (let i = 0; i < cols * rows; i++) {
const r = Math.floor(i / cols), c = i % cols;
ctx.fillStyle = i === fsIdx ? "#ffffff" : "#222222";
ctx.fillRect(ox + c * cw + 4, oy + r * ch + 4, cw - 8, ch - 8);
ctx.strokeStyle = "#3f3f3f"; ctx.strokeRect(ox + c * cw + 4, oy + r * ch + 4, cw - 8, ch - 8);
}
drawFrameTimeOscilloscope(ctx, w);
} else if (step.id === "vrr_pwm") {
if (subMode === "pwm") {
ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
ctx.fillStyle = "#000000";
for (let x = 0; x < w; x += 24) ctx.fillRect(x, 0, 12, h);
} else {
const pulse = Math.sin(ts / 45) > 0 ? 22 : 26;
ctx.fillStyle = "rgb(" + pulse + "," + pulse + "," + (pulse + 3) + ")";
ctx.fillRect(0, 0, w, h);
ctx.fillStyle = "#b9b9b9"; ctx.font = "600 15px Segoe UI, sans-serif";
ctx.fillText("Тёмно-серое поле VRR Flicker — оценивайте стабильность яркости периферийным зрением", 32, 42);
}
} else if (step.id === "angles") {
ctx.fillStyle = subMode === "va" ? "#1e1e1e" : "#2b2b2b";
ctx.fillRect(0, 0, w, h);
const pts = [[0.18, 0.25], [0.5, 0.25], [0.82, 0.25], [0.18, 0.62], [0.5, 0.62], [0.82, 0.62]];
pts.forEach(([px, py]) => {
const cx = w * px, cy = (h - 120) * py;
if (subMode === "va") {
ctx.fillStyle = "#3a3a3a";
ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = "#262626";
ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = "#181818";
ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
} else {
ctx.fillStyle = "#e5b89b";
ctx.fillRect(cx - 56, cy - 36, 54, 72);
ctx.fillStyle = "#d9d9d9";
ctx.fillRect(cx + 2, cy - 36, 54, 72);
}
});
} else if (step.id === "fald_abl") {
ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, w, h);
if (subMode === "cursor") {
const cx = Math.round(mouseX * w), cy = Math.round(mouseY * h);
ctx.fillStyle = "#ffffff";
ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
ctx.fillStyle = "#7a7a7a"; ctx.font = "600 13px Segoe UI, sans-serif";
ctx.fillText("Водите курсором мыши по чёрному полю — оценивайте ореол (Blooming) вокруг белого круга", 24, 34);
} else if (subMode === "bloom") {
bloomAngle += dt * 1.4;
const cx = w / 2 + Math.cos(bloomAngle) * Math.min(w * 0.34, 420);
const cy = (h - 140) / 2 + Math.sin(bloomAngle * 1.3) * Math.min((h - 180) * 0.34, 180);
ctx.fillStyle = "#ffffff";
ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
for (let i = 0; i < 48; i++) {
ctx.fillRect(((i * 197) % (w - 80)) + 40, ((i * 131) % Math.max(120, h - 220)) + 40, 2, 2);
}
} else {
const pct = Number(subMode.replace("apl", "")) || 10;
const frac = Math.sqrt(pct / 100);
const ww = Math.round(w * frac), wh = Math.round(h * frac);
ctx.fillStyle = "#ffffff";
ctx.fillRect(Math.round((w - ww) / 2), Math.round((h - wh) / 2), ww, wh);
}
} else if (step.id === "sharpness") {
ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, w, h);
if (subMode === "text") {
ctx.fillStyle = "#ffffff"; ctx.fillRect(32, 32, (w - 80) / 2, h - 210);
ctx.fillStyle = "#000000"; ctx.fillRect(48 + (w - 80) / 2, 32, (w - 80) / 2, h - 210);
[10, 11, 12, 14, 16, 20].forEach((sz, i) => {
const y = 76 + i * 44;
const sample = sz + "px: Съешь ещё этих мягких французских булок 0123456789 (RGB / ClearType)";
ctx.fillStyle = "#000000"; ctx.font = sz + "px Segoe UI, Inter, sans-serif";
ctx.fillText(sample, 48, y);
ctx.fillStyle = "#ffffff";
ctx.fillText(sample, 64 + (w - 80) / 2, y);
});
} else {
const cx = Math.round(w * 0.25), cy = Math.round((h - 150) / 2);
const rad = Math.min(180, (h - 220) / 2);
for (let i = 0; i < 72; i++) {
const a1 = (i * Math.PI * 2) / 72, a2 = ((i + 0.5) * Math.PI * 2) / 72;
ctx.fillStyle = i % 2 === 0 ? "#ffffff" : "#000000";
ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, a1, a2); ctx.closePath(); ctx.fill();
}
const rx = Math.round(w * 0.52);
for (let x = 0; x < 240; x += 2) { ctx.fillStyle = "#ffffff"; ctx.fillRect(rx + x, 50, 1, 140); }
for (let y = 0; y < 140; y += 2) { ctx.fillStyle = "#ffffff"; ctx.fillRect(rx + 260, 50 + y, 180, 1); }
ctx.fillStyle = "#ffffff"; ctx.font = "13px Segoe UI, sans-serif";
ctx.fillText("1px линии не должны иметь белых ореолов (иначе снизьте Sharpness в OSD)", rx, 224);
ctx.fillStyle = "#000000"; ctx.fillRect(rx, 245, 440, 110);
ctx.fillStyle = "#ffffff"; ctx.font = "12px Consolas, monospace";
ctx.fillText("const ppi = Math.hypot(3840, 2160) / 27; // 163.2 PPI", rx + 14, 280);
ctx.fillStyle = "#60cdff";
ctx.fillText("Проверьте отсутствие розово-зелёной каймы вокруг букв", rx + 14, 312);
}
} else if (step.id === "gamut_hdr") {
ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, w, h);
if (subMode === "hdr") {
const pads = [0.25, 0.5, 0.75, 0.9, 0.95, 0.98, 1.0];
const bw = (w - 120) / pads.length;
pads.forEach((p, i) => {
const v = Math.round(255 * p);
ctx.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
ctx.fillRect(60 + i * bw + 6, 80, bw - 12, h - 300);
ctx.fillStyle = p > 0.6 ? "#1b1b1b" : "#e5e5e5";
ctx.font = "700 14px Segoe UI, sans-serif";
ctx.fillText(Math.round(p * 100) + "%", 60 + i * bw + 18, 110);
});
} else {
const swatches = [
["#e11d48", "Красный"], ["#16a34a", "Зелёный"], ["#2563eb", "Синий"],
["#f59e0b", "Янтарный"], ["#eab308", "Жёлтый"], ["#e5b89b", "Кожа 1"], ["#c68642", "Кожа 2"]
];
const bw = (w - 100) / swatches.length;
swatches.forEach((sw, i) => {
ctx.fillStyle = sw[0];
ctx.fillRect(50 + i * bw + 6, 70, bw - 12, h - 290);
ctx.fillStyle = "#ffffff"; ctx.font = "600 12px Segoe UI, sans-serif";
ctx.fillText(sw[1], 50 + i * bw + 12, h - 200);
});
}
}
rafId = requestAnimationFrame(drawFrame);
}
function renderStepUI() {
const step = STEPS[stepIdx];
subMode = step.modes[0].k;
document.getElementById("lblGuidedStepNum").textContent = "Шаг " + (stepIdx + 1) + " / " + STEPS.length;
document.getElementById("lblGuidedTitle").textContent = step.title;
document.getElementById("barGuidedProgress").style.width = Math.round(((stepIdx + 1) / STEPS.length) * 100) + "%";
document.getElementById("lblGuidedHint").innerHTML = '<span>' + step.check + '</span> '
+ '<span style="color:#6ccb5f;margin-left:8px;"><b>✅ Норма:</b> ' + step.ok + '</span> '
+ '<span style="color:#ff99a4;margin-left:8px;"><b>❌ Брак:</b> ' + step.bad + '</span>';
const subWrap = document.getElementById("divGuidedSubModes");
subWrap.innerHTML = "";
step.modes.forEach(m => {
const b = document.createElement("button");
b.type = "button";
b.className = "guided-sub-btn" + (m.k === subMode ? " active" : "");
b.textContent = m.l;
b.onclick = () => {
subMode = m.k;
subWrap.querySelectorAll(".guided-sub-btn").forEach(x => x.classList.remove("active"));
b.classList.add("active");
};
subWrap.appendChild(b);
});
const v = verdicts[step.id];
document.getElementById("btnGuidedMarkOk").className = "guided-pill" + (v === "ok" ? " active-ok" : "");
document.getElementById("btnGuidedMarkWarn").className = "guided-pill" + (v === "warn" ? " active-warn" : "");
document.getElementById("btnGuidedMarkFail").className = "guided-pill" + (v === "fail" ? " active-fail" : "");
document.getElementById("btnGuidedNext").textContent = stepIdx === STEPS.length - 1 ? "Готово ✓" : "Далее ▶";
if (step.id === "audio_summary") {
summaryEl.style.display = "block";
renderSummary();
} else {
summaryEl.style.display = "none";
}
}
function openSuite() {
stepIdx = 0;
frameTimes = [];
modal.classList.add("open");
modal.classList.remove("hud-is-hidden");
hud.classList.remove("hud-hidden");
renderStepUI();
try { if (modal.requestFullscreen) modal.requestFullscreen(); } catch (e) {}
if (rafId) cancelAnimationFrame(rafId);
lastTs = 0;
rafId = requestAnimationFrame(drawFrame);
}
function closeSuite() {
modal.classList.remove("open");
if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) {}
}
function toggleHud() {
const hidden = hud.classList.toggle("hud-hidden");
modal.classList.toggle("hud-is-hidden", hidden);
}
function setVerdict(val) {
verdicts[STEPS[stepIdx].id] = val;
renderStepUI();
if (stepIdx < STEPS.length - 1) { stepIdx++; renderStepUI(); }
}
const launchBtn = document.getElementById("btnLaunchFullGuidedPass");
if (launchBtn) launchBtn.addEventListener("click", openSuite);
document.getElementById("btnGuidedClose").addEventListener("click", closeSuite);
document.getElementById("btnGuidedHideHud").addEventListener("click", toggleHud);
document.getElementById("btnGuidedRestoreHud").addEventListener("click", toggleHud);
document.getElementById("btnGuidedFullscreen").addEventListener("click", () => {
try {
if (!document.fullscreenElement && modal.requestFullscreen) modal.requestFullscreen();
else if (document.exitFullscreen) document.exitFullscreen();
} catch (e) {}
});
document.getElementById("btnGuidedPrev").addEventListener("click", () => {
if (stepIdx > 0) { stepIdx--; renderStepUI(); }
});
document.getElementById("btnGuidedNext").addEventListener("click", () => {
if (stepIdx < STEPS.length - 1) { stepIdx++; renderStepUI(); }
else closeSuite();
});
document.getElementById("btnGuidedMarkOk").addEventListener("click", () => setVerdict("ok"));
document.getElementById("btnGuidedMarkWarn").addEventListener("click", () => setVerdict("warn"));
document.getElementById("btnGuidedMarkFail").addEventListener("click", () => setVerdict("fail"));
document.addEventListener("keydown", (e) => {
if (!modal.classList.contains("open")) return;
if (e.key === "Escape") closeSuite();
else if (e.key === "ArrowRight" || e.key === " ") {
if (e.preventDefault) e.preventDefault();
if (stepIdx < STEPS.length - 1) { stepIdx++; renderStepUI(); }
} else if (e.key === "ArrowLeft") {
if (stepIdx > 0) { stepIdx--; renderStepUI(); }
} else if (e.key === "1") setVerdict("ok");
else if (e.key === "2") setVerdict("warn");
else if (e.key === "3") setVerdict("fail");
else if (e.key === "h" || e.key === "H" || e.key === "р" || e.key === "Р") toggleHud();
else if (e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") {
try { if (!document.fullscreenElement && modal.requestFullscreen) modal.requestFullscreen(); } catch (err) {}
}
});
}
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", createGuidedSuite);
} else {
createGuidedSuite();
}
})();
/* FULL_GUIDED_TEST_SUITE_JS_END */
/* MODERN_UI_TESTLAB_JS_END */
/* === WINUI3_TABS23_AND_MOBILE_PVZ_JS === */
(function(){
if (typeof renderCompare === "function" && !window.__cmpStickyEnhanced) {
window.__cmpStickyEnhanced = true;
const _origRenderCompare = renderCompare;
renderCompare = function() {
_origRenderCompare.apply(this, arguments);
try {
const box = document.getElementById("divCompareContent");
if (!box) return;
const rows = box.querySelectorAll("table tbody tr");
let diffCount = 0, totalCount = 0;
const diffOnly = !!(document.getElementById("chkCompareDiffOnly") && document.getElementById("chkCompareDiffOnly").checked);
rows.forEach(tr => {
const cells = Array.from(tr.querySelectorAll("td"));
if (cells.length < 3) return;
totalCount++;
const vals = cells.slice(1).map(td => (td.textContent || "").replace(/\s+/g, " ").trim());
const allSame = vals.every(v => v === vals[0]);
if (!allSame) {
diffCount++;
tr.classList.add("cmp-diff-row");
tr.style.display = "";
} else {
tr.classList.remove("cmp-diff-row");
tr.style.display = diffOnly ? "none" : "";
}
});
const stat = document.getElementById("lblCompareDiffStat");
if (stat && totalCount > 0) {
stat.textContent = diffOnly ? (diffCount + " из " + totalCount) : ("отличий: " + diffCount + " / " + totalCount);
}
} catch (_) {}
};
const chk = document.getElementById("chkCompareDiffOnly");
if (chk) {
chk.addEventListener("change", () => { try { renderCompare(); } catch (_) {} });
}
}
})();
/* === SMART_URL_ROUTING_AND_VIRTUAL_CATALOG_V1 === */
(function() {
function copyTextWithFeedback(text, btn, defaultLabel) {
const done = () => {
if (!btn) return;
const orig = defaultLabel || btn.textContent;
btn.textContent = "✓ Ссылка скопирована";
setTimeout(() => { btn.textContent = orig; }, 1800);
};
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(text).then(done).catch(() => {
try {
const ta = document.createElement("textarea");
ta.value = text;
document.body.appendChild(ta);
ta.select();
document.execCommand("copy");
ta.remove();
} catch (_) {}
done();
});
} else {
done();
}
}
function makeDeepUrl(hashStr) {
const base = (location.origin && location.origin !== "null" ? location.origin : "") + (location.pathname || "");
return base + "#" + hashStr;
}
function setHashSilent(hashStr) {
try {
if (history && history.replaceState) {
history.replaceState(null, "", "#" + hashStr);
}
} catch (_) {}
}
function applyHashRoute() {
const raw = (location.hash || "").replace(/^#/, "").trim();
if (!raw) return;
const params = new URLSearchParams(raw.includes("=") ? raw : ("tab=" + raw));
const tab = params.get("tab");
const validTabs = new Set(["catalog","finder","compare","market","flagships","panels_oem","revisions","brands_srv","encyclopedia","guide","tests"]);
if (tab && validTabs.has(tab) && typeof switchTab === "function") {
switchTab(tab);
}
const testMode = params.get("test");
if (testMode === "guided") {
if (typeof switchTab === "function") switchTab("tests");
setTimeout(() => {
const launchBtn = document.getElementById("btnLaunchFullGuidedSuite");
if (launchBtn && typeof launchBtn.click === "function") launchBtn.click();
}, 60);
return;
}
const cmp = params.get("compare");
if (cmp && typeof compareIds !== "undefined") {
const ids = cmp.split(",").map(x => Number(x.trim())).filter(x => Number.isFinite(x) && x > 0).slice(0, 4);
if (ids.length) {
compareIds.clear();
ids.forEach(id => {
if (typeof DB !== "undefined" && DB.catalog && DB.catalog.some(m => m.id === id)) {
compareIds.add(id);
}
});
if (typeof updateCompareBadge === "function") { try { updateCompareBadge(); } catch (_) {} }
if (typeof switchTab === "function") switchTab("compare");
if (typeof renderCompare === "function") renderCompare();
}
return;
}
const modelId = Number(params.get("model"));
if (Number.isFinite(modelId) && modelId > 0 && typeof openModelModal === "function") {
if (typeof DB !== "undefined" && DB.catalog && DB.catalog.some(m => m.id === modelId)) {
setTimeout(() => { try { openModelModal(modelId); } catch (_) {} }, 40);
}
}
}
const btnCmpLink = document.getElementById("btnCopyCompareLink");
if (btnCmpLink) {
btnCmpLink.addEventListener("click", () => {
const ids = (typeof compareIds !== "undefined") ? Array.from(compareIds) : [];
if (!ids.length) {
copyTextWithFeedback(makeDeepUrl("tab=compare"), btnCmpLink, "🔗 Ссылка на сравнение");
return;
}
const h = "compare=" + ids.join(",");
setHashSilent(h);
copyTextWithFeedback(makeDeepUrl(h), btnCmpLink, "🔗 Ссылка на сравнение");
});
}
if (typeof openModelModal === "function" && !window.__deepLinkModalHooked) {
window.__deepLinkModalHooked = true;
const _origOpenModel = openModelModal;
openModelModal = function(id) {
_origOpenModel.apply(this, arguments);
try {
if (id) setHashSilent("model=" + id);
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (body && !body.querySelector("#btnCopyModelDeepLink")) {
const bar = document.createElement("div");
bar.className = "flex flex-wrap items-center justify-end gap-2 mb-2";
bar.innerHTML = `<button type="button" id="btnCopyModelDeepLink" class="px-2.5 py-1 rounded text-xs font-semibold transition" style="background:rgba(0,95,184,0.1);color:#005fb8;border:1px solid rgba(0,95,184,0.35);">🔗 Ссылка на эту модель (#model=${id})</button>`;
if (body.firstChild) body.insertBefore(bar, body.firstChild);
else body.appendChild(bar);
const b = bar.querySelector("#btnCopyModelDeepLink");
if (b) b.addEventListener("click", () => copyTextWithFeedback(makeDeepUrl("model=" + id), b, `🔗 Ссылка на эту модель (#model=${id})`));
}
} catch (_) {}
};
}
if (typeof switchTab === "function" && !window.__deepLinkTabHooked) {
window.__deepLinkTabHooked = true;
const _origSwitchTab = switchTab;
switchTab = function(tabName) {
_origSwitchTab.apply(this, arguments);
try {
if (tabName === "compare" && typeof compareIds !== "undefined" && compareIds.size > 0) {
setHashSilent("compare=" + Array.from(compareIds).join(","));
} else if (tabName && tabName !== "catalog") {
setHashSilent("tab=" + tabName);
}
} catch (_) {}
};
}
function ensureGuidedTestLinkBtn() {
const launchBtn = document.getElementById("btnLaunchFullGuidedSuite");
if (!launchBtn || document.getElementById("btnCopyGuidedTestLink")) return;
const b = document.createElement("button");
b.type = "button";
b.id = "btnCopyGuidedTestLink";
b.className = "px-3 py-1.5 rounded-lg text-xs font-semibold transition";
b.style.cssText = "background:rgba(0,95,184,0.1);color:#005fb8;border:1px solid rgba(0,95,184,0.35);margin-left:8px;";
b.textContent = "🔗 Ссылка на тест ПВЗ";
b.title = "Скопировать прямую ссылку (#test=guided) для мгновенного запуска 14-шаговой проверки в ПВЗ";
b.addEventListener("click", () => copyTextWithFeedback(makeDeepUrl("test=guided"), b, "🔗 Ссылка на тест ПВЗ"));
if (launchBtn.parentNode) launchBtn.parentNode.insertBefore(b, launchBtn.nextSibling);
}
let _vObserver = null;
window.__catVirtualQueue = [];
function flushNextCatalogChunk() {
const tbody = document.getElementById("tblCatalogBody");
if (!tbody || !window.__catVirtualQueue.length) return;
const oldSent = document.getElementById("trCatalogVirtualSentinel");
if (oldSent) oldSent.remove();
const frag = document.createDocumentFragment ? document.createDocumentFragment() : null;
const batch = window.__catVirtualQueue.splice(0, 80);
if (frag) {
batch.forEach(tr => frag.appendChild(tr));
tbody.appendChild(frag);
} else {
batch.forEach(tr => tbody.appendChild(tr));
}
if (window.__catVirtualQueue.length > 0) {
const sent = document.createElement("tr");
sent.id = "trCatalogVirtualSentinel";
sent.innerHTML = `<td colspan="12" class="text-center py-3 text-xs text-slate-500">Загружено ещё 80 строк • осталось ${window.__catVirtualQueue.length} (прокрутите вниз или нажмите для показа)</td>`;
sent.style.cursor = "pointer";
sent.addEventListener("click", flushNextCatalogChunk);
tbody.appendChild(sent);
if (_vObserver) {
try { _vObserver.observe(sent); } catch (_) {}
}
}
}
if (typeof renderCatalog === "function" && !window.__virtualCatalogHooked) {
window.__virtualCatalogHooked = true;
const _origRenderCatalog = renderCatalog;
renderCatalog = function() {
_origRenderCatalog.apply(this, arguments);
try {
const tbody = document.getElementById("tblCatalogBody");
if (!tbody || !tbody.children) return;
const rows = Array.from(tbody.children);
window.__catVirtualQueue = [];
if (rows.length > 100) {
const rest = rows.slice(80);
rest.forEach(tr => tr.remove());
window.__catVirtualQueue = rest;
if (typeof IntersectionObserver !== "undefined") {
if (_vObserver) _vObserver.disconnect();
_vObserver = new IntersectionObserver(entries => {
if (entries.some(e => e.isIntersecting)) {
requestAnimationFrame(flushNextCatalogChunk);
}
}, { rootMargin: "600px" });
}
const sent = document.createElement("tr");
sent.id = "trCatalogVirtualSentinel";
sent.innerHTML = `<td colspan="12" class="text-center py-3 text-xs text-slate-500">⚡ Быстрый режим: показано 80 из ${rows.length} строк (прокрутите вниз для плавной подгрузки)</td>`;
sent.style.cursor = "pointer";
sent.addEventListener("click", flushNextCatalogChunk);
tbody.appendChild(sent);
if (_vObserver) _vObserver.observe(sent);
}
} catch (_) {}
};
}
window.addEventListener("hashchange", applyHashRoute);
setTimeout(() => {
ensureGuidedTestLinkBtn();
applyHashRoute();
}, 30);
window.__applyHashRoute = applyHashRoute;
})();
/* === PVZ_PRICE_AND_WARRANTY_RISK_MODULE_V1 === */
(function() {
const RF_RETAIL_NAMES = ["dns", "ситилинк", "регард", "онлайнтрейд", "м.видео"];
function analyzePriceAndPvzRisk(m) {
const baseRub = Number(m.rub || m.price_mp_rf || 0);
const handRub = Number(m.hand || baseRub || 0);
const retailRub = Number(m.price_retail_rf || 0);
const dutyRub = Math.max(0, handRub - baseRub);
const stores = Array.isArray(m.stores) ? m.stores : [];
const rfRetailStores = stores.filter(s => s && s.name && RF_RETAIL_NAMES.some(k => s.name.toLowerCase().includes(k)));
const hasDirectRf = rfRetailStores.some(s => s.url && (s.url.includes("/product/") || s.url.includes("/catalogue/")));
const isCrossBorder = !m.is_ru || dutyRub > 0;
let riskLevel = "low";
let riskTitle = "Низкий риск (локальная розница РФ)";
let riskDesc = "Локальная гарантия РФ (12–36 мес.), простая проверка битых пикселей и засветов в ПВЗ / магазине, возврат по ЗоЗПП.";
if (rfRetailStores.length === 0 && isCrossBorder) {
riskLevel = "high";
riskTitle = "Повышенный риск (зарубежная доставка / CN)";
riskDesc = "Возможна таможенная пошлина (15% свыше 200 € + брокер ~500 ₽) и сложный возврат при битых пикселях — обязательно снимайте распаковку и прогоните 14-шаговый тест.";
} else if (rfRetailStores.length === 0) {
riskLevel = "med";
riskTitle = "Средний риск (маркетплейс без крупной розницы РФ)";
riskDesc = "Проверяйте продавца, условия возврата и осматривайте матрицу прямо в ПВЗ до закрытия заказа.";
}
let deltaText = "";
if (retailRub > 0 && handRub > 0 && retailRub !== handRub) {
const diff = retailRub - handRub;
const pct = Math.round((diff / handRub) * 100);
const sign = diff > 0 ? "+" : "";
deltaText = `${sign}${diff.toLocaleString("ru-RU")} ₽ (${sign}${pct}%) за локальную гарантию РФ`;
}
return { baseRub, handRub, retailRub, dutyRub, rfRetailStores, hasDirectRf, isCrossBorder, riskLevel, riskTitle, riskDesc, deltaText };
}
function buildPvzRiskCardHtml(m) {
const info = analyzePriceAndPvzRisk(m);
const badgeColor = info.riskLevel === "low"
? "color:#0f7b0f;border-color:rgba(15,123,15,0.35);background:rgba(15,123,15,0.08);"
: info.riskLevel === "med"
? "color:#9d5d00;border-color:rgba(157,93,0,0.35);background:rgba(157,93,0,0.08);"
: "color:#c42b1c;border-color:rgba(196,43,28,0.35);background:rgba(196,43,28,0.08);";
const fmt = v => v > 0 ? v.toLocaleString("ru-RU") + " ₽" : "—";
return `<div id="divPvzPriceRiskCard" class="my-2.5 p-3 rounded-lg border text-xs" style="border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.04);">
<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
<span class="font-bold">💰 Итоговая цена «на руки» и риски ПВЗ / гарантии</span>
<span class="px-2 py-0.5 rounded font-semibold border" style="${badgeColor}">${info.riskTitle}</span>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
<div class="p-2 rounded border" style="border-color:rgba(128,128,128,0.16);">
<div class="opacity-70 text-[11px]">Базовая / МП</div>
<div class="font-bold text-sm">${fmt(info.baseRub)}</div>
</div>
<div class="p-2 rounded border" style="border-color:rgba(128,128,128,0.16);">
<div class="opacity-70 text-[11px]">Пошлина (>200 €)</div>
<div class="font-bold text-sm">${info.dutyRub > 0 ? "+" + fmt(info.dutyRub) : "0 ₽"}</div>
</div>
<div class="p-2 rounded border" style="border-color:rgba(0,95,184,0.35);background:rgba(0,95,184,0.06);">
<div class="opacity-70 text-[11px]">Итого «на руки»</div>
<div class="font-extrabold text-sm" style="color:#005fb8;">${fmt(info.handRub)}</div>
</div>
<div class="p-2 rounded border" style="border-color:rgba(128,128,128,0.16);">
<div class="opacity-70 text-[11px]">Розница РФ (${info.rfRetailStores.length} маг.)</div>
<div class="font-bold text-sm">${fmt(info.retailRub)}</div>
</div>
</div>
${info.deltaText ? `<div class="mb-1.5 font-medium">⚖️ Переплата розницы РФ vs «на руки»: <strong>${info.deltaText}</strong></div>` : ""}
<div class="opacity-85 leading-relaxed">🛡️ ${info.riskDesc}</div>
</div>`;
}
if (typeof openModelModal === "function" && !window.__pvzRiskModalHooked) {
window.__pvzRiskModalHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#divPvzPriceRiskCard")) return;
const wrap = document.createElement("div");
wrap.innerHTML = buildPvzRiskCardHtml(m);
const card = wrap.firstElementChild;
if (!card) return;
const first = body.firstElementChild;
if (first && first.querySelector && first.querySelector("#btnCopyModelDeepLink") && first.nextSibling) {
body.insertBefore(card, first.nextSibling);
} else if (body.firstChild) {
body.insertBefore(card, body.firstChild);
} else {
body.appendChild(card);
}
} catch (_) {}
};
}
if (typeof renderCompare === "function" && !window.__pvzRiskCompareHooked) {
window.__pvzRiskCompareHooked = true;
const _origCmp = renderCompare;
renderCompare = function() {
_origCmp.apply(this, arguments);
try {
const box = document.getElementById("divCompareContent");
if (!box || typeof compareIds === "undefined" || compareIds.size < 2 || box.querySelector("#divComparePvzSummary")) return;
const items = Array.from(compareIds).map(id => DB.catalog.find(x => x.id === id)).filter(Boolean);
if (items.length < 2) return;
const analyzed = items.map(m => ({ m, info: analyzePriceAndPvzRisk(m) }));
const priced = analyzed.filter(x => x.info.handRub > 0).sort((a, b) => a.info.handRub - b.info.handRub);
const winner = priced.length ? priced[0] : null;
const rowsHtml = analyzed.map(({ m, info }) => {
const rfMark = info.rfRetailStores.length > 0 ? `✅ РФ (${info.rfRetailStores.length})` : "⚠️ Зарубеж/МП";
const handStr = info.handRub > 0 ? info.handRub.toLocaleString("ru-RU") + " ₽" : "—";
const dutyStr = info.dutyRub > 0 ? ` (вкл. пошлину ${info.dutyRub.toLocaleString("ru-RU")} ₽)` : "";
return `<div class="p-2 rounded border" style="border-color:rgba(128,128,128,0.18);">
<div class="font-bold truncate">${m.model}</div>
<div class="mt-0.5">На руки: <strong>${handStr}</strong>${dutyStr} • ${rfMark}</div>
</div>`;
}).join("");
const summaryEl = document.createElement("div");
summaryEl.id = "divComparePvzSummary";
summaryEl.className = "mb-3 p-3 rounded-lg border text-xs";
summaryEl.style.cssText = "border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.04);";
summaryEl.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
<span class="font-bold">⚖️ Сводка «На руки» + гарантия РФ / риски ПВЗ</span>
${winner ? `<span class="font-semibold" style="color:#005fb8;">Выгоднее по цене «на руки»: ${winner.m.model} (${winner.info.handRub.toLocaleString("ru-RU")} ₽)</span>` : ""}
</div>
<div class="grid grid-cols-1 md:grid-cols-${Math.min(4, items.length)} gap-2">${rowsHtml}</div>`;
if (box.firstChild) box.insertBefore(summaryEl, box.firstChild);
else box.appendChild(summaryEl);
} catch (_) {}
};
}
})();
/* === SPARKLINE_PVZ_MODE_AND_REF_TABS_WINUI3_JS === */
(function() {
function buildPriceSparklineHtml(m) {
const rawPts = (typeof DB !== "undefined" && DB.price_history && DB.price_history[String(m.id)])
? DB.price_history[String(m.id)].slice()
: [];
const curPrice = Number(m.price_retail_rf || m.hand || m.rub || 0);
if (!rawPts.length) return "";
const series = rawPts
.map(p => ({ d: p.d, v: Number(p.r || p.m || 0), s: p.s || "" }))
.filter(p => p.v > 0);
if (curPrice > 0 && series.length && series[series.length - 1].v !== curPrice) {
series.push({ d: "Текущая", v: curPrice, s: "База" });
}
if (!series.length) return "";
const vals = series.map(x => x.v);
const minV = Math.min(...vals), maxV = Math.max(...vals);
const last = series[series.length - 1];
const first = series[0];
const delta = last.v - first.v;
const pct = first.v > 0 ? Math.round((delta / first.v) * 100) : 0;
const trendTxt = series.length === 1
? `Снимок ${first.d} (${first.s || "РФ"})`
: (delta === 0 ? "Без изменений" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("ru-RU")} ₽ (${delta > 0 ? "+" : ""}${pct}%)`);
const strokeCol = delta > 0 ? "#c42b1c" : "#0f7b0f";
const W = 240, H = 40, pad = 6;
const coords = series.map((pt, i) => {
const x = series.length === 1 ? W / 2 : pad + (i / (series.length - 1)) * (W - pad * 2);
const y = maxV === minV ? H / 2 : (H - pad) - ((pt.v - minV) / (maxV - minV)) * (H - pad * 2);
return [x.toFixed(1), y.toFixed(1)];
});
const polyline = coords.length > 1
? `<polyline fill="none" stroke="${strokeCol}" stroke-width="2" points="${coords.map(c => c.join(",")).join(" ")}" />`
: `<line x1="${pad}" y1="${H/2}" x2="${W-pad}" y2="${H/2}" stroke="#005fb8" stroke-width="1.5" stroke-dasharray="3 3" />`;
const dots = coords.map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="${i === coords.length - 1 ? 3.5 : 2.5}" fill="${i === coords.length - 1 ? "#005fb8" : strokeCol}" />`).join("");
return `<div id="divPriceHistorySparkline" class="my-2 p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-3" style="border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.03);">
<div>
<div class="font-bold">📈 История цены (${series.length} ${series.length === 1 ? "снимок" : "точек"})</div>
<div class="opacity-80 mt-0.5">Мин: <strong>${minV.toLocaleString("ru-RU")} ₽</strong> • Текущая: <strong>${last.v.toLocaleString("ru-RU")} ₽</strong> • ${trendTxt}</div>
</div>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="flex-shrink:0;" aria-label="График цены">${polyline}${dots}</svg>
</div>`;
}
if (typeof openModelModal === "function" && !window.__sparklineHooked) {
window.__sparklineHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#divPriceHistorySparkline")) return;
const spHtml = buildPriceSparklineHtml(m);
if (!spHtml) return;
const wrap = document.createElement("div");
wrap.innerHTML = spHtml;
const el = wrap.firstElementChild;
if (!el) return;
const riskCard = body.querySelector("#divPvzPriceRiskCard");
if (riskCard && riskCard.nextSibling) body.insertBefore(el, riskCard.nextSibling);
else if (body.firstChild) body.insertBefore(el, body.firstChild);
else body.appendChild(el);
} catch (_) {}
};
}
const PVZ_STEPS = [
"1. Внешний осмотр коробки и заводских пломб (нет вмятин, следов повторного скотча — снимите распаковку на видео).",
"2. Сверка серийного номера (S/N) на коробке и на наклейке сзади монитора + проверка точной ревизии модели.",
"3. Проверка комплектации: кабель DP/HDMI, блок питания/шнур, подставка, винты VESA и отсутствие люфта ножки.",
"4. Осмотр поверхности экрана при выключенном питании под фонариком (нет царапин, сколов, отслоения плёнки).",
"5. Битые пиксели и субпиксели: прогон 8 заливок (чёрный, белый, R/G/B, 5% серый) в 14-шаговом тесте.",
"6. Равномерность, засветы (IPS Glow / Backlight Bleed) и 5% Grey Banding (особенно важно для OLED).",
"7. Проверка часов наработки (Panel Hours) и кода матрицы в сервисном меню бренда ниже (не меняйте Gain/Offset!)."
];
const PVZ_KEY = "monitor_db_pvz_checks_v1";
function loadPvzState() {
try { return JSON.parse(localStorage.getItem(PVZ_KEY) || "[]"); } catch (_) { return []; }
}
function savePvzState(arr) {
try { localStorage.setItem(PVZ_KEY, JSON.stringify(arr)); } catch (_) {}
}
function renderPvzChecklist() {
const box = document.getElementById("divPvzChecklist");
const lbl = document.getElementById("lblPvzProgress");
if (!box) return;
const saved = loadPvzState();
let doneCount = 0;
box.innerHTML = PVZ_STEPS.map((txt, i) => {
const ck = !!saved[i];
if (ck) doneCount++;
return `<label class="pvz-check-row">
<input type="checkbox" data-pvz-idx="${i}" ${ck ? "checked" : ""} class="w-4 h-4 mt-0.5" style="accent-color:#005fb8;" />
<span style="${ck ? "text-decoration:line-through;opacity:0.6;" : ""}">${txt}</span>
</label>`;
}).join("");
if (lbl) lbl.textContent = `Проверено: ${doneCount} / ${PVZ_STEPS.length}`;
box.querySelectorAll("input[data-pvz-idx]").forEach(inp => {
inp.addEventListener("change", () => {
const st = loadPvzState();
st[Number(inp.dataset.pvzIdx)] = inp.checked;
savePvzState(st);
renderPvzChecklist();
});
});
}
function populatePvzServiceMenus() {
const sel = document.getElementById("selPvzServiceBrand");
const out = document.getElementById("divPvzServiceOut");
if (!sel || !out || typeof DB === "undefined" || !DB.ref_sheets || !DB.ref_sheets.service_menus) return;
if (sel.options && sel.options.length > 1) return;
const menus = DB.ref_sheets.service_menus;
sel.innerHTML = `<option value="">— Выберите бренд (${menus.length}) —</option>` +
menus.map((m, idx) => `<option value="${idx}">${m.brand}</option>`).join("");
sel.addEventListener("change", () => {
const idx = sel.value === "" ? -1 : Number(sel.value);
if (idx < 0 || !menus[idx]) {
out.textContent = "Выберите бренд монитора, чтобы увидеть комбинацию входа и безопасного выхода.";
return;
}
const item = menus[idx];
out.innerHTML = `<strong>${item.brand}:</strong> ${item.howto || "Нет данных"}`;
});
}
function openPvzExpressMode() {
const mdl = document.getElementById("mdlPvzExpress");
if (!mdl) return;
renderPvzChecklist();
populatePvzServiceMenus();
mdl.classList.remove("hidden");
}
window.openPvzExpressMode = openPvzExpressMode;
const btnClosePvz = document.getElementById("btnClosePvzExpress");
if (btnClosePvz) btnClosePvz.addEventListener("click", () => {
const mdl = document.getElementById("mdlPvzExpress");
if (mdl) mdl.classList.add("hidden");
});
const btnPvzReset = document.getElementById("btnPvzResetCheck");
if (btnPvzReset) btnPvzReset.addEventListener("click", () => {
savePvzState([]);
renderPvzChecklist();
});
const btnPvz14 = document.getElementById("btnPvzLaunch14Steps");
if (btnPvz14) btnPvz14.addEventListener("click", () => {
const mdl = document.getElementById("mdlPvzExpress");
if (mdl) mdl.classList.add("hidden");
if (typeof switchTab === "function") switchTab("tests");
setTimeout(() => {
const b = document.getElementById("btnLaunchFullGuidedSuite");
if (b && typeof b.click === "function") b.click();
}, 50);
});
const btnPvzCopy = document.getElementById("btnPvzCopyLink");
if (btnPvzCopy) btnPvzCopy.addEventListener("click", () => {
const url = (location.origin && location.origin !== "null" ? location.origin : "") + (location.pathname || "") + "#test=pvz";
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(url).catch(() => {});
}
btnPvzCopy.textContent = "✓ Скопировано";
setTimeout(() => { btnPvzCopy.textContent = "🔗 Ссылка на Режим ПВЗ"; }, 1600);
});
function injectPvzHeaderButton() {
if (document.getElementById("btnHeaderPvzMode")) return;
const anchor = document.getElementById("btnHeaderToolsMenu") || document.getElementById("btnQuickScreenTest");
if (!anchor || !anchor.parentNode) return;
const btn = document.createElement("button");
btn.type = "button";
btn.id = "btnHeaderPvzMode";
btn.className = "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition";
btn.style.cssText = "background:rgba(0,95,184,0.12);color:#005fb8;border:1px solid rgba(0,95,184,0.35);";
btn.textContent = "📱 Режим ПВЗ";
btn.title = "Автономный экран приёмки монитора в ПВЗ: чек-лист, сервисное меню и 14-шаговый тест";
btn.addEventListener("click", openPvzExpressMode);
anchor.parentNode.insertBefore(btn, anchor);
}
setTimeout(injectPvzHeaderButton, 20);
if (typeof window.__applyHashRoute === "function") {
const _origHash = window.__applyHashRoute;
window.__applyHashRoute = function() {
const raw = (location.hash || "").replace(/^#/, "").trim();
if (raw === "test=pvz" || raw === "tab=pvz" || raw === "pvz") {
openPvzExpressMode();
return;
}
_origHash.apply(this, arguments);
};
window.addEventListener("hashchange", () => {
const raw = (location.hash || "").replace(/^#/, "").trim();
if (raw === "test=pvz" || raw === "tab=pvz" || raw === "pvz") openPvzExpressMode();
});
}
})();
/* === ALL_TABS_WINUI3_AND_PVZ_PRINT_SHEET_JS === */
(function() {
function escHtml(s) {
return String(s == null ? "" : s)
.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function openPrintablePvzSheet(m) {
if (!m) return;
const brandLow = String(m.brand_canonical || m.brand || "").toLowerCase();
const modelLow = String(m.model || "").toLowerCase();
let srvCombo = "Не найдена в справочнике — проверьте комбинацию для OEM-завода (TPV / KTC / HKC / InnoCN).";
if (typeof DB !== "undefined" && DB.ref_sheets && Array.isArray(DB.ref_sheets.service_menus)) {
const hit = DB.ref_sheets.service_menus.find(s => {
const b = String(s.brand || "").toLowerCase();
return b && (brandLow.includes(b) || b.includes(brandLow));
});
if (hit && hit.howto) srvCombo = hit.howto;
}
const flags = [];
if (typeof DB !== "undefined" && DB.ref_sheets && Array.isArray(DB.ref_sheets.red_flags)) {
DB.ref_sheets.red_flags.forEach(rf => {
const rm = String(rf.model || "").toLowerCase();
if (rm && (rm.includes(modelLow) || modelLow.split(/\s+/).some(tok => tok.length >= 6 && rm.includes(tok)))) {
flags.push(`${rf.model}: ${rf.defect || rf.panel || ""}`);
}
});
}
const stores = (Array.isArray(m.stores) ? m.stores : [])
.filter(s => s && s.url)
.slice(0, 4)
.map(s => `<li><strong>${escHtml(s.name)}:</strong> ${escHtml(s.url)}</li>`).join("");
const docHtml = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Шпаргалка ПВЗ — ${escHtml(m.model)}</title>
<style>
@page { size: A4; margin: 12mm; }
body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111; font-size: 11.5px; line-height: 1.45; margin: 0; }
h1 { font-size: 17px; margin: 0 0 4px; }
.sub { color: #555; font-size: 11px; margin-bottom: 10px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.box { border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; }
.box h2 { font-size: 12px; margin: 0 0 5px; color: #005fb8; }
.warn { border-color: #d1242f; background: #fff8f8; }
.warn h2 { color: #d1242f; }
ul { margin: 4px 0 0; padding-left: 16px; }
.chk { list-style: none; padding-left: 0; }
.chk li { margin-bottom: 4px; }
.foot { margin-top: 10px; font-size: 10px; color: #666; border-top: 1px solid #e5e7eb; padding-top: 6px; display: flex; justify-content: space-between; }
@media print { .noprint { display: none; } }
</style>
<style id="winui3UnifiedSystemStyle">
/* === UNIFIED WINUI 3 DESIGN SYSTEM (ALL 11 TABS • LIGHT/DARK • DESKTOP/MOBILE • LITE/FULL) === */
:root {
--u-bg: #f3f3f3;
--u-surface: #ffffff;
--u-surface-alt: #f8f9fa;
--u-border: rgba(0, 0, 0, 0.09);
--u-text: #1b1b1b;
--u-muted: #5c5c5c;
--u-accent: #005fb8;
--u-accent-soft: rgba(0, 95, 184, 0.10);
--u-accent-border: rgba(0, 95, 184, 0.35);
--u-th-bg: rgba(248, 249, 250, 0.96);
}
html.dark {
--u-bg: #202020;
--u-surface: #2b2b2b;
--u-surface-alt: #252525;
--u-border: rgba(255, 255, 255, 0.09);
--u-text: #f3f3f3;
--u-muted: #b8b8b8;
--u-accent: #60cdff;
--u-accent-soft: rgba(96, 205, 255, 0.12);
--u-accent-border: rgba(96, 205, 255, 0.38);
--u-th-bg: rgba(38, 38, 38, 0.96);
}
/* 1. Uniform calm card surfaces across ALL 11 sections */
section[id^="sec"] > div {
background: var(--u-surface) !important;
border: 1px solid var(--u-border) !important;
border-radius: 8px !important;
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
}
html.dark section[id^="sec"] > div {
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28) !important;
}
/* Eliminate jarring white / bright pastel boxes in Dark Mode across all 11 tabs */
html.dark section[id^="sec"] .bg-white,
html.dark section[id^="sec"] .bg-slate-50,
html.dark section[id^="sec"] .bg-slate-100,
html.dark section[id^="sec"] [class*="bg-indigo-50"],
html.dark section[id^="sec"] [class*="bg-blue-50"],
html.dark section[id^="sec"] [class*="bg-emerald-50"],
html.dark section[id^="sec"] [class*="bg-amber-50"],
html.dark section[id^="sec"] [class*="bg-rose-50"],
html.dark section[id^="sec"] [class*="bg-purple-50"],
html.dark section[id^="sec"] [class*="bg-teal-50"],
html.dark section[id^="sec"] [class*="bg-cyan-50"] {
background-color: #2f2f2f !important;
border-color: rgba(255, 255, 255, 0.1) !important;
color: #f0f0f0 !important;
}
html.dark section[id^="sec"] .text-slate-900,
html.dark section[id^="sec"] .text-slate-800,
html.dark section[id^="sec"] .text-slate-700,
html.dark section[id^="sec"] .text-indigo-950,
html.dark section[id^="sec"] .text-indigo-900,
html.dark section[id^="sec"] .text-blue-900,
html.dark section[id^="sec"] .text-emerald-900 {
color: #efefef !important;
}
html.dark section[id^="sec"] .text-slate-600,
html.dark section[id^="sec"] .text-slate-500 {
color: #b8b8b8 !important;
}
/* 2. Unified WinUI 3 Inputs & Selects */
section[id^="sec"] select,
section[id^="sec"] input[type="text"],
section[id^="sec"] input[type="search"],
#mdlPvzExpress select {
background: var(--u-surface) !important;
color: var(--u-text) !important;
border: 1px solid var(--u-border) !important;
border-bottom: 1.5px solid rgba(128, 128, 128, 0.45) !important;
border-radius: 4px !important;
}
html.dark section[id^="sec"] select,
html.dark section[id^="sec"] input[type="text"],
html.dark section[id^="sec"] input[type="search"],
html.dark #mdlPvzExpress select {
background: #323232 !important;
}
section[id^="sec"] select:focus,
section[id^="sec"] input:focus {
border-bottom-color: var(--u-accent) !important;
outline: none !important;
}
/* 3. Unified Sticky Table Headers across Catalog, Compare, Market, Flagships, Panels, Revisions, Brands */
#secMarket .overflow-x-auto,
#secFlagships .overflow-x-auto,
#secPanelsOem .overflow-x-auto,
#secRevisions .overflow-x-auto,
#secBrandsSrv .overflow-x-auto,
#divCompareContent {
max-height: 75vh;
overflow: auto !important;
position: relative;
}
#secMarket table thead th,
#secFlagships table thead th,
#secPanelsOem table thead th,
#secRevisions table thead th,
#secBrandsSrv table thead th,
#divCompareContent table thead th {
position: sticky !important;
top: 0 !important;
z-index: 20 !important;
background: var(--u-th-bg) !important;
backdrop-filter: blur(10px) !important;
border-bottom: 2px solid var(--u-accent-border) !important;
}
/* Compare sticky left parameter column + diff highlight */
#divCompareContent table { border-collapse: separate !important; border-spacing: 0 !important; width: 100%; }
#divCompareContent table tbody td:first-child,
#divCompareContent table thead th:first-child {
position: sticky !important;
left: 0 !important;
z-index: 15 !important;
background: var(--u-surface-alt) !important;
border-right: 1px solid var(--u-border) !important;
min-width: 150px;
}
#divCompareContent table thead th:first-child { z-index: 25 !important; }
#divCompareContent tr.cmp-diff-row td { background-color: var(--u-accent-soft); }
/* 4. Restrained Neutral Toolbar Buttons in Compare + Unified Accent Buttons (Light & Dark) */
#secCompare #btnCopyCompareMarkdown,
#secCompare #btnCopyCompareTsv,
#secCompare #btnExportCompareReportHtml,
#secCompare #btnExportCompareSummaryTxt,
#secCompare #btnExportCompareCard {
background: rgba(128, 128, 128, 0.08) !important;
color: var(--u-text) !important;
border: 1px solid var(--u-border) !important;
border-radius: 5px !important;
font-weight: 600 !important;
box-shadow: none !important;
}
#secCompare #btnCopyCompareMarkdown:hover,
#secCompare #btnCopyCompareTsv:hover,
#secCompare #btnExportCompareReportHtml:hover,
#secCompare #btnExportCompareSummaryTxt:hover,
#secCompare #btnExportCompareCard:hover {
background: rgba(128, 128, 128, 0.15) !important;
}
#btnHeaderPvzMode,
#btnCopyCompareLink,
#btnCopyModelDeepLink,
#btnCopyGuidedTestLink,
#btnPvzCopyLink,
#secCompare label:has(#chkCompareDiffOnly) {
color: var(--u-accent) !important;
background: var(--u-accent-soft) !important;
border: 1px solid var(--u-accent-border) !important;
border-radius: 6px !important;
font-weight: 600 !important;
}
#btnPrintPvzSheet {
color: var(--u-text) !important;
background: rgba(128, 128, 128, 0.1) !important;
border: 1px solid var(--u-border) !important;
}
/* Status badge contrast in Dark Mode */
html.dark #divPvzPriceRiskCard [style*="#005fb8"],
html.dark #divComparePvzSummary [style*="#005fb8"],
html.dark #divCableBwCard [style*="#005fb8"] { color: #60cdff !important; }
html.dark #divPvzPriceRiskCard [style*="#0f7b0f"],
html.dark #divEyeDistanceWidget [style*="#0f7b0f"],
html.dark #divCableBwCard [style*="#0f7b0f"] { color: #6ccb5f !important; border-color: rgba(108,203,95,0.4) !important; background: rgba(108,203,95,0.12) !important; }
html.dark #divPvzPriceRiskCard [style*="#9d5d00"],
html.dark #divEyeDistanceWidget [style*="#9d5d00"],
html.dark #divCableBwCard [style*="#9d5d00"] { color: #fce100 !important; border-color: rgba(252,225,0,0.38) !important; background: rgba(252,225,0,0.10) !important; }
html.dark #divPvzPriceRiskCard [style*="#c42b1c"],
html.dark #divEyeDistanceWidget [style*="#c42b1c"] { color: #ff99a4 !important; border-color: rgba(255,153,164,0.4) !important; background: rgba(255,153,164,0.12) !important; }
html.dark #btnPvzLaunch14Steps { background: #60cdff !important; color: #111111 !important; }
/* 5. Modal Engineering Tools Accordion (#dtlModalToolsGroup) */
#dtlModalToolsGroup {
margin: 8px 0;
border: 1px solid var(--u-border);
border-radius: 8px;
background: rgba(128, 128, 128, 0.03);
padding: 6px 10px;
}
#dtlModalToolsGroup > summary {
cursor: pointer;
font-size: 12px;
font-weight: 700;
color: var(--u-accent);
padding: 4px 2px;
list-style: none;
display: flex;
align-items: center;
justify-content: space-between;
}
#dtlModalToolsGroup > summary::-webkit-details-marker { display: none; }
/* 6. Clean Lite Mode (Упрощённый режим): hide pro export noise & keep every tab uncluttered */
body.lite-mode #btnCopyCompareMarkdown,
body.lite-mode #btnCopyCompareTsv,
body.lite-mode #btnExportCompareSummaryTxt,
body.lite-mode #btnExportCompareCard,
html.lite-mode #btnCopyCompareMarkdown,
html.lite-mode #btnCopyCompareTsv,
html.lite-mode #btnExportCompareSummaryTxt,
html.lite-mode #btnExportCompareCard {
display: none !important;
}
/* 7. PVZ Express Modal (#mdlPvzExpress) */
#mdlPvzExpress {
position: fixed; inset: 0; z-index: 90;
background: rgba(0, 0, 0, 0.62); backdrop-filter: blur(8px);
display: flex; align-items: center; justify-content: center; padding: 12px;
}
#mdlPvzExpress.hidden { display: none !important; }
#mdlPvzExpress .pvz-sheet {
width: 100%; max-width: 680px; max-height: 92dvh; overflow-y: auto;
background: var(--u-surface); color: var(--u-text);
border: 1px solid var(--u-border); border-radius: 10px; padding: 18px;
box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}
#mdlPvzExpress .pvz-check-row {
display: flex; align-items: flex-start; gap: 10px;
padding: 10px 12px; border-radius: 6px;
border: 1px solid var(--u-border); cursor: pointer;
transition: background 0.15s ease;
}
#mdlPvzExpress .pvz-check-row:hover { background: var(--u-accent-soft); }
/* 8. Unified Mobile & PVZ Responsiveness (<= 768px & <= 480px) across ALL 11 tabs */
@media (max-width: 768px) {
body { font-size: 13px !important; padding-bottom: 24px !important; }
header, .header-bar, nav { padding-left: 10px !important; padding-right: 10px !important; }
header button, header select, [data-tab], .tab-btn {
min-height: 36px !important; padding-top: 6px !important; padding-bottom: 6px !important; font-size: 12px !important;
}
.tabs-bar, nav[role="tablist"], #tabNav {
overflow-x: auto !important; -webkit-overflow-scrolling: touch !important;
flex-wrap: nowrap !important; scrollbar-width: none !important;
}
.overflow-x-auto, #divCompareContent { -webkit-overflow-scrolling: touch !important; }
table th, table td { padding: 6px 8px !important; font-size: 11.5px !important; }
#divCompareContent table tbody td:first-child,
#divCompareContent table thead th:first-child { min-width: 115px !important; max-width: 135px !important; font-size: 11px !important; }
#mdlDetail > div, #mdlDetail .modal-content, #mdlDetail [class*="max-w-"] {
width: 100vw !important; max-width: 100vw !important; margin: 0 !important;
border-radius: 0 !important; max-height: 100dvh !important; padding: 12px !important;
}
#mdlDetail .grid { grid-template-columns: 1fr !important; }
#mdlPvzExpress { padding: 0; }
#mdlPvzExpress .pvz-sheet { max-width: 100vw; max-height: 100dvh; height: 100dvh; border-radius: 0; padding: 14px; }
#mdlFullGuidedSuite button { min-height: 36px !important; padding: 6px 10px !important; font-size: 12px !important; }
#mdlFullGuidedSuite .fgs-kbd-hint { display: none !important; }
section[id^="sec"] .grid-cols-2,
section[id^="sec"] .grid-cols-3,
section[id^="sec"] .grid-cols-4 { grid-template-columns: 1fr !important; }
}
@media (max-width: 480px) {
#secCompare button, #secCompare label:has(#chkCompareDiffOnly) { font-size: 11px !important; padding: 6px 8px !important; }
}
/* === Wave 12: Smart Finder 1-Click Presets (WinUI 3 Light/Dark/Mobile/Lite) === */
.fnd-presets-bar { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; }
.fnd-preset-btn {
display: inline-flex; align-items: center; gap: 6px;
padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
border: 1px solid #cbd5e1; background: #f8fafc; color: #0f172a;
cursor: pointer; transition: background .15s, border-color .15s, color .15s, transform .1s;
}
.fnd-preset-btn:hover { background: #e0f2fe; border-color: #005fb8; color: #005fb8; }
.fnd-preset-btn.is-active { background: #005fb8; border-color: #005fb8; color: #ffffff; box-shadow: 0 2px 6px rgba(0,95,184,.25); }
.fnd-preset-explain {
display: none; align-items: center; justify-content: space-between; gap: 10px;
padding: 8px 12px; border-radius: 10px; font-size: 12px;
background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a;
}
.fnd-preset-explain.is-visible { display: flex; flex-wrap: wrap; }
html.dark .fnd-preset-btn { background: #1e293b; border-color: #334155; color: #e2e8f0; }
html.dark .fnd-preset-btn:hover { background: #0f172a; border-color: #60cdff; color: #60cdff; }
html.dark .fnd-preset-btn.is-active { background: #005fb8; border-color: #60cdff; color: #ffffff; }
html.dark .fnd-preset-explain { background: rgba(0,95,184,.18); border-color: rgba(96,205,255,.35); color: #dbeafe; }
@media (max-width: 640px) {
.fnd-presets-bar { gap: 6px; }
.fnd-preset-btn { font-size: 11px; padding: 5px 10px; }
}
/* === Wave 13: Device Compatibility Matrix Card (WinUI 3 Light/Dark) === */
.compat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
.compat-item {
border: 1px solid var(--u-border, #e2e8f0); border-radius: 8px; padding: 8px 10px;
background: rgba(128,128,128,.04); font-size: 11.5px; line-height: 1.35;
}
.compat-item-title { font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
.compat-pill { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; white-space: nowrap; }
.compat-pill.ok { background: rgba(16,185,129,.16); color: #047857; }
.compat-pill.warn { background: rgba(245,158,11,.18); color: #b45309; }
.compat-pill.no { background: rgba(148,163,184,.2); color: #475569; }
html.dark .compat-pill.ok { background: rgba(16,185,129,.22); color: #6ee7b7; }
html.dark .compat-pill.warn { background: rgba(245,158,11,.22); color: #fcd34d; }
html.dark .compat-pill.no { background: rgba(148,163,184,.22); color: #cbd5e1; }
@media (max-width: 640px) { .compat-grid { grid-template-columns: 1fr; } }
/* === Wave 14: Similar Alternatives Card & Compare Verdict Panel (WinUI 3) === */
.sim-alt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
.sim-alt-card {
border: 1px solid var(--u-border, #e2e8f0); border-radius: 8px; padding: 8px 10px;
background: rgba(128,128,128,.04); display: flex; flex-direction: column; justify-content: space-between; gap: 6px;
}
.sim-alt-card:hover { border-color: var(--u-accent, #005fb8); }
.sim-alt-actions { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
.cmp-verdict-box {
margin-bottom: 12px; padding: 12px 14px; border-radius: 12px;
border: 1px solid #bfdbfe; background: #eff6ff; color: #0f172a;
}
html.dark .cmp-verdict-box { border-color: rgba(96,205,255,.35); background: rgba(0,95,184,.16); color: #f1f5f9; }
.cmp-verdict-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cmp-verdict-chip {
font-size: 11.5px; padding: 4px 9px; border-radius: 999px;
background: rgba(255,255,255,.85); border: 1px solid #cbd5e1; color: #0f172a;
}
html.dark .cmp-verdict-chip { background: rgba(15,23,42,.75); border-color: #334155; color: #e2e8f0; }
@media (max-width: 640px) { .sim-alt-grid { grid-template-columns: 1fr; } }
/* === Wave 15: Top RF Drops Banner & Offline Duty Calculator (WinUI 3 Light/Dark) === */
.w15-panel {
margin-bottom: 10px; border: 1px solid var(--u-border, #e2e8f0); border-radius: 12px;
background: var(--u-surface, #ffffff); padding: 8px 12px; font-size: 12px;
}
html.dark .w15-panel { background: rgba(30,41,59,.72); border-color: #334155; color: #e2e8f0; }
.w15-panel > summary {
cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between;
gap: 8px; list-style: none;
}
.w15-panel > summary::-webkit-details-marker { display: none; }
.drops-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
@media (max-width: 1100px) { .drops-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .drops-grid { grid-template-columns: 1fr; } }
.drop-chip {
border: 1px solid var(--u-border, #e2e8f0); border-radius: 9px; padding: 8px 10px;
background: rgba(16,185,129,.06); cursor: pointer; text-align: left;
transition: border-color .15s, transform .1s;
}
.drop-chip:hover { border-color: #10b981; transform: translateY(-1px); }
.duty-calc-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 8px; }
.duty-calc-row input, .duty-calc-row select {
border: 1px solid #cbd5e1; border-radius: 7px; padding: 4px 8px; font-size: 12px; font-weight: 600;
background: #ffffff; color: #0f172a;
}
html.dark .duty-calc-row input, html.dark .duty-calc-row select {
background: #0f172a; border-color: #475569; color: #f8fafc;
}
/* === Catalog Table 9-Column Fit Fix (Zero Right-Edge Cutoff on Desktop) === */
@media (min-width: 1024px) {
#tblCatalogMain {
table-layout: fixed !important;
width: 100% !important;
}
#tblCatalogMain th,
#tblCatalogMain td {
padding: 7px 6px !important;
overflow-wrap: break-word;
word-break: break-word;
vertical-align: top;
}
#tblCatalogMain th:nth-child(1), #tblCatalogMain td:nth-child(1) { width: 4.5% !important; }
#tblCatalogMain th:nth-child(2), #tblCatalogMain td:nth-child(2) { width: 19.5% !important; }
#tblCatalogMain th:nth-child(3), #tblCatalogMain td:nth-child(3) { width: 10.5% !important; }
#tblCatalogMain th:nth-child(4), #tblCatalogMain td:nth-child(4) { width: 9.5% !important; }
#tblCatalogMain th:nth-child(5), #tblCatalogMain td:nth-child(5) { width: 15% !important; }
#tblCatalogMain th:nth-child(6), #tblCatalogMain td:nth-child(6) { width: 10.5% !important; }
#tblCatalogMain th:nth-child(7), #tblCatalogMain td:nth-child(7) { width: 10.5% !important; }
#tblCatalogMain th:nth-child(8), #tblCatalogMain td:nth-child(8) { width: 8% !important; }
#tblCatalogMain th:nth-child(9), #tblCatalogMain td:nth-child(9) { width: 12% !important; }
}
@media (max-width: 1023px) {
#tblCatalogMain { min-width: 960px; }
}
/* === Wave 24: Clean 7-Item Header Dropdown & Quick Hardware Spec Badges === */
#dtlHeaderToolsMenu { position: relative; }
#dtlHeaderToolsMenu > summary { list-style: none; cursor: pointer; }
#dtlHeaderToolsMenu > summary::-webkit-details-marker { display: none; }
#dtlHeaderToolsMenu .hdr-tools-pop {
position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
min-width: 230px; padding: 8px; border-radius: 12px;
background: #0f172a; border: 1px solid #334155; box-shadow: 0 12px 30px rgba(0,0,0,.45);
display: flex; flex-direction: column; gap: 6px;
}
#dtlHeaderToolsMenu .hdr-tools-pop button { width: 100%; text-align: left; }
.qspec-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.qspec-pill {
font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 6px;
border: 1px solid #cbd5e1; background: #f1f5f9; color: #0f172a; white-space: nowrap;
}
.qspec-pill.hi { background: #e0f2fe; border-color: #7dd3fc; color: #0369a1; }
.qspec-pill.gl { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
html.dark .qspec-pill { background: #1e293b; border-color: #334155; color: #e2e8f0; }
html.dark .qspec-pill.hi { background: rgba(14,165,233,.18); border-color: rgba(56,189,248,.4); color: #7dd3fc; }
html.dark .qspec-pill.gl { background: rgba(245,158,11,.18); border-color: rgba(251,191,36,.4); color: #fcd34d; }
</style>
</head><body>
<div class="noprint" style="margin-bottom:10px;text-align:right;">
<button onclick="window.print()" style="padding:6px 14px;background:#005fb8;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:600;">🖨️ Печать / Сохранить в PDF</button>
</div>
<h1>Шпаргалка приёмки в ПВЗ: ${escHtml(m.model)}</h1>
<div class="sub">Бренд: ${escHtml(m.brand_canonical || m.brand)} • Тир: ${escHtml(m.tier)} • ${escHtml(m.diag)}″ ${escHtml(m.res)} • ${escHtml(m.max_hz)} Гц • Год: ${escHtml(m.year)}</div>
<div class="grid">
<div class="box">
<h2>🎯 Ожидаемое железо и матрица</h2>
<div><strong>Матрица:</strong> ${escHtml(m.pmodel || "Не указана")}</div>
<div><strong>Тип / Покрытие:</strong> ${escHtml(m.ptype || "—")} / ${escHtml(m.coat || "—")}</div>
<div><strong>OEM-сборщик:</strong> ${escHtml(m.oem || "—")}</div>
<div><strong>Отклик / Контраст / HDR:</strong> ${escHtml(m.gtg80 || "—")} мс / ${escHtml(m.cr || "—")}:1 / ${escHtml(m.hdr || "—")} нит</div>
</div>
<div class="box">
<h2>💰 Ориентир цен и магазины</h2>
<div><strong>Цена «на руки»:</strong> ${m.hand ? Number(m.hand).toLocaleString("ru-RU") + " ₽" : "—"}</div>
<div><strong>Розница РФ:</strong> ${m.price_retail_rf ? Number(m.price_retail_rf).toLocaleString("ru-RU") + " ₽" : "—"}</div>
${stores ? `<ul>${stores}</ul>` : "<div>Прямые карточки магазинов РФ не привязаны</div>"}
</div>
</div>
<div class="box ${flags.length ? "warn" : ""}" style="margin-bottom:10px;">
<h2>${flags.length ? "⚠️ Внимание: известные ревизии / «лотерея панелей»" : "✅ Проверка по базе «Красных флагов»"}</h2>
<div>${flags.length ? flags.map(escHtml).join("<br/>") : "По данной модели критических записей о скрытой подмене матриц в базе не зафиксировано — всё равно сверьте код панели в сервисном меню."}</div>
</div>
<div class="box" style="margin-bottom:10px;">
<h2>🛠️ Сервисное меню (${escHtml(m.brand_canonical || m.brand)}) — часы наработки и код панели</h2>
<div>${escHtml(srvCombo)}</div>
</div>
<div class="box">
<h2>📋 Чек-лист осмотра монитора в ПВЗ</h2>
<ul class="chk">
<li>☐ 1. Коробка без пробоин, заводские пломбы не вскрыты (видео распаковки).</li>
<li>☐ 2. Серийный номер (S/N) на коробке совпадает с наклейкой на корпусе.</li>
<li>☐ 3. Комплект: кабели DP/HDMI, блок питания, подставка, винты VESA.</li>
<li>☐ 4. Экран под фонариком: нет царапин, сколов и отслоения плёнки.</li>
<li>☐ 5. Заливки (чёрный, белый, R/G/B, 5% серый): нет битых пикселей и полос.</li>
<li>☐ 6. Равномерность: допустимый IPS Glow / отсутствие жёстких жёлтых засветов.</li>
<li>☐ 7. Сервисное меню: часы наработки близки к 0 ч, матрица соответствует ожидаемой.</li>
</ul>
</div>
<div class="foot">
<span>monitor_full_database • Портал: https://tapocket.github.io/monitor_full_database/#model=${escHtml(m.id)}</span>
<span>14-шаговый тест ПВЗ: #test=guided</span>
</div>
</body></html>`;
const w = window.open("", "_blank", "width=860,height=960");
if (w && w.document) {
w.document.open();
w.document.write(docHtml);
w.document.close();
}
}
window.openPrintablePvzSheet = openPrintablePvzSheet;
if (typeof openModelModal === "function" && !window.__pvzPrintBtnHooked) {
window.__pvzPrintBtnHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#btnPrintPvzSheet")) return;
const linkBtn = body.querySelector("#btnCopyModelDeepLink");
const printBtn = document.createElement("button");
printBtn.type = "button";
printBtn.id = "btnPrintPvzSheet";
printBtn.className = "px-2.5 py-1 rounded text-xs font-semibold transition";
printBtn.style.cssText = "background:rgba(128,128,128,0.1);border:1px solid rgba(128,128,128,0.3);";
printBtn.textContent = "🖨️ Шпаргалка ПВЗ (Печать / PDF)";
printBtn.title = "Открыть печатную одностраничную шпаргалку приёмки для этой модели";
printBtn.addEventListener("click", () => openPrintablePvzSheet(m));
if (linkBtn && linkBtn.parentNode) {
linkBtn.parentNode.insertBefore(printBtn, linkBtn);
} else {
body.insertBefore(printBtn, body.firstChild);
}
} catch (_) {}
};
}
})();
/* === KEYBOARD_SHORTCUTS_POLISH_V1 === */
(function() {
if (window.__winui3ShortcutsWired) return;
window.__winui3ShortcutsWired = true;
document.addEventListener("keydown", (e) => {
const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable);
if (e.key === "Escape") {
const pvz = document.getElementById("mdlPvzExpress");
if (pvz && !pvz.classList.contains("hidden")) {
pvz.classList.add("hidden");
return;
}
}
if (e.key === "/" && !inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
const flt = document.getElementById("fltSearch");
if (flt) {
e.preventDefault();
if (typeof switchTab === "function") switchTab("catalog");
flt.focus();
if (typeof flt.select === "function") flt.select();
}
}
});
})();
/* === ICC_CALIBRATION_AND_UNIFIED_BACKUP_V1 === */
(function() {
function findIccProfile(m) {
if (typeof DB === "undefined" || !DB.icc_profiles || !Array.isArray(DB.icc_profiles.profiles)) return null;
const pmodel = String(m.pmodel || "").toLowerCase();
const model = String(m.model || "").toLowerCase();
const ptype = String(m.ptype || "").toLowerCase();
const profs = DB.icc_profiles.profiles;
for (const p of profs) {
const cell = String(p.panel_cell || "").toLowerCase();
if (cell && pmodel && (pmodel.includes(cell) || cell.split(/\s+/).some(t => t.length >= 7 && pmodel.includes(t)))) {
return p;
}
if (Array.isArray(p.example_models) && p.example_models.some(ex => model.includes(String(ex).toLowerCase()))) {
return p;
}
}
if (ptype.includes("woled") && (pmodel.includes("tandem") || model.includes("wmg") || model.includes("ucwm"))) {
return profs.find(p => String(p.panel_cell || "").toLowerCase().includes("tandem woled")) || null;
}
if (ptype.includes("qd-oled")) {
return profs.find(p => String(p.panel_cell || "").toLowerCase().includes("qd-oled")) || null;
}
return null;
}
function buildIccCalibrationCardHtml(m) {
const p = findIccProfile(m);
if (!p) return "";
const hdr = p.win11_hdr_calib || {};
const hdrLine = (hdr.max_nits != null)
? `Win 11 HDR Calibration: Min <strong>${hdr.min_nits ?? 0}</strong> • Max <strong>${hdr.max_nits}</strong> • Full-Frame <strong>${hdr.max_full_nits ?? hdr.max_nits} нит</strong>`
: "";
return `<div id="divIccCalibCard" class="my-2 p-2.5 rounded-lg border text-xs space-y-1" style="border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.03);">
<div class="font-bold">🎨 Калибровка OSD / ICC / Windows 11 HDR (${p.panel_cell})</div>
<div><strong>Overdrive:</strong> ${p.recommended_overdrive || "—"}</div>
<div><strong>Пресет OSD:</strong> ${p.osd_preset || "—"}</div>
<div><strong>sRGB / ACM:</strong> ${p.srgb_clamp_tip || "—"}</div>
${hdrLine ? `<div><strong>${hdrLine}</strong></div>` : ""}
</div>`;
}
if (typeof openModelModal === "function" && !window.__iccCardHooked) {
window.__iccCardHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#divIccCalibCard")) return;
const iccHtml = buildIccCalibrationCardHtml(m);
if (!iccHtml) return;
const wrap = document.createElement("div");
wrap.innerHTML = iccHtml;
const el = wrap.firstElementChild;
if (!el) return;
const anchor = body.querySelector("#divPriceHistorySparkline") || body.querySelector("#divPvzPriceRiskCard");
if (anchor && anchor.nextSibling) body.insertBefore(el, anchor.nextSibling);
else if (body.firstChild) body.insertBefore(el, body.firstChild);
else body.appendChild(el);
} catch (_) {}
};
}
function collectUnifiedBackup() {
const dump = {};
try {
for (let i = 0; i < localStorage.length; i++) {
const k = localStorage.key(i);
if (k && (k.includes("monitor") || k.includes("fav") || k.includes("note") || k.includes("pvz") || k.includes("cmp") || k.includes("preset"))) {
dump[k] = localStorage.getItem(k);
}
}
["monitor_db_favs", "monitor_db_personal_watch_v1", "monitor_db_pvz_checklist_v1"].forEach(k => {
const v = localStorage.getItem(k);
if (v !== null && v !== undefined) dump[k] = v;
});
} catch (_) {}
return {
app: "monitor_full_database",
exported_at: new Date().toISOString(),
compare_ids: (typeof compareIds !== "undefined") ? Array.from(compareIds) : [],
local_storage: dump
};
}
function applyUnifiedBackup(data) {
if (!data || typeof data !== "object") return false;
if (data.local_storage && typeof data.local_storage === "object") {
Object.entries(data.local_storage).forEach(([k, v]) => {
try { if (typeof v === "string") localStorage.setItem(k, v); } catch (_) {}
});
}
if (Array.isArray(data.compare_ids) && typeof compareIds !== "undefined") {
compareIds.clear();
data.compare_ids.slice(0, 4).forEach(id => compareIds.add(Number(id)));
if (typeof updateCompareBadge === "function") { try { updateCompareBadge(); } catch (_) {} }
}
if (typeof favoriteIds !== "undefined") {
try {
const restoredFavs = JSON.parse(localStorage.getItem("monitor_db_favs") || "[]");
favoriteIds.clear();
restoredFavs.forEach(id => favoriteIds.add(Number(id)));
const lblF = document.getElementById("lblFavCount");
if (lblF) lblF.textContent = String(favoriteIds.size);
} catch (_) {}
}
if (typeof window.renderMyWatchlistPanel === "function") { try { window.renderMyWatchlistPanel(); } catch (_) {} }
return true;
}
window.collectUnifiedBackup = collectUnifiedBackup;
window.applyUnifiedBackup = applyUnifiedBackup;
const btnExp = document.getElementById("btnExportUnifiedBackup");
if (btnExp) {
btnExp.addEventListener("click", () => {
const payload = JSON.stringify(collectUnifiedBackup(), null, 2);
const blob = new Blob([payload], { type: "application/json" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = "monitor_db_backup_" + new Date().toISOString().slice(0, 10) + ".json";
document.body.appendChild(a);
a.click();
a.remove();
btnExp.textContent = "✓ Бэкап сохранён";
setTimeout(() => { btnExp.textContent = "💾 Экспорт бэкапа (.json)"; }, 1800);
});
}
const inpImp = document.getElementById("inpImportUnifiedBackup");
if (inpImp) {
inpImp.addEventListener("change", (ev) => {
const file = ev.target && ev.target.files && ev.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
try {
const parsed = JSON.parse(String(reader.result || "{}"));
if (applyUnifiedBackup(parsed)) {
if (typeof window.openPvzExpressMode === "function") window.openPvzExpressMode();
alert("Бэкап успешно импортирован (Избранное, заметки, сравнение и чек-лист ПВЗ восстановлены).");
}
} catch (err) {
alert("Ошибка чтения JSON-файла бэкапа.");
}
};
reader.readAsText(file);
});
}
})();
/* === VIEWING_DISTANCE_PPI_PPD_WIDGET_V1 === */
(function() {
const DIST_KEY = "monitor_db_desk_dist_cm_v1";
function parseResWh(resStr) {
const m = String(resStr || "").match(/(\d{3,4})\s*[xх×]\s*(\d{3,4})/i);
if (m) return [Number(m[1]), Number(m[2])];
const s = String(resStr || "").toUpperCase();
if (s.includes("5K") && s.includes("2K")) return [5120, 2160];
if (s.includes("5K")) return [5120, 2880];
if (s.includes("4K") || s.includes("UHD")) return [3840, 2160];
if (s.includes("UWQHD") || s.includes("3440")) return [3440, 1440];
if (s.includes("QHD") || s.includes("2K") || s.includes("1440")) return [2560, 1440];
if (s.includes("FHD") || s.includes("1080")) return [1920, 1080];
return [2560, 1440];
}
function calcEyeMetrics(diagIn, resStr, distCm) {
const d = Number(diagIn) || 27;
const [w, h] = parseResWh(resStr);
const ppi = Math.sqrt(w * w + h * h) / d;
const distIn = distCm / 2.54;
const ppd = 2 * distIn * Math.tan((0.5 * Math.PI) / 180) * ppi;
const retinaCm = Math.round((60 / (2 * Math.tan((0.5 * Math.PI) / 180) * ppi)) * 2.54);
let winScale = "100%";
if (ppi >= 180) winScale = "175–200%";
else if (ppi >= 140) winScale = "150%";
else if (ppi >= 118) winScale = "125%";
else if (ppi >= 96) winScale = "100% (или 125%)";
let verdict = "Отличная чёткость (уровень Retina)";
let badgeStyle = "color:#0f7b0f;border-color:rgba(15,123,15,0.35);background:rgba(15,123,15,0.08);";
if (ppd < 46) {
verdict = "Заметна пиксельная сетка — лучше отодвинуться";
badgeStyle = "color:#c42b1c;border-color:rgba(196,43,28,0.35);background:rgba(196,43,28,0.08);";
} else if (ppd < 57) {
verdict = "Комфортно для игр и работы (ниже порога Retina)";
badgeStyle = "color:#9d5d00;border-color:rgba(157,93,0,0.35);background:rgba(157,93,0,0.08);";
}
return {
ppi: ppi.toFixed(1),
ppd: ppd.toFixed(1),
retinaCm,
winScale,
verdict,
badgeStyle,
wh: `${w}×${h}`
};
}
function buildDistanceWidgetHtml(m, distCm) {
const mt = calcEyeMetrics(m.diag, m.res, distCm);
return `<div id="divEyeDistanceWidget" class="my-2 p-2.5 rounded-lg border text-xs space-y-2" style="border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.03);">
<div class="flex flex-wrap items-center justify-between gap-2">
<span class="font-bold">📏 Расстояние до глаз, PPI и масштаб Windows</span>
<span id="lblEyeVerdict" class="px-2 py-0.5 rounded font-semibold border" style="${mt.badgeStyle}">${mt.verdict}</span>
</div>
<div class="flex flex-wrap items-center gap-3">
<label class="font-medium whitespace-nowrap">До глаз: <strong id="lblEyeDistCm">${distCm} см</strong></label>
<input type="range" id="rngEyeDistCm" min="45" max="100" step="5" value="${distCm}" class="flex-1" style="accent-color:#005fb8;min-width:140px;" />
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
<div class="p-1.5 rounded border" style="border-color:rgba(128,128,128,0.16);"><div class="opacity-70 text-[11px]">Плотность</div><div class="font-bold">${mt.ppi} PPI</div></div>
<div class="p-1.5 rounded border" style="border-color:rgba(128,128,128,0.16);"><div class="opacity-70 text-[11px]">Угловая (Retina ≥60)</div><div class="font-bold" id="lblEyePpd">${mt.ppd} PPD</div></div>
<div class="p-1.5 rounded border" style="border-color:rgba(128,128,128,0.16);"><div class="opacity-70 text-[11px]">Порог Retina</div><div class="font-bold">от ${mt.retinaCm} см</div></div>
<div class="p-1.5 rounded border" style="border-color:rgba(128,128,128,0.16);"><div class="opacity-70 text-[11px]">Масштаб Windows</div><div class="font-bold">${mt.winScale}</div></div>
</div>
</div>`;
}
if (typeof openModelModal === "function" && !window.__eyeDistHooked) {
window.__eyeDistHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#divEyeDistanceWidget")) return;
let distCm = 65;
try {
const saved = Number(localStorage.getItem(DIST_KEY));
if (saved >= 45 && saved <= 100) distCm = saved;
} catch (_) {}
const wrap = document.createElement("div");
wrap.innerHTML = buildDistanceWidgetHtml(m, distCm);
const el = wrap.firstElementChild;
if (!el) return;
const anchor = body.querySelector("#divIccCalibCard") || body.querySelector("#divPriceHistorySparkline") || body.querySelector("#divPvzPriceRiskCard");
if (anchor && anchor.nextSibling) body.insertBefore(el, anchor.nextSibling);
else if (body.firstChild) body.insertBefore(el, body.firstChild);
else body.appendChild(el);
const rng = el.querySelector("#rngEyeDistCm");
if (rng) {
rng.addEventListener("input", () => {
const val = Number(rng.value) || 65;
try { localStorage.setItem(DIST_KEY, String(val)); } catch (_) {}
const upd = calcEyeMetrics(m.diag, m.res, val);
const lDist = el.querySelector("#lblEyeDistCm");
const lPpd = el.querySelector("#lblEyePpd");
const lVerd = el.querySelector("#lblEyeVerdict");
if (lDist) lDist.textContent = val + " см";
if (lPpd) lPpd.textContent = upd.ppd + " PPD";
if (lVerd) {
lVerd.textContent = upd.verdict;
lVerd.setAttribute("style", upd.badgeStyle);
}
});
}
} catch (_) {}
};
}
})();
/* === CABLE_BANDWIDTH_DSC_AND_PRICEDROP_FILTER_V1 === */
(function() {
const INTERFACES = [
{ name: "DP 1.4 (HBR3)", cap: 25.92, cable: "DP 1.4 VESA Certified" },
{ name: "DP 2.1 UHBR10", cap: 38.69, cable: "DP40 VESA Certified" },
{ name: "HDMI 2.1 (48G)", cap: 42.67, cable: "Ultra High Speed HDMI" },
{ name: "DP 2.1 UHBR13.5", cap: 52.22, cable: "DP54 VESA Certified" },
{ name: "DP 2.1 UHBR20", cap: 77.37, cable: "DP80 VESA Certified (до 1–1.2 м)" }
];
function parseResWhBw(resStr) {
const m = String(resStr || "").match(/(\d{3,4})\s*[xх×]\s*(\d{3,4})/i);
if (m) return [Number(m[1]), Number(m[2])];
const s = String(resStr || "").toUpperCase();
if (s.includes("5K") && s.includes("2K")) return [5120, 2160];
if (s.includes("5K")) return [5120, 2880];
if (s.includes("4K") || s.includes("UHD")) return [3840, 2160];
if (s.includes("UWQHD") || s.includes("3440")) return [3440, 1440];
if (s.includes("QHD") || s.includes("2K") || s.includes("1440")) return [2560, 1440];
if (s.includes("FHD") || s.includes("1080")) return [1920, 1080];
return [2560, 1440];
}
function calcRequiredGbps(resStr, hz, bpc) {
const [w, h] = parseResWhBw(resStr);
const rHz = Number(hz) || 144;
const gbps = (w * h * rHz * (bpc * 3) * 1.05) / 1e9;
return { w, h, hz: rHz, gbps };
}
function renderBwContent(m, bpc) {
const req = calcRequiredGbps(m.res, m.max_hz, bpc);
const minNoDsc = INTERFACES.find(i => i.cap >= req.gbps);
const verdict = minNoDsc
? `Без сжатия (без DSC): от ${minNoDsc.name} • Кабель: ${minNoDsc.cable}`
: `Требуется DSC 1.2a даже на DP 2.1 UHBR20 (>77.4 Гбит/с)`;
const chips = INTERFACES.map(ifc => {
const ok = ifc.cap >= req.gbps;
const st = ok
? "color:#0f7b0f;border-color:rgba(15,123,15,0.35);background:rgba(15,123,15,0.08);"
: "color:#9d5d00;border-color:rgba(157,93,0,0.3);background:rgba(157,93,0,0.06);";
return `<span class="px-2 py-0.5 rounded border text-[11px] font-medium" style="${st}">${ifc.name}: ${ok ? "Без DSC" : "Нужен DSC"}</span>`;
}).join("");
return `<div class="opacity-85">Сигнал <strong>${req.w}×${req.h} @ ${req.hz} Гц (${bpc}-бит RGB 4:4:4)</strong> → требуется <strong>${req.gbps.toFixed(2)} Гбит/с</strong></div>
<div class="font-semibold">${verdict}</div>
<div class="flex flex-wrap gap-1.5 pt-0.5">${chips}</div>`;
}
if (typeof openModelModal === "function" && !window.__bwCalcHooked) {
window.__bwCalcHooked = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const m = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!m || !body || body.querySelector("#divCableBwCard")) return;
const wrap = document.createElement("div");
wrap.innerHTML = `<div id="divCableBwCard" class="my-2 p-2.5 rounded-lg border text-xs space-y-1.5" style="border-color:rgba(128,128,128,0.22);background:rgba(128,128,128,0.03);">
<div class="flex flex-wrap items-center justify-between gap-2">
<span class="font-bold">🔌 Пропускная способность кабеля (DP / HDMI / DSC)</span>
<div class="inline-flex rounded border overflow-hidden text-[11px]" style="border-color:rgba(128,128,128,0.3);">
<button type="button" data-bw-bpc="8" class="px-2 py-0.5 font-semibold">8-бит</button>
<button type="button" data-bw-bpc="10" class="px-2 py-0.5 font-semibold" style="background:rgba(0,95,184,0.16);color:#005fb8;">10-бит (HDR)</button>
</div>
</div>
<div id="divCableBwBody" class="space-y-1">${renderBwContent(m, 10)}</div>
</div>`;
const el = wrap.firstElementChild;
if (!el) return;
const anchor = body.querySelector("#divEyeDistanceWidget") || body.querySelector("#divIccCalibCard") || body.querySelector("#divPvzPriceRiskCard");
if (anchor && anchor.nextSibling) body.insertBefore(el, anchor.nextSibling);
else if (body.firstChild) body.insertBefore(el, body.firstChild);
else body.appendChild(el);
el.querySelectorAll("button[data-bw-bpc]").forEach(btn => {
btn.addEventListener("click", () => {
const bpc = Number(btn.dataset.bwBpc) || 10;
el.querySelectorAll("button[data-bw-bpc]").forEach(b => { b.style.background = ""; b.style.color = ""; });
btn.style.background = "rgba(0,95,184,0.16)";
btn.style.color = "#005fb8";
const bBody = el.querySelector("#divCableBwBody");
if (bBody) bBody.innerHTML = renderBwContent(m, bpc);
});
});
} catch (_) {}
};
}
function hasPriceDropOrHistory(m, onlyDrops) {
if (typeof DB === "undefined" || !DB.price_history) return false;
const pts = DB.price_history[String(m.id)];
if (!Array.isArray(pts) || !pts.length) return false;
if (!onlyDrops) return true;
const vals = pts.map(p => Number(p.r || p.m || 0)).filter(v => v > 0);
const cur = Number(m.price_retail_rf || m.hand || m.rub || 0);
if (!vals.length || cur <= 0) return false;
return cur < Math.max(...vals);
}
function injectPriceDropFilterPill() {
if (document.getElementById("chkCatPriceHistory")) return;
const onlyRuChk = document.getElementById("chkCatOnlyRu");
const host = onlyRuChk && onlyRuChk.closest("label") && onlyRuChk.closest("label").parentNode;
if (!host) return;
const dropCount = (typeof DB !== "undefined" && DB.catalog)
? DB.catalog.filter(m => hasPriceDropOrHistory(m, true)).length
: 0;
const histCount = (typeof DB !== "undefined" && DB.price_history)
? Object.keys(DB.price_history).length
: 0;
const lbl = document.createElement("label");
lbl.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer";
lbl.style.cssText = "border-color:rgba(128,128,128,0.28);background:rgba(128,128,128,0.06);";
lbl.title = dropCount > 0
? "Показать модели, которые подешевели относительно прошлых снимков истории цен"
: "Показать модели с отслеживаемой историей цен РФ (по мере накопления снимков покажет скидки)";
lbl.innerHTML = `<input type="checkbox" id="chkCatPriceHistory" class="w-3.5 h-3.5" style="accent-color:#005fb8;" />` +
`<span>📉 ${dropCount > 0 ? `Снижение цены (${dropCount})` : `История цен РФ (${histCount})`}</span>`;
host.appendChild(lbl);
const chk = lbl.querySelector("#chkCatPriceHistory");
if (chk && typeof renderCatalog === "function") {
chk.addEventListener("change", () => { try { renderCatalog(); } catch (_) {} });
}
}
if (typeof renderCatalog === "function" && !window.__priceHistFilterHooked) {
window.__priceHistFilterHooked = true;
const _origRenderCat = renderCatalog;
renderCatalog = function() {
_origRenderCat.apply(this, arguments);
try {
const chk = document.getElementById("chkCatPriceHistory");
if (!chk || !chk.checked) return;
const tbody = document.getElementById("tblCatalogBody");
if (!tbody || !tbody.children) return;
const dropCount = DB.catalog.filter(m => hasPriceDropOrHistory(m, true)).length;
const onlyDrops = dropCount > 0;
const allowedIds = new Set(DB.catalog.filter(m => hasPriceDropOrHistory(m, onlyDrops)).map(m => String(m.id)));
Array.from(tbody.children).forEach(tr => {
if (tr.id === "trCatalogVirtualSentinel") return;
const mid = tr.getAttribute && (tr.getAttribute("data-id") || tr.dataset && tr.dataset.id);
if (mid && !allowedIds.has(String(mid))) {
tr.style.display = "none";
}
});
} catch (_) {}
};
}
setTimeout(injectPriceDropFilterPill, 40);
})();
/* === MODAL_TOOLS_GROUP_AND_LITE_ORCHESTRATOR_V1 === */
(function() {
if (typeof openModelModal === "function" && !window.__modalToolsGrouped) {
window.__modalToolsGrouped = true;
const _origOpen = openModelModal;
openModelModal = function(id) {
_origOpen.apply(this, arguments);
try {
const body = document.getElementById("mdlDetailBody") || document.getElementById("divModalBody");
if (!body) return;
try {
const curItem = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
if (curItem && typeof buildCompatMatrixCard === "function") {
const oldC = body.querySelector("#divCompatMatrixCard");
if (oldC) oldC.remove();
const cEl = buildCompatMatrixCard(curItem);
if (cEl) body.appendChild(cEl);
}
} catch (_) {}
const toolIds = ["divCompatMatrixCard", "divPriceHistorySparkline", "divIccCalibCard", "divEyeDistanceWidget", "divCableBwCard"];
const found = toolIds.map(tid => body.querySelector("#" + tid)).filter(Boolean);
if (!found.length) return;
let group = body.querySelector("#dtlModalToolsGroup");
if (!group) {
group = document.createElement("details");
group.id = "dtlModalToolsGroup";
const lite = (typeof isLiteMode !== "undefined" && isLiteMode) || document.body.classList.contains("lite-mode");
group.open = false;
const sum = document.createElement("summary");
sum.innerHTML = `<span>🛠️ Инженерные инструменты (${found.length}): совместимость PS5/Mac/GPU, история цен, ICC/HDR, PPI и кабель</span><span class="opacity-70 text-[11px]">${lite ? "Упрощённый режим — нажмите, чтобы раскрыть ▾" : "Раскрыть ▾"}</span>`;
group.appendChild(sum);
const riskCard = body.querySelector("#divPvzPriceRiskCard");
if (riskCard && riskCard.nextSibling) body.insertBefore(group, riskCard.nextSibling);
else if (body.firstChild) body.insertBefore(group, body.firstChild);
else body.appendChild(group);
}
found.forEach(el => group.appendChild(el));
try {
const curItem2 = (typeof DB !== "undefined" && DB.catalog) ? DB.catalog.find(x => x.id === id) : null;
const oldSim = body.querySelector("#divSimilarModelsCard");
if (oldSim) oldSim.remove();
const oldWatch = body.querySelector("#divPersonalWatchBox");
if (oldWatch) oldWatch.remove();
if (curItem2 && typeof attachForumShareBtn === "function") attachForumShareBtn(body, curItem2);
if (curItem2 && typeof buildPersonalWatchBox === "function") {
const wEl = buildPersonalWatchBox(curItem2);
if (wEl) {
if (group && group.nextSibling) body.insertBefore(wEl, group.nextSibling);
else body.appendChild(wEl);
}
}
if (curItem2 && typeof buildSimilarModelsCard === "function") {
const simEl = buildSimilarModelsCard(curItem2);
if (simEl) {
if (group && group.nextSibling) body.insertBefore(simEl, group.nextSibling);
else body.appendChild(simEl);
}
}
} catch (_) {}
} catch (_) {}
};
}
})();
(function() {
const RU_EN_LAYOUT = {
"й":"q","ц":"w","у":"e","к":"r","е":"t","н":"y","г":"u","ш":"i","щ":"o","з":"p",
"ф":"a","ы":"s","в":"d","а":"f","п":"g","р":"h","о":"j","л":"k","д":"l",
"я":"z","ч":"x","с":"c","м":"v","и":"b","т":"n","ь":"m"
};
const SEARCH_ALIASES = {
"асус": "asus", "асус": "asus", "рог": "rog", "таф": "tuf",
"мси": "msi", "мсиай": "msi",
"ксиаоми": "xiaomi", "сяоми": "xiaomi", "редми": "redmi",
"гигабайт": "gigabyte", "гига": "gigabyte", "аорус": "aorus",
"самсунг": "samsung", "самс": "samsung", "одиссей": "odyssey",
"лджи": "lg", "лыжа": "lg", "ультрагир": "ultragear",
"аос": "aoc", "аок": "aoc", "агон": "agon",
"филипс": "philips", "эвния": "evnia",
"делл": "dell", "алиенвар": "alienware", "алиен": "alienware",
"бенк": "benq", "бенкью": "benq", "зови": "zowie",
"асер": "acer", "эйсер": "acer", "предатор": "predator", "нитро": "nitro",
"леново": "lenovo", "легион": "legion",
"титан": "titan", "арми": "army",
"ифалкон": "iffalcon", "иннокн": "innocn", "тсл": "tcl", "тцл": "tcl",
"хисенс": "hisense", "хайсенс": "hisense", "ардор": "ardor", "кооруи": "koorui", "санс": "sanc",
"олед": "oled", "волед": "woled", "кдолед": "qd-oled", "тандем": "tandem",
"минилед": "mini-led", "мини-лед": "mini-led", "фалд": "fald",
"ипс": "ips", "ва": "va", "тн": "tn",
"ультраширик": "3440", "ультравайд": "3440", "ширик": "3440",
"2к": "2560x1440", "4к": "3840x2160", "5к": "5120x2880", "фхд": "1920x1080", "фуллхд": "1920x1080",
"глянец": "глянц", "глянцевый": "глянц", "матовый": "матов", "мат": "матов",
"дуал": "dual-mode", "дуалмод": "dual-mode"
};
function convertRuLayout(word) {
return word.split("").map(ch => RU_EN_LAYOUT[ch] || ch).join("");
}
function normalizeSmartSearchTokens(raw) {
const clean = String(raw || "").trim().toLowerCase().replace(/ё/g, "е");
if (!clean) return [];
const rawTokens = clean.split(/\s+/).filter(Boolean);
return rawTokens.map(tok => {
if (SEARCH_ALIASES[tok]) return SEARCH_ALIASES[tok];
if (/^[а-я]+$/.test(tok)) {
const conv = convertRuLayout(tok);
if (/^(asus|msi|lg|aoc|dell|benq|acer|tcl|hkc|ktc|sanc|oled|woled|qdoled|ips|miniled|fhd|qhd|uhd|uwqhd|hdr|kvm|usb|dp|hdmi|rog|tuf|mpg|mag|pg|xg|mo|fo|aw|gs|gp|gx)$/.test(conv) || /^[a-z]{2,}\d+/.test(conv)) {
return conv;
}
}
return tok;
});
}
window.normalizeSmartSearchTokens = normalizeSmartSearchTokens;
function buildCompatMatrixCard(m) {
const ports = String(m.ports || "");
const pl = ports.toLowerCase();
const res = String(m.res || "").toLowerCase();
const hz = Number(m.max_hz || 0);
const consoleTxt = String(m.console || "").toLowerCase();
const kvmTxt = String(m.kvm || "").toLowerCase();
const hasHdmi21 = /hdmi\s*2\.1/i.test(ports) || consoleTxt.includes("hdmi 2.1") || consoleTxt.includes("4k 120");
let consPill = "no", consBadge = "60 Гц", consDesc = "Только 60 Гц на консолях (нет 120 Гц / HDMI 2.1).";
if (hasHdmi21 && hz >= 120) {
consPill = "ok"; consBadge = "4K 120 Гц + VRR";
consDesc = "Полноценная поддержка PS5 и Xbox Series X в 120 Гц с VRR по HDMI 2.1.";
} else if (hz >= 120) {
consPill = "warn"; consBadge = "1080p/1440p 120 Гц";
consDesc = "Потянет 120 Гц в FHD/QHD, но без полного 4K 120 Гц VRR (ограничение HDMI 2.0).";
}
const pdMatch = (ports + " " + kvmTxt).match(/(?:pd|power delivery|зарядк[а-я]*)\s*[:~]?\s*(\d{2,3})\s*(?:w|вт)/i) || ports.match(/(\d{2,3})\s*(?:w|вт)\s*(?:pd|usb-c)/i);
const hasUsbC = /usb[\s-]*c|type[\s-]*c|thunderbolt/i.test(ports + " " + kvmTxt);
let macPill = "no", macBadge = "Без USB-C", macDesc = "Подключение к ноутбуку через кабель USB-C → DisplayPort + штатная зарядка.";
if (pdMatch) {
const watts = Number(pdMatch[1]);
if (watts >= 65) {
macPill = "ok"; macBadge = `1 кабель (PD ${watts} Вт)`;
macDesc = `Заряжает MacBook Air/Pro и передаёт картинку по одному USB-C кабелю (${watts} Вт).`;
} else {
macPill = "warn"; macBadge = `USB-C (PD ${watts} Вт)`;
macDesc = `Передаёт видео по USB-C, но ${watts} Вт хватит лишь для подзарядки телефона/лёгкого ультрабука.`;
}
} else if (hasUsbC) {
macPill = "warn"; macBadge = "USB-C DP Alt";
macDesc = "Есть видеовход USB-C (DP Alt Mode), но мощность зарядки PD не заявлена или минимальна.";
}
const hasDp21 = /dp\s*2\.1|displayport\s*2\.1/i.test(ports);
const hasUhbr20 = /uhbr\s*20|80\s*gbps|80\s*гбит/i.test(ports);
const highBw = (res.includes("3840") || res.includes("4k") || res.includes("5120") || res.includes("5k")) && hz >= 160;
let gpuPill = "ok", gpuBadge = "RTX / RX Ready", gpuDesc = "Штатно работает на RTX 30/40/50 и RX 6000–9000 по DisplayPort 1.4.";
if (hasUhbr20) {
gpuPill = "ok"; gpuBadge = "DP 2.1 UHBR20 (Без DSC)";
gpuDesc = "Максимальная полоса 80 Гбит/с: без сжатия DSC на RTX 50-й серии и Radeon Pro.";
} else if (hasDp21) {
gpuPill = "ok"; gpuBadge = "DP 2.1 (RTX 50 / RX 7000+)";
gpuDesc = "Поддержка современного DisplayPort 2.1 (полная совместимость с RTX 40/50 и RX 7000/9000).";
} else if (highBw) {
gpuPill = "warn"; gpuBadge = "DP 1.4 + DSC";
gpuDesc = "Для полной частоты на 4K/5K требуется сжатие DSC (поддерживается всеми RTX 20–50 и RX 6000–9000).";
}
const hasKvm = !!m.has_kvm || kvmTxt.includes("kvm");
const kvmPill = hasKvm ? "ok" : "no";
const kvmBadge = hasKvm ? "Аппаратный KVM" : "Без KVM";
const kvmDesc = hasKvm ? "Удобное переключение мыши/клавиатуры между рабочим ноутбуком и игровым ПК одной кнопкой." : "Переключение периферии между двумя ПК потребует отдельного USB-свитча.";
const wrap = document.createElement("div");
wrap.id = "divCompatMatrixCard";
wrap.className = "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-3 mt-2";
wrap.innerHTML = `
<div class="text-xs font-bold text-slate-900 dark:text-slate-100">🎮 Совместимость с консолями, ноутбуком и видеокартами</div>
<div class="compat-grid">
<div class="compat-item">
<div class="compat-item-title"><span>🎮 PS5 / Xbox Series X</span><span class="compat-pill ${consPill}">${consBadge}</span></div>
<div class="text-slate-600 dark:text-slate-300">${consDesc}</div>
</div>
<div class="compat-item">
<div class="compat-item-title"><span>💻 MacBook / Ноутбук</span><span class="compat-pill ${macPill}">${macBadge}</span></div>
<div class="text-slate-600 dark:text-slate-300">${macDesc}</div>
</div>
<div class="compat-item">
<div class="compat-item-title"><span>🖥️ Видеокарта ПК (GPU)</span><span class="compat-pill ${gpuPill}">${gpuBadge}</span></div>
<div class="text-slate-600 dark:text-slate-300">${gpuDesc}</div>
</div>
<div class="compat-item">
<div class="compat-item-title"><span>⌨️ 2 ПК / KVM-переключатель</span><span class="compat-pill ${kvmPill}">${kvmBadge}</span></div>
<div class="text-slate-600 dark:text-slate-300">${kvmDesc}</div>
</div>
</div>
`;
return wrap;
}
window.buildCompatMatrixCard = buildCompatMatrixCard;
function buildSelectionCsv(rows) {
const headers = [
"ID", "Бренд", "Модель", "Тир", "Диагональ", "Разрешение", "Частота (Гц)",
"Матрица", "Покрытие", "Зоны FALD", "Контраст", "HDR (нит)",
"Цена на руки (₽)", "Розница РФ (₽)", "Порты", "Обзор", "Ссылка магазина"
];
const esc = (v) => {
const s = String(v == null ? "" : v).replace(/\r?\n/g, " ").replace(/"/g, '""');
return `"${s}"`;
};
const lines = [headers.map(esc).join(";")];
(rows || []).forEach(r => {
const firstStore = (Array.isArray(r.stores) && r.stores[0] && r.stores[0].url) ? r.stores[0].url : "";
lines.push([
r.id, r.brand, r.model, r.tier, r.diag, r.res, r.hz || r.max_hz,
r.ptype, r.coat, r.zones, r.cr, r.hdr,
r.hand || "", r.price_retail_rf || "", r.ports || "", r.rev_url || "", firstStore
].map(esc).join(";"));
});
return "\uFEFF" + lines.join("\r\n");
}
window.buildSelectionCsv = buildSelectionCsv;
function downloadCsvFile(rows, filename) {
if (!rows || !rows.length) {
if (typeof showToast === "function") showToast("Нет моделей для выгрузки в CSV");
return;
}
const csv = buildSelectionCsv(rows);
const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
const a = document.createElement("a");
a.href = URL.createObjectURL(blob);
a.download = filename;
document.body.appendChild(a);
a.click();
setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
if (typeof showToast === "function") showToast(`Скачан CSV (${rows.length} моделей) — открывается в Excel без кракозябр`);
}
document.getElementById("btnExportCatalogCsv")?.addEventListener("click", () => {
downloadCsvFile(window.__lastCatalogFiltered || (typeof DB !== "undefined" ? DB.catalog : []), "monitor_catalog_selection.csv");
});
document.getElementById("btnExportFinderCsv")?.addEventListener("click", () => {
downloadCsvFile(window.__lastFinderFiltered || [], "monitor_finder_selection.csv");
});
})();
(function() {
function resClassOf(m) {
const r = String(m.res || "").toLowerCase();
if (r.includes("5120") || r.includes("5k")) return "5k";
if (r.includes("3440") || r.includes("uwqhd") || r.includes("3840x1600")) return "uw";
if (r.includes("3840") || r.includes("4k")) return "4k";
if (r.includes("2560") || r.includes("qhd") || r.includes("2k")) return "2k";
return "fhd";
}
function panelClassOf(m) {
const p = String(m.ptype || "").toLowerCase();
if (p.includes("oled")) return "oled";
if (p.includes("mini-led") || p.includes("miniled")) return "miniled";
if (p.includes("va") || p.includes("hva")) return "va";
if (p.includes("tn")) return "tn";
return "ips";
}
function parseNumFirst(val) {
const m = String(val || "").replace(/\s+/g, "").match(/\d+(?:\.\d+)?/);
return m ? parseFloat(m[0]) : 0;
}
function findSimilarAlternatives(m, limit = 4) {
if (!m || typeof DB === "undefined" || !Array.isArray(DB.catalog)) return [];
const rc = resClassOf(m);
const pc = panelClassOf(m);
const d0 = Number(m.diag || 27);
const p0 = Number(m.hand || 0);
const hz0 = Number(m.max_hz || 0);
const candidates = DB.catalog.filter(x => {
if (x.id === m.id) return false;
if (resClassOf(x) !== rc) return false;
if (panelClassOf(x) !== pc) return false;
if (Math.abs(Number(x.diag || 27) - d0) > 1.6) return false;
const t = String(x.tier || "").charAt(0).toUpperCase();
if (t === "F" || t === "D") return false;
return true;
});
candidates.sort((a, b) => {
const aCheaper = p0 > 0 && a.hand > 0 && a.hand < p0 ? 1 : 0;
const bCheaper = p0 > 0 && b.hand > 0 && b.hand < p0 ? 1 : 0;
if (aCheaper !== bCheaper) return bCheaper - aCheaper;
const aRu = a.is_ru ? 1 : 0;
const bRu = b.is_ru ? 1 : 0;
if (aRu !== bRu) return bRu - aRu;
const aHzDiff = Math.abs(Number(a.max_hz || 0) - hz0);
const bHzDiff = Math.abs(Number(b.max_hz || 0) - hz0);
if (aHzDiff !== bHzDiff) return aHzDiff - bHzDiff;
return (a.hand || 999999) - (b.hand || 999999);
});
return candidates.slice(0, limit);
}
window.findSimilarAlternatives = findSimilarAlternatives;
function buildSimilarModelsCard(m) {
const alts = findSimilarAlternatives(m, 4);
if (!alts.length) return null;
const p0 = Number(m.hand || 0);
const wrap = document.createElement("div");
wrap.id = "divSimilarModelsCard";
wrap.className = "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-3 my-2";
wrap.innerHTML = `
<div class="text-xs font-bold text-slate-900 dark:text-slate-100">💡 Похожие аналоги (дешевле или с гарантией РФ)</div>
<div class="sim-alt-grid">
${alts.map(a => {
const save = (p0 > 0 && a.hand > 0 && a.hand < p0) ? (p0 - a.hand) : 0;
const badge = save >= 1000
? `<span class="compat-pill ok">−${save.toLocaleString("ru-RU")} ₽</span>`
: (a.is_ru ? `<span class="compat-pill ok">🏠 Розница РФ</span>` : `<span class="compat-pill no">Тир ${String(a.tier||"").slice(0,1)}</span>`);
const priceStr = a.hand > 0 ? `${Number(a.hand).toLocaleString("ru-RU")} ₽` : "цена уточн.";
return `
<div class="sim-alt-card">
<div>
<div class="flex items-center justify-between gap-1.5">
<button type="button" class="text-left text-xs font-bold text-blue-700 dark:text-sky-400 hover:underline sim-open-btn" data-sim-id="${a.id}">${a.model}</button>
${badge}
</div>
<div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">${a.diag}″ • ${a.max_hz || a.hz} Гц • Тир ${String(a.tier||"").slice(0,1)}</div>
</div>
<div class="sim-alt-actions">
<span class="text-xs font-extrabold text-slate-900 dark:text-white">${priceStr}</span>
<button type="button" class="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 sim-cmp-btn" data-sim-cmp="${a.id}" title="Сравнить с текущей моделью">⚖️ Сравнить</button>
</div>
</div>`;
}).join("")}
</div>
`;
wrap.querySelectorAll(".sim-open-btn").forEach(btn => {
btn.addEventListener("click", () => {
const tid = Number(btn.dataset.simId);
if (typeof openModelModal === "function") openModelModal(tid);
});
});
wrap.querySelectorAll(".sim-cmp-btn").forEach(btn => {
btn.addEventListener("click", () => {
const tid = Number(btn.dataset.simCmp);
if (typeof compareIds !== "undefined") {
compareIds.clear();
compareIds.add(m.id);
compareIds.add(tid);
if (typeof updateCompareBadge === "function") updateCompareBadge();
if (typeof closeModelModal === "function") closeModelModal();
const tabBtn = document.querySelector('[data-tab="secCompare"]');
if (tabBtn) tabBtn.click();
else if (typeof renderCompare === "function") renderCompare();
}
});
});
return wrap;
}
window.buildSimilarModelsCard = buildSimilarModelsCard;
function buildCompareVerdictHtml(items) {
if (!Array.isArray(items) || items.length < 2) return "";
const scores = new Map(items.map(x => [x.id, 0]));
const winners = [];
const priced = items.filter(x => Number(x.hand || 0) > 0);
if (priced.length >= 2) {
const bestP = priced.reduce((a, b) => (a.hand <= b.hand ? a : b));
const worstP = priced.reduce((a, b) => (a.hand >= b.hand ? a : b));
if (bestP.hand < worstP.hand) {
scores.set(bestP.id, scores.get(bestP.id) + 1);
winners.push(`💰 <strong>Цена:</strong> ${bestP.model} (${Number(bestP.hand).toLocaleString("ru-RU")} ₽)`);
}
}
const bestHz = items.reduce((a, b) => (Number(a.max_hz||0) >= Number(b.max_hz||0) ? a : b));
const minHz = Math.min(...items.map(x => Number(x.max_hz||0)));
if (Number(bestHz.max_hz||0) > minHz) {
scores.set(bestHz.id, scores.get(bestHz.id) + 1);
winners.push(`⚡ <strong>Частота:</strong> ${bestHz.model} (${bestHz.max_hz} Гц)`);
}
const gtgs = items.map(x => ({ x, v: parseNumFirst(x.gtg80) })).filter(o => o.v > 0);
if (gtgs.length >= 2) {
const bestG = gtgs.reduce((a, b) => (a.v <= b.v ? a : b));
const worstG = gtgs.reduce((a, b) => (a.v >= b.v ? a : b));
if (bestG.v < worstG.v) {
scores.set(bestG.x.id, scores.get(bestG.x.id) + 1);
winners.push(`🎯 <strong>Отклик GtG:</strong> ${bestG.x.model} (${bestG.v} мс)`);
}
}
const crs = items.map(x => {
const isO = String(x.ptype||"").toLowerCase().includes("oled");
return { x, v: isO ? 1000000 : parseNumFirst(x.cr), isO };
}).filter(o => o.v > 0);
if (crs.length >= 2) {
const bestC = crs.reduce((a, b) => (a.v >= b.v ? a : b));
const worstC = crs.reduce((a, b) => (a.v <= b.v ? a : b));
if (bestC.v > worstC.v) {
scores.set(bestC.x.id, scores.get(bestC.x.id) + 1);
winners.push(`🌗 <strong>Контраст:</strong> ${bestC.x.model} (${bestC.isO ? "∞:1 OLED" : bestC.v + ":1"})`);
}
}
const hdrs = items.map(x => ({ x, v: parseNumFirst(x.hdr) })).filter(o => o.v >= 200);
if (hdrs.length >= 2) {
const bestH = hdrs.reduce((a, b) => (a.v >= b.v ? a : b));
const worstH = hdrs.reduce((a, b) => (a.v <= b.v ? a : b));
if (bestH.v > worstH.v) {
scores.set(bestH.x.id, scores.get(bestH.x.id) + 1);
winners.push(`☀️ <strong>Пик HDR:</strong> ${bestH.x.model} (${bestH.v} нит)`);
}
}
if (!winners.length) return "";
const sortedLeaders = [...items].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
const topScore = scores.get(sortedLeaders[0].id) || 0;
const leaders = sortedLeaders.filter(x => (scores.get(x.id) || 0) === topScore).map(x => x.model).join(" / ");
return `
<div id="divCompareVerdict" class="cmp-verdict-box text-xs">
<div class="font-bold">🏆 Инженерный вердикт сравнения — лидер по метрикам: <span class="underline">${leaders}</span> (${topScore} из ${winners.length})</div>
<div class="cmp-verdict-chips">${winners.map(w => `<span class="cmp-verdict-chip">${w}</span>`).join("")}</div>
</div>
`;
}
window.buildCompareVerdictHtml = buildCompareVerdictHtml;
})();
(function() {
function hasVerifiedDirectStoreUrl(m) {
const sts = Array.isArray(m && m.stores) ? m.stores : [];
return sts.some(s => {
const u = String((s && s.url) || "").toLowerCase();
if (!u.startsWith("http")) return false;
if (u.includes("/search") || u.includes("/catalog/17a8943716404e77/")) return false;
return (
u.includes("dns-shop.ru/product/") ||
u.includes("citilink.ru/product/") ||
u.includes("regard.ru/product/") ||
u.includes("onlinetrade.ru/catalogue/") ||
u.includes("ozon.ru/product/") ||
u.includes("ozon.ru/t/") ||
u.includes("market.yandex.ru/card/") ||
u.includes("market.yandex.ru/product") ||
u.includes("wildberries.ru/catalog/")
);
});
}
function getTopRfDrops(limit = 5) {
if (typeof DB === "undefined" || !DB.price_history || !Array.isArray(DB.catalog)) return [];
const byId = new Map(DB.catalog.map(m => [String(m.id), m]));
const list = [];
Object.entries(DB.price_history).forEach(([mid, pts]) => {
if (!Array.isArray(pts) || !pts.length) return;
const m = byId.get(String(mid));
if (!m || !hasVerifiedDirectStoreUrl(m)) return;
const last = pts[pts.length - 1];
const first = pts[0];
const ret = Number(last.r || 0);
const mp = Number(last.m || 0);
const firstMp = Number(first.m || first.r || 0);
let base = 0, cur = 0, kind = "";
if (pts.length > 1 && firstMp > mp && mp > 0) {
base = firstMp; cur = mp; kind = "снижение";
} else if (ret > mp && mp > 0) {
base = ret; cur = mp; kind = "ниже розницы";
} else {
return;
}
const diff = base - cur;
const pct = Math.round((diff / base) * 1000) / 10;
if (diff < 2000 || pct < 8 || pct > 52) return;
const resL = String(m.res || "").toLowerCase();
if (cur < 10000 && (resL.includes("2560") || resL.includes("3840") || resL.includes("3440") || resL.includes("5120") || resL.includes("4k") || resL.includes("qhd") || resL.includes("2k"))) return;
list.push({
id: m.id, brand: String(m.brand || "").trim().toLowerCase(),
model: m.model, diag: m.diag, max_hz: m.max_hz,
cur, base, diff, pct, kind, store: last.s || "РФ"
});
});
list.sort((a, b) => (b.pct - a.pct) || (b.diff - a.diff));
const diversified = [];
const usedBrands = new Set();
for (const item of list) {
if (usedBrands.has(item.brand)) continue;
usedBrands.add(item.brand);
diversified.push(item);
if (diversified.length >= limit) break;
}
return diversified;
}
window.getTopRfDrops = getTopRfDrops;
function renderTopDropsBanner() {
const box = document.getElementById("divTopDropsList");
if (!box) return;
const drops = getTopRfDrops(5);
if (!drops.length) {
const wrap = document.getElementById("dtlTopDropsBanner");
if (wrap) wrap.style.display = "none";
return;
}
box.innerHTML = drops.map(d => `
<button type="button" class="drop-chip" data-drop-id="${d.id}">
<div class="flex items-center justify-between gap-1">
<span class="font-bold text-slate-900 dark:text-white truncate">${d.model}</span>
<span class="compat-pill ok">−${d.pct}%</span>
</div>
<div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">${d.diag}″ • ${d.max_hz} Гц • ${d.store}</div>
<div class="mt-1 flex items-baseline gap-1.5">
<span class="font-extrabold text-emerald-700 dark:text-emerald-400">${d.cur.toLocaleString("ru-RU")} ₽</span>
<span class="text-[10px] line-through opacity-60">${d.base.toLocaleString("ru-RU")} ₽</span>
</div>
</button>
`).join("");
box.querySelectorAll("[data-drop-id]").forEach(btn => {
btn.addEventListener("click", () => {
if (typeof openModelModal === "function") openModelModal(Number(btn.dataset.dropId));
});
});
}
function applyCustomDutyScenario(eurRate, thresholdEur, dutyPct) {
if (typeof DB === "undefined" || !Array.isArray(DB.catalog)) return 0;
const limRub = Math.max(0, Number(eurRate) * Number(thresholdEur));
const rate = Math.max(0, Number(dutyPct)) / 100;
let updated = 0;
DB.catalog.forEach(m => {
if (m.__origDuty === undefined) { m.__origDuty = m.duty; m.__origHand = m.hand; }
if (!m.is_ru && Number(m.rub || 0) > 0) {
const excess = Math.max(0, Number(m.rub) - limRub);
const newDuty = Math.round(excess * rate);
m.duty = newDuty;
m.hand = Number(m.rub) + newDuty;
updated++;
}
});
const badge = document.getElementById("lblCustomDutyBadge");
if (badge) badge.textContent = `(активно: EUR=${eurRate} ₽, порог ${thresholdEur} €, ставка ${dutyPct}%)`;
if (typeof renderCatalog === "function") renderCatalog();
if (typeof renderFinder === "function") renderFinder();
return updated;
}
window.applyCustomDutyScenario = applyCustomDutyScenario;
function resetCustomDutyScenario() {
if (typeof DB === "undefined" || !Array.isArray(DB.catalog)) return;
DB.catalog.forEach(m => {
if (m.__origDuty !== undefined) { m.duty = m.__origDuty; m.hand = m.__origHand; }
});
const badge = document.getElementById("lblCustomDutyBadge");
if (badge) badge.textContent = "(штатный: порог 200 €, 15%)";
if (typeof renderCatalog === "function") renderCatalog();
if (typeof renderFinder === "function") renderFinder();
}
window.resetCustomDutyScenario = resetCustomDutyScenario;
document.getElementById("btnApplyCustomDuty")?.addEventListener("click", () => {
const eur = Number(document.getElementById("inpCustomEur")?.value || 100);
const thr = Number(document.getElementById("selCustomThreshold")?.value || 200);
const pct = Number(document.getElementById("inpCustomRate")?.value || 15);
const cnt = applyCustomDutyScenario(eur, thr, pct);
if (typeof showToast === "function") showToast(`Пересчитана пошлина для ${cnt} зарубежных моделей (порог ${thr} €, EUR=${eur} ₽)`);
});
document.getElementById("btnResetCustomDuty")?.addEventListener("click", () => {
resetCustomDutyScenario();
if (typeof showToast === "function") showToast("Возвращён штатный расчёт пошлины (200 €, 15%)");
});
renderTopDropsBanner();
})();
(function() {
const WATCH_LS_KEY = "monitor_db_personal_watch_v1";
function loadPersonalWatchMap() {
try { return JSON.parse(localStorage.getItem(WATCH_LS_KEY) || "{}"); } catch (_) { return {}; }
}
function getPersonalWatch(id) {
const map = loadPersonalWatchMap();
return map[String(id)] || null;
}
function savePersonalWatch(id, targetRub, noteText) {
const map = loadPersonalWatchMap();
const t = Number(targetRub || 0);
const n = String(noteText || "").trim();
if (t > 0 || n) {
map[String(id)] = { target: t > 0 ? t : 0, note: n, updated: new Date().toISOString().slice(0, 10) };
if (typeof favoriteIds !== "undefined") {
favoriteIds.add(Number(id));
if (typeof saveFavorites === "function") saveFavorites();
}
} else {
delete map[String(id)];
}
try { localStorage.setItem(WATCH_LS_KEY, JSON.stringify(map)); } catch (_) {}
return map[String(id)] || null;
}
window.getPersonalWatch = getPersonalWatch;
window.savePersonalWatch = savePersonalWatch;
function buildPersonalWatchBox(m) {
const cur = getPersonalWatch(m.id) || { target: 0, note: "" };
const hand = Number(m.hand || 0);
const inBudget = cur.target > 0 && hand > 0 && hand <= cur.target;
const wrap = document.createElement("div");
wrap.id = "divPersonalWatchBox";
wrap.className = "rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-950/25 p-3 my-2 text-xs";
wrap.innerHTML = `
<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
<span class="font-bold text-slate-900 dark:text-amber-100">⭐ Личный список покупок (целевая цена и заметка)</span>
<span id="lblWatchBudgetStatus" class="compat-pill ${inBudget ? "ok" : "no"}">${inBudget ? "🎯 В вашем бюджете!" : (cur.target > 0 ? "⏳ Ждём снижения" : "Не задано")}</span>
</div>
<div class="flex flex-wrap items-center gap-2">
<input type="number" id="inpWatchTarget" value="${cur.target || ""}" placeholder="Желаемая цена ₽" min="0" step="500" class="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-36 font-semibold" />
<input type="text" id="inpWatchNote" value="${String(cur.note || "").replace(/"/g, "&quot;")}" placeholder="Короткая заметка (например: проверить ревизию BOE в ПВЗ)" class="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex-1 min-w-[200px]" />
<button type="button" id="btnSavePersonalWatch" class="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold">Сохранить</button>
</div>
`;
wrap.querySelector("#btnSavePersonalWatch")?.addEventListener("click", () => {
const tVal = Number(wrap.querySelector("#inpWatchTarget")?.value || 0);
const nVal = String(wrap.querySelector("#inpWatchNote")?.value || "");
const saved = savePersonalWatch(m.id, tVal, nVal);
const stEl = wrap.querySelector("#lblWatchBudgetStatus");
if (stEl) {
const hit = saved && saved.target > 0 && hand > 0 && hand <= saved.target;
stEl.className = "compat-pill " + (hit ? "ok" : "no");
stEl.textContent = hit ? "🎯 В вашем бюджете!" : (saved && saved.target > 0 ? "⏳ Ждём снижения" : "Сохранено");
}
if (typeof showToast === "function") showToast(saved ? "Сохранено в личном списке покупок (Избранное)" : "Заметка очищена");
});
return wrap;
}
window.buildPersonalWatchBox = buildPersonalWatchBox;
})();
(function() {
function renderMyWatchlistPanel() {
const cntEl = document.getElementById("lblMyWatchCnt");
const box = document.getElementById("divMyWatchlistItems");
if (!box) return;
let map = {};
try { map = JSON.parse(localStorage.getItem("monitor_db_personal_watch_v1") || "{}"); } catch (_) {}
const onlyHit = !!(document.getElementById("chkWatchOnlyInBudget") && document.getElementById("chkWatchOnlyInBudget").checked);
const byId = (typeof DB !== "undefined" && Array.isArray(DB.catalog)) ? new Map(DB.catalog.map(m => [String(m.id), m])) : new Map();
const entries = Object.entries(map).map(([mid, info]) => {
const m = byId.get(String(mid));
if (!m) return null;
const target = Number(info.target || 0);
const hand = Number(m.hand || 0);
const inBudget = target > 0 && hand > 0 && hand <= target;
return { m, target, note: info.note || "", inBudget };
}).filter(Boolean);
if (cntEl) cntEl.textContent = String(entries.length);
const visible = onlyHit ? entries.filter(e => e.inBudget) : entries;
if (!visible.length) {
box.innerHTML = `<div class="col-span-full text-[11px] opacity-75 py-1">${entries.length ? "Пока ни одна из сохранённых моделей не опустилась до заданной целевой цены." : "Список пока пуст — откройте любую модель и укажите целевую цену или заметку в блоке «⭐ Личный список покупок»."}</div>`;
return;
}
box.innerHTML = visible.map(e => `
<button type="button" class="drop-chip" data-wl-id="${e.m.id}">
<div class="flex items-center justify-between gap-1">
<span class="font-bold text-slate-900 dark:text-white truncate">${e.m.model}</span>
<span class="compat-pill ${e.inBudget ? "ok" : "no"}">${e.inBudget ? "🎯 В бюджете" : (e.target > 0 ? "⏳ Ждём" : "📝 Заметка")}</span>
</div>
<div class="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Сейчас: <strong>${e.m.hand > 0 ? Number(e.m.hand).toLocaleString("ru-RU") + " ₽" : "—"}</strong>${e.target > 0 ? " • Цель: " + e.target.toLocaleString("ru-RU") + " ₽" : ""}</div>
${e.note ? `<div class="text-[10.5px] opacity-80 truncate mt-0.5">📝 ${e.note}</div>` : ""}
</button>
`).join("");
box.querySelectorAll("[data-wl-id]").forEach(btn => {
btn.addEventListener("click", () => {
if (typeof openModelModal === "function") openModelModal(Number(btn.dataset.wlId));
});
});
}
window.renderMyWatchlistPanel = renderMyWatchlistPanel;
document.getElementById("chkWatchOnlyInBudget")?.addEventListener("change", renderMyWatchlistPanel);
document.getElementById("btnWatchExportBackup")?.addEventListener("click", () => document.getElementById("btnExportUnifiedBackup")?.click());
document.getElementById("btnWatchImportBackup")?.addEventListener("click", () => document.getElementById("inpImportUnifiedBackup")?.click());
const origSave = window.savePersonalWatch;
if (typeof origSave === "function") {
window.savePersonalWatch = function(id, targetRub, noteText) {
const res = origSave(id, targetRub, noteText);
renderMyWatchlistPanel();
return res;
};
}
renderMyWatchlistPanel();
})();
(function() {
["chkCatOnly2026", "chkCatOnlyReviewed"].forEach(id => {
document.getElementById(id)?.addEventListener("change", () => {
if (typeof renderCatalog === "function") renderCatalog();
});
});
document.getElementById("btnResetFilters")?.addEventListener("click", () => {
["chkCatOnly2026", "chkCatOnlyReviewed"].forEach(id => {
const el = document.getElementById(id);
if (el) el.checked = false;
});
});
})();
(function() {
function buildModelShareMarkdown(m) {
if (!m) return "";
const price = Number(m.hand || 0) > 0 ? `${Number(m.hand).toLocaleString("ru-RU")} ₽ (на руки)` : "цена уточняется";
const url = `https://tapocket.github.io/monitor_full_database/#model=${m.id}`;
const lines = [
`🖥️ **${m.model}** (Тир ${String(m.tier || "").slice(0, 1)})`,
`• Экран: ${m.diag}″ ${m.res} • ${m.hz || m.max_hz} Гц`,
`• Матрица: ${m.ptype}${m.coat ? " | Покрытие: " + m.coat : ""}`,
`• Контраст / HDR: ${m.cr || "—"} | ${m.hdr || "—"}`,
`• Цена: ${price}`,
`🔗 Карточка в базе: ${url}`
];
if (m.rev_url) lines.push(`🎬 Обзор: ${m.rev_url}`);
return lines.join("\n");
}
window.buildModelShareMarkdown = buildModelShareMarkdown;
function attachForumShareBtn(modalBody, m) {
if (!modalBody || !m) return;
const oldBtn = modalBody.querySelector("#btnCopyModelForumCard");
if (oldBtn) oldBtn.remove();
const btn = document.createElement("button");
btn.type = "button";
btn.id = "btnCopyModelForumCard";
btn.className = "px-2.5 py-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 font-bold text-xs hover:bg-indigo-100 transition";
btn.textContent = "📋 Для чата / форума";
btn.title = "Скопировать готовую мини-карточку монитора для Telegram, Discord, 4PDA или форума";
btn.addEventListener("click", () => {
const txt = buildModelShareMarkdown(m);
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(txt).catch(() => {});
}
if (typeof showToast === "function") showToast("Мини-карточка скопирована (готова для Telegram / форума)");
});
const printBtn = modalBody.querySelector("#btnPrintPvzSheet") || modalBody.querySelector("#btnCopyModelLink");
const oldRep = modalBody.querySelector("#btnReportModelIssue");
if (oldRep) oldRep.remove();
const repA = document.createElement("a");
repA.id = "btnReportModelIssue";
repA.target = "_blank";
repA.rel = "noopener";
const issueTitle = encodeURIComponent(`[Правка] ${m.model} (#${m.id})`);
const issueModel = encodeURIComponent(`${m.model} (#${m.id})`);
repA.href = `https://github.com/tapocket/monitor_full_database/issues/new?template=fix-error.yml&title=${issueTitle}&model=${issueModel}`;
repA.className = "px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 font-bold text-xs hover:bg-amber-100 transition inline-flex items-center";
repA.textContent = "⚠️ Сообщить об ошибке";
repA.title = "Открыть предзаполненную форму GitHub Issue для этой модели";
if (printBtn && printBtn.parentNode) {
printBtn.parentNode.appendChild(btn);
printBtn.parentNode.appendChild(repA);
} else if (modalBody.firstChild) {
modalBody.insertBefore(btn, modalBody.firstChild);
}
}
window.attachForumShareBtn = attachForumShareBtn;
})();
(function() {
const dtlTools = document.getElementById("dtlHeaderToolsMenu");
if (dtlTools) {
dtlTools.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { dtlTools.open = false; }));
document.addEventListener("click", (ev) => {
if (dtlTools.open && !dtlTools.contains(ev.target)) dtlTools.open = false;
});
}
function buildQuickSpecBadgesHtml(r) {
if (!r) return "";
const pills = [];
const ports = String(r.ports || "");
const res = String(r.res || "").toLowerCase();
const hz = String(r.hz || "").toLowerCase();
const coat = String(r.coat || "").toLowerCase();
const kvm = String(r.kvm || "").toLowerCase();
if (/dp\s*2\.1|displayport\s*2\.1/i.test(ports)) pills.push('<span class="qspec-pill hi">DP 2.1</span>');
if (/hdmi\s*2\.1/i.test(ports)) pills.push('<span class="qspec-pill hi">HDMI 2.1</span>');
const pdM = (ports + " " + kvm).match(/(?:pd|power delivery|зарядк[а-я]*)\s*[:~]?\s*(\d{2,3})\s*(?:w|вт)/i);
if (pdM && Number(pdM[1]) >= 45) pills.push(`<span class="qspec-pill hi">USB-C ${pdM[1]}W</span>`);
if (r.has_kvm || kvm.includes("аппаратный kvm")) pills.push('<span class="qspec-pill">KVM</span>');
if (res.includes("dual-mode") || hz.includes("dual-mode") || hz.includes("/")) pills.push('<span class="qspec-pill hi">Dual-Mode</span>');
if (coat.includes("глянц") || coat.includes("glossy")) pills.push('<span class="qspec-pill gl">Глянец</span>');
else if (coat.includes("матов") || coat.includes("matte")) pills.push('<span class="qspec-pill">Мат</span>');
if (!pills.length) return "";
return `<div class="qspec-row">${pills.slice(0, 5).join("")}</div>`;
}
window.buildQuickSpecBadgesHtml = buildQuickSpecBadgesHtml;
})();
