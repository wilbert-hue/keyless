"""
Promote 'By Propulsion & Sales Channel' into two segment types:
'By Propulsion Type' and 'By Sales Channel' (each with flat children / year data).
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
COMBINED = "By Propulsion & Sales Channel"


def split_block(obj: dict) -> dict:
    if not isinstance(obj, dict):
        return obj
    if COMBINED not in obj:
        return {k: split_block(v) if isinstance(v, dict) else v for k, v in obj.items()}

    out = {}
    for k, v in obj.items():
        if k == COMBINED and isinstance(v, dict):
            prop = v.get("By Propulsion Type")
            sales = v.get("By Sales Channel")
            if prop is not None:
                out["By Propulsion Type"] = deepcopy(prop) if isinstance(prop, dict) else prop
            if sales is not None:
                out["By Sales Channel"] = deepcopy(sales) if isinstance(sales, dict) else sales
        else:
            out[k] = split_block(v) if isinstance(v, dict) else v
    return out


def reorder_geo_keys(geo: dict) -> dict:
    """Optional stable order for 5 main segment types + rest (e.g. By Country)."""
    preferred = [
        "By System Type",
        "By Key Form Factor",
        "By Propulsion Type",
        "By Sales Channel",
        "By Vehicle Type",
    ]
    if not any(k in geo for k in preferred):
        return geo
    rest = {k: v for k, v in geo.items() if k not in preferred and k != COMBINED}
    front = {}
    for k in preferred:
        if k in geo:
            front[k] = geo[k]
    return {**front, **rest}


def process_file(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    new_data = {}
    for key, gdata in data.items():
        if isinstance(gdata, dict):
            g2 = reorder_geo_keys(split_block(gdata))
            new_data[key] = g2
        else:
            new_data[key] = gdata

    path.write_text(json.dumps(new_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {path}")


def main() -> None:
    for name in ("value.json", "volume.json", "segmentation_analysis.json"):
        process_file(DATA / name)


if __name__ == "__main__":
    main()
