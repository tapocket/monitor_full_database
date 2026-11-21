#!/usr/bin/env python3
"""Append daily RF price snapshot records to monthly JSONL history and recalculate 90-day minimums."""

import argparse
import datetime
import json
import os
from collections import defaultdict


def main():
    parser = argparse.ArgumentParser(description="Record RF prices into monthly JSONL history and refresh min_90d_rub")
    parser.add_argument("--snapshot", default="data/prices_rf_snapshot.json")
    parser.add_argument("--history-dir", default="data/price_history")
    args = parser.parse_args()

    with open(args.snapshot, "r", encoding="utf-8") as fp:
        snap = json.load(fp)

    today = datetime.date.today()
    month_file = os.path.join(args.history_dir, f"{today.strftime('%Y-%m')}.jsonl")
    os.makedirs(args.history_dir, exist_ok=True)

    # Append today's records
    with open(month_file, "a", encoding="utf-8") as fp:
        for it in snap.get("items", []):
            rec = {
                "date": today.isoformat(),
                "model_match": it.get("model_match", ""),
                "sku_rf": it.get("sku_rf", ""),
                "retail_rf_rub": it.get("retail_rf_rub", 0),
                "mp_rf_rub": it.get("mp_rf_rub", 0),
                "store": it.get("store", ""),
            }
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # Recompute 90-day minimums across all JSONL files in history-dir
    cutoff = (today - datetime.timedelta(days=90)).isoformat()
    min_by_model = defaultdict(list)
    for fname in sorted(os.listdir(args.history_dir)):
        if not fname.endswith(".jsonl"):
            continue
        with open(os.path.join(args.history_dir, fname), "r", encoding="utf-8") as fp:
            for line in fp:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                if rec.get("date", "") >= cutoff:
                    for k in ("retail_rf_rub", "mp_rf_rub"):
                        v = rec.get(k, 0)
                        if isinstance(v, (int, float)) and v > 0:
                            min_by_model[rec["model_match"]].append(int(v))

    for it in snap.get("items", []):
        vals = min_by_model.get(it.get("model_match", ""), [])
        if vals:
            it["min_90d_rub"] = min(vals)

    snap["updated_at"] = today.isoformat()
    with open(args.snapshot, "w", encoding="utf-8") as fp:
        json.dump(snap, fp, ensure_ascii=False, indent=2)
    print(f"Recorded {len(snap.get('items', []))} items to {month_file} and refreshed 90-day minimums.")


if __name__ == "__main__":
    main()
