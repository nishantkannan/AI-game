import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette, useGame } from '../state/game'
import { Bar, Dock, LensPanel, softmax } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

const SLICE_COLORS = ['#29b6e8', '#8b6cf0', '#f5a623', '#4dd0c8', '#ec6fb3', '#f37c6b', '#7cc56b', '#ffd34d']

/** Softmax with temperature, then keep only the top-k and renormalise. */
export function sampleDist(logits: number[], T: number, k: number) {
  const p = softmax(logits, T)
  const order = p.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  const keep = new Set(order.slice(0, k).map((o) => o.i))
  const kept = p.map((v, i) => (keep.has(i) ? v : 0))
  const s = kept.reduce((a, b) => a + b, 0)
  return kept.map((v) => v / s)
}

function Wheel({
  labels,
  probs,
  bad = [],
  spin,
  onLanded,
}: {
  labels: string[]
  probs: number[]
  bad?: number[]
  spin: { index: number; nonce: number } | null
  onLanded?: (i: number) => void
}) {
  const pal = usePalette()
  const reduced = useGame((s) => s.reducedMotion)
  const group = useRef<THREE.Group>(null)
  const anim = useRef<{ from: number; to: number; t: number; idx: number } | null>(null)
  const R = 3.6
  // slice geometry
  let acc = 0
  const slices = probs.map((p, i) => {
    const start = acc * Math.PI * 2
    const len = Math.max(p, 0.0001) * Math.PI * 2
    acc += p
    return { i, start, len, mid: start + len / 2, p }
  })
  useEffect(() => {
    if (!spin || !group.current) return
    const s = slices[spin.index]
    const cur = group.current.rotation.y
    const turns = reduced ? 1 : 4
    const to = cur - ((((cur + s.mid) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI * 2 * turns
    anim.current = { from: cur, to, t: 0, idx: spin.index }
    sfx.spin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.nonce])
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !group.current) return
    a.t = Math.min(1, a.t + dt / (reduced ? 0.4 : 1.8))
    const e = 1 - Math.pow(1 - a.t, 3)
    group.current.rotation.y = a.from + (a.to - a.from) * e
    if (a.t >= 1) {
      anim.current = null
      onLanded?.(a.idx)
    }
  })
  return (
    <group position={[0, 0.9, 0]}>
      {/* base */}
      <mesh position={[0, -0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R + 0.5, R + 0.8, 0.6, 48]} />
        <meshStandardMaterial color="#8a5a3b" />
      </mesh>
      <group ref={group}>
        {slices.map((s) =>
          s.p <= 0 ? null : (
            <group key={s.i}>
              <mesh castShadow>
                <cylinderGeometry args={[R, R, 0.3, Math.max(3, Math.ceil(s.len * 12)), 1, false, s.start, s.len]} />
                <meshStandardMaterial color={bad.includes(s.i) ? pal.bad : SLICE_COLORS[s.i % SLICE_COLORS.length]} />
              </mesh>
              {s.p > 0.025 && (
                <Html position={[Math.sin(s.mid) * R * 0.68, 0.3, Math.cos(s.mid) * R * 0.68]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
                  <div className="label3d small">
                    {bad.includes(s.i) ? '✗ ' : ''}
                    {labels[s.i]} <span className="mono">{(s.p * 100).toFixed(0)}%</span>
                  </div>
                </Html>
              )}
            </group>
          ),
        )}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.5, 0.6, 0.3, 24]} />
          <meshStandardMaterial color="#ffd34d" metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
      {/* pointer at the front */}
      <mesh position={[0, 0.45, R + 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.28, 0.7, 4]} />
        <meshStandardMaterial color="#2b2420" />
      </mesh>
    </group>
  )
}

function DistLens({ labels, logits, T, k, probs }: { labels: string[]; logits: number[]; T: number; k: number; probs: number[] }) {
  return (
    <LensPanel title="Logits → probabilities">
      <p>
        The model outputs a score (logit) for every token in its vocabulary. Divide by temperature <b className="mono">T={T.toFixed(2)}</b>, softmax, then keep the top{' '}
        <b className="mono">k={k}</b>.
      </p>
      <table>
        <thead>
          <tr>
            <th>token</th>
            <th>logit</th>
            <th>logit/T</th>
            <th>p</th>
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l} style={{ opacity: probs[i] ? 1 : 0.4 }}>
              <td>{l}</td>
              <td>{logits[i].toFixed(1)}</td>
              <td>{(logits[i] / T).toFixed(2)}</td>
              <td style={{ width: 90 }}>
                <Bar value={probs[i]} color="#ec6fb3" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </LensPanel>
  )
}

/* -------------------- Puzzle 1 · Temperature knob -------------------- */
const P1 = { prompt: 'The cat sat on the', labels: ['mat', 'floor', 'sofa', 'roof', 'moon', 'banana', 'purple'], logits: [4, 3, 2.6, 1.8, 0.5, -0.5, -1] }

function TemperaturePuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [T, setT] = useState(1)
  const [step, setStep] = useState<0 | 1>(0)
  const [spin, setSpin] = useState<{ index: number; nonce: number } | null>(null)
  const probs = sampleDist(P1.logits, T, 7)
  const mat = probs[0]
  const lock = () => {
    if (step === 0) {
      if (mat < 0.7) return onWrong(`“mat” is at ${(mat * 100).toFixed(0)}%. Lower temperature sharpens the wheel.`)
      sfx.good()
      echoMood('happy', 800)
      setStep(1)
    } else {
      if (mat > 0.4) return onWrong(`“mat” is still ${(mat * 100).toFixed(0)}%. Higher temperature flattens the wheel.`)
      onSolve()
    }
  }
  const doSpin = () => {
    const r = Math.random()
    let acc = 0
    const idx = probs.findIndex((p) => (acc += p) >= r)
    setSpin({ index: idx < 0 ? 0 : idx, nonce: Date.now() })
  }
  return (
    <>
      <T3D.In>
        <Wheel labels={P1.labels} probs={probs} spin={spin} />
        <Label position={[0, 3.2, -3]}>“{P1.prompt} ___”</Label>
      </T3D.In>
      <Dock title={step === 0 ? 'Step 1: make the model confident' : 'Step 2: make it adventurous'}>
        <p className="muted" style={{ marginTop: 0 }}>
          {step === 0 ? (
            <>
              Turn the temperature knob until <b>“mat” ≥ 70%</b>.
            </>
          ) : (
            <>
              Now flatten the wheel until <b>“mat” ≤ 40%</b>. Rarer words get a real chance.
            </>
          )}
        </p>
        <div className="slider-row">
          <label htmlFor="temp">🌡 Temperature</label>
          <span className="mono">{T.toFixed(2)}</span>
          <input
            id="temp"
            type="range"
            min={0.1}
            max={2}
            step={0.05}
            value={T}
            onChange={(e) => setT(+e.target.value)}
            disabled={solved}
            style={hintLevel >= 1 ? { outline: '3px dashed #f39a3c' } : undefined}
          />
        </div>
        <div className="row">
          <button className="btn btn-yellow" onClick={lock} disabled={solved}>
            Lock it in
          </button>
          <button className="btn btn-sm" onClick={doSpin}>
            🎡 Test spin
          </button>
        </div>
      </Dock>
      {lensOpen && <DistLens labels={P1.labels} logits={P1.logits} T={T} k={7} probs={probs} />}
    </>
  )
}

/* -------------------- Puzzle 2 · Top-k fence -------------------- */
function TopKPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [k, setK] = useState(7)
  const [spin, setSpin] = useState<{ index: number; nonce: number } | null>(null)
  const probs = sampleDist(P1.logits, 1, k)
  const lock = () => {
    if (probs[5] > 0 || probs[6] > 0) return onWrong('“banana” or “purple” can still be picked. Fence them out!')
    if (k < 3) return onWrong(`With k=${k} the model can only ever say ${k === 1 ? 'one thing' : 'two things'}. Keep at least 3 options for variety.`)
    onSolve()
  }
  return (
    <>
      <T3D.In>
        <Wheel labels={P1.labels} probs={probs} bad={[5, 6]} spin={spin} />
        <Label position={[0, 3.2, -3]}>“{P1.prompt} ___”</Label>
      </T3D.In>
      <Dock title="Fence out the nonsense with top-k">
        <p className="muted" style={{ marginTop: 0 }}>
          <b>Top-k</b> keeps only the k most likely tokens. Remove “banana” and “purple” but keep at least 3 choices.
        </p>
        <div className="slider-row">
          <label htmlFor="k">✂ top-k</label>
          <span className="mono">{k}</span>
          <input id="k" type="range" min={1} max={7} step={1} value={k} onChange={(e) => setK(+e.target.value)} disabled={solved} style={hintLevel >= 1 ? { outline: '3px dashed #f39a3c' } : undefined} />
        </div>
        <div className="row">
          <button className="btn btn-yellow" onClick={lock} disabled={solved}>
            Lock it in
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              const r = Math.random()
              let acc = 0
              const idx = probs.findIndex((p) => (acc += p) >= r)
              setSpin({ index: Math.max(0, idx), nonce: Date.now() })
            }}
          >
            🎡 Test spin
          </button>
        </div>
      </Dock>
      {lensOpen && <DistLens labels={P1.labels} logits={P1.logits} T={1} k={k} probs={probs} />}
    </>
  )
}

/* -------------------- Boss · Five spins -------------------- */
const STEPS = [
  { labels: ['up', 'through', 'over', 'home', 'purple'], logits: [3, 2.2, 2, 1.5, -1.5], bad: [4] },
  { labels: ['the', 'a', 'every', 'banana'], logits: [3, 2, 1.2, -1.5], bad: [3] },
  { labels: ['tower', 'sky', 'clouds', 'library', 'spoon'], logits: [3, 2.4, 2, 1.4, -1.2], bad: [4] },
  { labels: ['to', 'and', 'while', 'purple'], logits: [2.8, 2.2, 1.4, -1.5], bad: [3] },
  { labels: ['deliver', 'find', 'fetch', 'sing', 'banana'], logits: [2.8, 2.2, 1.6, 1, -1.8], bad: [4] },
]

function SentenceBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [T, setT] = useState(1.6)
  const [k, setK] = useState(5)
  const [out, setOut] = useState<{ w: string; bad: boolean; top: boolean }[]>([])
  const [spin, setSpin] = useState<{ index: number; nonce: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const si = Math.min(out.length, STEPS.length - 1)
  const step = STEPS[si]
  const probs = sampleDist(step.logits, T, k)
  const done = out.length >= STEPS.length

  const go = () => {
    if (busy || done || solved) return
    const r = Math.random()
    let acc = 0
    const idx = Math.max(0, probs.findIndex((p) => (acc += p) >= r))
    setBusy(true)
    setSpin({ index: idx, nonce: Date.now() })
  }
  const landed = (idx: number) => {
    const w = { w: step.labels[idx], bad: step.bad.includes(idx), top: idx === 0 }
    const next = [...out, w]
    setSpin(null)
    setOut(next)
    setBusy(false)
    if (next.length === STEPS.length) {
      const nonsense = next.some((x) => x.bad)
      const creative = next.some((x) => !x.top)
      if (nonsense) {
        onWrong('Nonsense slipped in! Lower the temperature or tighten top-k.')
        setTimeout(() => setOut([]), 1400)
      } else if (!creative) {
        onWrong('Correct… but every pick was the most likely word. Too predictable! Warm it up a little.')
        setTimeout(() => setOut([]), 1400)
      } else {
        echoMood('happy')
        onSolve()
      }
    }
  }
  return (
    <>
      <T3D.In>
        <Wheel key={si} labels={step.labels} probs={probs} bad={step.bad} spin={spin} onLanded={landed} />
        <Label position={[0, 3.4, -3]}>
          “Echo flew {out.map((o) => o.w).join(' ')}
          {done ? '' : ' ___'}”
        </Label>
      </T3D.In>
      <Dock title={`Boss: write a sentence in 5 spins (${out.length}/5)`}>
        <p className="muted" style={{ marginTop: 0 }}>
          The sentence must be <b>correct</b> (no ✗ nonsense) and <b>creative</b> (at least one pick that isn’t the top choice). Set the dials, then spin.
        </p>
        <p className="mono">
          Echo flew{' '}
          {out.map((o, i) => (
            <span key={i} style={{ color: o.bad ? pal.bad : o.top ? undefined : pal.good }}>
              {o.w}{' '}
            </span>
          ))}
        </p>
        <div className="slider-row">
          <label htmlFor="bt">🌡 Temperature</label>
          <span className="mono">{T.toFixed(2)}</span>
          <input id="bt" type="range" min={0.1} max={2} step={0.05} value={T} onChange={(e) => setT(+e.target.value)} disabled={busy || solved} />
        </div>
        <div className="slider-row">
          <label htmlFor="bk">✂ top-k</label>
          <span className="mono">{k}</span>
          <input id="bk" type="range" min={1} max={5} step={1} value={k} onChange={(e) => setK(+e.target.value)} disabled={busy || solved} />
        </div>
        {hintLevel >= 2 && <p className="muted">Try temperature ≈ 1.0 and top-k = 3.</p>}
        <button className="btn btn-yellow" onClick={go} disabled={busy || done || solved}>
          🎡 Spin!
        </button>
      </Dock>
      {lensOpen && <DistLens labels={step.labels} logits={step.logits} T={T} k={k} probs={probs} />}
    </>
  )
}

export const world6: WorldDef = {
  id: 6,
  name: 'Probability Casino',
  concept: 'Next-token prediction & sampling',
  oneLiner: 'The model rolls weighted dice.',
  techTerm: 'sampling',
  explainBack: 'At each step the model gives every token a probability. Temperature and top-k change how we pick from them: safe and predictable, or creative and risky.',
  island: { top: '#ffc6e6', side: '#c780a8', trim: '#ec6fb3' },
  camera: { pos: [0, 10, 11.5], target: [0, 0.4, 0.4] },
  deepDive: 'p_i = exp(z_i / T) / Σ_j exp(z_j / T)\nTop-k: zero all but the k largest p_i, renormalise.\nTop-p (nucleus): keep the smallest set with Σp ≥ p.\nT → 0 ⇒ greedy argmax.',
  card: {
    term: 'Next-token prediction',
    def: 'An LLM’s only job: output a probability for every possible next token, then pick one and repeat.',
    leavesOut: 'Real vocabularies have ~100k tokens; the wheel would have 100k slices, most of them microscopically thin.',
  },
  quiz: [
    {
      q: 'What does a language model output at each step?',
      options: ['A finished paragraph', 'A probability for every possible next token', 'A single fixed word', 'A search query'],
      answer: 1,
      why: 'It outputs a distribution; sampling picks from it.',
    },
    {
      q: 'Raising the temperature makes the output…',
      options: ['More predictable', 'More random and creative', 'Shorter', 'Faster'],
      answer: 1,
      why: 'Higher T flattens the distribution.',
    },
    {
      q: 'Top-k = 3 means…',
      options: ['Only the 3 most likely tokens can be picked', 'Generate 3 sentences', 'Pick every 3rd token', 'Use 3 layers'],
      answer: 0,
      why: 'Everything outside the top 3 is set to zero probability.',
    },
  ],
  puzzles: [
    {
      id: 'w6p1',
      title: 'The Temperature Knob',
      objective: 'Sharpen the wheel (mat ≥ 70%), then flatten it (mat ≤ 40%).',
      hints: ['The temperature slider is the one to move.', 'Low T = confident; high T = flat.', 'Set T ≤ 0.7 and lock, then T ≥ 1.7 and lock.'],
      card: { term: 'Temperature', def: 'A dial that sharpens (low) or flattens (high) the probability distribution before sampling.', leavesOut: 'T = 0 is usually implemented as plain argmax (greedy decoding).' },
      Component: TemperaturePuzzle,
    },
    {
      id: 'w6p2',
      title: 'The Top-k Fence',
      objective: 'Make “banana” and “purple” impossible while keeping ≥ 3 options.',
      hints: ['Move the top-k slider.', 'banana and purple are the 6th and 7th most likely tokens.', 'Any k from 3 to 5 works.'],
      card: { term: 'Top-k / top-p', def: 'Sampling filters that cut off the unlikely tail so the model can’t pick nonsense.', leavesOut: 'Top-p (nucleus) adapts the cut-off to how confident the model is; it’s often preferred.' },
      Component: TopKPuzzle,
    },
    {
      id: 'w6p3',
      title: 'Boss · Five Spins',
      objective: 'Generate a sentence that is both correct and creative.',
      boss: true,
      timeLimit: 120,
      hints: ['Too hot = nonsense; too cold = boring.', 'Top-k removes the ✗ slices entirely.', 'Temperature ≈ 1.0 with top-k = 3, then spin 5 times.'],
      card: { term: 'Autoregressive generation', def: 'Generating text one token at a time, feeding each choice back in as input for the next.', leavesOut: 'Real logits change after every token based on everything generated so far.' },
      Component: SentenceBoss,
    },
  ],
}
