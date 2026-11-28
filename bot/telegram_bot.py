#!/usr/bin/env python3
"""Telegram-бот подбора мониторов с интерактивным кнопочным меню, сравнением,
Inline-режимом (@monitor_fdb_bot) и уведомлениями о снижении цен РФ (SQLite).
"""

import asyncio
import datetime
import glob
import hashlib
import json
import os
import re
import sqlite3
import urllib.parse
from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InlineQueryResultArticle,
    InputTextMessageContent,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    InlineQueryHandler,
)

MASTER_PATH = os.environ.get("MONITOR_DB_MASTER", "database_master.json")
SNAPSHOT_PATH = os.environ.get("MONITOR_DB_SNAPSHOT", "data/prices_rf_snapshot.json")
ALERTS_DB_PATH = os.environ.get("MONITOR_DB_ALERTS_DB", "alerts.db")
ALERT_CHECK_INTERVAL_SEC = int(os.environ.get("ALERT_CHECK_INTERVAL_SEC", "3600"))
PORTAL_URL = os.environ.get("MONITOR_PORTAL_URL", "https://tapocket.github.io/monitor_full_database/")
REPO_URL = os.environ.get("MONITOR_REPO_URL", "https://github.com/tapocket/monitor_full_database")


def load_catalog() -> list[dict]:
    with open(MASTER_PATH, "r", encoding="utf-8") as fp:
        return json.load(fp).get("catalog", [])


def init_alerts_db(db_path: str = ALERTS_DB_PATH) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS price_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                model_query TEXT NOT NULL,
                target_rub INTEGER NOT NULL,
                triggered INTEGER DEFAULT 0
            )"""
        )


def add_alert(chat_id: int, model_query: str, target_rub: int, db_path: str = ALERTS_DB_PATH) -> int:
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO price_alerts (chat_id, model_query, target_rub) VALUES (?, ?, ?)",
            (chat_id, model_query, target_rub),
        )
        return int(cur.lastrowid)


def list_alerts(chat_id: int, db_path: str = ALERTS_DB_PATH) -> list[tuple]:
    with sqlite3.connect(db_path) as conn:
        return conn.execute(
            "SELECT id, model_query, target_rub, triggered FROM price_alerts WHERE chat_id = ? ORDER BY id DESC",
            (chat_id,),
        ).fetchall()


def delete_alert(chat_id: int, alert_id: int, db_path: str = ALERTS_DB_PATH) -> bool:
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute("DELETE FROM price_alerts WHERE chat_id = ? AND id = ?", (chat_id, alert_id))
        return cur.rowcount > 0


def find_triggered_alerts(snapshot_path: str = SNAPSHOT_PATH, db_path: str = ALERTS_DB_PATH) -> list[dict]:
    if not os.path.exists(snapshot_path):
        return []
    with open(snapshot_path, "r", encoding="utf-8") as fp:
        items = json.load(fp).get("items", [])

    triggered_msgs = []
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, chat_id, model_query, target_rub FROM price_alerts WHERE triggered = 0"
        ).fetchall()
        for aid, chat_id, q, target in rows:
            ql = q.lower()
            for it in items:
                if ql in str(it.get("model_match", "")).lower():
                    best = min(
                        [p for p in (it.get("mp_rf_rub", 0), it.get("retail_rf_rub", 0)) if p and p > 0],
                        default=0,
                    )
                    if best > 0 and best <= target:
                        conn.execute("UPDATE price_alerts SET triggered = 1 WHERE id = ?", (aid,))
                        triggered_msgs.append({
                            "chat_id": chat_id,
                            "model": it.get("model_match", q),
                            "price": best,
                            "target": target,
                            "store": it.get("store", "Рынок РФ"),
                            "url": it.get("url", ""),
                        })
                        break
    return triggered_msgs


def load_service_menus() -> list[dict]:
    if not os.path.exists(MASTER_PATH):
        return []
    try:
        with open(MASTER_PATH, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        return (data.get("ref_sheets") or {}).get("service_menus") or []
    except Exception:
        return []


CATALOG = load_catalog()
SERVICE_MENUS = load_service_menus() if os.path.exists(MASTER_PATH) else []
BY_ID = {int(m["id"]): m for m in CATALOG if "id" in m}
TIER_RANK = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6}




def load_price_drops(limit: int = 8) -> list[dict]:
    """Return top RF price drops / marketplace discounts from data/price_history/*.jsonl."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ph_dir = os.path.join(base_dir, "data", "price_history")
    files = sorted(glob.glob(os.path.join(ph_dir, "*.jsonl")))
    by_model: dict[str, list[dict]] = {}
    for fp in files:
        try:
            with open(fp, "r", encoding="utf-8") as fh:
                for ln in fh:
                    ln = ln.strip()
                    if not ln:
                        continue
                    rec = json.loads(ln)
                    key = str(rec.get("model_match") or "").strip()
                    if key:
                        by_model.setdefault(key, []).append(rec)
        except Exception:
            continue

    cat_by_name = {str(m.get("model") or "").strip().lower(): m for m in CATALOG}
    drops = []
    for name, recs in by_model.items():
        latest = recs[-1]
        ret = int(latest.get("retail_rf_rub") or 0)
        mp = int(latest.get("mp_rf_rub") or 0)
        # Prefer historical drop across snapshots if present, otherwise retail vs marketplace spread
        first_mp = int(recs[0].get("mp_rf_rub") or recs[0].get("retail_rf_rub") or 0)
        if len(recs) > 1 and first_mp > mp > 0:
            diff = first_mp - mp
            pct = round(diff / first_mp * 100, 1)
            kind = "history"
            base_price = first_mp
            cur_price = mp
        elif ret > mp > 0:
            diff = ret - mp
            pct = round(diff / ret * 100, 1)
            kind = "spread"
            base_price = ret
            cur_price = mp
        else:
            continue
        if diff < 1500 or pct < 5.0 or pct > 52.0:
            continue
        m_obj = cat_by_name.get(name.lower())
        if not m_obj:
            ql = name.lower()
            m_obj = next((c for c in CATALOG if ql in str(c.get("model") or "").lower()), None)
        if not m_obj:
            continue
        # Only include models with a verified direct product link in RF stores
        has_direct = any(
            isinstance(st, dict)
            and str(st.get("url", "")).startswith("http")
            and "/search" not in str(st.get("url", "")).lower()
            and any(dom in str(st.get("url", "")).lower() for dom in (
                "dns-shop.ru/product/", "citilink.ru/product/", "regard.ru/product/",
                "onlinetrade.ru/catalogue/", "ozon.ru/product/", "ozon.ru/t/",
                "market.yandex.ru/card/", "market.yandex.ru/product", "wildberries.ru/catalog/"
            ))
            for st in (m_obj.get("stores") or [])
        )
        if not has_direct:
            continue
        res_l = str(m_obj.get("res") or "").lower()
        if cur_price < 10000 and any(k in res_l for k in ("2560", "3840", "3440", "5120", "4k", "qhd", "2k")):
            continue
        drops.append({
            "model": m_obj["model"],
            "brand": str(m_obj.get("brand") or "").strip().lower(),
            "id": m_obj["id"],
            "base": base_price,
            "cur": cur_price,
            "diff": diff,
            "pct": pct,
            "kind": kind,
            "store": latest.get("store") or "РФ",
            "date": latest.get("date") or "",
        })
    drops.sort(key=lambda x: (1 if x["kind"] == "history" else 0, x["pct"], x["diff"]), reverse=True)
    diversified, seen_brands = [], set()
    for d in drops:
        if d["brand"] in seen_brands:
            continue
        seen_brands.add(d["brand"])
        diversified.append(d)
        if len(diversified) >= limit:
            break
    return diversified




def _load_affiliates() -> dict:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    p = os.path.join(base_dir, "config", "affiliates.json")
    if not os.path.exists(p):
        return {"enabled": False}
    try:
        with open(p, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return {"enabled": False}


AFFILIATES_CFG = _load_affiliates()


def wrap_affiliate_url(url: str) -> str:
    if not url or not AFFILIATES_CFG.get("enabled"):
        return url
    u_low = url.lower()
    ym = AFFILIATES_CFG.get("yandex_market") or {}
    if "market.yandex.ru" in u_low and ym.get("clid"):
        parts = urllib.parse.urlsplit(url)
        qs = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
        qs["clid"] = str(ym["clid"])
        if ym.get("vid"):
            qs["vid"] = str(ym["vid"])
        if ym.get("erid"):
            qs["erid"] = str(ym["erid"])
        return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(qs), parts.fragment))
    adm = AFFILIATES_CFG.get("admitad_deeplinks") or {}
    for dom, prefix in adm.items():
        if prefix and dom.lower() in u_low:
            sep = "" if prefix.endswith("=") else ("&ulp=" if "?" in prefix else "?ulp=")
            return f"{prefix}{sep}{urllib.parse.quote(url, safe='')}"
    return url


def is_pro_user(chat_id: int) -> bool:
    raw = os.environ.get("PRO_USER_IDS", "")
    ids = {x.strip() for x in raw.split(",") if x.strip()}
    return str(chat_id) in ids


def get_free_alerts_limit() -> int:
    try:
        return max(1, int(os.environ.get("FREE_ALERTS_LIMIT", "3")))
    except Exception:
        return 3


async def cmd_pro(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    lim = get_free_alerts_limit()
    pro_url = os.environ.get("PRO_CONTACT_URL", "").strip() or PORTAL_URL
    is_pro = is_pro_user(update.effective_chat.id)
    status_line = "✅ *Ваш статус: Pro активен (безлимит алертов)*" if is_pro else f"🔹 *Ваш статус: Базовый (до {lim} активных алертов)*"
    text = (
        "💎 *monitor_full_database Pro и персональный подбор*\n\n"
        f"{status_line}\n\n"
        "Что даёт Pro-подписка / личный подбор:\n"
        "• 🔔 Безлимит на подписки о снижении цены (`/alert`)\n"
        "• ⚡ Приоритетные уведомления о появлении дефицитных OLED и Mini-LED в РФ\n"
        "• 🎯 Личный подбор 3 лучших моделей под ваш ПК, стол и бюджет с проверкой ревизии матрицы\n\n"
        "💡 Вся база из 2 710 моделей, поиск, сравнение и тест ПВЗ навсегда остаются бесплатными."
    )
    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("💬 Подключить Pro / Заказать подбор", url=pro_url)],
        [InlineKeyboardButton("🌐 Открыть веб-портал", url=PORTAL_URL)],
    ])
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)

def fmt_rub(val) -> str:
    return f"{int(round(float(val or 0))):,}".replace(",", " ")


def search_models(query_tokens: list[str], limit: int = 5) -> list[dict]:
    budget = None
    diag_filter = None
    tokens = []
    for a in query_tokens:
        if re.fullmatch(r"\d{4,6}", a):
            budget = int(a)
        elif re.fullmatch(r"\d{2}(?:\.\d)?", a):
            diag_filter = float(a)
        elif a.strip():
            tokens.append(a.lower())

    matches = []
    for m in CATALOG:
        price = m.get("price_mp_rf") or m.get("hand") or m.get("rub") or 0
        if budget is not None and (price <= 0 or price > budget):
            continue
        if diag_filter is not None and abs(float(m.get("diag", 0)) - diag_filter) > 1.5:
            continue
        blob = f"{m.get('brand','')} {m.get('brand_canonical','')} {m.get('model','')} {m.get('ptype','')} {m.get('res','')}".lower()
        if all(t in blob for t in tokens):
            matches.append(m)

    matches.sort(
        key=lambda x: (
            TIER_RANK.get(str(x.get("tier", "E"))[:1], 5),
            -(x.get("max_hz") or 0),
            x.get("price_mp_rf") or x.get("hand") or 999999,
        )
    )
    deduped = []
    seen_models = set()
    for m in matches:
        mk = re.sub(r"\s+", " ", str(m.get("model", "")).strip().lower())
        if mk in seen_models:
            continue
        seen_models.add(mk)
        deduped.append(m)
        if len(deduped) >= limit:
            break
    return deduped


def compute_vesa_cts12_label(m: dict) -> str:
    """Estimate VESA DisplayHDR CTS 1.2 tier from panel type, HDR peak brightness, and local dimming zones."""
    ptype = str(m.get("ptype") or "").upper()
    hdr = 0
    try:
        import re as _re
        nums = [int(x) for x in _re.findall(r"\d{3,4}", str(m.get("hdr") or ""))]
        hdr = max(nums) if nums else 0
    except Exception:
        hdr = 0
    zones = 0
    try:
        import re as _re
        znums = [int(x) for x in _re.findall(r"\d+", str(m.get("zones") or ""))]
        zones = max(znums) if znums else 0
    except Exception:
        zones = 0

    if "OLED" in ptype:
        if hdr >= 1400: return "VESA DisplayHDR True Black 1400 (CTS 1.2, 2026)"
        if hdr >= 1000: return "VESA DisplayHDR True Black 1000 (CTS 1.2)"
        if hdr >= 600:  return "VESA DisplayHDR True Black 600 (CTS 1.2)"
        if hdr >= 500:  return "VESA DisplayHDR True Black 500 (CTS 1.2)"
        return "VESA DisplayHDR True Black 400 (CTS 1.2)"
    if zones >= 384 and hdr >= 1400: return "VESA DisplayHDR 1400 (CTS 1.2, 2D FALD)"
    if zones >= 384 and hdr >= 1000: return "VESA DisplayHDR 1000 (CTS 1.2, 2D FALD)"
    if hdr >= 600: return "VESA DisplayHDR 600 (CTS 1.2)"
    if hdr >= 500: return "VESA DisplayHDR 500 (CTS 1.2)"
    if hdr >= 400: return "VESA DisplayHDR 400 (CTS 1.2, 8b+2b FRC)"
    return "SDR / Базовый HDR (<400 нит)"


def format_model_card(m: dict) -> str:
    mp = int(m.get("price_mp_rf") or m.get("hand") or m.get("rub") or 0)
    retail = int(m.get("price_retail_rf") or 0)
    diff_line = ""
    if retail > 0 and mp > 0 and retail != mp:
        diff = retail - mp
        pct = round(diff / mp * 100)
        sign = "+" if diff > 0 else ""
        diff_line = f"\n• ⚖️ Разница розницы РФ vs МП: *{sign}{fmt_rub(diff)} ₽ ({sign}{pct}%)*"
    retail_line = f" | Розница РФ: *{fmt_rub(retail)} ₽*" if retail > 0 else ""
    vesa_label = compute_vesa_cts12_label(m)
    stores = [s for s in (m.get("stores") or []) if isinstance(s, dict) and s.get("url")]
    rf_count = sum(1 for s in stores if any(k in str(s.get("name", "")).lower() for k in ("dns", "ситилинк", "регард", "онлайнтрейд")))
    pvz_note = f"Розница РФ ({rf_count} маг., локальная гарантия)" if rf_count > 0 else "Маркетплейс / зарубеж (проверьте матрицу в ПВЗ)"
    return (
        f"🖥 *{m['model']}*\n"
        f"• Бренд: {m.get('brand_canonical', m.get('brand'))} | Год: {m.get('year')} | Тир: `{str(m.get('tier',''))[:1]}`\n"
        f"• Экран: {m.get('diag')}″ {m.get('res')} • {m.get('max_hz')} Гц\n"
        f"• Матрица: `{str(m.get('pmodel',''))[:90]}`\n"
        f"• Отклик GtG 80%: {m.get('gtg80')} мс | Контраст: {m.get('cr')}:1 | HDR: {m.get('hdr')} нит\n"
        f"• 🏅 VESA CTS 1.2: `{vesa_label}`\n"
        f"• Цена «на руки» (МП/Ozon): *{fmt_rub(mp)} ₽*{retail_line}{diff_line}\n"
        f"• 🛡️ ПВЗ и гарантия: {pvz_note}\n"
        f"• Обзор: {m.get('rev_url') or 'Нет прямой ссылки'}"
    )


def model_card_keyboard(m: dict) -> InlineKeyboardMarkup:
    mid = int(m["id"])
    mp = int(m.get("price_mp_rf") or m.get("hand") or m.get("rub") or 0)
    target_10 = max(5000, int(round(mp * 0.9 / 500) * 500)) if mp > 0 else 30000
    enc_model = urllib.parse.quote(str(m.get("model", "")))
    issue_url = f"{REPO_URL}/issues/new?template=price-update-rf.yml&title=%5B%D0%A6%D0%B5%D0%BD%D0%B0+%D0%A0%D0%A4%5D+{enc_model}"
    model_deep_url = f"{PORTAL_URL.rstrip('/')}/#model={mid}"
    pvz_test_url = f"{PORTAL_URL.rstrip('/')}/#test=guided"

    rows = [
        [
            InlineKeyboardButton("🌐 Карточка на портале", url=model_deep_url),
            InlineKeyboardButton(f"🔔 Алерт ≤ {fmt_rub(target_10)} ₽", callback_data=f"al:{mid}:{target_10}"),
        ],
    ]

    # Add up to 4 direct store buttons (preferring direct /product/, /card/, /item/ links)
    stores = [s for s in (m.get("stores") or []) if isinstance(s, dict) and s.get("url")]
    stores.sort(key=lambda s: (0 if any(p in s["url"] for p in ("/product/", "/card/", "/item/", "/catalogue/")) else 1))
    store_btns = [InlineKeyboardButton(str(s.get("name", "Магазин"))[:22], url=s["url"]) for s in stores[:4]]
    for i in range(0, len(store_btns), 2):
        rows.append(store_btns[i:i+2])

    rows.append([
        InlineKeyboardButton("🧪 14-шаговый тест ПВЗ", url=pvz_test_url),
        InlineKeyboardButton("📋 Чек-лист ПВЗ", callback_data="menu:pvz"),
    ])
    rows.append([
        InlineKeyboardButton("💰 Сообщить цену РФ", url=issue_url),
        InlineKeyboardButton("🎯 Новый подбор", callback_data="menu:pick"),
    ])
    return InlineKeyboardMarkup(rows)


def main_menu_keyboard() -> InlineKeyboardMarkup:
    n_fmt = f"{len(CATALOG):,}".replace(",", " ")
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎯 Подобрать монитор по шагам", callback_data="menu:pick")],
        [
            InlineKeyboardButton("🔥 Топ OLED до 70к", callback_data="quick:70000:all:oled"),
            InlineKeyboardButton("⚡ Топ Mini-LED до 45к", callback_data="quick:45000:all:mini-led"),
        ],
        [
            InlineKeyboardButton("📉 Скидки РФ (/drops)", callback_data="menu:drops"),
            InlineKeyboardButton("📋 Чек-лист ПВЗ", callback_data="menu:pvz"),
        ],
        [
            InlineKeyboardButton("🔔 Мои подписки", callback_data="menu:alerts"),
            InlineKeyboardButton(f"🌐 Веб-портал ({n_fmt})", url=PORTAL_URL),
        ],
    ])


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        f"👋 *monitor_full_database* — инженерная база ({len(CATALOG)} моделей).\n\n"
        "Выберите действие кнопками ниже или используйте команды:\n"
        "• `/find 50000 27 OLED` — быстрый поиск\n"
        "• `/oled [бюджет]` и `/miniled [бюджет]` — быстрые подборки\n"
        "• `/drops` — мониторинг скидок и выгодных цен в РФ\n"
        "• `/digest` — еженедельный дайджест новинок и скидок\n"
        "• `/model TCL 27R83U` — полная карточка модели\n"
        "• `/compare PG32UCDM vs 321URX` — сравнение двух моделей\n"
        "• `/pvz ASUS` — чек-лист приёмки и сервисное меню\n"
        "• `/alert TCL 27R83U 45000` — подписка на снижение цены\n\n"
        "💡 В любом чате работает Inline-поиск: `@monitor_fdb_bot PG32UCDM`"
    )
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu_keyboard())


async def cmd_find(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    results = search_models(context.args or [], limit=5)
    if not results:
        await update.message.reply_text("Ничего не найдено по этим фильтрам. Попробуйте изменить бюджет или запрос.", reply_markup=main_menu_keyboard())
        return
    await send_search_results(update.message.reply_text, results, "🎯 *Подборка по вашему запросу:*")




async def cmd_oled(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tokens = ["oled"] + list(context.args or [])
    results = search_models(tokens, limit=5)
    if not results:
        await update.message.reply_text("OLED-модели по этим параметрам не найдены. Пример: `/oled 70000` или `/oled 32`.", parse_mode="Markdown", reply_markup=main_menu_keyboard())
        return
    await send_search_results(update.message.reply_text, results, "🔥 *Топ OLED-мониторов:*")


async def cmd_miniled(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tokens = ["mini-led"] + list(context.args or [])
    results = search_models(tokens, limit=5)
    if not results:
        await update.message.reply_text("Mini-LED модели по этим параметрам не найдены. Пример: `/miniled 45000` или `/miniled 27`.", parse_mode="Markdown", reply_markup=main_menu_keyboard())
        return
    await send_search_results(update.message.reply_text, results, "⚡ *Топ Mini-LED мониторов (FALD):*")


def format_drops_message(drops: list[dict]) -> tuple[str, InlineKeyboardMarkup]:
    if not drops:
        return "📉 Данных по снижениям цен пока нет.", main_menu_keyboard()
    lines = ["📉 *Выгодные цены и снижения в РФ (по базе истории цен):*"]
    kb = []
    for i, d in enumerate(drops, 1):
        tag = "снижение" if d["kind"] == "history" else "дешевле розницы"
        lines.append(
            f"{i}. *{d['model']}*\n"
            f"   *{fmt_rub(d['cur'])} ₽* вместо `{fmt_rub(d['base'])} ₽` (−{fmt_rub(d['diff'])} ₽ / −{d['pct']}%, {tag} • {d['store']})"
        )
        if d.get("id"):
            kb.append([InlineKeyboardButton(f"🖥 {i}. {str(d['model'])[:38]}", callback_data=f"card:{d['id']}")])
    kb.append([InlineKeyboardButton("🌐 Открыть фильтр скидок на портале", url=PORTAL_URL)])
    return "\n".join(lines), InlineKeyboardMarkup(kb)




def build_weekly_digest_text() -> tuple[str, InlineKeyboardMarkup]:
    today = datetime.date.today().strftime("%d.%m.%Y")
    total = len(CATALOG)
    oled_cnt = sum(1 for m in CATALOG if "oled" in (str(m.get("ptype", "")) + " " + str(m.get("model", ""))).lower())
    mini_cnt = sum(1 for m in CATALOG if "mini-led" in str(m.get("ptype", "")).lower())
    dns_cnt = sum(1 for m in CATALOG for st in (m.get("stores") or []) if isinstance(st, dict) and "dns-shop.ru/product/" in str(st.get("url", "")))

    fresh = CATALOG[-5:][::-1]
    drops = load_price_drops(limit=5)

    lines = [
        f"📰 *Еженедельный дайджест monitor_full_database ({today})*",
        f"📊 В базе: *{total}* моделей ({oled_cnt} OLED • {mini_cnt} Mini-LED • {dns_cnt} прямых карточек DNS)",
        "",
        "🆕 *Свежие новинки в каталоге:*",
    ]
    for m in fresh:
        p_str = f"{fmt_rub(m.get('hand'))} ₽" if m.get("hand") else "ожидается"
        lines.append(f"• *{m['model']}* — {m.get('diag')}″ {m.get('res')} • {m.get('max_hz') or m.get('hz')} Гц ({p_str})")

    if drops:
        lines.append("")
        lines.append("📉 *Топ-5 выгодных цен и скидок РФ на этой неделе:*")
        for d in drops:
            lines.append(
                f"• *{d['model']}* — *{fmt_rub(d['cur'])} ₽* вместо `{fmt_rub(d['base'])} ₽` (−{d['pct']}% • {d['store']})"
            )

    lines.append("")
    lines.append(f"🌐 Полный интерактивный каталог и тест ПВЗ: {PORTAL_URL}")
    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🌐 Открыть портал", url=PORTAL_URL),
            InlineKeyboardButton("📱 Режим ПВЗ", url=f"{PORTAL_URL.rstrip('/')}/#test=pvz"),
        ],
        [
            InlineKeyboardButton("📉 Все скидки (/drops)", callback_data="menu:drops"),
            InlineKeyboardButton("🎯 Подобрать монитор", callback_data="menu:pick"),
        ],
    ])
    return "\n".join(lines), kb


async def cmd_digest(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text, kb = build_weekly_digest_text()
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)


async def weekly_digest_loop(app: Application) -> None:
    """If TELEGRAM_DIGEST_CHAT_ID is set in bot/.env, post weekly digest every Monday ~10:00 MSK."""
    target_chat = os.environ.get("TELEGRAM_DIGEST_CHAT_ID", "").strip()
    if not target_chat:
        return
    last_sent_week = None
    while True:
        try:
            now = datetime.datetime.utcnow() + datetime.timedelta(hours=3)  # MSK
            iso_week = now.isocalendar()[:2]
            if now.weekday() == 0 and now.hour == 10 and last_sent_week != iso_week:
                text, kb = build_weekly_digest_text()
                await app.bot.send_message(chat_id=target_chat, text=text, parse_mode="Markdown", reply_markup=kb)
                last_sent_week = iso_week
        except Exception:
            pass
        await asyncio.sleep(1800)


async def cmd_drops(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    drops = load_price_drops(limit=7)
    text, kb = format_drops_message(drops)
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)


async def send_search_results(reply_fn, results: list[dict], header: str) -> None:
    lines = [header]
    kb = []
    for i, m in enumerate(results, 1):
        mp = fmt_rub(m.get("price_mp_rf") or m.get("hand"))
        lines.append(
            f"{i}. *{m['model']}*\n"
            f"   {m.get('diag')}″ • {m.get('res')} • {m.get('max_hz')} Гц • Тир `{str(m.get('tier',''))[:1]}` | *{mp} ₽*"
        )
        kb.append([InlineKeyboardButton(f"🖥 {i}. {str(m['model'])[:38]}", callback_data=f"card:{m['id']}")])
    kb.append([InlineKeyboardButton("🎯 Новый подбор", callback_data="menu:pick")])
    await reply_fn("\n".join(lines), parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(kb))


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = context.args or []
    if not q:
        await update.message.reply_text("Укажите модель, например: `/model TCL 27R83U`", parse_mode="Markdown")
        return
    results = search_models(q, limit=1)
    if not results:
        await update.message.reply_text("Модель не найдена. Проверьте точный индекс.")
        return
    m = results[0]
    await update.message.reply_text(format_model_card(m), parse_mode="Markdown", reply_markup=model_card_keyboard(m))


async def cmd_compare(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    raw = " ".join(context.args or []).strip()
    if " vs " not in raw.lower():
        await update.message.reply_text("Формат: `/compare PG32UCDM vs 321URX`", parse_mode="Markdown")
        return
    p1, p2 = re.split(r"\s+vs\s+", raw, maxsplit=1, flags=re.I)
    r1, r2 = search_models(p1.split(), limit=1), search_models(p2.split(), limit=1)
    if not r1 or not r2:
        await update.message.reply_text("Не удалось найти одну из моделей для сравнения. Проверьте названия.")
        return
    a, b = r1[0], r2[0]
    text = (
        f"⚔️ *Сравнение в лоб:*\n"
        f"1️⃣ *{a['model']}*\n"
        f"2️⃣ *{b['model']}*\n\n"
        f"• Экран: `{a.get('diag')}″ {a.get('res')}` vs `{b.get('diag')}″ {b.get('res')}`\n"
        f"• Частота: *{a.get('max_hz')} Гц* vs *{b.get('max_hz')} Гц*\n"
        f"• GtG 80%: *{a.get('gtg80')} мс* vs *{b.get('gtg80')} мс*\n"
        f"• HDR пик: *{a.get('hdr')} нит* vs *{b.get('hdr')} нит*\n"
        f"• Контраст: `{a.get('cr')}:1` vs `{b.get('cr')}:1`\n"
        f"• Тир: `{str(a.get('tier',''))[:1]}` vs `{str(b.get('tier',''))[:1]}`\n"
        f"• Цена «на руки»: *{fmt_rub(a.get('price_mp_rf') or a.get('hand'))} ₽* vs *{fmt_rub(b.get('price_mp_rf') or b.get('hand'))} ₽*"
    )
    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(f"1️⃣ {str(a['model'])[:22]}", callback_data=f"m:{a['id']}"),
            InlineKeyboardButton(f"2️⃣ {str(b['model'])[:22]}", callback_data=f"m:{b['id']}"),
        ],
        [
            InlineKeyboardButton(
                "🔗 Открыть сравнение на портале",
                url=f"{PORTAL_URL.rstrip('/')}/#compare={a['id']},{b['id']}",
            )
        ],
    ])
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)


async def cmd_alert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []
    if len(args) < 2 or not re.fullmatch(r"\d{4,6}", args[-1]):
        await update.message.reply_text("Формат: `/alert <модель> <целевая_цена_₽>`, например: `/alert TCL 27R83U 45000`", parse_mode="Markdown")
        return
    target = int(args[-1])
    model_q = " ".join(args[:-1]).strip()
    if not is_pro_user(update.effective_chat.id):
        cur_alerts = list_alerts(update.effective_chat.id)
        lim = get_free_alerts_limit()
        if len(cur_alerts) >= lim:
            await update.message.reply_text(
                f"🔔 В базовом тарифе доступно до *{lim}* активных подписок (у вас уже {len(cur_alerts)}).\n"
                "Удалите старую через `/delalert <id>` или откройте безлимит в `/pro`.",
                parse_mode="Markdown",
            )
            return
    aid = add_alert(update.effective_chat.id, model_q, target)
    await update.message.reply_text(
        f"🔔 Подписка `#{aid}` создана: уведомлю, когда *{model_q}* станет дешевле *{fmt_rub(target)} ₽*.",
        parse_mode="Markdown",
    )


async def cmd_myalerts(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    rows = list_alerts(update.effective_chat.id)
    if not rows:
        await update.message.reply_text("Активных подписок на цены нет. Добавить: `/alert <модель> <цена>`", parse_mode="Markdown")
        return
    lines = ["🔔 *Ваши подписки на снижение цены:*"]
    for aid, mq, tgt, trig in rows:
        st = "✅ сработала" if trig else "⏳ отслеживается"
        lines.append(f"• `#{aid}` — *{mq}* ≤ *{fmt_rub(tgt)} ₽* ({st})")
    lines.append("\nУдалить подписку: `/delalert <id>`")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_delalert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []
    if not args or not args[0].isdigit():
        await update.message.reply_text("Укажите ID подписки, например: `/delalert 1`", parse_mode="Markdown")
        return
    ok = delete_alert(update.effective_chat.id, int(args[0]))
    await update.message.reply_text("🗑 Подписка удалена." if ok else "Подписка с таким ID не найдена.")


PVZ_TEXT = (
    "📋 *Чек-лист приёмки монитора в ПВЗ за 3 минуты:*\n"
    "1. Заливки R/G/B/Белый/Чёрный — проверка битых и горящих субпикселей.\n"
    "2. Тёмно-серый 5% Grey — проверка засветов (Backlight Bleed) и полосатости OLED.\n"
    "3. Однородный белый — проверка цветового тинта по краям и грязных пятен DSE.\n"
    "4. В параметрах дисплея Windows выставить максимальные Гц и проверить комплект кабелей.\n\n"
    "💡 Полноэкранный тест-мастер ПВЗ доступен офлайн прямо на веб-портале (Вкладка 11)."
)


async def cmd_pvz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    pvz_kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📱 Открыть Режим ПВЗ", url=f"{PORTAL_URL.rstrip('/')}/#test=pvz"),
            InlineKeyboardButton("🧪 14-шаговый тест", url=f"{PORTAL_URL.rstrip('/')}/#test=guided"),
        ],
        [InlineKeyboardButton("🎯 Новый подбор", callback_data="menu:pick")],
    ])
    brand_q = " ".join(context.args or []).strip()
    if brand_q:
        ql = brand_q.lower()
        hits = [s for s in SERVICE_MENUS if ql in str(s.get("brand", "")).lower()]
        if hits:
            s = hits[0]
            msg = (
                f"🛠️ *Сервисное меню — {s.get('brand')}*\n\n"
                f"{s.get('howto', 'Нет данных')}\n\n"
                f"⚠️ _Не меняйте регистры Gain/Offset и не включайте Burn-In/Aging Mode._"
            )
            await update.message.reply_text(msg, parse_mode="Markdown", reply_markup=pvz_kb)
            return
        await update.message.reply_text(
            f"Бренд `{brand_q}` не найден в справочнике сервисных меню ({len(SERVICE_MENUS)} брендов). "
            f"Попробуйте, например: `/pvz ASUS`, `/pvz LG`, `/pvz TCL`, `/pvz MSI`, `/pvz Xiaomi`.",
            parse_mode="Markdown",
            reply_markup=pvz_kb,
        )
        return
    await update.message.reply_text(
        PVZ_TEXT + "\n\n💡 _Вход в сервисное меню по бренду:_ `/pvz ASUS` (или LG, MSI, TCL, Xiaomi, Samsung...)",
        parse_mode="Markdown",
        reply_markup=pvz_kb,
    )


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = update.callback_query
    await q.answer()
    data = q.data or ""

    if data == "menu:pick":
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("До 20 000 ₽", callback_data="pb:20000"), InlineKeyboardButton("До 35 000 ₽", callback_data="pb:35000")],
            [InlineKeyboardButton("До 60 000 ₽", callback_data="pb:60000"), InlineKeyboardButton("До 100 000 ₽", callback_data="pb:100000")],
            [InlineKeyboardButton("Любой бюджет", callback_data="pb:999999")],
        ])
        await q.edit_message_text("💰 *Шаг 1 / 3:* Выберите бюджет «на руки» (₽):", parse_mode="Markdown", reply_markup=kb)

    elif data.startswith("pb:"):
        b = data.split(":")[1]
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("24″", callback_data=f"pd:{b}:24.5"), InlineKeyboardButton("27″", callback_data=f"pd:{b}:27")],
            [InlineKeyboardButton("32″", callback_data=f"pd:{b}:32"), InlineKeyboardButton("34″+", callback_data=f"pd:{b}:34")],
            [InlineKeyboardButton("Любая диагональ", callback_data=f"pd:{b}:all")],
        ])
        await q.edit_message_text("📐 *Шаг 2 / 3:* Выберите диагональ экрана:", parse_mode="Markdown", reply_markup=kb)

    elif data.startswith("pd:"):
        _, b, d = data.split(":")
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("OLED", callback_data=f"quick:{b}:{d}:oled"), InlineKeyboardButton("Mini-LED", callback_data=f"quick:{b}:{d}:mini-led")],
            [InlineKeyboardButton("Fast IPS", callback_data=f"quick:{b}:{d}:ips"), InlineKeyboardButton("VA / HVA", callback_data=f"quick:{b}:{d}:va")],
            [InlineKeyboardButton("Любая матрица", callback_data=f"quick:{b}:{d}:all")],
        ])
        await q.edit_message_text("🎨 *Шаг 3 / 3:* Выберите тип матрицы:", parse_mode="Markdown", reply_markup=kb)

    elif data.startswith("quick:"):
        _, b, d, mat = data.split(":")
        tokens = [b]
        if d != "all":
            tokens.append(d)
        if mat != "all":
            tokens.append(mat)
        results = search_models(tokens, limit=5)
        if not results:
            await q.edit_message_text("По выбранным параметрам моделей не нашлось. Попробуйте увеличить бюджет.", reply_markup=main_menu_keyboard())
            return
        await send_search_results(q.edit_message_text, results, "🎯 *Топ-5 мониторов по вашим параметрам:*")

    elif data.startswith("card:") or data.startswith("m:"):
        mid = int(data.split(":")[1])
        m = BY_ID.get(mid)
        if not m:
            await q.edit_message_text("Модель не найдена.", reply_markup=main_menu_keyboard())
            return
        await q.edit_message_text(format_model_card(m), parse_mode="Markdown", reply_markup=model_card_keyboard(m))

    elif data.startswith("al:"):
        _, mid_s, tgt_s = data.split(":")
        m = BY_ID.get(int(mid_s))
        if m:
            aid = add_alert(q.message.chat_id, m["model"], int(tgt_s))
            await q.message.reply_text(
                f"🔔 Подписка `#{aid}` оформлена: напишу, когда *{m['model']}* станет дешевле *{fmt_rub(int(tgt_s))} ₽*.",
                parse_mode="Markdown",
            )

    elif data == "menu:drops":
        drops = load_price_drops(limit=7)
        text, kb = format_drops_message(drops)
        await q.edit_message_text(text, parse_mode="Markdown", reply_markup=kb)

    elif data == "menu:pvz":
        await q.edit_message_text(PVZ_TEXT, parse_mode="Markdown", reply_markup=main_menu_keyboard())

    elif data == "menu:alerts":
        rows = list_alerts(q.message.chat_id)
        if not rows:
            await q.edit_message_text("Активных подписок пока нет. Откройте любую модель и нажмите «🔔 Алерт».", reply_markup=main_menu_keyboard())
        else:
            lines = ["🔔 *Ваши подписки:*"] + [
                f"• `#{aid}` — *{mq}* ≤ *{fmt_rub(tgt)} ₽* ({'✅' if trig else '⏳'})"
                for aid, mq, tgt, trig in rows
            ]
            await q.edit_message_text("\n".join(lines), parse_mode="Markdown", reply_markup=main_menu_keyboard())


async def inline_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = (update.inline_query.query or "").strip()
    tokens = query.split() if query else ["OLED"]
    matches = search_models(tokens, limit=10)
    results = []
    for m in matches:
        mp = fmt_rub(m.get("price_mp_rf") or m.get("hand"))
        rid = hashlib.md5(f"{m['id']}:{m['model']}".encode("utf-8")).hexdigest()[:16]
        deep_url = f"{PORTAL_URL.rstrip('/')}/#model={m['id']}"
        inline_kb_rows = [[
            InlineKeyboardButton("🌐 Открыть на портале", url=deep_url),
            InlineKeyboardButton("🧪 Тест ПВЗ", url=f"{PORTAL_URL.rstrip('/')}/#test=guided"),
        ]]
        store_btns = []
        for st in (m.get("stores") or [])[:2]:
            if isinstance(st, dict) and st.get("url"):
                store_btns.append(InlineKeyboardButton(str(st.get("name", "Магазин"))[:18], url=wrap_affiliate_url(st["url"])))
        if store_btns:
            inline_kb_rows.append(store_btns)
        results.append(
            InlineQueryResultArticle(
                id=rid,
                title=f"{m['model']} — {mp} ₽",
                description=f"{m.get('diag')}″ {m.get('res')} • {m.get('max_hz')} Гц • Тир {str(m.get('tier',''))[:1]} • {str(m.get('ptype',''))[:40]}",
                input_message_content=InputTextMessageContent(format_model_card(m), parse_mode="Markdown"),
                reply_markup=InlineKeyboardMarkup(inline_kb_rows),
            )
        )
    await update.inline_query.answer(results, cache_time=60)


async def alert_loop(app: Application) -> None:
    while True:
        try:
            for msg in find_triggered_alerts():
                await app.bot.send_message(
                    chat_id=msg["chat_id"],
                    text=(
                        f"🔥 *Цена снизилась!* {msg['model']}\n"
                        f"Текущая цена: *{fmt_rub(msg['price'])} ₽* (ваш порог: {fmt_rub(msg['target'])} ₽)\n"
                        f"Площадка: {msg['store']}\n{msg['url']}"
                    ),
                    parse_mode="Markdown",
                )
        except Exception:
            pass
        await asyncio.sleep(ALERT_CHECK_INTERVAL_SEC)


async def post_init(app: Application) -> None:
    try:
        await app.bot.set_my_commands([
            BotCommand("start", "Главное меню и подбор по шагам"),
            BotCommand("find", "Поиск: /find 50000 27 OLED"),
            BotCommand("oled", "Топ OLED-мониторов (можно указать бюджет)"),
            BotCommand("miniled", "Топ Mini-LED мониторов (можно указать бюджет)"),
            BotCommand("drops", "Скидки и выгодные цены в РФ"),
            BotCommand("digest", "Еженедельный дайджест новинок и скидок"),
            BotCommand("pro", "Pro-подписка (безлимит алертов) и подбор"),
            BotCommand("model", "Полная карточка модели"),
            BotCommand("compare", "Сравнение: /compare A vs B"),
            BotCommand("pvz", "Чек-лист ПВЗ и сервисные меню (/pvz ASUS)"),
            BotCommand("alert", "Подписка на цену: /alert модель цена"),
            BotCommand("myalerts", "Мои активные подписки"),
        ])
    except Exception:
        pass
    asyncio.create_task(alert_loop(app))
    asyncio.create_task(weekly_digest_loop(app))


def load_local_env() -> None:
    """Auto-load TELEGRAM_BOT_TOKEN from bot/.env, bot/.env.txt, or .env so startup never depends on .bat quoting."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates = [
        os.path.join(base_dir, "bot", ".env"),
        os.path.join(base_dir, "bot", ".env.txt"),
        os.path.join(base_dir, ".env"),
    ]
    for p in candidates:
        if not os.path.exists(p):
            continue
        try:
            with open(p, "r", encoding="utf-8-sig") as fh:
                for raw_ln in fh:
                    ln = raw_ln.strip()
                    if not ln or ln.startswith("#") or "=" not in ln:
                        continue
                    k, v = ln.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k and v and k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass
    if not os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("BOT_TOKEN"):
        os.environ["TELEGRAM_BOT_TOKEN"] = os.environ["BOT_TOKEN"]


def main() -> None:
    load_local_env()
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN environment variable first.")
    init_alerts_db()
    app = Application.builder().token(token).post_init(post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("find", cmd_find))
    app.add_handler(CommandHandler("oled", cmd_oled))
    app.add_handler(CommandHandler("miniled", cmd_miniled))
    app.add_handler(CommandHandler("drops", cmd_drops))
    app.add_handler(CommandHandler("digest", cmd_digest))
    app.add_handler(CommandHandler("pro", cmd_pro))
    app.add_handler(CommandHandler("model", cmd_model))
    app.add_handler(CommandHandler("compare", cmd_compare))
    app.add_handler(CommandHandler("alert", cmd_alert))
    app.add_handler(CommandHandler("myalerts", cmd_myalerts))
    app.add_handler(CommandHandler("delalert", cmd_delalert))
    app.add_handler(CommandHandler("pvz", cmd_pvz))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(InlineQueryHandler(inline_query))
    print(f"Telegram bot (menu + compare + inline + alerts) started ({len(CATALOG)} models)...")
    app.run_polling()


if __name__ == "__main__":
    main()
