#!/usr/bin/env python3
"""Concurrent Link Rot Checker for monitor_full_database (never deletes URLs, writes JSON + Markdown audit)."""

import argparse
import concurrent.futures
import datetime
import json
import os
import urllib.error
import urllib.request


def check_url(entry: tuple[str, str], timeout: int = 8) -> dict:
    model, url = entry
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0"}
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return {"model": model, "url": url, "status": resp.status, "state": "ok"}
        except urllib.error.HTTPError as e:
            if e.code in (405, 403) and method == "HEAD":
                continue
            state = "dead" if e.code in (404, 410) else "restricted"
            return {"model": model, "url": url, "status": e.code, "state": state}
        except Exception as e:
            if method == "HEAD":
                continue
            return {"model": model, "url": url, "status": 0, "state": "error", "error": str(e)[:100]}
    return {"model": model, "url": url, "status": 0, "state": "error"}


def main():
    parser = argparse.ArgumentParser(description="Check store & review URLs in database_master.json")
    parser.add_argument("--master", default="database_master.json")
    parser.add_argument("--out", default="data/link_health_report.json")
    parser.add_argument("--md-out", default="data/LINK_AUDIT_REPORT.md")
    parser.add_argument("--sample", type=int, default=150, help="Max URLs to check (0 = all)")
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    with open(args.master, "r", encoding="utf-8") as fp:
        master = json.load(fp)

    entries = []
    seen = set()
    for item in master.get("catalog", []):
        mname = str(item.get("model", ""))
        ru = str(item.get("rev_url") or "").strip()
        if ru.startswith("http") and ru not in seen:
            seen.add(ru)
            entries.append((mname, ru))
        for st in item.get("stores", []) if isinstance(item.get("stores"), list) else []:
            su = str(st.get("u") or "").strip() if isinstance(st, dict) else ""
            if su.startswith("http") and su not in seen:
                seen.add(su)
                entries.append((mname, su))

    if args.sample > 0:
        entries = entries[:args.sample]

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(check_url, entries):
            results.append(res)

    dead_list = [r for r in results if r["state"] == "dead"]
    summary = {
        "checked_at": datetime.datetime.utcnow().isoformat() + "Z",
        "total_checked": len(results),
        "ok": sum(1 for r in results if r["state"] == "ok"),
        "restricted": sum(1 for r in results if r["state"] == "restricted"),
        "dead": len(dead_list),
        "error": sum(1 for r in results if r["state"] == "error"),
        "dead_urls": dead_list,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)

    if args.md_out:
        md_lines = [
            "# Отчёт проверки ссылок `monitor_full_database`",
            f"- Дата проверки: `{summary['checked_at']}`",
            f"- Проверено ссылок: **{summary['total_checked']}** (OK: {summary['ok']}, Ограничено защитой: {summary['restricted']}, 404/Удалено: **{summary['dead']}**, Ошибки сети: {summary['error']})",
            "",
            "## Нерабочие ссылки (404 / 410 — кандидаты на замену)",
            "",
        ]
        if dead_list:
            md_lines.append("| Модель | HTTP | Ссылка |")
            md_lines.append("| :--- | :---: | :--- |")
            for d in dead_list:
                md_lines.append(f"| {d['model']} | {d['status']} | {d['url']} |")
        else:
            md_lines.append("Нерабочих ссылок (404/410) в проверенной выборке не обнаружено.")
        with open(args.md_out, "w", encoding="utf-8") as fp:
            fp.write("\n".join(md_lines) + "\n")

    print(f"Link check done: {summary['ok']} ok, {summary['restricted']} restricted, {summary['dead']} dead -> {args.out}")


if __name__ == "__main__":
    main()
