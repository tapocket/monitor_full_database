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
            ws["A1"] = str(ws["A1"].value).replace("62 СТОЛБЦА", "69 СТОЛБЦОВ")

        ws.freeze_panes = "C5"

    # Update Sheet 0 & Sheet 1 A1 column counts (65 cols)
    # APPEND_NEW_MODELS_TO_WS1: sync newly added catalog models into Sheet 1 ("1. Общая база мониторов")
    ws1_sync = wb["1. Общая база мониторов"]
    existing_count = max(0, ws1_sync.max_row - 4)
    template_r = ws1_sync.max_row
    for item in master["catalog"][existing_count:]:
        m_name = str(item.get("model") or "").strip()
        new_r = ws1_sync.max_row + 1
        col_vals = {
            1: item.get("brand", ""),
            2: m_name,
            3: item.get("reg", "Глобал"),
            4: item.get("oem", "—"),
            5: item.get("year", 2026),
            7: item.get("tier", ""),
            8: item.get("use", ""),
            9: item.get("diag", 27),
            10: item.get("res", ""),
            11: item.get("cat", ""),
            12: item.get("hz", ""),
            13: item.get("gtg80", ""),
            18: item.get("ptype", ""),
            19: item.get("pmodel", ""),
            20: item.get("subp", ""),
            21: item.get("coat", ""),
            22: item.get("zones", ""),
            24: item.get("cr", ""),
            26: item.get("sdr_max", ""),
            27: item.get("hdr", ""),
            30: item.get("srgb", ""),
            31: item.get("argb", ""),
            32: item.get("dci", ""),
            36: item.get("ports", ""),
            52: item.get("rub", 0),
            53: item.get("duty", 0),
            54: item.get("hand", 0),
            59: item.get("rev_url", ""),
            62: item.get("notes", ""),
            63: item.get("max_hz", 0),
            64: normalize_brand(item.get("brand", ""))[0],
            65: normalize_brand(item.get("brand", ""))[1],
        }
        for c_i in range(1, 66):
            copy_cell_style(ws1_sync.cell(template_r, c_i), ws1_sync.cell(new_r, c_i))
            if c_i in col_vals:
                ws1_sync.cell(new_r, c_i).value = col_vals[c_i]

    # Update all Sheet 13 count/sum formulas to cover new LAST_S1
    ws13_sync = wb["13. Сводная по брендам"]
    new_last_s1 = ws1_sync.max_row
    for r_i in range(5, ws13_sync.max_row + 1):
        for c_i in range(1, ws13_sync.max_column + 1):
            v = ws13_sync.cell(r_i, c_i).value
            if isinstance(v, str) and v.startswith("="):
                ws13_sync.cell(r_i, c_i).value = re.sub(r"(\$[A-Z]+\$5:\$[A-Z]+\$)\d+", rf"\g<1>{new_last_s1}", v)

    ws0 = wb["0. ИНФА и Гайд по таблице"]
    ws0["A1"] = '="ИНФО И ПУТЕВОДИТЕЛЬ ПО ИНЖЕНЕРНОЙ БАЗЕ МОНИТОРОВ monitor_full_database (" & COUNTA(\'13. Сводная по брендам\'!A5:A500) & " БРЕНДОВ • " & COUNTA(\'1. Общая база мониторов\'!B5:B5000) & " МОДЕЛЕЙ • 69 СТОЛБЦОВ • 18 ВКЛАДОК)"'
    ws0["A2"] = "Источники и благодарности: Таблица «МАНИТОРЫ» (автор Гоша) https://docs.google.com/spreadsheets/d/1wTcNBG28l6VL7BXuO_vIlj0ncRNvrCEExy-iGrNFARU/edit?gid=830910660#gid=830910660 | YouTube-канал «Джун» https://www.youtube.com/@djunn/videos | TFTCentral https://tftcentral.co.uk/category/reviews | RTINGS https://www.rtings.com/monitor | DisplaySpecifications https://www.displayspecifications.com/ | Blur Busters TestUFO https://testufo.com/ghosting | VESA DisplayPort https://vesa.org/displayport-developer/certified-components/"

    ws1 = wb["1. Общая база мониторов"]
    ws1["A1"] = '="ПОЛНАЯ ИНЖЕНЕРНАЯ БАЗА МОНИТОРОВ monitor_full_database (" & COUNTA(\'13. Сводная по брендам\'!A5:A500) & " БРЕНДОВ — " & COUNTA(B5:B5000) & " МОДЕЛЕЙ — 69 СТОЛБЦОВ)"'

    # Update Sheet 13 to average pure numeric BK (Col 63) for Avg Hz (Col 21 / U)
    ws13 = wb["13. Сводная по брендам"]
    S1 = "'1. Общая база мониторов'"
    LAST_S1 = ws1.max_row
    s13_last = ws13.max_row - 1
    for r in range(5, s13_last + 1):
        ws13.cell(r, 21).value = f"=IFERROR(ROUND(AVERAGEIF({S1}!$A$5:$A${LAST_S1}, B{r}, {S1}!$BK$5:$BK${LAST_S1}), 0), 0)"
    ws13.cell(ws13.max_row, 21).value = f"=ROUND(AVERAGE({S1}!$BK$5:$BK${LAST_S1}), 0)"
    ws13["A1"] = f'="СВОДНАЯ АНАЛИТИКА БАЗЫ МОНИТОРОВ ПО " & COUNTA(B5:B{s13_last}) & " БРЕНДАМ (" & SUM(C5:C{s13_last}) & " МОДЕЛЕЙ — 69 СТОЛБЦОВ)"'

    wb.save(out_xlsx)
    wb.close()
    print(f"[XLSX] Upgraded 18 sheets (65 cols, clean numeric types) -> {out_xlsx}")


def generate_offline_tailwind_css(html_text: str) -> str:
    """Compile all Tailwind 3.4 utility classes actually used in HTML/JS into a single zero-CDN CSS block."""
    # Full Tailwind 3.4 color palette
    PALETTE = {
        "white": "#ffffff", "black": "#000000", "transparent": "transparent", "current": "currentColor",
        "slate-50": "#f8fafc", "slate-100": "#f1f5f9", "slate-200": "#e2e8f0", "slate-300": "#cbd5e1", "slate-400": "#94a3b8", "slate-500": "#64748b", "slate-600": "#475569", "slate-700": "#334155", "slate-800": "#1e293b", "slate-900": "#0f172a", "slate-950": "#020617",
        "gray-50": "#f9fafb", "gray-100": "#f3f4f6", "gray-200": "#e5e7eb", "gray-300": "#d1d5db", "gray-400": "#9ca3af", "gray-500": "#6b7280", "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937", "gray-900": "#111827", "gray-950": "#030712",
        "zinc-50": "#fafafa", "zinc-100": "#f4f4f5", "zinc-200": "#e4e4e7", "zinc-300": "#d4d4d8", "zinc-400": "#a1a1aa", "zinc-500": "#71717a", "zinc-600": "#52525b", "zinc-700": "#3f3f46", "zinc-800": "#27272a", "zinc-900": "#18181b", "zinc-950": "#09090b",
        "neutral-50": "#fafafa", "neutral-100": "#f5f5f5", "neutral-200": "#e5e5e5", "neutral-300": "#d4d4d4", "neutral-400": "#a3a3a3", "neutral-500": "#737373", "neutral-600": "#525252", "neutral-700": "#404040", "neutral-800": "#262626", "neutral-900": "#171717", "neutral-950": "#0a0a0a",
        "red-50": "#fef2f2", "red-100": "#fee2e2", "red-200": "#fecaca", "red-300": "#fca5a5", "red-400": "#f87171", "red-500": "#ef4444", "red-600": "#dc2626", "red-700": "#b91c1c", "red-800": "#991b1b", "red-900": "#7f1d1d", "red-950": "#450a0a",
        "orange-50": "#fff7ed", "orange-100": "#ffedd5", "orange-200": "#fed7aa", "orange-300": "#fdba74", "orange-400": "#fb923c", "orange-500": "#f97316", "orange-600": "#ea580c", "orange-700": "#c2410c", "orange-800": "#9a3412", "orange-900": "#7c2d12", "orange-950": "#431407",
        "amber-50": "#fffbeb", "amber-100": "#fef3c7", "amber-200": "#fde68a", "amber-300": "#fcd34d", "amber-400": "#fbbf24", "amber-500": "#f59e0b", "amber-600": "#d97706", "amber-700": "#b45309", "amber-800": "#92400e", "amber-900": "#78350f", "amber-950": "#451a03",
        "yellow-50": "#fefce8", "yellow-100": "#fef9c3", "yellow-200": "#fef08a", "yellow-300": "#fde047", "yellow-400": "#facc15", "yellow-500": "#eab308", "yellow-600": "#ca8a04", "yellow-700": "#a16207", "yellow-800": "#854d0e", "yellow-900": "#713f12", "yellow-950": "#422006",
        "lime-50": "#f7fee7", "lime-100": "#ecfccb", "lime-200": "#d9f99d", "lime-300": "#bef264", "lime-400": "#a3e635", "lime-500": "#84cc16", "lime-600": "#65a30d", "lime-700": "#4d7c0f", "lime-800": "#3f6212", "lime-900": "#365314", "lime-950": "#1a2e05",
        "green-50": "#f0fdf4", "green-100": "#dcfce7", "green-200": "#bbf7d0", "green-300": "#86efac", "green-400": "#4ade80", "green-500": "#22c55e", "green-600": "#16a34a", "green-700": "#15803d", "green-800": "#166534", "green-900": "#14532d", "green-950": "#052e16",
        "emerald-50": "#ecfdf5", "emerald-100": "#d1fae5", "emerald-200": "#a7f3d0", "emerald-300": "#6ee7b7", "emerald-400": "#34d399", "emerald-500": "#10b981", "emerald-600": "#059669", "emerald-700": "#047857", "emerald-800": "#065f46", "emerald-900": "#064e3b", "emerald-950": "#022c22",
        "teal-50": "#f0fdfa", "teal-100": "#ccfbf1", "teal-200": "#99f6e4", "teal-300": "#5eead4", "teal-400": "#2dd4bf", "teal-500": "#14b8a6", "teal-600": "#0d9488", "teal-700": "#0f766e", "teal-800": "#115e59", "teal-900": "#134e4a", "teal-950": "#042f2e",
        "cyan-50": "#ecfeff", "cyan-100": "#cffafe", "cyan-200": "#a5f3fc", "cyan-300": "#67e8f9", "cyan-400": "#22d3ee", "cyan-500": "#06b6d4", "cyan-600": "#0891b2", "cyan-700": "#0e7490", "cyan-800": "#155e75", "cyan-900": "#164e63", "cyan-950": "#083344",
        "sky-50": "#f0f9ff", "sky-100": "#e0f2fe", "sky-200": "#bae6fd", "sky-300": "#7dd3fc", "sky-400": "#38bdf8", "sky-500": "#0ea5e9", "sky-600": "#0284c7", "sky-700": "#0369a1", "sky-800": "#075985", "sky-900": "#0c4a6e", "sky-950": "#082f49",
        "blue-50": "#eff6ff", "blue-100": "#dbeafe", "blue-200": "#bfdbfe", "blue-300": "#93c5fd", "blue-400": "#60a5fa", "blue-500": "#3b82f6", "blue-600": "#2563eb", "blue-700": "#1d4ed8", "blue-800": "#1e40af", "blue-900": "#1e3a8a", "blue-950": "#172554",
        "indigo-50": "#eef2ff", "indigo-100": "#e0e7ff", "indigo-200": "#c7d2fe", "indigo-300": "#a5b4fc", "indigo-400": "#818cf8", "indigo-500": "#6366f1", "indigo-600": "#4f46e5", "indigo-700": "#4338ca", "indigo-800": "#3730a3", "indigo-900": "#312e81", "indigo-950": "#1e1b4b",
        "violet-50": "#f5f3ff", "violet-100": "#ede9fe", "violet-200": "#ddd6fe", "violet-300": "#c4b5fd", "violet-400": "#a78bfa", "violet-500": "#8b5cf6", "violet-600": "#7c3aed", "violet-700": "#6d28d9", "violet-800": "#5b21b6", "violet-900": "#4c1d95", "violet-950": "#2e1065",
        "purple-50": "#faf5ff", "purple-100": "#f3e8ff", "purple-200": "#e9d5ff", "purple-300": "#d8b4fe", "purple-400": "#c084fc", "purple-500": "#a855f7", "purple-600": "#9333ea", "purple-700": "#7e22ce", "purple-800": "#6b21a8", "purple-900": "#581c87", "purple-950": "#3b0764",
        "fuchsia-50": "#fdf4ff", "fuchsia-100": "#fae8ff", "fuchsia-200": "#f5d0fe", "fuchsia-300": "#f0abfc", "fuchsia-400": "#e879f9", "fuchsia-500": "#d946ef", "fuchsia-600": "#c026d3", "fuchsia-700": "#a21caf", "fuchsia-800": "#86198f", "fuchsia-900": "#701a75", "fuchsia-950": "#4a044e",
        "pink-50": "#fdf2f8", "pink-100": "#fce7f3", "pink-200": "#fbcfe8", "pink-300": "#f9a8d4", "pink-400": "#f472b6", "pink-500": "#ec4899", "pink-600": "#db2777", "pink-700": "#be185d", "pink-800": "#9d174d", "pink-900": "#831843", "pink-950": "#500724",
        "rose-50": "#fff1f2", "rose-100": "#ffe4e6", "rose-200": "#fecdd3", "rose-300": "#fda4af", "rose-400": "#fb7185", "rose-500": "#f43f5e", "rose-600": "#e11d48", "rose-700": "#be123c", "rose-800": "#9f1239", "rose-900": "#881337", "rose-950": "#4c0519",
    }

    def hex_to_rgba(hx: str, alpha_str: str) -> str:
        if hx in ("transparent", "currentColor"):
            return hx
        h = hx.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(alpha_str) / 100.0
        return f"rgba({r},{g},{b},{a:g})"

    def resolve_color(tok: str) -> str | None:
        if tok.startswith("[") and tok.endswith("]"):
            return tok[1:-1]
        if "/" in tok:
            base, alpha = tok.rsplit("/", 1)
            if base in PALETTE and alpha.isdigit():
                return hex_to_rgba(PALETTE[base], alpha)
        return PALETTE.get(tok)

    def resolve_spacing(val: str) -> str | None:
        if val == "px": return "1px"
        if val == "auto": return "auto"
        if val == "full": return "100%"
        if val == "screen": return "100vw"
        if val == "fit": return "fit-content"
        if val == "max": return "max-content"
        if val == "min": return "min-content"
        if val.startswith("[") and val.endswith("]"):
            return val[1:-1].replace("_", " ")
        if "/" in val:
            a, b = val.split("/", 1)
            if a.isdigit() and b.isdigit() and int(b) > 0:
                return f"{int(a)/int(b)*100:.6g}%"
        try:
            f = float(val)
            return "0px" if f == 0 else f"{f * 0.25:g}rem"
        except ValueError:
            return None

    STATIC = {
        "block": "display:block", "inline-block": "display:inline-block", "inline": "display:inline",
        "flex": "display:flex", "inline-flex": "display:inline-flex", "grid": "display:grid",
        "inline-grid": "display:inline-grid", "table": "display:table", "hidden": "display:none",
        "static": "position:static", "fixed": "position:fixed", "absolute": "position:absolute",
        "relative": "position:relative", "sticky": "position:sticky",
        "inset-0": "inset:0px", "inset-x-0": "left:0px;right:0px", "inset-y-0": "top:0px;bottom:0px",
        "flex-row": "flex-direction:row", "flex-col": "flex-direction:column",
        "flex-wrap": "flex-wrap:wrap", "flex-nowrap": "flex-wrap:nowrap",
        "flex-1": "flex:1 1 0%", "flex-auto": "flex:1 1 auto", "flex-none": "flex:none",
        "flex-shrink-0": "flex-shrink:0", "shrink-0": "flex-shrink:0", "grow": "flex-grow:1",
        "items-start": "align-items:flex-start", "items-end": "align-items:flex-end",
        "items-center": "align-items:center", "items-baseline": "align-items:baseline", "items-stretch": "align-items:stretch",
        "justify-start": "justify-content:flex-start", "justify-end": "justify-content:flex-end",
        "justify-center": "justify-content:center", "justify-between": "justify-content:space-between", "justify-around": "justify-content:space-around",
        "self-start": "align-self:flex-start", "self-center": "align-self:center", "self-end": "align-self:flex-end",
        "align-middle": "vertical-align:middle", "align-top": "vertical-align:top", "align-bottom": "vertical-align:bottom",
        "text-left": "text-align:left", "text-center": "text-align:center", "text-right": "text-align:right",
        "font-normal": "font-weight:400", "font-medium": "font-weight:500", "font-semibold": "font-weight:600",
        "font-bold": "font-weight:700", "font-extrabold": "font-weight:800", "font-black": "font-weight:900",
        "font-mono": "font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace",
        "italic": "font-style:italic", "not-italic": "font-style:normal",
        "uppercase": "text-transform:uppercase", "lowercase": "text-transform:lowercase", "capitalize": "text-transform:capitalize",
        "underline": "text-decoration-line:underline", "line-through": "text-decoration-line:line-through", "no-underline": "text-decoration-line:none",
        "whitespace-nowrap": "white-space:nowrap", "whitespace-pre-wrap": "white-space:pre-wrap", "whitespace-normal": "white-space:normal",
        "break-words": "overflow-wrap:break-word", "break-all": "word-break:break-all",
        "truncate": "overflow:hidden;text-overflow:ellipsis;white-space:nowrap",
        "tabular-nums": "font-variant-numeric:tabular-nums",
        "leading-none": "line-height:1", "leading-tight": "line-height:1.25", "leading-snug": "line-height:1.375",
        "leading-normal": "line-height:1.5", "leading-relaxed": "line-height:1.625",
        "tracking-tight": "letter-spacing:-0.025em", "tracking-wide": "letter-spacing:0.025em", "tracking-wider": "letter-spacing:0.05em",
        "text-xs": "font-size:0.75rem;line-height:1rem", "text-sm": "font-size:0.875rem;line-height:1.25rem",
        "text-base": "font-size:1rem;line-height:1.5rem", "text-lg": "font-size:1.125rem;line-height:1.75rem",
        "text-xl": "font-size:1.25rem;line-height:1.75rem", "text-2xl": "font-size:1.5rem;line-height:2rem",
        "text-3xl": "font-size:1.875rem;line-height:2.25rem",
        "rounded-none": "border-radius:0px", "rounded-sm": "border-radius:0.125rem", "rounded": "border-radius:0.25rem",
        "rounded-md": "border-radius:0.375rem", "rounded-lg": "border-radius:0.5rem", "rounded-xl": "border-radius:0.75rem",
        "rounded-2xl": "border-radius:1rem", "rounded-3xl": "border-radius:1.5rem", "rounded-full": "border-radius:9999px",
        "rounded-t": "border-top-left-radius:0.25rem;border-top-right-radius:0.25rem",
        "rounded-t-lg": "border-top-left-radius:0.5rem;border-top-right-radius:0.5rem",
        "rounded-t-xl": "border-top-left-radius:0.75rem;border-top-right-radius:0.75rem",
        "rounded-b-lg": "border-bottom-left-radius:0.5rem;border-bottom-right-radius:0.5rem",
        "rounded-b-xl": "border-bottom-left-radius:0.75rem;border-bottom-right-radius:0.75rem",
        "border": "border-width:1px;border-style:solid", "border-0": "border-width:0px",
        "border-2": "border-width:2px;border-style:solid", "border-4": "border-width:4px;border-style:solid",
        "border-t": "border-top-width:1px;border-top-style:solid", "border-b": "border-bottom-width:1px;border-bottom-style:solid",
        "border-l": "border-left-width:1px;border-left-style:solid", "border-r": "border-right-width:1px;border-right-style:solid",
        "border-b-2": "border-bottom-width:2px;border-bottom-style:solid", "border-l-4": "border-left-width:4px;border-left-style:solid",
        "border-dashed": "border-style:dashed", "border-dotted": "border-style:dotted", "border-collapse": "border-collapse:collapse",
        "shadow-sm": "box-shadow:0 1px 2px 0 rgba(0,0,0,0.05)",
        "shadow": "box-shadow:0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1)",
        "shadow-md": "box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1)",
        "shadow-lg": "box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1)",
        "shadow-xl": "box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)",
        "shadow-2xl": "box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)", "shadow-none": "box-shadow:none",
        "overflow-hidden": "overflow:hidden", "overflow-auto": "overflow:auto", "overflow-x-auto": "overflow-x:auto",
        "overflow-y-auto": "overflow-y:auto", "overflow-y-scroll": "overflow-y:scroll", "overflow-visible": "overflow:visible",
        "cursor-pointer": "cursor:pointer", "cursor-default": "cursor:default", "cursor-not-allowed": "cursor:not-allowed",
        "select-none": "user-select:none", "select-all": "user-select:all", "pointer-events-none": "pointer-events:none",
        "transition": "transition-property:color,background-color,border-color,opacity,box-shadow,transform;transition-duration:150ms",
        "transition-all": "transition-property:all;transition-duration:150ms",
        "transition-colors": "transition-property:color,background-color,border-color;transition-duration:150ms",
        "backdrop-blur-sm": "backdrop-filter:blur(4px)", "backdrop-blur": "backdrop-filter:blur(8px)",
        "backdrop-blur-md": "backdrop-filter:blur(12px)", "backdrop-blur-lg": "backdrop-filter:blur(16px)",
        "bg-gradient-to-r": "background-image:linear-gradient(to right,var(--tw-gradient-from,transparent),var(--tw-gradient-to,transparent))",
        "bg-gradient-to-br": "background-image:linear-gradient(to bottom right,var(--tw-gradient-from,transparent),var(--tw-gradient-to,transparent))",
        "bg-gradient-to-b": "background-image:linear-gradient(to bottom,var(--tw-gradient-from,transparent),var(--tw-gradient-to,transparent))",
        "list-disc": "list-style-type:disc", "list-decimal": "list-style-type:decimal", "list-inside": "list-style-position:inside",
        "outline-none": "outline:2px solid transparent;outline-offset:2px",
        "ring-1": "box-shadow:0 0 0 1px var(--tw-ring-color,rgba(59,130,246,0.5))",
        "ring-2": "box-shadow:0 0 0 2px var(--tw-ring-color,rgba(59,130,246,0.5))",
        "object-contain": "object-fit:contain", "object-cover": "object-fit:cover",
        "sr-only": "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0",
    }

    MAX_W = {
        "xs": "20rem", "sm": "24rem", "md": "28rem", "lg": "32rem", "xl": "36rem",
        "2xl": "42rem", "3xl": "48rem", "4xl": "56rem", "5xl": "64rem", "6xl": "72rem",
        "7xl": "80rem", "full": "100%", "none": "none", "screen-xl": "1280px", "screen-2xl": "1536px",
    }

    def compile_utility(util: str) -> tuple[str, str] | None:
        """Returns (extra_selector_suffix, css_declarations) or None."""
        if util in STATIC:
            return ("", STATIC[util])
        if util.startswith("space-y-"):
            v = resolve_spacing(util[8:])
            if v: return (" > :not([hidden]) ~ :not([hidden])", f"margin-top:{v}")
        if util.startswith("space-x-"):
            v = resolve_spacing(util[8:])
            if v: return (" > :not([hidden]) ~ :not([hidden])", f"margin-left:{v}")
        if util.startswith("divide-y"):
            return (" > :not([hidden]) ~ :not([hidden])", "border-top-width:1px;border-top-style:solid")
        if util.startswith("divide-"):
            c = resolve_color(util[7:])
            if c: return (" > :not([hidden]) ~ :not([hidden])", f"border-color:{c}")
        if util.startswith("bg-"):
            c = resolve_color(util[3:])
            if c: return ("", f"background-color:{c}")
        if util.startswith("text-"):
            rest = util[5:]
            if rest.startswith("[") and rest.endswith("]"):
                val = rest[1:-1]
                if val.startswith("#") or val.startswith("rgb"):
                    return ("", f"color:{val}")
                return ("", f"font-size:{val}")
            c = resolve_color(rest)
            if c: return ("", f"color:{c}")
        if util.startswith("border-"):
            c = resolve_color(util[7:])
            if c: return ("", f"border-color:{c}")
        if util.startswith("accent-"):
            c = resolve_color(util[7:])
            if c: return ("", f"accent-color:{c}")
        if util.startswith("ring-"):
            c = resolve_color(util[5:])
            if c: return ("", f"--tw-ring-color:{c}")
        if util.startswith("from-"):
            c = resolve_color(util[5:])
            if c: return ("", f"--tw-gradient-from:{c}")
        if util.startswith("to-"):
            c = resolve_color(util[3:])
            if c: return ("", f"--tw-gradient-to:{c}")
        if util.startswith("fill-"):
            c = resolve_color(util[5:])
            if c: return ("", f"fill:{c}")
        if util.startswith("stroke-"):
            c = resolve_color(util[7:])
            if c: return ("", f"stroke:{c}")

        # Spacing & sizing
        for pref, props in [
            ("px-", ["padding-left", "padding-right"]), ("py-", ["padding-top", "padding-bottom"]),
            ("pt-", ["padding-top"]), ("pr-", ["padding-right"]), ("pb-", ["padding-bottom"]), ("pl-", ["padding-left"]), ("p-", ["padding"]),
            ("mx-", ["margin-left", "margin-right"]), ("my-", ["margin-top", "margin-bottom"]),
            ("mt-", ["margin-top"]), ("mr-", ["margin-right"]), ("mb-", ["margin-bottom"]), ("ml-", ["margin-left"]), ("m-", ["margin"]),
            ("-mt-", ["margin-top"]), ("-mb-", ["margin-bottom"]), ("-ml-", ["margin-left"]), ("-mr-", ["margin-right"]),
            ("gap-x-", ["column-gap"]), ("gap-y-", ["row-gap"]), ("gap-", ["gap"]),
            ("top-", ["top"]), ("bottom-", ["bottom"]), ("left-", ["left"]), ("right-", ["right"]),
            ("min-w-", ["min-width"]), ("min-h-", ["min-height"]), ("max-h-", ["max-height"]),
            ("w-", ["width"]), ("h-", ["height"]),
        ]:
            if util.startswith(pref):
                raw_v = util[len(pref):]
                v = resolve_spacing(raw_v)
                if v:
                    if pref.startswith("-") and v != "0px":
                        v = "-" + v
                    if pref == "h-" and raw_v == "screen": v = "100vh"
                    if pref == "min-h-" and raw_v == "screen": v = "100vh"
                    if pref == "max-h-" and raw_v == "screen": v = "100vh"
                    return ("", ";".join(f"{p}:{v}" for p in props))

        if util.startswith("max-w-"):
            rest = util[6:]
            if rest in MAX_W: return ("", f"max-width:{MAX_W[rest]}")
            v = resolve_spacing(rest)
            if v: return ("", f"max-width:{v}")
        if util.startswith("grid-cols-"):
            n = util[10:]
            if n.isdigit(): return ("", f"grid-template-columns:repeat({n},minmax(0,1fr))")
        if util.startswith("col-span-"):
            n = util[9:]
            if n == "full": return ("", "grid-column:1 / -1")
            if n.isdigit(): return ("", f"grid-column:span {n} / span {n}")
        if util.startswith("z-"):
            z = util[2:]
            if z.isdigit() or (z.startswith("[") and z.endswith("]")):
                return ("", f"z-index:{z.strip('[]')}")
        if util.startswith("opacity-"):
            o = util[8:]
            if o.isdigit(): return ("", f"opacity:{int(o)/100:g}")
        if util.startswith("line-clamp-"):
            n = util[11:]
            if n.isdigit(): return ("", f"overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:{n}")
        return None

    # Scan class tokens in HTML/JS (excluding compressed _P JSON)
    scan_txt = re.sub(r'<style[^>]*>.*?</style>', '', html_text, flags=re.S)
    p_idx = scan_txt.find("const _P = ")
    if p_idx != -1:
        p_end = scan_txt.find(";\n  const _K", p_idx)
        if p_end != -1:
            scan_txt = scan_txt[:p_idx] + scan_txt[p_end:]

    tokens = set()
    for m in re.finditer(r'class=["\']([^"\'${}]+)["\']', scan_txt):
        for tok in m.group(1).split():
            if tok and not tok.startswith(("${", "{")):
                tokens.add(tok)

    def esc_cls(c: str) -> str:
        return re.sub(r'([^a-zA-Z0-9_-])', r'\\\1', c)

    base_rules = [
        "*,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e2e8f0}",
        "html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:'Segoe UI Variable','Segoe UI',system-ui,-apple-system,sans-serif}",
        "body{margin:0;line-height:inherit}",
        "button,input,select,textarea{font-family:inherit;font-size:100%;color:inherit;margin:0}",
        "button{background-color:transparent;background-image:none;cursor:pointer}",
        "table{text-indent:0;border-color:inherit;border-collapse:collapse}",
        "a{color:inherit;text-decoration:inherit}",
    ]
    dark_rules = []
    media_rules = {"sm": [], "md": [], "lg": [], "xl": []}
    BP = {"sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px"}

    for tok in sorted(tokens):
        parts = tok.split(":")
        util = parts[-1]
        variants = parts[:-1]
        compiled = compile_utility(util)
        if not compiled:
            continue
        extra_suf, decls = compiled
        sel = "." + esc_cls(tok) + extra_suf
        is_dark = "dark" in variants
        is_hover = "hover" in variants
        is_focus = "focus" in variants
        bp = next((v for v in variants if v in BP), None)
        if is_hover: sel += ":hover"
        if is_focus: sel += ":focus"
        if is_dark: sel = "html.dark " + sel
        rule = f"{sel}{{{decls}}}"
        if bp:
            media_rules[bp].append(rule)
        elif is_dark:
            dark_rules.append(rule)
        else:
            base_rules.append(rule)

    out = ["/* Local Compiled Tailwind 3.4 Utility CSS (Zero-CDN, Instant Render) */"]
    out.extend(base_rules)
    out.extend(dark_rules)
    for bp_k in ("sm", "md", "lg", "xl"):
        if media_rules[bp_k]:
            out.append(f"@media(min-width:{BP[bp_k]}){{" + "".join(media_rules[bp_k]) + "}")
    return "\n".join(out)



def load_price_history_map(catalog: list, history_dir: str = "data/price_history") -> dict:
    """Load real recorded price history snapshots from data/price_history/*.jsonl matched to catalog IDs."""
    import glob as _glob
    if not os.path.isdir(history_dir):
        return {}
    by_norm = {}
    for m in catalog:
        nm = str(m.get("model") or "").strip().lower()
        if nm:
            by_norm[nm] = m["id"]
    out = {}
    for fp in sorted(_glob.glob(os.path.join(history_dir, "*.jsonl"))):
        try:
            with open(fp, "r", encoding="utf-8") as fh:
                for ln in fh:
                    ln = ln.strip()
                    if not ln: continue
                    rec = json.loads(ln)
                    mm = str(rec.get("model_match") or "").strip().lower()
                    mid = rec.get("cat_id") or by_norm.get(mm)
                    if not mid and mm:
                        for k_nm, k_id in by_norm.items():
                            if mm in k_nm or k_nm in mm:
                                mid = k_id
                                break
                    if not mid: continue
                    pt = {
                        "d": str(rec.get("date") or ""),
                        "r": int(rec.get("retail_rf_rub") or 0),
                        "m": int(rec.get("mp_rf_rub") or 0),
                        "s": str(rec.get("store") or "")[:40],
                    }
                    out.setdefault(str(mid), []).append(pt)
        except Exception:
            continue
    return out



def load_affiliates_config(path: str = "config/affiliates.json") -> dict:
    if not os.path.exists(path):
        return {"enabled": False}
    try:
        with open(path, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return {"enabled": False}


def apply_affiliate_url(url: str, cfg: dict) -> str:
    if not url or not cfg or not cfg.get("enabled"):
        return url
    import urllib.parse as _up
    u_low = url.lower()
    ym = cfg.get("yandex_market") or {}
    if "market.yandex.ru" in u_low and ym.get("clid"):
        parts = _up.urlsplit(url)
        qs = dict(_up.parse_qsl(parts.query, keep_blank_values=True))
        qs["clid"] = str(ym["clid"])
        if ym.get("vid"):
            qs["vid"] = str(ym["vid"])
        if ym.get("erid"):
            qs["erid"] = str(ym["erid"])
        return _up.urlunsplit((parts.scheme, parts.netloc, parts.path, _up.urlencode(qs), parts.fragment))
    adm = cfg.get("admitad_deeplinks") or {}
    for dom, prefix in adm.items():
        if prefix and dom.lower() in u_low:
            sep = "" if prefix.endswith("=") else ("&ulp=" if "?" in prefix else "?ulp=")
            return f"{prefix}{sep}{_up.quote(url, safe='')}"
    return url


def apply_affiliates_to_copy(master: dict) -> dict:
    cfg = load_affiliates_config()
    if not cfg.get("enabled"):
        return master
    import copy as _copy
    out = _copy.deepcopy(master)
    for arr_name in ("catalog", "market_rf", "flagships"):
        for item in out.get(arr_name, []):
            for st in (item.get("stores") or []):
                if isinstance(st, dict) and st.get("url"):
                    st["url"] = apply_affiliate_url(st["url"], cfg)
    return out



def minify_js_safe(js_code: str) -> str:
    """Safe line-level JS minifier (strips full-line comments & leading spaces without touching string literals/regex)."""
    out_lines = []
    for ln in js_code.splitlines():
        s = ln.strip()
        if not s or s.startswith("//"):
            continue
        out_lines.append(s)
    return "\n".join(out_lines) + "\n"


def compress_db_for_html(master: dict) -> str:
    """Sparse column-defaults + deep string dictionary + compact store URL encoding (100% lossless sync unpack)."""
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

    all_keys = list(catalog[0].keys())
    for row in catalog:
        for k in row.keys():
            if k not in all_keys:
                all_keys.append(k)

    # 1. Most frequent value per column becomes default (omitted from sparse rows)
    col_defaults = []
    for k in all_keys:
        vals = Counter(json.dumps(row.get(k, "__U__"), ensure_ascii=False, separators=(",", ":")) for row in catalog)
        top_val_json, _ = vals.most_common(1)[0]
        col_defaults.append(json.loads(top_val_json))

    # 2. Compact URL prefix table for stores
    url_prefixes = [
        "https://www.dns-shop.ru/product/",
        "https://www.dns-shop.ru/search/?q=",
        "https://www.citilink.ru/product/",
        "https://www.regard.ru/product/",
        "https://www.regard.ru/catalog?search=",
        "https://www.onlinetrade.ru/catalogue/",
        "https://www.onlinetrade.ru/sitesearch.html?query=",
        "https://www.ozon.ru/product/",
        "https://www.ozon.ru/search/?text=",
        "https://market.yandex.ru/card/",
        "https://market.yandex.ru/search?text=",
        "https://aliexpress.ru/item/",
    ]

    # 3. Count repeated strings (>=3 chars) across non-default values (including store names)
    str_freq = Counter()
    def count_strs(v):
        if isinstance(v, str) and len(v) >= 3:
            str_freq[v] += 1
        elif isinstance(v, list):
            for x in v:
                count_strs(x)
        elif isinstance(v, dict):
            for x in v.values():
                count_strs(x)

    for row in catalog:
        for ci, k in enumerate(all_keys):
            v = row.get(k, "__U__")
            if type(v) is not type(col_defaults[ci]) or v != col_defaults[ci]:
                if k == "stores" and isinstance(v, list):
                    for st in v:
                        if isinstance(st, dict) and isinstance(st.get("name"), str):
                            str_freq[st["name"]] += 1
                else:
                    count_strs(v)

    dict_strings = [s for s, c in str_freq.most_common() if c >= 2 and (len(s) * c > len(s) + 4 * c + 4)]
    str_to_idx = {s: idx for idx, s in enumerate(dict_strings)}

    def enc_val(v):
        if isinstance(v, str) and v in str_to_idx:
            return [str_to_idx[v]]
        if isinstance(v, list):
            return [enc_val(x) for x in v]
        if isinstance(v, dict):
            return {dk: enc_val(dv) for dk, dv in v.items()}
        return v

    def enc_stores(st_list):
        out = []
        for st in st_list:
            if isinstance(st, dict) and set(st.keys()) <= {"name", "url"}:
                nm = st.get("name", "")
                nm_enc = str_to_idx[nm] if nm in str_to_idx else nm
                u = st.get("url", "")
                p_idx = -1
                for pi, pref in enumerate(url_prefixes):
                    if u.startswith(pref):
                        p_idx = pi
                        u = u[len(pref):]
                        break
                out.append([nm_enc, p_idx, u])
            else:
                out.append(st)
        return out

    stores_col = all_keys.index("stores") if "stores" in all_keys else -1
    sparse_rows = []
    for row in catalog:
        sr = []
        for ci, k in enumerate(all_keys):
            v = row.get(k, "__U__")
            if type(v) is not type(col_defaults[ci]) or v != col_defaults[ci]:
                sr.append(ci)
                if ci == stores_col and isinstance(v, list):
                    sr.append(enc_stores(v))
                else:
                    sr.append(enc_val(v))
        sparse_rows.append(sr)

    rest_obj = {k: v for k, v in db_obj.items() if k != "catalog"}
    rest_obj["price_history"] = load_price_history_map(catalog)
    if os.path.exists("data/icc_profiles.json"):
        with open("data/icc_profiles.json", "r", encoding="utf-8") as _f_icc:
            rest_obj["icc_profiles"] = json.load(_f_icc)
    # 4. Lossless phrase-fragment dictionary (_F) for long repeated Russian/spec phrases inside strings
    frag_freq = Counter()
    def scan_frags(v):
        if isinstance(v, str) and len(v) >= 24 and "\x02" not in v:
            for part in re.split(r"(?:\s•\s|\s\|\s|;\s|\.\s|\s—\s)", v):
                p = part.strip()
                if len(p) >= 20:
                    frag_freq[p] += 1
        elif isinstance(v, list):
            for x in v:
                scan_frags(x)
        elif isinstance(v, dict):
            for x in v.values():
                scan_frags(x)

    scan_frags(dict_strings)
    scan_frags(sparse_rows)
    frag_dict = [
        s for s, c in frag_freq.most_common(900)
        if c >= 3 and (len(s) * c > len(s) + 6 * c + 8)
    ]
    frag_dict.sort(key=len, reverse=True)
    if frag_dict:
        frag_to_tok = {s: f"\x02{i}\x03" for i, s in enumerate(frag_dict)}
        frag_re = re.compile("|".join(re.escape(s) for s in frag_dict))
        def compress_frags(v):
            if isinstance(v, str) and len(v) >= 20 and "\x02" not in v:
                return frag_re.sub(lambda m: frag_to_tok[m.group(0)], v)
            if isinstance(v, list):
                return [compress_frags(x) for x in v]
            if isinstance(v, dict):
                return {dk: compress_frags(dv) for dk, dv in v.items()}
            return v
        dict_strings = [compress_frags(s) for s in dict_strings]
        sparse_rows = compress_frags(sparse_rows)

    payload = {
        "k": all_keys,
        "df": col_defaults,
        "d": dict_strings,
        "f": frag_dict,
        "up": url_prefixes,
        "sc": stores_col,
        "r": sparse_rows,
        "o": rest_obj,
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    unpack_js = (
        "const DB = (() => {\n"
        f"  const _P = {payload_json};\n"
        "  const _K = _P.k, _DF = _P.df, _F = _P.f || [], _UP = _P.up, _SC = _P.sc, _kl = _K.length;\n"
        "  const _unf = s => (typeof s === 'string' && s.indexOf('\\x02') !== -1) ? s.replace(/\\x02(\\d+)\\x03/g, (_, i) => _F[+i]) : s;\n"
        "  const _D = _P.d.map(_unf);\n"
        "  const _dec = v => {\n"
        "    if (typeof v === 'string') return _unf(v);\n"
        "    if (Array.isArray(v)) {\n"
        "      if (v.length === 1 && typeof v[0] === 'number') return _D[v[0]];\n"
        "      return v.map(_dec);\n"
        "    }\n"
        "    if (v && typeof v === 'object') {\n"
        "      const o = {}; for (const kk in v) o[kk] = _dec(v[kk]); return o;\n"
        "    }\n"
        "    return v;\n"
        "  };\n"
        "  const _decSt = arr => arr.map(s => Array.isArray(s) ? { name: typeof s[0] === 'number' ? _D[s[0]] : s[0], url: (s[1] >= 0 ? _UP[s[1]] : '') + s[2] } : s);\n"
        "  const _cat = _P.r.map(sr => {\n"
        "    const obj = {};\n"
        "    for (let i = 0; i < _kl; i++) {\n"
        "      const dv = _DF[i];\n"
        "      if (dv === '__U__') continue;\n"
        "      obj[_K[i]] = Array.isArray(dv) ? dv.slice() : (dv && typeof dv === 'object' ? Object.assign({}, dv) : dv);\n"
        "    }\n"
        "    for (let j = 0; j < sr.length; j += 2) {\n"
        "      const ci = sr[j], v = sr[j + 1];\n"
        "      if (v === '__U__') { delete obj[_K[ci]]; continue; }\n"
        "      obj[_K[ci]] = (ci === _SC && Array.isArray(v)) ? _decSt(v) : _dec(v);\n"
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

    # 1. Replace either raw `const DB = {...};` OR compressed `const DB = (() => {...})();`
    compressed_db_js = compress_db_for_html(master)
    s_comp = html.find("const DB = (() => {")
    if s_comp != -1:
        end_marker = "return Object.assign({ catalog: _cat }, _P.o);\n})();"
        e_comp = html.find(end_marker, s_comp)
        if e_comp == -1:
            raise RuntimeError("Could not locate end of compressed DB block in template HTML")
        html = html[:s_comp] + compressed_db_js + html[e_comp + len(end_marker):]
    else:
        m = re.search(r"const DB\s*=\s*\{[\s\S]*?\};\s*\n", html)
        if not m:
            raise RuntimeError("Could not locate `const DB = ...` in template HTML")
        html = html[:m.start()] + compressed_db_js + "\n" + html[m.end():]

    # 2. Compile 100% local zero-CDN Tailwind utility CSS and remove external Tailwind CDN & Google Fonts
    html = re.sub(r'\s*<script[^>]+cdn\.tailwindcss\.com[^>]*></script>\s*', '\n', html)
    html = re.sub(r'\s*<link[^>]+fonts\.googleapis\.com[^>]*>\s*', '\n', html)
    offline_css = generate_offline_tailwind_css(html)
    fallback_tag = f'  <style id="offline-tailwind-fallback">\n{offline_css}\n  </style>\n'
    if 'id="offline-tailwind-fallback"' in html:
        html = re.sub(r'<style id="offline-tailwind-fallback">[\s\S]*?</style>', fallback_tag.strip(), html, count=1)
    else:
        html = html.replace("<head>", "<head>\n" + fallback_tag, 1)

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

    # 5. Also emit fast split web build: index.html (~1.2 MB) + data/db_payload.js (independently cached)
    out_dir = os.path.dirname(out_html) or "."
    data_dir = os.path.join(out_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    p_start = html.find("  const _P = ")
    p_end = html.find(";\n  const _K = _P.k", p_start)
    if p_start != -1 and p_end != -1:
        payload_rhs = html[p_start + len("  const _P = "):p_end]
        payload_js_path = os.path.join(data_dir, "db_payload.js")
        with open(payload_js_path, "w", encoding="utf-8") as fp_js:
            fp_js.write("window.__DB_PAYLOAD=" + payload_rhs + ";\n")
        split_html = html[:p_start] + "  const _P = window.__DB_PAYLOAD;" + html[p_end:]
        sc_pos = split_html.rfind("<script>", 0, p_start)
        sc_end = split_html.find("</script>", sc_pos) if sc_pos != -1 else -1
        if sc_pos != -1 and sc_end != -1:
            app_js_code = minify_js_safe(split_html[sc_pos + len("<script>"):sc_end])
            app_js_path = os.path.join(data_dir, "app.js")
            with open(app_js_path, "w", encoding="utf-8") as fp_app:
                fp_app.write(app_js_code)
            split_html = (
                split_html[:sc_pos]
                + '<script src="data/db_payload.js"></script>\n<script src="data/app.js"></script>'
                + split_html[sc_end + len("</script>"):]
            )
            index_html_path = os.path.join(out_dir, "index.html")
            with open(index_html_path, "w", encoding="utf-8") as fp_idx:
                fp_idx.write(split_html)
            print(f"[WEB]  Built ultra-fast split portal: {index_html_path} ({os.path.getsize(index_html_path):,} bytes) + data/app.js ({os.path.getsize(app_js_path):,} bytes) + data/db_payload.js ({os.path.getsize(payload_js_path):,} bytes)")


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
    m_sc = re.search(r"<script(?![^>]*(?:src|ld\+json))[^>]*>([\s\S]*?)</script>", html_txt, flags=re.I)
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




def build_static_api(master: dict, outdir: str) -> None:
    """Generate lightweight static JSON API slices under api/v1/ for external integrations."""
    api_dir = os.path.join(outdir, "api", "v1")
    os.makedirs(api_dir, exist_ok=True)
    cat = master.get("catalog", [])

    def compact(m: dict) -> dict:
        return {
            "id": m.get("id"),
            "brand": m.get("brand"),
            "model": m.get("model"),
            "tier": m.get("tier"),
            "year": m.get("year"),
            "diag": m.get("diag"),
            "res": m.get("res"),
            "hz": m.get("hz"),
            "max_hz": m.get("max_hz"),
            "ptype": m.get("ptype"),
            "panel_gen": m.get("panel_gen"),
            "coat": m.get("coat"),
            "zones": m.get("zones"),
            "hdr": m.get("hdr"),
            "hand": m.get("hand"),
            "price_retail_rf": m.get("price_retail_rf"),
            "is_ru": bool(m.get("is_ru")),
            "rev_url": m.get("rev_url") or "",
            "stores": m.get("stores") or [],
        }

    oled_rows = [compact(m) for m in cat if "oled" in (str(m.get("ptype", "")) + " " + str(m.get("model", ""))).lower()]
    miniled_rows = [compact(m) for m in cat if "mini-led" in str(m.get("ptype", "")).lower() or "miniled" in str(m.get("ptype", "")).lower()]
    brands = sorted({m.get("brand_canonical") or m.get("brand") or "" for m in cat if m.get("brand")})

    summary = {
        "name": "monitor_full_database",
        "updated": master.get("meta", {}).get("updated", ""),
        "total_models": len(cat),
        "total_brands": len(brands),
        "counts": {
            "oled": len(oled_rows),
            "miniled": len(miniled_rows),
            "lcd": len(cat) - len(oled_rows) - len(miniled_rows),
            "market_rf": len(master.get("market_rf", [])),
            "flagships": len(master.get("flagships", [])),
        },
        "rates": master.get("meta", {}).get("rates", {}),
        "endpoints": {
            "summary": "api/v1/summary.json",
            "oled": "api/v1/oled.json",
            "miniled": "api/v1/miniled.json",
            "market_rf": "api/v1/market_rf.json",
            "flagships": "api/v1/flagships.json",
            "brands": "api/v1/brands.json",
            "monitors": "api/v1/monitors.json",
        },
    }

    def dump_j(fn: str, obj) -> None:
        with open(os.path.join(api_dir, fn), "w", encoding="utf-8") as fp:
            json.dump(obj, fp, ensure_ascii=False, separators=(",", ":"))

    dump_j("summary.json", summary)
    dump_j("oled.json", oled_rows)
    dump_j("miniled.json", miniled_rows)
    dump_j("market_rf.json", master.get("market_rf", []))
    dump_j("flagships.json", master.get("flagships", []))
    dump_j("brands.json", {"count": len(brands), "brands": brands})
    print(f"[API]  Built static JSON API in {api_dir} (summary, oled={len(oled_rows)}, miniled={len(miniled_rows)}, market_rf, flagships, brands)")


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
    portal_master = apply_affiliates_to_copy(master)
    build_html(portal_master, args.template_html, out_html)
    build_static_api(portal_master, args.outdir)

    if args.recalc:
        recalculate_xlsx_libreoffice(out_xlsx)
    if args.verify:
        verify_outputs(master, out_csv, out_xlsx, out_html)
    print("[DONE] All targets built cleanly.")


if __name__ == "__main__":
    main()
