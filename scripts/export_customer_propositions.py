"""Export Proposition 1/2/3 sheets from the sample xlsx to public JSON (incl. group header row)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX = (
    ROOT
    / "Sample Framework_Customer Database_Global Automotive Keyless Entry, Immobilizer, and Transponder Market.xlsx"
)
OUT = ROOT / "public" / "data" / "customer_propositions.json"

SHEETS = [
    ("Proposition 1 - Basic", "Proposition 1", "Basic customer directory and contact profile."),
    ("Proposition 2 - Advance", "Proposition 2", "Adds vehicle access & security system buying drivers."),
    ("Proposition 3 - Premium", "Proposition 3", "Full framework including purchasing, solution requirements, and CMI insights."),
]


def clean_val(v) -> str | int | float | None:
    if pd.isna(v):
        return ""
    if isinstance(v, (int, float)) and v == int(v) and not isinstance(v, bool):
        return int(v)
    return str(v).strip() if isinstance(v, str) else v


def forward_fill_groups(row4: list) -> list[str | None]:
    out: list[str | None] = []
    cur: str | None = None
    for v in row4:
        if v is not None and not (isinstance(v, float) and np.isnan(v)) and str(v).strip():
            cur = str(v).strip()
        out.append(cur)
    return out


def merged_header_groups(filled: list[str | None]) -> list[dict[str, int | str]]:
    filled2 = [x or "—" for x in filled]
    segments: list[dict[str, int | str]] = []
    i = 0
    n = len(filled2)
    while i < n:
        g = filled2[i]
        j = i + 1
        while j < n and filled2[j] == g:
            j += 1
        segments.append({"label": g, "span": j - i})
        i = j
    return segments


def sub_headers_from_row5(row5: list, n: int) -> list[str]:
    sub: list[str] = []
    for j in range(n):
        v = row5[j] if j < len(row5) else None
        if j == 0 and (v is None or (isinstance(v, float) and np.isnan(v))):
            sub.append("S.No.")
        elif v is None or (isinstance(v, float) and np.isnan(v)):
            sub.append(f"Column_{j}")
        else:
            sub.append(str(v).strip())
    return sub


def main() -> None:
    if not XLSX.exists():
        raise SystemExit(f"Missing: {XLSX}")

    book_title = "Global Automotive Keyless Entry, Immobilizer, and Transponder Market - Customer Database"
    propositions: list[dict] = []

    for sheet_name, short_name, blurb in SHEETS:
        raw = pd.read_excel(XLSX, sheet_name=sheet_name, header=None)
        n = raw.shape[1]
        row4 = [raw.iloc[4, j] for j in range(n)]
        row5 = [raw.iloc[5, j] for j in range(n)]

        filled = forward_fill_groups(row4)
        header_groups = merged_header_groups(filled)
        columns = sub_headers_from_row5(row5, n)

        records: list[dict] = []
        for ridx in range(6, len(raw)):
            row = [raw.iloc[ridx, j] for j in range(n)]
            if all(
                (x is None or (isinstance(x, float) and np.isnan(x)) or str(x).strip() == "")
                for x in row
            ):
                continue
            rec = {columns[j]: clean_val(row[j]) for j in range(n)}
            if all(v == "" or v is None for v in rec.values()):
                continue
            records.append(rec)

        propositions.append(
            {
                "id": short_name.split()[-1],
                "name": short_name,
                "sheet": sheet_name,
                "description": blurb,
                "headerGroups": header_groups,
                "columns": columns,
                "rows": records,
            }
        )

    payload = {
        "title": book_title,
        "verifiedNote": "Verified directory and insight on customers (framework sample).",
        "propositions": propositions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
