#!/usr/bin/env python3
"""Generate a prioritized monthly maintenance & update checklist for monitor_full_database.

Offline-safe: analyzes database_master.json, data/price_history/, and data/link_health_report.json
to surface 2026 releases missing reviews/RF prices, remaining DNS search URLs, and dead links.
"""

import argparse
import datetime
import glob
import json
import os


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate daily maintenance checklist")
    parser.add_argument("--master", default="database_master.json")
    parser.add_argument("--history-dir", default="data/price_history")
    parser.add_argument("--link-report", default="data/link_health_report.json")
    parser.add_argument("--out", default="data/DAILY_UPDATE_CHECKLIST.md")
    args = parser.parse_args()

    with open(args.master, "r", encoding="utf-8") as fp:
        db = json.load(fp)
    cat = db.get("catalog", [])

    # 1. 2026 S/A/E models missing review URL or RF price
    no_rev_2026 = [
        m for m in cat
        if str(m.get("year") or "") == "2026"
        and not (m.get("rev_url") or "").strip()
        and any(k in (m.get("ptype") or "").lower() for k in ("oled", "mini-led"))
    ]
    no_price_2026 = [
        m for m in cat
        if str(m.get("year") or "") == "2026"
        and int(m.get("hand") or 0) <= 0
    ]

    # 2. Remaining DNS search URLs (candidates to upgrade to direct /product/ cards)
    dns_search = []
    dns_direct = 0
    for m in cat:
        for st in (m.get("stores") or []):
            u = st.get("url", "") if isinstance(st, dict) else ""
            if "dns-shop.ru/product/" in u:
                dns_direct += 1
            elif "dns-shop.ru/search/" in u:
                dns_search.append((m["id"], m["brand"], m["model"], m.get("hand") or 0))

    # 3. Price history freshness
    ph_files = sorted(glob.glob(os.path.join(args.history_dir, "*.jsonl")))
    ph_lines = 0
    for pf in ph_files:
        with open(pf, "r", encoding="utf-8") as fh:
            ph_lines += sum(1 for ln in fh if ln.strip())

    # 4. Dead links from last CI report (if present)
    dead_links = []
    if os.path.exists(args.link_report):
        try:
            lr = json.load(open(args.link_report, "r", encoding="utf-8"))
            dead_links = lr.get("dead_urls", [])
        except Exception:
            pass

    today = datetime.date.today().isoformat()
    lines = [
        f"# Ежедневный чеклист обновления `monitor_full_database` ({today})",
        "",
        "## Сводка состояния базы",
        f"- Всего моделей в каталоге: **{len(cat)}** (витрина РФ: {len(db.get('market_rf', []))}, флагманы: {len(db.get('flagships', []))})",
        f"- Прямые карточки DNS `/product/`: **{dns_direct}** | Целевой поиск DNS `/search/`: **{len(dns_search)}**",
        f"- История цен (`data/price_history/`): **{len(ph_files)}** файл(ов), **{ph_lines}** записей",
        f"- Битые ссылки из последнего CI-аудита (404/410): **{len(dead_links)}**",
        "",
        "## 1. Приоритет: новинки 2026 (OLED / Mini-LED) без ссылки на обзор",
        f"Найдено **{len(no_rev_2026)}** моделей (показаны первые 15):",
        "",
    ]
    for m in no_rev_2026[:15]:
        lines.append(f"- [ ] `#{m['id']}` **{m['model']}** — {m.get('diag')}″ {m.get('res')} {m.get('hz')} Гц ({m.get('ptype')})")

    lines += [
        "",
        "## 2. Новинки 2026 без цены «на руки» (добавить при появлении в РФ / CN)",
        f"Найдено **{len(no_price_2026)}** моделей (показаны первые 15):",
        "",
    ]
    for m in no_price_2026[:15]:
        lines.append(f"- [ ] `#{m['id']}` **{m['model']}** — {m.get('diag')}″ {m.get('ptype')}")

    lines += [
        "",
        "## 3. Кандидаты на перевод DNS `/search/` → прямая карточка `/product/`",
        f"Осталось **{len(dns_search)}** моделей (показаны первые 15 по цене):",
        "",
    ]
    for mid, br, mod, hand in sorted(dns_search, key=lambda x: x[3], reverse=True)[:15]:
        lines.append(f"- [ ] `#{mid}` **{mod}** ({hand:,} ₽)".replace(",", " "))

    if dead_links:
        lines += ["", "## 4. Битые ссылки (404/410) к замене", ""]
        for d in dead_links[:20]:
            lines.append(f"- [ ] **{d.get('model')}** ({d.get('status')}): {d.get('url')}")

    lines += [
        "",
        "## Команды для обновления",
        "```bash",
        "python3 scripts/add_or_update_monitor.py --help",
        "python3 build_database.py --master database_master.json --template-xlsx monitor_full_database.xlsx --template-html monitor_full_database.html --outdir . --recalc --verify",
        "python3 scripts/pre_deploy_check.py",
        "```",
        "",
    ]

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    print(f"[CHECKLIST] Generated {args.out}: 2026_no_rev={len(no_rev_2026)}, 2026_no_price={len(no_price_2026)}, dns_search={len(dns_search)}, dead={len(dead_links)}")


if __name__ == "__main__":
    main()
