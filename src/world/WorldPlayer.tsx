import { useCallback, useEffect, useState } from 'react'
import { Echo, Island, T3D, echoMood, useCameraRig } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { formatParams, paramsFromStars, totalStars, useGame } from '../state/game'
import { STORY_PROMPT, WORLDS } from '../worlds'
import { WorldCtx } from './kit'
import { Debrief } from './Debrief'
import { CodexGrid } from '../screens/Codex'

type Phase = 'arrive' | 'play' | 'debrief'

export function WorldPlayer() {
  const id = useGame((s) => s.currentWorld)
  const world = WORLDS[id - 1]
  const g = useGame()
  const [phase, setPhase] = useState<Phase>('arrive')
  const [pi, setPi] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [hint, setHint] = useState(0)
  const [lens, setLens] = useState(false)
  const [solved, setSolved] = useState(false)
  const [earned, setEarned] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [paused, setPaused] = useState(false)
  const [codexOpen, setCodexOpen] = useState(false)
  const puzzle = world.puzzles[pi]
  const timed = g.mode === 'engineer' && !!puzzle.timeLimit && phase === 'play'
  const [time, setTime] = useState(puzzle.timeLimit ?? 0)

  const baseCam = puzzle.camera ?? world.camera ?? { pos: [0, 7, 13] as [number, number, number], target: [0, 1, 0] as [number, number, number] }
  // Shift the view left a little so the action sits to the right of the controls dock.
  const SHIFT = -1.3
  const cam = {
    pos: [baseCam.pos[0] + SHIFT, baseCam.pos[1], baseCam.pos[2]] as [number, number, number],
    target: [baseCam.target[0] + SHIFT, baseCam.target[1], baseCam.target[2]] as [number, number, number],
  }
  const from: [number, number, number] = [cam.pos[0] * 2.4 + 8, cam.pos[1] * 3 + 10, cam.pos[2] * 2.4]
  useCameraRig(cam.pos, cam.target, { from: phase === 'arrive' ? from : undefined, key: phase + pi + id })

  // timer (Engineer mode only)
  useEffect(() => {
    setTime(puzzle.timeLimit ?? 0)
  }, [pi, runKey, puzzle.timeLimit])
  useEffect(() => {
    if (!timed || solved || paused) return
    const t = setInterval(() => setTime((x) => x - 1), 1000)
    return () => clearInterval(t)
  }, [timed, solved, paused])
  useEffect(() => {
    if (timed && time <= 0 && !solved) {
      g.toast('⏱ Time’s up! The puzzle resets.', 'bad')
      setRunKey((k) => k + 1)
      setWrong(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time])

  const onSolve = useCallback(() => {
    const stars = hint === 0 && wrong <= 1 ? 3 : hint <= 1 && wrong <= 3 ? 2 : 1
    setEarned(stars)
    setSolved(true)
    g.awardStars(puzzle.id, stars)
    g.unlockCard(puzzle.id)
    sfx.star()
    echoMood('happy', 2500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint, wrong, puzzle.id])

  const onWrong = useCallback(
    (msg?: string) => {
      setWrong((w) => {
        const n = w + 1
        if (n === 2 && hint === 0) setTimeout(() => g.toast('Stuck? Press H for a hint from Echo.', 'info'), 600)
        return n
      })
      sfx.bad()
      echoMood('confused')
      g.toast(msg ?? 'Not quite — try again!', 'bad')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hint],
  )

  const nextPuzzle = () => {
    sfx.whoosh()
    if (pi + 1 < world.puzzles.length) {
      setPi(pi + 1)
      setWrong(0)
      setHint(0)
      setSolved(false)
      setLens(false)
      setRunKey((k) => k + 1)
    } else {
      setLens(false)
      setPhase('debrief')
    }
  }

  const askHint = () => {
    if (phase !== 'play' || solved) return
    sfx.select()
    setHint((h) => Math.min(3, h + 1))
    echoMood('thinking', 1200)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const k = e.key.toLowerCase()
      if (k === 'escape') setPaused((p) => !p)
      if (phase !== 'play') return
      if (k === 'l') setLens((x) => !x)
      if (k === 'h') askHint()
      if (k === 'c') setCodexOpen((x) => !x)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (import.meta.env.DEV) {
    ;(window as unknown as { __nq: object }).__nq = {
      solve: onSolve,
      next: nextPuzzle,
      begin: () => setPhase('play'),
      goto: (i: number) => {
        setPhase('play')
        setPi(i)
        setSolved(false)
        setHint(0)
        setRunKey((k) => k + 1)
      },
    }
  }

  const stars = totalStars(g.puzzleStars)
  const progress = (id - 1 + (phase === 'debrief' ? 1 : pi / world.puzzles.length)) / WORLDS.length
  const lit = Math.max(1, Math.round(STORY_PROMPT.length * progress))
  const lowTime = timed && time <= (puzzle.timeLimit ?? 0) * 0.25
  const P = puzzle.Component

  return (
    <WorldCtx.Provider value={world}>
      <T3D.In>
        <Island {...world.island} />
        <Echo position={[-6.5, 2.8, -1.5]} />
      </T3D.In>

      {phase === 'arrive' && (
        <div className="center-stack" style={{ background: 'rgba(255,255,255,.05)' }}>
          <div className="banner">
            <div className="card" style={{ padding: '22px 34px' }}>
              <div className="kicker">
                Floor {world.id} · {world.concept}
              </div>
              <h1 className="headline" style={{ margin: '6px 0' }}>
                {world.name}
              </h1>
              <p style={{ fontSize: '1.3em', margin: '4px 0 16px' }}>“{world.oneLiner}”</p>
              <button className="btn btn-yellow btn-big" autoFocus onClick={() => (sfx.whoosh(), setPhase('play'))}>
                Begin ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'play' && (
        <>
          <P key={pi + '-' + runKey} onSolve={onSolve} onWrong={onWrong} hintLevel={hint} lensOpen={lens} solved={solved} />

          <div className="hud-tl">
            <header className="card objective" aria-live="polite">
              <div className="world-name">
                {world.id}. {world.name} · {puzzle.boss ? 'BOSS' : `Puzzle ${pi + 1}/${world.puzzles.length}`}
              </div>
              <div className="obj-text">{puzzle.objective}</div>
            </header>
            {hint > 0 && !solved && (
              <div className="card hint-card" role="status">
                <span className="pill">ECHO · HINT {hint}/3</span>
                <p style={{ margin: '8px 0 0' }}>{puzzle.hints[hint - 1]}</p>
              </div>
            )}
          </div>

          {solved && (
            <div
              className="overlay"
              style={{
                background: 'transparent',
                backdropFilter: 'none',
                pointerEvents: 'none',
                placeItems: lens ? 'start' : 'center',
                paddingTop: lens ? 130 : 16,
              }}
            >
              <div className="card modal banner" style={{ width: 'min(420px,100%)', textAlign: 'center', pointerEvents: 'auto', marginTop: lens ? 0 : '-18vh' }}>
                <div className="kicker">Solved!</div>
                <div className="stars" style={{ fontSize: 46 }} aria-label={`${earned} of 3 stars`}>
                  {'★'.repeat(earned)}
                  <span style={{ opacity: 0.25 }}>{'★'.repeat(3 - earned)}</span>
                </div>
                <p style={{ margin: '4px 0 12px' }}>
                  Codex card unlocked: <b>{puzzle.card.term}</b>
                </p>
                <div className="menu-row">
                  <button className="btn" onClick={() => setLens((x) => !x)}>
                    {lens ? 'Hide' : 'Inspect with'} Lens <span className="kbd">L</span>
                  </button>
                  <button className="btn btn-yellow" autoFocus onClick={nextPuzzle}>
                    {pi + 1 < world.puzzles.length ? 'Next puzzle ▶' : 'Debrief ▶'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="hud-tr">
            <div className="card stat" title="Parameters: your model grows as you earn stars">
              <span className="stars">★</span>
              <span className="mono">{stars}</span>
              <span className="muted">·</span>
              <span className="mono">{formatParams(paramsFromStars(stars))}</span>
              <span className="muted" style={{ fontSize: '.8em' }}>
                params
              </span>
            </div>
            {timed && (
              <div className="card stat" style={{ background: lowTime ? '#ffe1de' : undefined }} aria-label="time left">
                ⏱ <span className="mono">{Math.max(0, time)}s</span>
              </div>
            )}
            <button className="btn btn-icon" aria-label="Pause" onClick={() => setPaused(true)}>
              ❚❚
            </button>
          </div>

          <div className="hud-bc">
            <div className="card tray" aria-label="Context tray: the user's prompt">
              <span className="tray-label">CONTEXT TRAY</span>
              {STORY_PROMPT.map((t, i) => (
                <span key={i} className={'chip ' + (i < lit ? (lowTime ? 'hot' : 'lit') : '')}>
                  {t.trim()}
                </span>
              ))}
            </div>
          </div>

          <div className="hud-br">
            <button className={'btn' + (lens ? ' selected' : '')} onClick={() => setLens((x) => !x)} aria-pressed={lens}>
              🔍 Lens <span className="kbd">L</span>
            </button>
            <button className="btn" onClick={askHint} disabled={solved || hint >= 3}>
              💡 Hint <span className="kbd">H</span>
            </button>
            <button className="btn" onClick={() => setCodexOpen(true)}>
              📖 Codex <span className="kbd">C</span>
            </button>
          </div>
        </>
      )}

      {phase === 'debrief' && <Debrief world={world} />}

      {codexOpen && (
        <div className="overlay" onClick={() => setCodexOpen(false)}>
          <div className="card modal" style={{ width: 'min(920px,100%)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Codex">
            <div className="page-head">
              <h2 style={{ margin: 0 }}>📖 Codex</h2>
              <span style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => setCodexOpen(false)}>
                Close <span className="kbd">C</span>
              </button>
            </div>
            <CodexGrid />
          </div>
        </div>
      )}

      {paused && (
        <div className="overlay">
          <div className="card modal" style={{ width: 'min(360px,100%)', textAlign: 'center' }} role="dialog" aria-label="Paused">
            <h2>Paused</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <button className="btn btn-yellow" autoFocus onClick={() => setPaused(false)}>
                Resume
              </button>
              <button
                className="btn"
                onClick={() => {
                  setPaused(false)
                  setSolved(false)
                  setHint(0)
                  setWrong(0)
                  setRunKey((k) => k + 1)
                }}
              >
                Restart puzzle
              </button>
              <button className="btn" onClick={() => g.go('map')}>
                World map
              </button>
              <button className="btn" onClick={() => g.go('title')}>
                Title screen
              </button>
              <div className="seg" style={{ justifySelf: 'center' }}>
                <button className={g.sound ? 'on' : ''} onClick={() => g.set({ sound: !g.sound })}>
                  Sound {g.sound ? 'on' : 'off'}
                </button>
                <button className={g.reducedMotion ? 'on' : ''} onClick={() => g.set({ reducedMotion: !g.reducedMotion })}>
                  Reduce motion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorldCtx.Provider>
  )
}
