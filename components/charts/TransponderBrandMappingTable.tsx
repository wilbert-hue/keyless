'use client'

import { useEffect, useState } from 'react'

type Row = Record<string, string | number | null | undefined>

interface Payload {
  title: string
  subtitle?: string
  columns: string[]
  rows: Row[]
}

const MAKE_COL = 'Make'

function makeRowSpan(rows: Row[], startIndex: number): number {
  const m = String(rows[startIndex][MAKE_COL] ?? '')
  let c = 0
  for (let j = startIndex; j < rows.length && String(rows[j][MAKE_COL] ?? '') === m; j++) {
    c += 1
  }
  return c
}

export function TransponderBrandMappingTable() {
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = true
    fetch('/data/transponder_brand_mapping.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load make-model-year-tech table (${r.status})`)
        return r.json()
      })
      .then((d: Payload) => {
        if (c) setData(d)
      })
      .catch((e: Error) => {
        if (c) setErr(e.message)
      })
    return () => {
      c = false
    }
  }, [])

  if (err) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{err}</div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading make-model-year-tech mapping table…
      </div>
    )
  }

  const dataCols = data.columns.filter((col) => col !== MAKE_COL)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-200/80 bg-gradient-to-br from-sky-50/90 to-cyan-50/60 px-4 py-3 sm:px-5">
        <h2 className="text-center text-base font-bold uppercase leading-snug tracking-tight text-[#0c4a6e] sm:text-lg">
          {data.title}
        </h2>
        {data.subtitle && <p className="mt-2 text-center text-sm text-cyan-900/80">{data.subtitle}</p>}
      </div>

      <div className="max-h-[min(75vh,800px)] overflow-auto rounded-lg border-2 border-white bg-white p-0.5 shadow-inner ring-1 ring-slate-200/80">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {data.columns.map((col, i) => (
                <th
                  key={col}
                  scope="col"
                  className={`min-w-[5.5rem] border border-white px-2 py-3 text-center text-[0.65rem] font-bold uppercase leading-tight text-white sm:text-xs ${
                    i === 0 ? 'bg-[#215981]' : 'bg-[#2a75a9]'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const showMake = ri === 0 || String(data.rows[ri - 1][MAKE_COL] ?? '') !== String(row[MAKE_COL] ?? '')
              const rowSpan = showMake ? makeRowSpan(data.rows, ri) : 0
              const zebra = ri % 2 === 0 ? 'bg-white' : 'bg-[#eef4f9]'

              return (
                <tr key={ri}>
                  {showMake && (
                    <td
                      rowSpan={rowSpan}
                      className="border border-white bg-[#215981] px-2 py-2.5 text-center align-middle text-xs font-bold text-white"
                    >
                      {String(row[MAKE_COL] ?? '—')}
                    </td>
                  )}
                  {dataCols.map((col) => {
                    const v = row[col]
                    const isLong = col.includes('Transponder') || col.includes('OEM') || col.includes('Programming') || col.includes('Key System')
                    return (
                      <td
                        key={col}
                        className={`border border-white px-2 py-2.5 text-xs text-slate-900 ${zebra} ${
                          isLong ? 'text-left align-top leading-relaxed' : 'text-center align-middle'
                        }`}
                      >
                        {v === '' || v == null ? <span className="text-slate-400">—</span> : String(v)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
