import { useState } from 'react'
import { useGame } from '../state/game'
import { ALL_CARDS, FLOORS } from '../worlds'

export function CodexGrid() {
  const owned = useGame((s) => s.codex)
  const [open, setOpen] = useState<string | null>(null)
  const card = ALL_CARDS.find((c) => c.id === open)
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {owned.length} / {ALL_CARDS.length} cards collected
      </p>
      <div className="codex-grid">
        {ALL_CARDS.map((c) => {
          const has = owned.includes(c.id)
          const floor = FLOORS[c.world - 1]
          return (
            <button
              key={c.id}
              className={'card codex-card' + (has ? '' : ' locked')}
              style={has ? { borderTop: `10px solid ${floor.color}` } : undefined}
              onClick={() => has && setOpen(c.id)}
              aria-label={has ? c.term : 'Locked card'}
              disabled={!has}
            >
              <span className="pill" style={{ alignSelf: 'flex-start', background: has ? floor.color : undefined }}>
                {c.id === 'w' + c.world ? 'WORLD' : 'CONCEPT'} · {c.world}
              </span>
              <span className="term">{has ? c.term : '? ? ?'}</span>
              <span className="def">{has ? c.def : 'Solve puzzles to unlock this card.'}</span>
            </button>
          )
        })}
      </div>
      {card && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <div className="card modal reveal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={card.term}>
            <span className="pill" style={{ background: FLOORS[card.world - 1].color }}>
              {FLOORS[card.world - 1].name}
            </span>
            <h2 style={{ fontSize: '2em', margin: '10px 0' }}>{card.term}</h2>
            <p style={{ fontSize: '1.1em' }}>{card.def}</p>
            <div className="card cream">
              <b>What this metaphor leaves out</b>
              <p className="muted" style={{ marginBottom: 0 }}>
                {card.leavesOut}
              </p>
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn btn-yellow" autoFocus onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function CodexScreen() {
  const back = useGame((s) => s.back)
  return (
    <div className="scroll-page">
      <div className="page-inner">
        <div className="page-head">
          <button className="btn" onClick={back}>
            ◀ Back
          </button>
          <h1 className="headline">📖 The Codex</h1>
        </div>
        <CodexGrid />
      </div>
    </div>
  )
}
