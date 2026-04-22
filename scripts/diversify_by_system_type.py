"""
Reallocate 'By System Type' series so the three sub-segments are not identical.
Preserves each (geography, year) total across the three systems.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"

YEAR_RE = re.compile(r"^20\d{2}$")
SEG_KEY = "By System Type"
# Plausible market mix: immobilizer base (older tech), RKE mid, PKE growing share
NAMES = [
    "Immobilizer System",
    "Remote Keyless Entry System",
    "Passive Keyless Entry and Start System",
]
# Weights at start / end of forecast to simulate mix shift (PKE gains over time)
W_START = (0.26, 0.35, 0.39)
W_END = (0.20, 0.33, 0.47)


def lerp3(t: float) -> tuple[float, float, float]:
    t = min(1.0, max(0.0, t))
    a = tuple(a0 + (a1 - a0) * t for a0, a1 in zip(W_START, W_END))
    s = sum(a)
    return tuple(x / s for x in a)


def int_split(total: int, w: tuple[float, float, float]) -> tuple[int, int, int]:
    """Split integer total by weights, preserving sum exactly (largest remainder)."""
    exact = [total * w[i] for i in range(3)]
    floors = [int(e) for e in exact]
    remainders = [exact[i] - floors[i] for i in range(3)]
    rem = total - sum(floors)
    order = sorted(range(3), key=lambda i: -remainders[i])
    for k in range(rem):
        floors[order[k]] += 1
    return (floors[0], floors[1], floors[2])


def redistribute_block(by_sys: dict, as_int: bool) -> None:
    """Mutate in place: recompute all year values from per-year totals."""
    all_years: set[int] = set()
    for name in NAMES:
        for k, v in by_sys.get(name, {}).items():
            if YEAR_RE.match(k) and isinstance(v, (int, float)):
                all_years.add(int(k))
    if not all_years:
        return
    y_min, y_max = min(all_years), max(all_years)
    span = max(1, y_max - y_min)

    for y in sorted(all_years):
        yk = str(y)
        t = (y - y_min) / span
        w = lerp3(t)
        total = sum(
            float(by_sys[n][yk])
            for n in NAMES
            if yk in by_sys.get(n, {}) and isinstance(by_sys[n][yk], (int, float))
        )
        if total <= 0:
            continue
        if as_int:
            itot = int(round(total))
            if itot > 0:
                a, b, c = int_split(itot, w)
                for n, val in zip(NAMES, (a, b, c)):
                    if yk in by_sys.get(n, {}):
                        by_sys[n][yk] = val
        else:
            for i, n in enumerate(NAMES):
                if yk in by_sys.get(n, {}):
                    by_sys[n][yk] = round(total * w[i], 4)


def process_value_json(data: dict, as_int: bool) -> None:
    for geo, g in data.items():
        if not isinstance(g, dict) or SEG_KEY not in g:
            continue
        by_sys = g[SEG_KEY]
        if not all(n in by_sys for n in NAMES):
            continue
        redistribute_block(by_sys, as_int)


def main() -> None:
    for fname, as_int in (("value.json", False), ("volume.json", True)):
        p = DATA / fname
        data = json.loads(p.read_text(encoding="utf-8"))
        process_value_json(data, as_int)
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Updated {p}")


if __name__ == "__main__":
    main()
