"""Rename top-level segment-type keys in public/data JSON to match UI spec."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

# Old key -> new display key. "Application / Use Case" is not listed: run
# migrate_automotive_segments.py (it emits By Propulsion Type + By Sales Channel).
RENAME: dict[str, str] = {
    "By Type": "By System Type",
    "By Organ Type": "By Key Form Factor",
    "By End User": "By Vehicle Type",
}


def deep_rename_keys(obj):
    if isinstance(obj, dict):
        return {RENAME.get(k, k): deep_rename_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [deep_rename_keys(x) for x in obj]
    return obj


def main() -> None:
    for name in ("value.json", "volume.json", "segmentation_analysis.json"):
        p = DATA / name
        data = json.loads(p.read_text(encoding="utf-8"))
        p.write_text(
            json.dumps(deep_rename_keys(data), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Updated {p}")


if __name__ == "__main__":
    main()
