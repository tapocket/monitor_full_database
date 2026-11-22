#!/usr/bin/env python3
"""Telegram-бот подбора мониторов с интерактивным кнопочным меню, сравнением,
Inline-режимом (@monitor_fdb_bot) и уведомлениями о снижении цен РФ (SQLite).
"""

import asyncio
import hashlib
import json
import os
import re
import sqlite3
import urllib.parse
from telegram import (
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


CATALOG = load_catalog() if os.path.exists(MASTER_PATH) else []
BY_ID = {int(m["id"]): m for m in CATALOG if "id" in m}
TIER_RANK = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6}


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
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎯 Подобрать монитор по шагам", callback_data="menu:pick")],
        [
            InlineKeyboardButton("🔥 Топ OLED до 70к", callback_data="quick:70000:all:oled"),
            InlineKeyboardButton("⚡ Топ Mini-LED до 45к", callback_data="quick:45000:all:mini-led"),
        ],
        [
            InlineKeyboardButton("📋 Чек-лист ПВЗ", callback_data="menu:pvz"),
            InlineKeyboardButton("🔔 Мои подписки", callback_data="menu:alerts"),
        ],
        [InlineKeyboardButton("🌐 Открыть веб-портал (2 763 модели)", url=PORTAL_URL)],
    ])


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        f"👋 *monitor_full_database* — инженерная база ({len(CATALOG)} моделей).\n\n"
        "Выберите действие кнопками ниже или используйте команды:\n"
        "• `/find 50000 27 OLED` — быстрый поиск\n"
        "• `/model TCL 27R83U` — карточка модели\n"
        "• `/compare PG32UCDM vs 321URX` — сравнение двух моделей\n"
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
            InlineKeyboardButton(f"1️⃣ Карточка {str(a['model'])[:18]}", callback_data=f"card:{a['id']}"),
            InlineKeyboardButton(f"2️⃣ Карточка {str(b['model'])[:18]}", callback_data=f"card:{b['id']}"),
        ]
    ])
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)


async def cmd_alert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []
    if len(args) < 2 or not re.fullmatch(r"\d{4,6}", args[-1]):
        await update.message.reply_text("Формат: `/alert <модель> <целевая_цена_₽>`, например: `/alert TCL 27R83U 45000`", parse_mode="Markdown")
        return
    target = int(args[-1])
    model_q = " ".join(args[:-1]).strip()
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
    await update.message.reply_text(PVZ_TEXT, parse_mode="Markdown", reply_markup=main_menu_keyboard())


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

    elif data.startswith("card:"):
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
        results.append(
            InlineQueryResultArticle(
                id=rid,
                title=f"{m['model']} — {mp} ₽",
                description=f"{m.get('diag')}″ {m.get('res')} • {m.get('max_hz')} Гц • Тир {str(m.get('tier',''))[:1]} • {str(m.get('ptype',''))[:40]}",
                input_message_content=InputTextMessageContent(format_model_card(m), parse_mode="Markdown"),
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
    asyncio.create_task(alert_loop(app))


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN environment variable first.")
    init_alerts_db()
    app = Application.builder().token(token).post_init(post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("find", cmd_find))
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
