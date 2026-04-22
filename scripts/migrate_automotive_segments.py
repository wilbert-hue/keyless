"""
One-time migration: replace demo segments with keyless vehicle segments
in public/data/*.json. Preserves per-geography, per–segment-type yearly totals.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

YEAR_RE = re.compile(r"^20\d{2}$")

# Keys expected in *legacy* medical demo JSON input
SEG_FOUR_IN = ("By Type", "By Organ Type", "Application / Use Case", "By End User")
# Keys written to output (and current app / public data)
SEG_OUT_SYSTEM = "By System Type"
SEG_OUT_KEY_FORM = "By Key Form Factor"
SEG_OUT_PROP = "By Propulsion Type"
SEG_OUT_SALES = "By Sales Channel"
SEG_OUT_VEHICLE = "By Vehicle Type"

BY_TYPE = [
    "Immobilizer System",
    "Remote Keyless Entry System",
    "Passive Keyless Entry and Start System",
]
BY_ORGAN = [
    "Conventional Transponder Key",
    "Remote Head Key",
    "Flip Key",
    "Smart Key",
    "Card Key",
]
APP_PROP = [
    "Internal Combustion Engine Vehicles",
    "Hybrid Vehicles",
    "Battery Electric Vehicles",
]
APP_SALES = [
    "OEM Factory-Fit",
    "Aftermarket Replacement Channel",
]


def is_year_obj(d: dict) -> bool:
    if not isinstance(d, dict) or not d:
        return False
    return any(YEAR_RE.match(k) for k in d)


def sum_leaf_years(node) -> dict[str, float]:
    if not isinstance(node, dict):
        return {}
    if is_year_obj(node):
        return {k: float(v) for k, v in node.items() if YEAR_RE.match(k) and v is not None}
    out: dict[str, float] = {}
    for v in node.values():
        s = sum_leaf_years(v)
        for y, val in s.items():
            out[y] = out.get(y, 0) + val
    return out


def split_equal(total: dict[str, float], n: int) -> list[dict[str, float]]:
    if n <= 0:
        return []
    return [{y: v / n for y, v in total.items()} for _ in range(n)]


def map_five_organ(old_organ: dict) -> dict[str, dict]:
    old_keys = sorted(old_organ.keys())
    out: dict[str, dict] = {}
    for ok, nn in zip(old_keys, BY_ORGAN):
        if is_year_obj(old_organ[ok]):
            out[nn] = {yk: float(old_organ[ok][yk]) for yk in old_organ[ok] if YEAR_RE.match(yk)}
        else:
            out[nn] = sum_leaf_years(old_organ[ok])
    return out


def build_application(old_app: dict) -> dict:
    total = sum_leaf_years(old_app)
    p_share = 3.0 / 5.0
    s_share = 2.0 / 5.0
    p_total = {y: v * p_share for y, v in total.items()}
    s_total = {y: v * s_share for y, v in total.items()}
    p_parts = split_equal(p_total, 3)
    s_parts = split_equal(s_total, 2)
    return {
        "By Propulsion Type": {APP_PROP[i]: p_parts[i] for i in range(3)},
        "By Sales Channel": {APP_SALES[i]: s_parts[i] for i in range(2)},
    }


def build_end_user(old_eu: dict) -> dict:
    keys = sorted(old_eu.keys())
    if len(keys) != 4:
        t = sum_leaf_years(old_eu)
        parts = split_equal(t, 4)
        return {
            "Passenger Cars": parts[0],
            "Commercial Vehicles": {
                "Light Commercial Vehicles": parts[1],
                "Heavy Commercial Vehicles": parts[2],
            },
            "Two-Wheelers": parts[3],
        }
    series: list[dict[str, float]] = []
    for k in keys:
        if is_year_obj(old_eu[k]):
            series.append(
                {yk: float(old_eu[k][yk]) for yk in old_eu[k] if YEAR_RE.match(yk)}
            )
        else:
            series.append(sum_leaf_years(old_eu[k]))
    return {
        "Passenger Cars": series[0],
        "Commercial Vehicles": {
            "Light Commercial Vehicles": series[1],
            "Heavy Commercial Vehicles": series[2],
        },
        "Two-Wheelers": series[3],
    }


def transform_geo_block(block: dict, as_int: bool) -> dict:
    if not isinstance(block, dict):
        return block
    out: dict = {}
    for k, v in block.items():
        if k not in SEG_FOUR_IN:
            out[k] = deepcopy(v)
            continue
        if not isinstance(v, dict):
            out[k] = v
            continue
        if k == "By Type":
            total = sum_leaf_years(v)
            # Differing shares (not equal thirds) — see diversify_by_system_type.py
            w = (0.26, 0.35, 0.39)
            s = sum(w)
            w = tuple(x / s for x in w)
            out[SEG_OUT_SYSTEM] = {BY_TYPE[i]: {y: total[y] * w[i] for y in total} for i in range(3)}
        elif k == "By Organ Type":
            if len(v.keys()) == 5:
                out[SEG_OUT_KEY_FORM] = map_five_organ(v)
            else:
                total = sum_leaf_years(v)
                parts = split_equal(total, 5)
                out[SEG_OUT_KEY_FORM] = {BY_ORGAN[i]: parts[i] for i in range(5)}
        elif k == "Application / Use Case":
            app = build_application(v)
            out[SEG_OUT_PROP] = app["By Propulsion Type"]
            out[SEG_OUT_SALES] = app["By Sales Channel"]
        elif k == "By End User":
            out[SEG_OUT_VEHICLE] = build_end_user(v)
    return round_years_if_needed(out, as_int)


def round_years_if_needed(node, as_int: bool):
    if isinstance(node, dict):
        if is_year_obj(node):
            if as_int:
                return {k: int(round(v)) for k, v in node.items() if YEAR_RE.match(k)}
            return {k: round(v, 4) for k, v in node.items() if YEAR_RE.match(k)}
        return {k: round_years_if_needed(v, as_int) for k, v in node.items()}
    return node


def main() -> None:
    seg_path = DATA / "segmentation_analysis.json"
    by_region = json.loads(seg_path.read_text(encoding="utf-8"))["Global"]["By Region"]

    for name, as_int in (("value.json", False), ("volume.json", True)):
        path = DATA / name
        data = json.loads(path.read_text(encoding="utf-8"))
        new_data: dict = {}
        for geo, gdata in data.items():
            if isinstance(gdata, dict) and "By Type" in gdata:
                new_data[geo] = transform_geo_block(gdata, as_int)
            elif isinstance(gdata, dict) and SEG_OUT_SYSTEM in gdata:
                new_data[geo] = gdata
            else:
                new_data[geo] = gdata
        path.write_text(json.dumps(new_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {path}")

    struct = {
        "Global": {
            SEG_OUT_SYSTEM: {x: {} for x in BY_TYPE},
            SEG_OUT_KEY_FORM: {x: {} for x in BY_ORGAN},
            SEG_OUT_PROP: {x: {} for x in APP_PROP},
            SEG_OUT_SALES: {x: {} for x in APP_SALES},
            SEG_OUT_VEHICLE: {
                "Passenger Cars": {},
                "Commercial Vehicles": {
                    "Light Commercial Vehicles": {},
                    "Heavy Commercial Vehicles": {},
                },
                "Two-Wheelers": {},
            },
            "By Region": by_region,
        }
    }
    seg_path.write_text(json.dumps(struct, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {seg_path}")


if __name__ == "__main__":
    main()
