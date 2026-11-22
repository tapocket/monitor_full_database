#!/usr/bin/env python3
"""Safe monthly update helper: update price, retail price, direct store URL, or review URL in database_master.json,
sync to market_rf/flagships, and append a dated record to data/price_history/YYYY-MM.jsonl."""

import argparse
import datetime
import json
import os


def main() -> None:
    parser = argparse.ArgumentParser(description="Safely update a monitor in database_master.json + price history")
    parser.add_argument("--master", default="database_master.json")
    parser.add_argument("--id", type=int, required=True, help="Catalog ID of monitor to update")
    parser.add_argument("--retail-rub", type=int, default=None, help="New RF retail price (RUB)")
    parser.add_argument("--hand-rub", type=int, default=None, help="New out-of-pocket price (RUB)")
    parser.add_argument("--store-name", default=None, help="Store name (e.g. '🛒 DNS', '🛒 Ozon', '🛒 Яндекс Маркет')")
    parser.add_argument("--store-url", default=None, help="Verified direct product URL")
    parser.add_argument("--rev-url", default=None, help="Verified review URL (TFTCentral / RTINGS)")
    parser.add_argument("--history-dir", default="data/price_history")
    args = parser.parse_args()

    with open(args.master, "r", encoding="utf-8") as f:
        db = json.load(f)

    m = next((x for x in db["catalog"] if x.get("id") == args.id), None)
    if not m:
        raise SystemExit(f"Monitor id={args.id} not found in {args.master}")

    if args.retail_rub is not None:
        m["price_retail_rf"] = args.retail_rub
    if args.hand_rub is not None:
        m["hand"] = args.hand_rub
        m["price_mp_rf"] = args.hand_rub
    if args.rev_url:
        m["rev_url"] = args.rev_url
    if args.store_name and args.store_url:
        stores = m.get("stores") or []
        existing = next((s for s in stores if isinstance(s, dict) and s.get("name") == args.store_name), None)
        if existing:
            existing["url"] = args.store_url
        else:
            stores.append({"name": args.store_name, "url": args.store_url})
        m["stores"] = stores

    # Sync to market_rf and flagships
    for sec in ("market_rf", "flagships"):
        for it in db.get(sec, []):
            if it.get("cat_id") == args.id:
                if "stores" in it:
                    it["stores"] = list(m.get("stores") or [])
                if args.hand_rub is not None and "hand" in it:
                    it["hand"] = args.hand_rub

    with open(args.master, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    # Append to monthly price history if price was updated
    if args.retail_rub is not None or args.hand_rub is not None:
        today = datetime.date.today()
        os.makedirs(args.history_dir, exist_ok=True)
        hist_file = os.path.join(args.history_dir, f"{today.strftime('%Y-%m')}.jsonl")
        rec = {
            "date": today.isoformat(),
            "cat_id": m["id"],
            "model_match": m.get("model", ""),
            "retail_rf_rub": int(m.get("price_retail_rf") or 0),
            "mp_rf_rub": int(m.get("price_mp_rf") or m.get("hand") or 0),
            "store": (args.store_name or "РФ").replace("🛒 ", ""),
        }
        with open(hist_file, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print(f"Appended price history snapshot -> {hist_file}")

    print(f"Updated id={m['id']} ({m.get('model')}). Next step: run build_database.py --recalc --verify")


if __name__ == "__main__":
    main()
