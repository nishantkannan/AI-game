import { useState } from 'react'
import { Echo, Island, Spin, T3D, echoMood, useCameraRig } from '../engine/Stage'
import { Tower, TOWER_TOP } from '../engine/Tower'
import { sfx } from '../engine/audio'
import { formatParams, isUnlocked, paramsFromStars, totalStars, useGame } from '../state/game'
import { FLOORS, STORY_PROMPT, WORLDS } from '../worlds'

function worldStars(ps: Record<string, number>) {
  const out: Record<number, number> = {}
  WORLDS.forEach((w) => {
    const s = w.puzzles.reduce((a, p) => a + (ps[p.id] ?? 0), 0)
    out[w.id] = Math.round(s / w.puzzles.length)
  })
  return out
}

export function Credit({ inline = false }: { inline?: boolean }) {
  const go = useGame((s) => s.go)
  return (
    <div className={inline ? '' : 'footer-note'}>
      © Neural Quest · Built by <b>Nishant Kannan</b> ·{' '}
      <button onClick={() => go('credits')}>Credits</button>
    </div>
  )
}

/* ------------------------------- Title / hub ------------------------------- */
export function TitleScreen() {
  const g = useGame()
  useCameraRig([15, 5, 23], [0, 5.2, 0])
  const canContinue = g.started
  const start = () => {
    sfx.whoosh()
    g.newGame()
    g.go('intro')
  }
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <group position={[0, 0, 0]}>
          <Spin speed={0.15}>
            <Tower completed={g.completed} />
          </Spin>
        </group>
        <Echo position={[4.2, 3.2, 3.5]} scale={1.3} />
      </T3D.In>
      <div className="center-stack" style={{ justifyContent: 'space-between', padding: '5vh 16px 8vh' }}>
        <h1 className="mega-title" aria-label="Neural Quest">
          <span className="t1" style={{ ['--r' as string]: '-3deg' }}>
            Neural
          </span>{' '}
          <span className="t2" style={{ ['--r' as string]: '2deg' }}>
            Quest
          </span>
          <div style={{ fontSize: '.22em', marginTop: 14 }}>
            <span className="pill" style={{ fontSize: '1em', transform: 'none', WebkitTextStroke: 0, textShadow: 'none' }}>
              a 3D adventure inside a language model
            </span>
          </div>
        </h1>
        <nav style={{ display: 'grid', gap: 16, justifyItems: 'center' }} aria-label="Main menu">
          <div className="menu-grid">
            {canContinue ? (
              <button className="btn btn-yellow btn-big" autoFocus onClick={() => (sfx.whoosh(), g.go('map'))}>
                Continue
                <small>★ {totalStars(g.puzzleStars)} · {formatParams(paramsFromStars(totalStars(g.puzzleStars)))} params</small>
              </button>
            ) : null}
            <button className={'btn btn-big ' + (canContinue ? 'btn-orange' : 'btn-yellow')} autoFocus={!canContinue} onClick={start}>
              New Game
              <small>{canContinue ? 'start over from street level' : 'start here!'}</small>
            </button>
            {!canContinue && (
              <button
                className="btn btn-big btn-orange"
                onClick={() => {
                  g.set({ lessonMode: true, mode: 'explorer', started: true })
                  g.go('map')
                }}
              >
                Lesson Mode
                <small>all worlds open · for classrooms</small>
              </button>
            )}
          </div>
          <div className="menu-row">
            {canContinue && (
              <button
                className="btn"
                onClick={() => {
                  g.set({ lessonMode: true })
                  g.go('map')
                }}
              >
                🏫 Lesson Mode
              </button>
            )}
            <button className="btn" onClick={() => g.go('sandbox')}>
              🧪 Sandbox
            </button>
            <button className="btn" onClick={() => g.go('codex')}>
              📖 Codex
            </button>
            <button className="btn" onClick={() => g.go('settings')}>
              ⚙ Settings
            </button>
            <button className="btn" onClick={() => g.go('credits')}>
              ✦ Credits
            </button>
          </div>
        </nav>
      </div>
      <Credit />
    </>
  )
}

/* ------------------------------- Cold open ------------------------------- */
const INTRO = [
  { who: 'SYSTEM', text: 'Ping! A new prompt just arrived at street level…' },
  { who: 'USER PROMPT', text: '“What did our company decide about remote work in 2025?”', prompt: true },
  {
    who: 'ECHO',
    text: 'Hi, I’m Echo, a courier drone inside this language model. My job is to carry the prompt up the tower, floor by floor, and deliver a correct answer before the context window closes.',
  },
  {
    who: 'ECHO',
    text: 'Careful, though. On its own the model will happily make things up. The Hallucination Wraith haunts the top floor. We’ll need real facts from the Library to beat it.',
  },
  { who: 'ECHO', text: 'Drag to look around. Scroll or press W/S to zoom, and A/D to orbit. Click things to interact. Let’s climb!' },
]

export function IntroScreen() {
  const go = useGame((s) => s.go)
  const [i, setI] = useState(0)
  const line = INTRO[i]
  useCameraRig(i < 2 ? [2, 2.5, 9] : [7, 6, 13], i < 2 ? [0, 1, 0] : [0, 4, 0], { key: i < 2 })
  const next = () => {
    sfx.click()
    if (i === 1) echoMood('happy')
    if (i + 1 < INTRO.length) setI(i + 1)
    else go('map')
  }
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Tower />
        <Echo position={i < 2 ? [0, 1.6, 3.2] : [3, 4, 3]} scale={1.2} />
      </T3D.In>
      <div className="dialogue card" role="dialog" aria-live="polite">
        <span className="pill speaker">{line.who}</span>
        {line.prompt ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '12px 0' }}>
            {STORY_PROMPT.map((t, k) => (
              <span key={k} className="chip lit" style={{ animation: `pop .3s ${k * 0.06}s both` }}>
                {t.trim()}
              </span>
            ))}
          </div>
        ) : null}
        <p>{line.text}</p>
        <div className="menu-row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={() => go('map')}>
            Skip
          </button>
          <button className="btn btn-yellow" autoFocus onClick={next}>
            {i + 1 < INTRO.length ? 'Next ▶' : 'To the tower ▶'}
          </button>
        </div>
      </div>
    </>
  )
}

/* ------------------------------- World map ------------------------------- */
export function MapScreen() {
  const g = useGame()
  const ws = worldStars(g.puzzleStars)
  const open = (id: number) => id <= WORLDS.length && isUnlocked(id, g.completed, g.lessonMode)
  const next = FLOORS.find((f) => f.id <= WORLDS.length && open(f.id) && !g.completed.includes(f.id))?.id ?? 1
  useCameraRig([13, 8, 19], [-2.2, 6, 0])
  const enter = (id: number) => {
    sfx.whoosh()
    g.enterWorld(id)
  }
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Tower completed={g.completed} unlocked={open} stars={ws} onPick={enter} labels />
        <Echo position={[-2.6, 0.9 + next * 1.25 + 0.2, 2.4]} />
      </T3D.In>
      <aside className="card" style={{ position: 'absolute', top: 16, left: 16, width: 'min(340px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={() => g.go('title')}>
            ◀ Title
          </button>
          <h2 style={{ margin: 0 }}>The Tower</h2>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Each floor is one step a prompt takes inside a model. Click a lit floor to enter.
        </p>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {[...FLOORS].reverse().map((f) => {
            const can = open(f.id)
            const done = g.completed.includes(f.id)
            return (
              <li key={f.id}>
                <button
                  className={'btn' + (f.id === next && !done ? ' selected' : '')}
                  style={{ width: '100%', justifyContent: 'space-between', borderLeft: `10px solid ${can ? f.color : '#c9c3ba'}` }}
                  disabled={!can}
                  onClick={() => enter(f.id)}
                  aria-label={`${f.name}${can ? '' : ', locked'}`}
                >
                  <span>
                    {f.id}. {f.name}
                  </span>
                  <span className="stars" style={{ fontSize: '.9em' }}>
                    {f.id > 8 ? <span className="muted">soon</span> : !can ? '🔒' : done ? '★'.repeat(ws[f.id] ?? 0) || '✓' : '▶'}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </aside>
      <div className="hud-tr">
        <div className="card stat">
          <span className="stars">★</span>
          <span className="mono">{totalStars(g.puzzleStars)}</span>
          <span className="muted">·</span>
          <span className="mono">{formatParams(paramsFromStars(totalStars(g.puzzleStars)))}</span>
          <span className="muted" style={{ fontSize: '.8em' }}>
            params
          </span>
        </div>
        <button className="btn" onClick={() => g.go('codex')}>
          📖 Codex
        </button>
        {g.completed.includes(8) && (
          <button className="btn" onClick={() => g.go('sandbox')}>
            🧪 Sandbox
          </button>
        )}
      </div>
      <Credit />
    </>
  )
}

/* ------------------------------- Settings ------------------------------- */
export function SettingsScreen() {
  const g = useGame()
  const [confirm, setConfirm] = useState(false)
  useCameraRig([8, 6, 14], [0, 4, 0])
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Tower />
      </T3D.In>
      <div className="scroll-page">
        <div className="page-inner" style={{ maxWidth: 620 }}>
          <div className="card">
            <div className="page-head">
              <button className="btn btn-sm" onClick={g.back}>
                ◀ Back
              </button>
              <h2 style={{ margin: 0 }}>⚙ Settings</h2>
            </div>
            <Setting label="Difficulty" note="Explorer: no timers, extra hints. Engineer: boss timers + Deep Dive math in the Lens.">
              <div className="seg">
                <button className={g.mode === 'explorer' ? 'on' : ''} onClick={() => g.set({ mode: 'explorer' })}>
                  🧭 Explorer
                </button>
                <button className={g.mode === 'engineer' ? 'on' : ''} onClick={() => g.set({ mode: 'engineer' })}>
                  🛠 Engineer
                </button>
              </div>
            </Setting>
            <Setting label="Color palette" note="Colors always come with a shape or icon too (✓ ✗ ★).">
              <div className="seg">
                {(['default', 'colorblind', 'contrast'] as const).map((p) => (
                  <button key={p} className={g.palette === p ? 'on' : ''} onClick={() => g.set({ palette: p })}>
                    {p === 'default' ? 'Default' : p === 'colorblind' ? 'Colorblind-safe' : 'High contrast'}
                  </button>
                ))}
              </div>
            </Setting>
            <Setting label={`Text size · ${Math.round(g.textScale * 100)}%`}>
              <input type="range" min={1} max={2} step={0.1} value={g.textScale} onChange={(e) => g.set({ textScale: +e.target.value })} aria-label="Text size" />
            </Setting>
            <Setting label="Comfort">
              <div className="seg">
                <button className={g.reducedMotion ? 'on' : ''} onClick={() => g.set({ reducedMotion: !g.reducedMotion })}>
                  {g.reducedMotion ? '✓ ' : ''}Reduce motion
                </button>
                <button className={g.sound ? 'on' : ''} onClick={() => g.set({ sound: !g.sound })}>
                  {g.sound ? '✓ ' : ''}Sound
                </button>
              </div>
            </Setting>
            <Setting label="Lesson Mode" note="Unlocks every world so a class can jump to any concept.">
              <div className="seg">
                <button className={g.lessonMode ? 'on' : ''} onClick={() => g.set({ lessonMode: !g.lessonMode, started: true })}>
                  {g.lessonMode ? '✓ On' : 'Off'}
                </button>
              </div>
            </Setting>
            <Setting label="Save data" note="Progress is stored only in this browser. No account, no tracking.">
              {confirm ? (
                <div className="row" style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-orange btn-sm"
                    onClick={() => {
                      g.newGame()
                      g.set({ started: false })
                      setConfirm(false)
                      g.toast('Progress reset.', 'info')
                    }}
                  >
                    Yes, erase everything
                  </button>
                  <button className="btn btn-sm" onClick={() => setConfirm(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn btn-sm" onClick={() => setConfirm(true)}>
                  Reset progress…
                </button>
              )}
            </Setting>
            <p className="muted" style={{ fontSize: '.85em', marginBottom: 0 }}>
              Controls: drag to look · scroll or W/S to zoom · A/D to orbit · L Lens · H Hint · C Codex · Esc Pause
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function Setting({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '2px dashed #e4dbcf' }}>
      <div style={{ marginBottom: 8 }}>{label}</div>
      {children}
      {note && (
        <div className="muted" style={{ fontSize: '.85em', marginTop: 6 }}>
          {note}
        </div>
      )}
    </div>
  )
}

/* ------------------------------- Credits ------------------------------- */
export function CreditsScreen() {
  const g = useGame()
  useCameraRig([0, 3, 10], [0, 2.4, 0])
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Spin speed={0.6}>
          <Echo position={[0, 2.6, 0]} scale={2} />
        </Spin>
        <StarRing />
      </T3D.In>
      <div className="center-stack" style={{ justifyContent: 'space-between', padding: '6vh 16px' }}>
        <div className="banner" style={{ textAlign: 'center' }}>
          <div className="pill" style={{ fontSize: '1em' }}>
            NEURAL QUEST
          </div>
          <h1 className="mega-title" style={{ fontSize: 'clamp(40px, 7vw, 92px)', marginTop: 14 }}>
            <span className="t3" style={{ ['--r' as string]: '-2deg' }}>
              Built by
            </span>
            <br />
            <span className="t1" style={{ ['--r' as string]: '1deg' }}>
              Nishant
            </span>{' '}
            <span className="t2" style={{ ['--r' as string]: '-1deg' }}>
              Kannan
            </span>
          </h1>
        </div>
        <div className="card" style={{ maxWidth: 560, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: '1.1em' }}>
            Concept, product design &amp; development: <b>Nishant Kannan</b>
          </p>
          <p className="muted" style={{ margin: '0 0 14px' }}>
            A 3D journey that follows one prompt from raw text to a grounded answer. Built with React Three Fiber and three.js.
          </p>
          <button className="btn btn-yellow" autoFocus onClick={() => g.go('title')}>
            ◀ Back to title
          </button>
        </div>
      </div>
    </>
  )
}

function StarRing() {
  return (
    <Spin speed={-0.2}>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 5, 2.4 + Math.sin(i * 1.7) * 1.2, Math.sin(a) * 5]} rotation={[0, a, Math.PI / 4]}>
            <octahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial color={FLOORS[i % 8].color} emissive={FLOORS[i % 8].color} emissiveIntensity={0.4} />
          </mesh>
        )
      })}
    </Spin>
  )
}

/* ------------------------------- Ending ------------------------------- */
export function EndingScreen() {
  const g = useGame()
  const stars = totalStars(g.puzzleStars)
  useCameraRig([7, TOWER_TOP + 3, 9], [0, TOWER_TOP, 0])
  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Tower completed={[1, 2, 3, 4, 5, 6, 7, 8]} />
        <Echo position={[0, TOWER_TOP + 2.2, 0]} scale={1.4} />
      </T3D.In>
      <div className="overlay" style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'none' }}>
        <div className="card modal banner">
          <span className="pill" style={{ background: 'var(--good)' }}>
            ✓ GROUNDED ANSWER DELIVERED
          </span>
          <h2 style={{ fontSize: '1.6em', margin: '12px 0 6px' }}>“What did our company decide about remote work in 2025?”</h2>
          <div className="card cream" style={{ margin: '12px 0' }}>
            <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.5 }}>
              In March 2025, Lumen Labs decided employees may work remotely up to three days a week. Tuesdays and Thursdays are shared office days, and fully
              remote roles need VP approval. <span className="mono" style={{ color: 'var(--good)' }}>[policy-2025 §1–2]</span>
            </p>
          </div>
          <p>
            You carried one prompt through tokens, embeddings, positions, attention, layers, sampling, training and retrieval. Your model grew to{' '}
            <b className="mono">{formatParams(paramsFromStars(stars))}</b> parameters (★ {stars}).
          </p>
          <div className="menu-row">
            <button className="btn" onClick={() => g.go('sandbox')}>
              🧪 Try the Sandbox
            </button>
            <button className="btn btn-yellow" autoFocus onClick={() => g.go('credits')}>
              Credits ▶
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
