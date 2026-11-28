#!/usr/bin/env python3
"""Prepare the _site directory for GitHub Pages deployment (zero bash-e edge cases)."""

import argparse
import glob
import json
import os
import shutil


def copy_if_exists(src: str, dst_dir: str, dst_name: str | None = None) -> bool:
    if not os.path.isfile(src):
        return False
    os.makedirs(dst_dir, exist_ok=True)
    shutil.copy2(src, os.path.join(dst_dir, dst_name or os.path.basename(src)))
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Build _site artifact for GitHub Pages")
    parser.add_argument("--out", default="_site", help="Output directory")
    args = parser.parse_args()
    out = args.out

    if os.path.exists(out):
        shutil.rmtree(out)
    for sub in ("", "data", "data/price_history", "api/v1", "docs/screenshots"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    root_files = [
        "index.html",
        "monitor_full_database.html",
        "manifest.webmanifest",
        "sw.js",
        "favicon.svg",
        "og-cover.png",
        "yandex_verify.html",
    ]
    copied_root = [f for f in root_files if copy_if_exists(f, out)]

    # Guarantee _site/index.html exists
    if not os.path.isfile(os.path.join(out, "index.html")):
        assert copy_if_exists("monitor_full_database.html", out, "index.html"), "Missing both index.html and monitor_full_database.html"

    for df in ("data/db_payload.js", "data/prices_rf_snapshot.json", "data/icc_profiles.json"):
        copy_if_exists(df, os.path.join(out, "data"))

    for ph in glob.glob("data/price_history/*.jsonl"):
        copy_if_exists(ph, os.path.join(out, "data", "price_history"))

    for img in glob.glob("docs/screenshots/*.png"):
        copy_if_exists(img, os.path.join(out, "docs", "screenshots"))

    for af in glob.glob("api/v1/*.json"):
        copy_if_exists(af, os.path.join(out, "api", "v1"))

    # Always generate full monitors.json & brands.json in _site/api/v1/
    with open("database_master.json", "r", encoding="utf-8") as fp:
        m = json.load(fp)
    cat = m.get("catalog", [])
    with open(os.path.join(out, "api", "v1", "monitors.json"), "w", encoding="utf-8") as fp:
        json.dump(cat, fp, ensure_ascii=False, separators=(",", ":"))
    brands = sorted({x.get("brand_canonical") or x.get("brand") or "" for x in cat if x.get("brand")})
    with open(os.path.join(out, "api", "v1", "brands.json"), "w", encoding="utf-8") as fp:
        json.dump({"count": len(brands), "brands": brands}, fp, ensure_ascii=False, separators=(",", ":"))

    api_files = sorted(os.listdir(os.path.join(out, "api", "v1")))
    print(f"[PAGES] Prepared {out}/ cleanly: root={copied_root}, api/v1={api_files}, models={len(cat)}")


if __name__ == "__main__":
    main()
