#!/usr/bin/env python3
"""Concurrent Link Rot Checker for monitor_full_database (never deletes URLs, only reports status)."""

import argparse
import concurrent.futures
import datetime
import json
import os
import urllib.error
import urllib.request


def check_url(url: str, timeout: int = 8) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; MonitorDB-LinkChecker/1.0)"}
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return {"url": url, "status": resp.status, "state": "ok"}
        except urllib.error.HTTPError as e:
            if e.code in (405, 403) and method == "HEAD":
                continue
            state = "dead" if e.code in (404, 410) else "restricted"
            return {"url": url, "status": e.code, "state": state}
        except Exception as e:
            if method == "HEAD":
                continue
            return {"url": url, "status": 0, "state": "error", "error": str(e)[:120]}
    return {"url": url, "status": 0, "state": "error"}


def main():
    parser = argparse.ArgumentParser(description="Check store & review URLs in database_master.json")
    parser.add_argument("--master", default="database_master.json")
    parser.add_argument("--out", default="data/link_health_report.json")
    parser.add_argument("--sample", type=int, default=100, help="Max URLs to check (0 = all)")
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()

    with open(args.master, "r", encoding="utf-8") as fp:
        master = json.load(fp)

    urls = []
    seen = set()
    for item in master.get("catalog", []):
        ru = str(item.get("rev_url") or "").strip()
        if ru.startswith("http") and ru not in seen:
            seen.add(ru)
            urls.append(ru)
        for st in item.get("stores", []) if isinstance(item.get("stores"), list) else []:
            su = str(st.get("u") or "").strip() if isinstance(st, dict) else ""
            if su.startswith("http") and su not in seen:
                seen.add(su)
                urls.append(su)

    if args.sample > 0:
        urls = urls[:args.sample]

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for res in ex.map(check_url, urls):
            results.append(res)

    summary = {
        "checked_at": datetime.datetime.utcnow().isoformat() + "Z",
        "total_checked": len(results),
        "ok": sum(1 for r in results if r["state"] == "ok"),
        "restricted": sum(1 for r in results if r["state"] == "restricted"),
        "dead": sum(1 for r in results if r["state"] == "dead"),
        "error": sum(1 for r in results if r["state"] == "error"),
        "dead_urls": [r for r in results if r["state"] == "dead"],
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)
    print(f"Link check done: {summary['ok']} ok, {summary['restricted']} restricted, {summary['dead']} dead, {summary['error']} error -> {args.out}")


if __name__ == "__main__":
    main()
