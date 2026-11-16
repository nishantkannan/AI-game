import { useState } from 'react'
import { sfx } from '../engine/audio'
import { echoMood } from '../engine/Stage'
import { useGame } from '../state/game'
import type { WorldDef } from './types'

export function Debrief({ world }: { world: WorldDef }) {
  const g = useGame()
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [stage, setStage] = useState<'quiz' | 'card'>('quiz')
  const [copied, setCopied] = useState(false)
  const q = world.quiz[qi]

  const pick = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer) {
      setScore((s) => s + 1)
      sfx.good()
      echoMood('happy')
    } else {
      sfx.bad()
      echoMood('confused')
    }
  }
  const next = () => {
    if (qi + 1 < world.quiz.length) {
      setQi(qi + 1)
      setPicked(null)
    } else {
      setStage('card')
      g.unlockCard('w' + world.id)
      sfx.star()
    }
  }
  const finish = () => {
    g.completeWorld(world.id, score)
    sfx.whoosh()
    g.go(world.id === 8 ? 'ending' : 'map')
  }
  const share = async () => {
    const text = `I just finished “${world.name}” in Neural Quest! ${world.concept}: ${world.explainBack}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      g.toast('Could not copy. Your browser blocked the clipboard.', 'bad')
    }
  }

  return (
    <div className="overlay" style={{ background: 'rgba(43,36,32,.2)' }}>
      {stage === 'quiz' ? (
        <div className="card modal" role="dialog" aria-label="Debrief quiz">
          <span className="pill">
            DEBRIEF · {qi + 1}/{world.quiz.length}
          </span>
          <h2 style={{ margin: '12px 0 4px' }}>{q.q}</h2>
          {q.options.map((o, i) => (
            <button
              key={i}
              className={'btn quiz-opt' + (picked !== null && i === q.answer ? ' right' : '') + (picked === i && i !== q.answer ? ' wrong' : '')}
              onClick={() => pick(i)}
              disabled={picked !== null && i !== q.answer && i !== picked}
            >
              {picked !== null && i === q.answer ? '✓ ' : picked === i ? '✗ ' : ''}
              {o}
            </button>
          ))}
          {picked !== null && (
            <>
              <p className="muted" role="status">
                {q.why}
              </p>
              <button className="btn btn-yellow" autoFocus onClick={next}>
                {qi + 1 < world.quiz.length ? 'Next question ▶' : 'Reveal Codex card ▶'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card modal reveal" role="dialog" aria-label="Codex card" style={{ textAlign: 'center' }}>
          <span className="pill">CODEX CARD UNLOCKED</span>
          <h1 className="headline" style={{ margin: '12px 0 4px', color: 'var(--token)' }}>
            {world.card.term}
          </h1>
          <p style={{ fontSize: '1.05em' }}>{world.card.def}</p>
          <div className="card cream" style={{ textAlign: 'left', margin: '14px 0' }}>
            <div className="muted" style={{ fontSize: '.8em', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Explain it back
            </div>
            <p style={{ margin: '6px 0 0' }}>
              “{world.oneLiner}” In tech terms: <b>{world.techTerm}</b>. {world.explainBack}
            </p>
          </div>
          <p className="muted" style={{ fontSize: '.85em' }}>
            What this metaphor leaves out: {world.card.leavesOut}
          </p>
          <p>
            Quiz: <b className="mono">{score}/{world.quiz.length}</b>
          </p>
          <div className="menu-row">
            <button className="btn" onClick={share}>
              {copied ? '✓ Copied!' : '↗ Share'}
            </button>
            <button className="btn btn-yellow" autoFocus onClick={finish}>
              {world.id === 8 ? 'Deliver the answer ▶' : 'Up to the next floor ▶'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
