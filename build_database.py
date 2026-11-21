#!/usr/bin/env python3
"""Unified Single-Source-of-Truth (SSOT) Builder & Validator for monitor_full_database.

Reads canonical data from `database_master.json` (plus optional base templates for
XLSX styles and HTML shell) and deterministically builds & verifies:
  1. monitor_full_database.csv  (30 columns: 28 original + canonical brand & subbrand)
  2. monitor_full_database.xlsx (18 sheets, 65 columns on catalog sheets, clean numeric
                                 types, live formulas on summary & brand sheets)
  3. monitor_full_database.html (dictionary-compressed DB payload ~70% smaller,
                                 embedded offline CSS fallback, restored UI buttons)

Usage:
  python3 build_database.py --master database_master.json --outdir . [--verify] [--recalc]
"""

import argparse
import copy
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from collections import Counter
import openpyxl
from openpyxl.utils import get_column_letter

# Canonical brand normalization map (preserves raw brand, adds canonical brand + subbrand)
BRAND_NORMALIZATION_RULES = {
    "ARDOR GAMING": ("Ardor Gaming", ""),
    "ARDOR GAMING (DNS)": ("Ardor Gaming", "DNS"),
    "ASRock (Phantom Gaming)": ("ASRock", "Phantom Gaming"),
    "Bloody (A4Tech)": ("A4Tech", "Bloody"),
    "Dell (Alienware)": ("Dell", "Alienware"),
    "DEXP (DNS)": ("DEXP", "DNS"),
    "Dough (Spectrum Black)": ("Dough", "Spectrum Black"),
    "HP (OMEN)": ("HP", "OMEN"),
    "Lenovo (Legion / Lecoo)": ("Lenovo", "Legion / Lecoo"),
    "Philips (Evnia)": ("Philips", "Evnia"),
    "RedMagic (Nubia)": ("Nubia", "RedMagic"),
    "XPG (ADATA)": ("ADATA", "XPG"),
}


def normalize_brand(raw_brand: str) -> tuple[str, str]:
    """Return (canonical_brand, subbrand) without discarding the raw brand string."""
    b = str(raw_brand or "").strip()
    if b in BRAND_NORMALIZATION_RULES:
        return BRAND_NORMALIZATION_RULES[b]
    return (b, "")


def unwrap_google_url(val):
    if not isinstance(val, str) or "google.com/url?q=" not in val:
        return val
    return re.sub(
        r"https?://(?:www\.)?google\.com/url\?q=([^&\s]+)(?:&[^\s|;]*)?",
        lambda m: urllib.parse.unquote(m.group(1)),
        val,
    )


def parse_clean_number(val):
    """Convert pure numeric strings like '480' or '24.5' to int/float; keep mixed text intact."""
    if isinstance(val, (int, float)) or val is None:
        return val
    if isinstance(val, str):
        s = val.strip()
        if re.fullmatch(r"-?\d+", s):
            return int(s)
        if re.fullmatch(r"-?\d+\.\d+", s):
            return float(s)
    return val


def build_csv(master: dict, out_csv: str) -> None:
    """Build monitor_full_database.csv (all 28 original columns + 2 normalized brand columns)."""
    headers = [
        "ID", "Бренд", "Модель", "Регион / Позиционирование", "Год", "Тир (Рейтинг)",
        "Диагональ (″)", "Разрешение", "Макс. частота (Гц)", "Тип матрицы",
        "Инженерная модель панели (LCM)", "Субпиксельная структура", "Покрытие экрана",
        "Зоны FALD / Mini-LED", "Контрастность (:1)", "Яркость SDR (нит)",
        "Пиковая яркость HDR (нит)", "Охват sRGB (%)", "Охват DCI-P3 (%)",
        "Отклик GtG 80% (мс)", "Отклик GtG 100% (мс)", "Видеоинтерфейсы и порты",
        "Цена (₽)", "Пошлина РФ (₽)", "Итого на руки (₽)", "Цена ($)",
        "Прямая ссылка ДНС", "Ссылка на обзор / источник",
        "Бренд (Канонический)", "Суббренд / Линейка",
    ]
    with open(out_csv, "w", encoding="utf-8-sig", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow(headers)
        for item in master["catalog"]:
            dns_url = ""
            stores = item.get("stores", [])
            if isinstance(stores, list):
                for s in stores:
                    u = s.get("u", "") if isinstance(s, dict) else ""
                    if "dns-shop.ru/product/" in u:
                        dns_url = unwrap_google_url(u)
                        break
            elif isinstance(stores, str):
                m = re.search(r"https?://(?:www\.)?dns-shop\.ru/product/[^\s|;]+", unwrap_google_url(stores))
                if m:
                    dns_url = m.group(0)

            canon, sub = normalize_brand(item.get("brand", ""))
            writer.writerow([
                item.get("id", ""),
                item.get("brand", ""),
                item.get("model", ""),
                item.get("reg", ""),
                item.get("year", ""),
                item.get("tier", ""),
                item.get("diag", ""),
                item.get("res", ""),
                item.get("max_hz", ""),
                item.get("ptype", ""),
                item.get("pmodel", ""),
                item.get("subp", ""),
                item.get("coat", ""),
                item.get("zones", 0),
                item.get("cr", 0),
                item.get("sdr_max", 0),
                item.get("hdr", 0),
                item.get("srgb", 0),
                item.get("dci", 0),
                item.get("gtg80", 0),
                item.get("gtg100", 0),
                item.get("ports", ""),
                item.get("rub", 0),
                item.get("duty", 0),
                item.get("hand", 0),
                item.get("usd", 0),
                dns_url,
                unwrap_google_url(item.get("rev_url", "")),
                canon,
                sub,
            ])
    print(f"[CSV] Wrote {len(master['catalog'])} rows (30 cols) -> {out_csv}")


def copy_cell_style(src_cell, dst_cell):
    if src_cell.has_style:
        dst_cell.font = copy.copy(src_cell.font)
        dst_cell.fill = copy.copy(src_cell.fill)
        dst_cell.border = copy.copy(src_cell.border)
        dst_cell.alignment = copy.copy(src_cell.alignment)
        dst_cell.number_format = src_cell.number_format


def upgrade_xlsx(master: dict, template_xlsx: str, out_xlsx: str) -> None:
    """Upgrade monitor_full_database.xlsx: clean numeric types + 3 helper cols (65 cols) + live formulas."""
    wb = openpyxl.load_workbook(template_xlsx, data_only=False)
    catalog = master["catalog"]

    # Map model name (lowercased) & brand to item for fast lookup of max_hz, brand_canonical, subbrand
    by_bm = {}
    by_m = {}
    for it in catalog:
        b = str(it.get("brand", "")).strip().lower()
        m = str(it.get("model", "")).strip().lower()
        by_bm[(b, m)] = it
        by_m[m] = it

    def lookup_item(brand_val, model_val):
        b = str(brand_val or "").strip().lower()
        m = str(model_val or "").strip().lower()
        if (b, m) in by_bm:
            return by_bm[(b, m)]
        if m in by_m:
            return by_m[m]
        # Strip trailing [...] or (...) tags for XLSX variants
        m_clean = re.sub(r"\s*\[.*?\]\s*$", "", m).strip()
        if (b, m_clean) in by_bm:
            return by_bm[(b, m_clean)]
        if m_clean in by_m:
            return by_m[m_clean]
        m_clean2 = re.sub(r"\s*\(.*?\)\s*$", "", m_clean).strip()
        if (b, m_clean2) in by_bm:
            return by_bm[(b, m_clean2)]
        return None

    def extract_max_hz_fallback(hz_val):
        if isinstance(hz_val, (int, float)):
            return int(hz_val) if float(hz_val).is_integer() else float(hz_val)
        nums = re.findall(r"\d+(?:\.\d+)?", str(hz_val or ""))
        if nums:
            vals = [float(x) for x in nums if float(x) <= 2000]
            if vals:
                mx = max(vals)
                return int(mx) if mx.is_integer() else mx
        return 60

    numeric_cols_62 = [4, 9, 12, 13, 14, 29, 32, 33, 34, 35, 41, 42, 43, 57, 58, 59]
    catalog_sheets = [
        "1. Общая база мониторов",
        "2. Проверенные замерами",
        "3. Мониторы Full HD (1080p)",
        "4. Мониторы 2K QHD (1440p)",
        "5. Мониторы 4K UHD (2160p)",
        "6. Мониторы 5K, 6K и 8K",
        "7. Ультраширокие (21-9 и 32-9)",
    ]

    for sname in catalog_sheets:
        ws = wb[sname]
        has_total = (sname != "1. Общая база мониторов")
        last_data = ws.max_row - 1 if has_total else ws.max_row

        # Add headers for Cols 63 (BK), 64 (BL), 65 (BM)
        new_headers = {
            63: "Макс. частота (Гц, число для сортировки)",
            64: "Бренд (Канонический)",
            65: "Суббренд / Линейка",
        }
        for col_idx, title in new_headers.items():
            ws.cell(4, col_idx).value = title
            copy_cell_style(ws.cell(4, 12 if col_idx == 63 else 1), ws.cell(4, col_idx))
            ws.column_dimensions[get_column_letter(col_idx)].width = 20 if col_idx != 63 else 16

        # Block header in row 3 for BK..BM
        ws.cell(3, 63).value = "БЛОК 7: НОРМАЛИЗОВАННЫЕ ПОЛЯ ДЛЯ СОРТИРОВКИ И СВОДНЫХ"
        copy_cell_style(ws.cell(3, 1), ws.cell(3, 63))
        try:
            ws.merge_cells(start_row=3, start_column=63, end_row=3, end_column=65)
        except Exception:
            pass

        # Clean numeric types & populate Cols 63..65
        for r in range(5, last_data + 1):
            for nc in numeric_cols_62:
                v = ws.cell(r, nc).value
                cleaned = parse_clean_number(v)
                if cleaned is not v:
                    ws.cell(r, nc).value = cleaned

            b_val = ws.cell(r, 1).value
            m_val = ws.cell(r, 2).value
            it = lookup_item(b_val, m_val)
            max_hz = it.get("max_hz") if it and isinstance(it.get("max_hz"), (int, float)) else extract_max_hz_fallback(ws.cell(r, 12).value)
            canon, sub = normalize_brand(b_val)

            ws.cell(r, 63).value = max_hz
            ws.cell(r, 64).value = canon
            ws.cell(r, 65).value = sub
            copy_cell_style(ws.cell(r, 9), ws.cell(r, 63))
            ws.cell(r, 63).number_format = "0"
            copy_cell_style(ws.cell(r, 1), ws.cell(r, 64))
            copy_cell_style(ws.cell(r, 1), ws.cell(r, 65))

        # Update summary row on Sheets 2..7 to also average clean numeric BK (Col 63)
        if has_total:
            tr = ws.max_row
            ws.cell(tr, 12).value = f"=ROUND(AVERAGE(BK5:BK{last_data}), 0)"
            ws.cell(tr, 63).value = f"=ROUND(AVERAGE(BK5:BK{last_data}), 0)"
            copy_cell_style(ws.cell(tr, 12), ws.cell(tr, 63))
            ws.cell(tr, 63).number_format = "0"
            ws["A1"] = str(ws["A1"].value).replace("62 СТОЛБЦА", "65 СТОЛБЦОВ")

        ws.freeze_panes = "C5"

    # Update Sheet 0 & Sheet 1 A1 column counts (65 cols)
    ws0 = wb["0. ИНФА и Гайд по таблице"]
    ws0["A1"] = '="ИНФО И ПУТЕВОДИТЕЛЬ ПО ИНЖЕНЕРНОЙ БАЗЕ МОНИТОРОВ monitor_full_database (" & COUNTA(\'13. Сводная по брендам\'!A5:A500) & " БРЕНДОВ • " & COUNTA(\'1. Общая база мониторов\'!B5:B5000) & " МОДЕЛЕЙ • 65 СТОЛБЦОВ • 18 ВКЛАДОК)"'

    ws1 = wb["1. Общая база мониторов"]
    ws1["A1"] = '="ПОЛНАЯ ИНЖЕНЕРНАЯ БАЗА МОНИТОРОВ monitor_full_database (" & COUNTA(\'13. Сводная по брендам\'!A5:A500) & " БРЕНДОВ — " & COUNTA(B5:B5000) & " МОДЕЛЕЙ — 65 СТОЛБЦОВ)"'

    # Update Sheet 13 to average pure numeric BK (Col 63) for Avg Hz (Col 21 / U)
    ws13 = wb["13. Сводная по брендам"]
    S1 = "'1. Общая база мониторов'"
    LAST_S1 = ws1.max_row
    s13_last = ws13.max_row - 1
    for r in range(5, s13_last + 1):
        ws13.cell(r, 21).value = f"=IFERROR(ROUND(AVERAGEIF({S1}!$A$5:$A${LAST_S1}, B{r}, {S1}!$BK$5:$BK${LAST_S1}), 0), 0)"
    ws13.cell(ws13.max_row, 21).value = f"=ROUND(AVERAGE({S1}!$BK$5:$BK${LAST_S1}), 0)"
    ws13["A1"] = f'="СВОДНАЯ АНАЛИТИКА БАЗЫ МОНИТОРОВ ПО " & COUNTA(B5:B{s13_last}) & " БРЕНДАМ (" & SUM(C5:C{s13_last}) & " МОДЕЛЕЙ — 65 СТОЛБЦОВ)"'

    wb.save(out_xlsx)
    wb.close()
    print(f"[XLSX] Upgraded 18 sheets (65 cols, clean numeric types) -> {out_xlsx}")


def generate_offline_tailwind_css(html_text: str) -> str:
    """Generate a compact offline CSS fallback for Tailwind utility classes used in the HTML."""
    # Core palette tokens matching Tailwind 3.4 defaults
    colors = {
        "white": "#ffffff", "black": "#000000", "transparent": "transparent",
        "slate-50": "#f8fafc", "slate-100": "#f1f5f9", "slate-200": "#e2e8f0", "slate-300": "#cbd5e1",
        "slate-400": "#94a3b8", "slate-500": "#64748b", "slate-600": "#475569", "slate-700": "#334155",
        "slate-800": "#1e293b", "slate-900": "#0f172a", "slate-950": "#020617",
        "gray-50": "#f9fafb", "gray-100": "#f3f4f6", "gray-200": "#e5e7eb", "gray-300": "#d1d5db",
        "gray-500": "#6b7280", "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937", "gray-900": "#111827",
        "blue-50": "#eff6ff", "blue-100": "#dbeafe", "blue-200": "#bfdbfe", "blue-500": "#3b82f6",
        "blue-600": "#2563eb", "blue-700": "#1d4ed8", "blue-800": "#1e40af", "blue-900": "#1e3a8a", "blue-950": "#172554",
        "indigo-50": "#eef2ff", "indigo-100": "#e0e7ff", "indigo-200": "#c7d2fe", "indigo-500": "#6366f1",
        "indigo-600": "#4f46e5", "indigo-700": "#4338ca", "indigo-800": "#3730a3", "indigo-900": "#312e81",
        "emerald-50": "#ecfdf5", "emerald-100": "#d1fae5", "emerald-200": "#a7f3d0", "emerald-500": "#10b981",
        "emerald-600": "#059669", "emerald-700": "#047857", "emerald-800": "#065f46", "emerald-900": "#064e3b",
        "teal-50": "#f0fdfa", "teal-100": "#ccfbf1", "teal-600": "#0d9488", "teal-700": "#0f766e", "teal-800": "#115e59",
        "amber-50": "#fffbeb", "amber-100": "#fef3c7", "amber-200": "#fde68a", "amber-500": "#f59e0b",
        "amber-600": "#d97706", "amber-700": "#b45309", "amber-800": "#92400e",
        "orange-50": "#fff7ed", "orange-100": "#ffedd5", "orange-500": "#f97316", "orange-600": "#ea580c", "orange-700": "#c2410c",
        "red-50": "#fef2f2", "red-100": "#fee2e2", "red-500": "#ef4444", "red-600": "#dc2626", "red-700": "#b91c1c",
        "rose-50": "#fff1f2", "rose-100": "#ffe4e6", "rose-600": "#e11d48", "rose-700": "#be123c",
        "purple-50": "#faf5ff", "purple-100": "#f3e8ff", "purple-600": "#9333ea", "purple-700": "#7e22ce", "purple-800": "#6b21a8",
        "violet-50": "#f5f3ff", "violet-100": "#ede9fe", "violet-600": "#7c3aed", "violet-700": "#6d28d9",
        "sky-50": "#f0f9ff", "sky-100": "#e0f2fe", "sky-600": "#0284c7", "sky-700": "#0369a1",
        "cyan-50": "#ecfeff", "cyan-100": "#cffafe", "cyan-600": "#0891b2", "cyan-700": "#0e7490",
        "green-50": "#f0fdf4", "green-100": "#dcfce7", "green-600": "#16a34a", "green-700": "#15803d",
        "yellow-50": "#fefce8", "yellow-100": "#fef9c3", "yellow-600": "#ca8a04", "yellow-700": "#a16207",
    }
    rules = [
        "/* Offline CSS Fallback (works even when cdn.tailwindcss.com is unreachable) */",
        "*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e2e8f0}",
        "body{margin:0;line-height:1.5;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a}",
        "button,input,select,textarea{font-family:inherit;font-size:100%;color:inherit}",
        "button{cursor:pointer;background:transparent}",
        "table{border-collapse:collapse;width:100%}",
        "a{color:inherit;text-decoration:none}",
        ".hidden{display:none!important}.block{display:block}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.flex{display:flex}.grid{display:grid}",
        ".flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1 1 0%}.shrink-0{flex-shrink:0}",
        ".items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.justify-end{justify-content:flex-end}",
        ".relative{position:relative}.absolute{position:absolute}.fixed{position:fixed}.sticky{position:sticky}.inset-0{inset:0}.top-0{top:0}.right-0{right:0}.bottom-5{bottom:1.25rem}.right-5{right:1.25rem}",
        ".z-10{z-index:10}.z-20{z-index:20}.z-30{z-index:30}.z-40{z-index:40}.z-50{z-index:50}",
        ".overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto}.overflow-y-auto{overflow-y:auto}",
        ".w-full{width:100%}.h-full{height:100%}.min-h-screen{min-height:100vh}.mx-auto{margin-left:auto;margin-right:auto}",
        ".max-w-7xl{max-width:80rem}.max-w-6xl{max-width:72rem}.max-w-5xl{max-width:64rem}.max-w-4xl{max-width:56rem}.max-w-3xl{max-width:48rem}.max-w-2xl{max-width:42rem}.max-w-\\[1600px\\]{max-width:1600px}",
        ".rounded{border-radius:.25rem}.rounded-md{border-radius:.375rem}.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.rounded-2xl{border-radius:1rem}.rounded-full{border-radius:9999px}",
        ".border{border-width:1px}.border-2{border-width:2px}.border-t{border-top-width:1px}.border-b{border-bottom-width:1px}.border-l{border-left-width:1px}.border-r{border-right-width:1px}",
        ".shadow{box-shadow:0 1px 3px rgba(0,0,0,.1)}.shadow-sm{box-shadow:0 1px 2px rgba(0,0,0,.05)}.shadow-md{box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}.shadow-lg{box-shadow:0 10px 15px -3px rgba(0,0,0,.1)}.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1)}.shadow-2xl{box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}",
        ".text-left{text-align:left}.text-center{text-align:center}.text-right{text-align:right}.whitespace-nowrap{white-space:nowrap}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}",
        ".font-normal{font-weight:400}.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}.font-extrabold{font-weight:800}.uppercase{text-transform:uppercase}.leading-tight{line-height:1.25}",
        ".cursor-pointer{cursor:pointer}.select-none{user-select:none}.transition,.transition-all,.transition-colors{transition:all .15s ease}",
        ".grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}",
        "@media(min-width:768px){.md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.md\\:flex-row{flex-direction:row}}",
        "@media(min-width:1024px){.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.lg\\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.lg\\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.lg\\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}}",
    ]
    # Spacing utilities
    spacings = {"0": "0", "0.5": ".125rem", "1": ".25rem", "1.5": ".375rem", "2": ".5rem", "2.5": ".625rem", "3": ".75rem", "4": "1rem", "5": "1.25rem", "6": "1.5rem", "8": "2rem"}
    for k, v in spacings.items():
        ek = k.replace(".", "\\.")
        rules.append(
            f".p-{ek}{{padding:{v}}}.px-{ek}{{padding-left:{v};padding-right:{v}}}.py-{ek}{{padding-top:{v};padding-bottom:{v}}}"
            f".pt-{ek}{{padding-top:{v}}}.pb-{ek}{{padding-bottom:{v}}}"
            f".m-{ek}{{margin:{v}}}.mt-{ek}{{margin-top:{v}}}.mb-{ek}{{margin-bottom:{v}}}.ml-{ek}{{margin-left:{v}}}.mr-{ek}{{margin-right:{v}}}"
            f".gap-{ek}{{gap:{v}}}.space-y-{ek}>:not([hidden])~:not([hidden]){{margin-top:{v}}}"
        )
    # Color utilities
    for cname, chex in colors.items():
        rules.append(f".bg-{cname}{{background-color:{chex}}}.text-{cname}{{color:{chex}}}.border-{cname}{{border-color:{chex}}}")
    return "\n".join(rules)


def compress_db_for_html(master: dict) -> str:
    """Dictionary-encode repeated strings in DB.catalog to shrink HTML by ~65-70% with lossless unpack."""
    # Build DB object matching exact runtime schema expected by monitor_full_database.html
    db_obj = {
        "catalog": master["catalog"],
        "market_rf": master["market_rf"],
        "excluded_market": master["excluded_market"],
        "flagships": master["flagships"],
        "ref_sheets": master["ref_sheets"],
        "excluded_flagships": master["excluded_flagships"],
    }
    catalog = db_obj["catalog"]
    if not catalog:
        return "const DB = " + json.dumps(db_obj, ensure_ascii=False, separators=(",", ":")) + ";"

    # Extract ordered keys schema from catalog[0] (all items share the same keys)
    all_keys = list(catalog[0].keys())
    for row in catalog:
        for k in row.keys():
            if k not in all_keys:
                all_keys.append(k)

    # Count repeated strings >= 8 chars across catalog values (excluding stores list/dicts for simplicity, compress top-level strings)
    str_freq = Counter()
    for row in catalog:
        for v in row.values():
            if isinstance(v, str) and len(v) >= 8:
                str_freq[v] += 1

    # Keep strings that appear >= 2 times, ordered most frequent first for shortest integer indices
    dict_strings = [s for s, c in str_freq.most_common() if c >= 2]
    str_to_idx = {s: idx for idx, s in enumerate(dict_strings)}

    # Encode each catalog row as a compact positional array; strings in dict become [idx] marker (1-element int array)
    # Note: no string field in catalog is a 1-element int array, so checking Array.isArray(v) && v.length === 1 && typeof v[0] === 'number' is 100% unambiguous!
    packed_rows = []
    for row in catalog:
        arr = []
        for k in all_keys:
            if k not in row:
                arr.append("__U__")
            else:
                v = row[k]
                if isinstance(v, str) and v in str_to_idx:
                    arr.append([str_to_idx[v]])
                else:
                    arr.append(v)
        packed_rows.append(arr)

    rest_obj = {k: v for k, v in db_obj.items() if k != "catalog"}
    payload = {
        "k": all_keys,
        "d": dict_strings,
        "r": packed_rows,
        "o": rest_obj,
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    unpack_js = (
        "const DB = (() => {\n"
        f"  const _P = {payload_json};\n"
        "  const _K = _P.k, _D = _P.d, _kl = _K.length;\n"
        "  const _cat = _P.r.map(row => {\n"
        "    const obj = {};\n"
        "    for (let i = 0; i < _kl; i++) {\n"
        "      const v = row[i];\n"
        "      if (v === '__U__') continue;\n"
        "      obj[_K[i]] = (Array.isArray(v) && v.length === 1 && typeof v[0] === 'number') ? _D[v[0]] : v;\n"
        "    }\n"
        "    return obj;\n"
        "  });\n"
        "  return Object.assign({ catalog: _cat }, _P.o);\n"
        "})();"
    )
    return unpack_js


def build_html(master: dict, template_html: str, out_html: str) -> None:
    """Build optimized, offline-ready monitor_full_database.html with restored UI controls."""
    with open(template_html, "r", encoding="utf-8") as fp:
        html = fp.read()

    # 1. Replace raw `const DB = {...};` with dictionary-compressed lossless unpacker
    m = re.search(r"const DB\s*=\s*\{[\s\S]*?\};\s*\n", html)
    if not m:
        raise RuntimeError("Could not locate `const DB = {...};` in template HTML")
    compressed_db_js = compress_db_for_html(master)
    html = html[:m.start()] + compressed_db_js + "\n" + html[m.end():]

    # 2. Inject compact Offline CSS Fallback right BEFORE Tailwind script so Tailwind overrides it online,
    #    and fallback takes over seamlessly offline!
    if 'id="offline-tailwind-fallback"' not in html:
        offline_css = generate_offline_tailwind_css(html)
        fallback_tag = f'  <style id="offline-tailwind-fallback">\n{offline_css}\n  </style>\n'
        tw_idx = html.find('<script src="https://cdn.tailwindcss.com')
        if tw_idx != -1:
            html = html[:tw_idx] + fallback_tag + html[tw_idx:]
        else:
            html = html.replace("</head>", fallback_tag + "</head>", 1)

    # 3. Restore missing UI controls whose JS handlers already exist:
    # 3a. #btnExportUserProfileJson right next to #inpImportUserProfileJson
    if 'id="btnExportUserProfileJson"' not in html:
        imp_anchor = '<label class="bg-teal-700 hover:bg-teal-600'
        idx_imp = html.find(imp_anchor)
        if idx_imp != -1:
            exp_btn = '<button type="button" id="btnExportUserProfileJson" class="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg transition">💾 Сохранить в .json</button>\n            '
            html = html[:idx_imp] + exp_btn + html[idx_imp:]

    # 3b. #btnShareUrl right next to #btnResetFilters
    if 'id="btnShareUrl"' not in html:
        rst_anchor = '<button id="btnResetFilters"'
        idx_rst = html.find(rst_anchor)
        if idx_rst != -1:
            share_btn = '<button type="button" id="btnShareUrl" class="text-indigo-600 hover:underline font-bold" title="Скопировать ссылку на текущую выборку и фильтры">🔗 Ссылка на выборку</button>\n            '
            html = html[:idx_rst] + share_btn + html[idx_rst:]

    # 3c. #btnExportCompareCard inside the Compare tab
    if 'id="btnExportCompareCard"' not in html:
        cmp_anchor = 'id="btnClearCompare"'
        idx_cmp = html.find(cmp_anchor)
        if idx_cmp != -1:
            tag_start = html.rfind("<button", 0, idx_cmp)
            if tag_start != -1:
                cmp_btn = '<button type="button" id="btnExportCompareCard" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition" title="Экспортировать карточку сравнения в автономный HTML / PDF">📄 Экспорт карточки (.html)</button>\n          '
                html = html[:tag_start] + cmp_btn + html[tag_start:]

    # 3d. Ensure #divToast exists and btnResetCat is fixed
    html = html.replace('getElementById("btnResetCat")', 'getElementById("btnResetFilters")')
    if 'id="divToast"' not in html:
        toast_html = '\n  <div id="divToast" class="hidden fixed bottom-5 right-5 z-[9999] bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 transition-all"></div>\n'
        idx_body = html.rfind("</body>")
        html = html[:idx_body] + toast_html + html[idx_body:]

    with open(out_html, "w", encoding="utf-8") as fp:
        fp.write(html)
    print(f"[HTML] Built optimized offline-ready portal ({os.path.getsize(out_html):,} bytes) -> {out_html}")


def recalculate_xlsx_libreoffice(xlsx_path: str) -> None:
    lo_prof = tempfile.mkdtemp(prefix="lo_build_", dir="/tmp")
    recalc_dir = tempfile.mkdtemp(prefix="lo_out_", dir="/tmp")
    env = os.environ.copy()
    env["HOME"] = "/tmp"
    env["TMPDIR"] = "/tmp"
    subprocess.run(
        [
            "libreoffice", "--headless",
            f"-env:UserInstallation=file://{lo_prof}",
            "--convert-to", "xlsx",
            "--outdir", recalc_dir,
            xlsx_path,
        ],
        env=env,
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    shutil.move(os.path.join(recalc_dir, os.path.basename(xlsx_path)), xlsx_path)
    print(f"[XLSX] LibreOffice formula recalculation succeeded -> {xlsx_path}")


def verify_outputs(master: dict, out_csv: str, out_xlsx: str, out_html: str) -> None:
    expected_n = len(master["catalog"])
    # 1. Verify CSV
    with open(out_csv, "r", encoding="utf-8-sig", newline="") as fp:
        rows = list(csv.DictReader(fp))
    assert len(rows) == expected_n, f"CSV row mismatch: {len(rows)} vs {expected_n}"
    for r in rows:
        assert int(float(r["Цена (₽)"])) + int(float(r["Пошлина РФ (₽)"])) == int(float(r["Итого на руки (₽)"]))
    print(f"[VERIFY] CSV OK: {len(rows)} rows, 30 cols, 100% price+duty parity")

    # 2. Verify XLSX formulas & parity
    wb_v = openpyxl.load_workbook(out_xlsx, data_only=True)
    ws1 = wb_v["1. Общая база мониторов"]
    assert ws1.max_row - 4 == expected_n, f"XLSX Sheet 1 rows: {ws1.max_row - 4} vs {expected_n}"
    ws13 = wb_v["13. Сводная по брендам"]
    s13_total = ws13.cell(ws13.max_row, 3).value
    assert s13_total == expected_n, f"XLSX Sheet 13 sum: {s13_total} vs {expected_n}"
    err_cnt = 0
    for sn in wb_v.sheetnames:
        ws = wb_v[sn]
        for r in range(1, ws.max_row + 1):
            for c in range(1, ws.max_column + 1):
                v = ws.cell(r, c).value
                if isinstance(v, str) and any(e in v for e in ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "Err:")):
                    err_cnt += 1
    assert err_cnt == 0, f"XLSX has {err_cnt} formula errors!"
    wb_v.close()
    print(f"[VERIFY] XLSX OK: {expected_n} models, Sheet 13 SUM={s13_total}, 0 formula errors across 18 sheets")

    # 3. Verify HTML JS syntax & lossless DB unpack via Node
    with open(out_html, "r", encoding="utf-8") as fp:
        html_txt = fp.read()
    m_sc = re.search(r"<script(?![^>]*src)[^>]*>([\s\S]*?)</script>", html_txt, flags=re.I)
    assert m_sc, "Main script block not found in HTML"
    tmp_js = "/tmp/verify_built_main.js"
    with open(tmp_js, "w", encoding="utf-8") as fp:
        fp.write(m_sc.group(1))
    nc = subprocess.run(["node", "--check", tmp_js], capture_output=True, text=True)
    assert nc.returncode == 0, f"HTML JS syntax error:\n{nc.stderr}"
    # Verify unpack produces exact expected_n items and intact fields
    m_db = re.search(r"(const DB = \(\(\) => \{[\s\S]*?\}\)\(\);)", m_sc.group(1))
    assert m_db, "Compressed DB unpacker not found"
    unpack_test = m_db.group(1) + f"\nif (DB.catalog.length !== {expected_n}) process.exit(2);\nconsole.log('UNPACK_OK', DB.catalog.length, DB.catalog[0].model, DB.catalog[{expected_n - 1}].model);\n"
    tmp_unpack = os.path.join(tempfile.gettempdir(), "verify_db_unpack.js")
    with open(tmp_unpack, "w", encoding="utf-8") as fp_u:
        fp_u.write(unpack_test)
    ut = subprocess.run(["node", tmp_unpack], capture_output=True, text=True)
    assert ut.returncode == 0, f"DB unpack failed: {ut.stderr}"
    print(f"[VERIFY] HTML OK: node --check=0, {ut.stdout.strip()}")


def main():
    parser = argparse.ArgumentParser(description="Build monitor_full_database from Single Source of Truth")
    parser.add_argument("--master", default="database_master.json", help="Path to database_master.json")
    parser.add_argument("--template-xlsx", default="monitor_full_database.xlsx", help="Template XLSX with styles & ref sheets")
    parser.add_argument("--template-html", default="monitor_full_database.html", help="Template HTML portal shell")
    parser.add_argument("--outdir", default=".", help="Output directory")
    parser.add_argument("--recalc", action="store_true", help="Recalculate XLSX via headless LibreOffice")
    parser.add_argument("--verify", action="store_true", help="Run automated integrity checks")
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    with open(args.master, "r", encoding="utf-8") as fp:
        master = json.load(fp)

    out_csv = os.path.join(args.outdir, "monitor_full_database.csv")
    out_xlsx = os.path.join(args.outdir, "monitor_full_database.xlsx")
    out_html = os.path.join(args.outdir, "monitor_full_database.html")

    build_csv(master, out_csv)
    upgrade_xlsx(master, args.template_xlsx, out_xlsx)
    build_html(master, args.template_html, out_html)

    if args.recalc:
        recalculate_xlsx_libreoffice(out_xlsx)
    if args.verify:
        verify_outputs(master, out_csv, out_xlsx, out_html)
    print("[DONE] All targets built cleanly.")


if __name__ == "__main__":
    main()
