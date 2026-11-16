import { createContext, useContext, type ReactNode } from 'react'
import { useGame } from '../state/game'
import type { WorldDef } from './types'

export const WorldCtx = createContext<WorldDef | null>(null)
export const useWorld = () => useContext(WorldCtx)!

/** Puzzle controls card, bottom-left. */
export function Dock({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card dock" aria-label="Puzzle controls">
      {title && <h3>{title}</h3>}
      {children}
    </section>
  )
}

/** The Lens: the real numbers beneath the metaphor. */
export function LensPanel({ title, children }: { title: string; children: ReactNode }) {
  const world = useWorld()
  const engineer = useGame((s) => s.mode === 'engineer')
  return (
    <aside className="card lens" aria-label={'Lens: ' + title} aria-live="polite">
      <h3>
        <span aria-hidden>🔍</span> Lens · {title}
      </h3>
      {children}
      {engineer && world && (
        <div style={{ marginTop: 14 }}>
          <span className="pill">DEEP DIVE</span>
          <p className="mono" style={{ fontSize: '.8em', whiteSpace: 'pre-wrap' }}>
            {world.deepDive}
          </p>
        </div>
      )}
    </aside>
  )
}

export function Bar({ value, color, label }: { value: number; color: string; label?: string }) {
  return (
    <div className="bar" role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

export function Heatmap({ rows, cols, m, color = '245,166,35' }: { rows: string[]; cols: string[]; m: number[][]; color?: string }) {
  return (
    <div>
      <div className="heat" style={{ gridTemplateColumns: `70px repeat(${cols.length}, 1fr)` }}>
        <span />
        {cols.map((c, i) => (
          <span key={i} style={{ textAlign: 'center', overflow: 'hidden' }}>
            {c}
          </span>
        ))}
        {rows.map((r, i) => (
          <Row key={i} label={r} vals={m[i]} color={color} showValues={cols.length <= 8} />
        ))}
      </div>
    </div>
  )
}
function Row({ label, vals, color, showValues }: { label: string; vals: number[]; color: string; showValues: boolean }) {
  return (
    <>
      <span style={{ alignSelf: 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>{label}</span>
      {vals.map((v, j) => (
        <div key={j} title={v.toFixed(3)} style={{ background: `rgba(${color},${0.08 + v * 0.92})`, color: v > 0.5 ? '#fff' : '#2b2420' }}>
          {showValues ? v.toFixed(2) : ''}
        </div>
      ))}
    </>
  )
}

export function softmax(xs: number[], T = 1) {
  const m = Math.max(...xs.map((x) => x / T))
  const e = xs.map((x) => Math.exp(x / T - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / s)
}

export const fmt = (x: number, d = 2) => (x >= 0 ? ' ' : '') + x.toFixed(d)
