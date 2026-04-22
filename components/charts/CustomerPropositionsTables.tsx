'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type PropRow = Record<string, string | number | null | undefined>

type HeaderGroup = { label: string; span: number }

function headerGroupRowClass(label: string): string {
  const base =
    'px-2.5 py-2 text-center text-[0.65rem] font-bold uppercase leading-tight tracking-wide text-slate-800 shadow-sm sm:text-xs sm:px-3 sm:py-2.5'
  if (label.trim() === 'S.No.' || /^S\.?No\.?$/i.test(label.trim())) {
    return `${base} border-b-2 border-slate-300/60 bg-slate-200/90 text-slate-800`
  }
  if (label === 'Customer Information') {
    return `${base} border-b-2 border-amber-300/50 bg-[#fed7c8] text-amber-950/90`
  }
  if (label === 'Contact Details') {
    return `${base} border-b-2 border-sky-300/50 bg-sky-200/90 text-sky-950/90`
  }
  if (label.includes('Vehicle Access')) {
    return `${base} border-b-2 border-violet-300/50 bg-violet-200/85 text-violet-950/90`
  }
  if (label.includes('Purchasing')) {
    return `${base} border-b-2 border-indigo-300/50 bg-indigo-200/85 text-indigo-950/90`
  }
  if (label.includes('Solution Requirements')) {
    return `${base} border-b-2 border-teal-300/50 bg-teal-200/80 text-teal-950/90`
  }
  if (label.includes('CMI')) {
    return `${base} border-b-2 border-rose-300/50 bg-rose-200/80 text-rose-950/90`
  }
  return `${base} border-b-2 border-slate-300/60 bg-slate-200/90 text-slate-800`
}

export interface CustomerPropositionsPayload {
  title: string
  verifiedNote: string
  propositions: {
    id: string
    name: string
    sheet: string
    description: string
    /** Merged top row from Excel: section titles spanning column groups */
    headerGroups?: HeaderGroup[]
    columns: string[]
    rows: PropRow[]
  }[]
}

export function CustomerPropositionsTables() {
  const [data, setData] = useState<CustomerPropositionsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let c = true
    fetch('/data/customer_propositions.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load customer proposition data (${r.status})`)
        return r.json()
      })
      .then((d: CustomerPropositionsPayload) => {
        if (c) {
          setData(d)
          setExpanded(new Set(d.propositions.map((p) => p.sheet)))
        }
      })
      .catch((e: Error) => {
        if (c) setErr(e.message)
      })
    return () => {
      c = false
    }
  }, [])

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }, [])

  if (err) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {err}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading customer intelligence tables…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/90 via-sky-50/60 to-indigo-50/80 p-4 sm:p-5 shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">
          {data.title}
        </h2>
        <p className="mt-1.5 text-sm text-cyan-900/80">{data.verifiedNote}</p>
      </div>

      <div className="space-y-3">
        {data.propositions.map((p) => {
          const isOpen = expanded.has(p.sheet)
          const levelLabel = p.sheet.replace(/^Proposition \d+ - /, '')
          const groupSpan = p.headerGroups?.reduce((acc, g) => acc + g.span, 0) ?? 0
          const hasHeaderGroups = Boolean(
            p.headerGroups?.length && groupSpan > 0 && groupSpan === p.columns.length
          )
          return (
            <div
              key={p.sheet}
              className="overflow-hidden rounded-xl border border-cyan-200/70 bg-white shadow-md shadow-cyan-900/5"
            >
              <button
                type="button"
                onClick={() => toggle(p.sheet)}
                className="flex w-full items-start gap-3 bg-gradient-to-r from-[#0f6ba8] via-[#1a8f9e] to-[#1f9d8a] px-4 py-3.5 text-left text-white transition hover:from-[#0d5f95] hover:via-[#178090] hover:to-[#1b8a78] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2"
                aria-expanded={isOpen}
              >
                <ChevronDown
                  className={`mt-0.5 h-5 w-5 shrink-0 text-cyan-100 transition-transform ${
                    isOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold sm:text-lg">
                    {p.name} — {levelLabel}
                  </div>
                  <p className="mt-0.5 text-sm text-cyan-50/95">{p.description}</p>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-cyan-100/80 bg-slate-50/40 p-1 sm:p-2">
                  <div className="max-h-[min(70vh,720px)] overflow-auto rounded-lg border border-slate-200/80 bg-white shadow-inner">
                    <table className="w-full min-w-[640px] border-collapse text-left text-slate-800">
                      <thead className="sticky top-0 z-10">
                        {hasHeaderGroups && (
                          <tr>
                            {p.headerGroups!.map((g, gi) => (
                              <th
                                key={`${g.label}-${gi}`}
                                colSpan={g.span}
                                scope="colgroup"
                                className={`${headerGroupRowClass(g.label)} ${gi === 0 ? 'rounded-tl-lg' : ''} ${
                                  gi === p.headerGroups!.length - 1 ? 'rounded-tr-lg' : ''
                                }`}
                              >
                                {g.label}
                              </th>
                            ))}
                          </tr>
                        )}
                        <tr>
                          {p.columns.map((col, ci) => (
                            <th
                              key={col}
                              scope="col"
                              className={`min-w-[11rem] max-w-[18rem] border-b-2 border-cyan-500/50 bg-gradient-to-b from-slate-100 to-slate-200/90 px-2.5 py-2.5 text-center text-[0.7rem] font-semibold leading-snug text-slate-800 shadow-sm sm:text-xs sm:px-3 ${
                                !hasHeaderGroups && ci === 0 ? 'first:rounded-tl-lg' : ''
                              } ${
                                !hasHeaderGroups && ci === p.columns.length - 1
                                  ? 'last:rounded-tr-lg'
                                  : ''
                              }`}
                            >
                              <span className="block break-words text-slate-800">{col}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.rows.map((row, ri) => (
                          <tr
                            key={ri}
                            className={
                              ri % 2 === 0
                                ? 'bg-white hover:bg-cyan-50/50'
                                : 'bg-cyan-50/35 hover:bg-cyan-50/70'
                            }
                          >
                            {p.columns.map((col) => (
                              <td
                                key={col}
                                className="max-w-[18rem] border-b border-slate-200/70 px-2.5 py-2 align-top text-[0.7rem] leading-relaxed sm:px-3 sm:text-xs"
                              >
                                {row[col] === '' || row[col] == null ? (
                                  <span className="text-slate-300">—</span>
                                ) : (
                                  <span className="break-words text-slate-700">
                                    {String(row[col])}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
