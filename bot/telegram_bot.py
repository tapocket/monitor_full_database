#!/usr/bin/env python3
"""Telegram-бот подбора мониторов, шпаргалок ПВЗ и уведомлений о снижении цен РФ.
Поддерживает:
  • /start, /find, /model, /pvz
  • /alert <модель> <целевая_цена> — подписка на снижение цены (SQLite)
  • /myalerts, /delalert <id> — управление подписками
  • Inline-режим (@botname запрос) в любом чате Telegram
"""

import asyncio
import hashlib
import json
import os
import re
import sqlite3
from telegram import InlineQueryResultArticle, InputTextMessageContent, Update
from telegram.ext import Application, CommandHandler, ContextTypes, InlineQueryHandler

MASTER_PATH = os.environ.get("MONITOR_DB_MASTER", "database_master.json")
SNAPSHOT_PATH = os.environ.get("MONITOR_DB_SNAPSHOT", "data/prices_rf_snapshot.json")
ALERTS_DB_PATH = os.environ.get("MONITOR_DB_ALERTS_DB", "alerts.db")
ALERT_CHECK_INTERVAL_SEC = int(os.environ.get("ALERT_CHECK_INTERVAL_SEC", "3600"))


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
        if diag_filter is not None and abs(float(m.get("diag", 0)) - diag_filter) > 1.2:
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
    return matches[:limit]


def format_model_card(m: dict) -> str:
    mp = fmt_rub(m.get("price_mp_rf") or m.get("hand") or m.get("rub"))
    retail = m.get("price_retail_rf") or 0
    retail_line = f" | Розница РФ: *{fmt_rub(retail)} ₽*" if retail > 0 else ""
    return (
        f"🖥 *{m['model']}*\n"
        f"• Бренд: {m.get('brand_canonical', m.get('brand'))} | Год: {m.get('year')} | Тир: `{str(m.get('tier',''))[:1]}`\n"
        f"• Экран: {m.get('diag')}″ {m.get('res')} • {m.get('max_hz')} Гц\n"
        f"• Матрица: `{str(m.get('pmodel',''))[:90]}`\n"
        f"• Отклик GtG 80%: {m.get('gtg80')} мс | Контраст: {m.get('cr')}:1 | HDR: {m.get('hdr')} нит\n"
        f"• Цена «на руки» (МП/Ozon): *{mp} ₽*{retail_line}\n"
        f"• Обзор: {m.get('rev_url') or 'Нет прямой ссылки'}"
    )


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        f"👋 *monitor_full_database* — инженерная база ({len(CATALOG)} моделей).\n\n"
        "Команды:\n"
        "• `/find 40000 27 OLED` — топ-5 моделей до бюджета (₽ на руки)\n"
        "• `/model Innocn GA27T1M` — карточка и шпаргалка ПВЗ\n"
        "• `/alert TCL 27R83U 45000` — уведомить, когда цена упадёт ниже 45 000 ₽\n"
        "• `/myalerts` / `/delalert <id>` — управление подписками на цены\n"
        "• `/pvz` — чек-лист приёмки в ПВЗ за 3 минуты\n\n"
        "💡 *Inline-режим*: `@имя_бота PG32UCDM` в любом чате Telegram."
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def cmd_find(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    results = search_models(context.args or [], limit=5)
    if not results:
        await update.message.reply_text("Ничего не найдено по этим фильтрам. Попробуйте изменить бюджет или запрос.")
        return
    lines = ["🎯 *Подборка по вашему запросу:*"]
    for i, m in enumerate(results, 1):
        mp = fmt_rub(m.get("price_mp_rf") or m.get("hand"))
        lines.append(
            f"{i}. *{m['model']}*\n"
            f"   {m.get('diag')}″ • {m.get('res')} • {m.get('max_hz')} Гц • Тир `{str(m.get('tier',''))[:1]}` | На руки: *{mp} ₽*"
        )
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_model(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = context.args or []
    if not q:
        await update.message.reply_text("Укажите модель, например: `/model TCL 27R83U`", parse_mode="Markdown")
        return
    results = search_models(q, limit=1)
    if not results:
        await update.message.reply_text("Модель не найдена. Проверьте точный индекс.")
        return
    await update.message.reply_text(format_model_card(results[0]), parse_mode="Markdown")


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


async def cmd_pvz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📋 *Чек-лист приёмки монитора в ПВЗ за 3 минуты:*\n"
        "1. Заливки R/G/B/Белый/Чёрный — проверка битых и горящих субпикселей.\n"
        "2. Тёмно-серый 5% Grey — проверка засветов (Backlight Bleed) и полосатости OLED.\n"
        "3. Однородный белый — проверка цветового тинта по краям и грязных пятен DSE.\n"
        "4. В параметрах дисплея Windows выставить максимальные Гц и проверить комплект кабелей."
    )
    await update.message.reply_text(text, parse_mode="Markdown")


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
    app.create_task(alert_loop(app))


def main() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN environment variable first.")
    init_alerts_db()
    app = Application.builder().token(token).post_init(post_init).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("find", cmd_find))
    app.add_handler(CommandHandler("model", cmd_model))
    app.add_handler(CommandHandler("alert", cmd_alert))
    app.add_handler(CommandHandler("myalerts", cmd_myalerts))
    app.add_handler(CommandHandler("delalert", cmd_delalert))
    app.add_handler(CommandHandler("pvz", cmd_pvz))
    app.add_handler(InlineQueryHandler(inline_query))
    print(f"Telegram bot (commands + inline + price alerts) started ({len(CATALOG)} models)...")
    app.run_polling()


if __name__ == "__main__":
    main()
