import { useRef, useState } from 'react'
import { Beam, Block, Label, Pedestal, T3D, echoMood, holdCamera } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette } from '../state/game'
import { Bar, Dock, LensPanel, softmax } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]

/** Tokens stand on pedestals in an arena arc. */
const arcPos = (i: number, n: number, r = Math.max(7, 3 + n * 0.62)): V3 => {
  const span = Math.min(Math.PI * 0.8, n * 0.22)
  const a = -span / 2 + (span * i) / Math.max(1, n - 1)
  return [Math.sin(a) * r, 0, -1.2 - (1 - Math.cos(a)) * r * 0.7]
}

function Arena() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1]}>
        <ringGeometry args={[2.2, 2.6, 48]} />
        <meshBasicMaterial color="#f5a623" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 1]}>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#ffe8b8" />
      </mesh>
    </group>
  )
}

/** Shared drag-or-click linking between tokens: press on one token, release (or click) on another. */
function useLinker(onLink: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number | null>(null)
  const hovered = useRef<number | null>(null)
  const linkRef = useRef(onLink)
  linkRef.current = onLink
  const down = (i: number) => {
    if (from !== null && from !== i) {
      linkRef.current(from, i)
      setFrom(null)
      return
    }
    sfx.select()
    setFrom(i)
    holdCamera()
    // Drag-to-connect: whatever token the pointer is over on release is the target.
    const release = () => {
      window.removeEventListener('pointerup', release)
      const to = hovered.current
      if (to !== null && to !== i) {
        linkRef.current(i, to)
        setFrom(null)
      }
    }
    window.addEventListener('pointerup', release)
  }
  const hover = (i: number, h: boolean) => {
    if (h) hovered.current = i
    else if (hovered.current === i) hovered.current = null
  }
  return { from, setFrom, down, hover }
}

function TokenArc({
  tokens,
  from,
  down,
  hover,
  glow,
  color,
}: {
  tokens: string[]
  from: number | null
  down: (i: number) => void
  hover: (i: number, h: boolean) => void
  glow?: number
  color: string
}) {
  return (
    <>
      {tokens.map((t, i) => {
        const p = arcPos(i, tokens.length)
        return (
          <group key={i}>
            <Pedestal position={[p[0], 0.2, p[2]]} r={0.6} />
            <Block
              position={[p[0], 1.05, p[2]]}
              size={[Math.min(1.5, Math.max(1, t.length * 0.2 + 0.45)), 0.8, 0.8]}
              color={color}
              label={t}
              labelClass="small"
              selected={from === i}
              glow={glow === i}
              onPointerDown={(e) => {
                e.stopPropagation()
                down(i)
              }}
              onHoverChange={(h) => hover(i, h)}
            />
          </group>
        )
      })}
    </>
  )
}

const tokTop = (i: number, n: number): V3 => {
  const p = arcPos(i, n)
  return [p[0], 1.6, p[2]]
}

function WeightBeams({ tokens, from, weights, color }: { tokens: string[]; from: number; weights: number[]; color: string }) {
  return (
    <>
      {weights.map((w, j) =>
        j === from ? null : (
          <group key={j}>
            <Beam from={tokTop(from, tokens.length)} to={tokTop(j, tokens.length)} color={color} width={0.02 + w * 0.22} opacity={0.35 + w * 0.6} />
            <Label position={[tokTop(j, tokens.length)[0], 2.3, tokTop(j, tokens.length)[2]]} className="mono small">
              {w.toFixed(2)}
            </Label>
          </group>
        ),
      )}
    </>
  )
}

function WeightsLens({ tokens, from, weights, note }: { tokens: string[]; from: number; weights: number[]; note?: string }) {
  return (
    <LensPanel title={`Attention from “${tokens[from]}”`}>
      <p>Each word’s query is compared with every key; softmax turns the scores into weights that sum to 1. The output is a weighted blend of the value vectors.</p>
      <table>
        <tbody>
          {tokens.map((t, j) => (
            <tr key={j}>
              <td style={{ width: 90 }}>{t}</td>
              <td>
                <Bar value={weights[j]} color="#f5a623" label={t} />
              </td>
              <td style={{ width: 50 }}>{weights[j].toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="muted">{note}</p>}
    </LensPanel>
  )
}

/* -------------------- Puzzle 1 · Aim the spotlight -------------------- */
const S1 = ['The', 'cat', 'sat', 'because', 'it', 'was', 'tired']
const S1_W = [0.03, 0.62, 0.08, 0.04, 0.12, 0.05, 0.06]

function SpotlightPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const IT = 4
  const link = (a: number, b: number) => {
    if (solved) return
    if (a !== IT) {
      onWrong('Start from “it”: that’s the word that needs to look around for meaning.')
      return
    }
    if (b !== 1) return onWrong(`Was “${S1[b]}” tired? Find the thing “it” refers to.`)
    onSolve()
  }
  const { from, down, hover } = useLinker(link)
  return (
    <>
      <T3D.In>
        <Arena />
        <TokenArc tokens={S1} from={from ?? (solved ? null : IT)} down={down} hover={hover} glow={hintLevel >= 1 && !solved ? 1 : undefined} color={pal.token} />
        {solved && <WeightBeams tokens={S1} from={IT} weights={S1_W} color={pal.attention} />}
      </T3D.In>
      <Dock title="Connect “it” to what it means">
        <p className="muted" style={{ marginTop: 0 }}>
          Every token holds a spotlight. <b>Drag</b> from “it” to the word it refers to (or click “it”, then click the target).
        </p>
        <p className="mono">{S1.map((t, i) => (i === IT ? `[${t}]` : t)).join(' ')}</p>
      </Dock>
      {lensOpen && <WeightsLens tokens={S1} from={IT} weights={S1_W} note="These weights are illustrative of what a trained head produces for this sentence." />}
    </>
  )
}

/* -------------------- Puzzle 2 · Query meets key -------------------- */
const KEYS = [
  { t: 'The', a: 300, m: 1.0 },
  { t: 'cat', a: 35, m: 2.0 },
  { t: 'sat', a: 115, m: 1.6 },
  { t: 'tired', a: 200, m: 1.6 },
]
const toV = (deg: number, m: number) => [Math.cos((deg * Math.PI) / 180) * m, Math.sin((deg * Math.PI) / 180) * m]

function QKPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [angle, setAngle] = useState(180)
  const q = toV(angle, 2.2)
  const scores = KEYS.map((k) => {
    const kv = toV(k.a, k.m)
    return (q[0] * kv[0] + q[1] * kv[1]) / Math.SQRT2
  })
  const w = softmax(scores)
  const GOAL = 0.7
  const lock = () => {
    if (w[1] < GOAL) return onWrong(`“cat” only gets ${(w[1] * 100).toFixed(0)}% of the attention. Aim the query closer to cat’s key.`)
    onSolve()
  }
  const C: V3 = [0, 0.6, 1]
  const tip = (deg: number, m: number): V3 => {
    const v = toV(deg, m * 1.4)
    return [C[0] + v[0], C[1], C[2] - v[1]]
  }
  return (
    <>
      <T3D.In>
        <Arena />
        {KEYS.map((k, i) => {
          const p = tip(k.a, 3)
          return (
            <group key={k.t}>
              <Beam from={C} to={tip(k.a, k.m)} color={pal.vector} width={0.06} arrow />
              <Block position={[p[0], 1, p[2]]} size={[1.3, 0.7, 0.7]} color={pal.token} label={k.t} labelClass="small" glow={hintLevel >= 1 && i === 1 && !solved} />
              <Beam from={[C[0], 1.4, C[2]]} to={[p[0], 1.4, p[2]]} color={pal.attention} width={0.015 + w[i] * 0.2} opacity={0.3 + w[i] * 0.7} />
              <Label position={[p[0], 2, p[2]]} className="mono small">
                {(w[i] * 100).toFixed(0)}%
              </Label>
            </group>
          )
        })}
        <Beam from={C} to={tip(angle, 2.2)} color={pal.attention} width={0.1} arrow />
        <Block position={[C[0], 1.3, C[2]]} size={[0.9, 0.6, 0.6]} color={pal.attention} label="it" labelClass="small" />
      </T3D.In>
      <Dock title="Aim the query (amber) at the right key (violet)">
        <p className="muted" style={{ marginTop: 0 }}>
          “it” sends a <b>query</b>. Each word shows a <b>key</b>. The score is the dot product q·k; softmax turns scores into attention weights. Give “cat” at least{' '}
          {GOAL * 100}%.
        </p>
        <div className="slider-row">
          <label htmlFor="qa">Query direction</label>
          <span className="mono">{angle}°</span>
          <input id="qa" type="range" min={0} max={359} value={angle} onChange={(e) => setAngle(+e.target.value)} disabled={solved} />
        </div>
        <div className="slider-row">
          <label>Attention on “cat”</label>
          <span className="mono">{(w[1] * 100).toFixed(0)}%</span>
          <div style={{ gridColumn: '1 / -1' }}>
            <Bar value={w[1]} color={w[1] >= GOAL ? pal.good : pal.attention} />
          </div>
        </div>
        <button className="btn btn-yellow" onClick={lock} disabled={solved}>
          Lock the beam
        </button>
      </Dock>
      {lensOpen && (
        <LensPanel title="Q · K → softmax">
          <p className="mono" style={{ fontSize: '.85em' }}>
            q = [{q.map((x) => x.toFixed(2)).join(', ')}]
          </p>
          <table>
            <thead>
              <tr>
                <th>key</th>
                <th>k</th>
                <th>q·k/√d</th>
                <th>weight</th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((k, i) => (
                <tr key={k.t}>
                  <td>{k.t}</td>
                  <td>[{toV(k.a, k.m).map((x) => x.toFixed(1)).join(',')}]</td>
                  <td>{scores[i].toFixed(2)}</td>
                  <td>{w[i].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Real heads use 64–128-dimensional q and k vectors, but the maths is exactly this.</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Boss · The trophy and the suitcase -------------------- */
const ROUNDS = [
  {
    tokens: ['The', 'trophy', 'didn’t', 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'big'],
    it: 8,
    answer: 1,
    weights: [0.02, 0.58, 0.03, 0.06, 0.01, 0.01, 0.14, 0.02, 0.05, 0.02, 0.02, 0.04],
    why: 'If the suitcase were too big, the trophy would fit easily!',
  },
  {
    tokens: ['The', 'trophy', 'didn’t', 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'small'],
    it: 8,
    answer: 6,
    weights: [0.02, 0.13, 0.03, 0.07, 0.02, 0.01, 0.57, 0.02, 0.05, 0.02, 0.02, 0.04],
    why: 'A small trophy would fit. It’s the container that’s too small.',
  },
]

function TrophyBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [ri, setRi] = useState(0)
  const [showBeams, setShowBeams] = useState(false)
  const r = ROUNDS[Math.min(ri, ROUNDS.length - 1)]
  const link = (a: number, b: number) => {
    if (solved || showBeams) return
    if (a !== r.it) return onWrong('Aim from “it”.')
    if (b !== r.answer) return onWrong(r.why)
    sfx.good()
    echoMood('happy')
    setShowBeams(true)
    setTimeout(() => {
      if (ri + 1 >= ROUNDS.length) onSolve()
      else {
        setRi(ri + 1)
        setShowBeams(false)
      }
    }, 1600)
  }
  const { from, down, hover } = useLinker(link)
  return (
    <>
      <T3D.In>
        <Arena />
        <TokenArc
          key={ri}
          tokens={r.tokens}
          from={from ?? r.it}
          down={down}
          hover={hover}
          glow={hintLevel >= 1 && !showBeams ? r.answer : undefined}
          color={pal.token}
        />
        {(showBeams || solved) && <WeightBeams tokens={r.tokens} from={r.it} weights={r.weights} color={pal.attention} />}
      </T3D.In>
      <Dock title={`Round ${ri + 1}/2: what is “it”?`}>
        <p className="mono" style={{ marginTop: 0 }}>
          {r.tokens.join(' ')}
        </p>
        <p className="muted">One word changes everything. Drag a beam from “it” to the thing that was too {r.tokens[11]}.</p>
      </Dock>
      {lensOpen && <WeightsLens tokens={r.tokens} from={r.it} weights={r.weights} note="This is a Winograd schema: resolving “it” needs world knowledge, which attention gathers from context." />}
    </>
  )
}

export const world4: WorldDef = {
  id: 4,
  name: 'Attention Arena',
  concept: 'Self-attention (Q, K, V)',
  oneLiner: 'Each word looks at the others.',
  techTerm: 'self-attention',
  explainBack: 'Each token sends a query, compares it with every other token’s key, and blends their values by how well they match.',
  island: { top: '#ffe0a3', side: '#d8a35a', trim: '#f5a623' },
  camera: { pos: [0, 7.5, 13], target: [0, 1, -1.5] },
  deepDive: 'Attention(Q,K,V) = softmax(Q Kᵀ / √d_k) V\nQ = X W_Q, K = X W_K, V = X W_V\nEach row of the softmax matrix sums to 1.',
  card: {
    term: 'Self-attention',
    def: 'A layer where every token gathers information from every other token, weighted by relevance.',
    leavesOut: 'Real models run dozens of heads in parallel, and decoders can only look backwards (causal mask).',
  },
  quiz: [
    {
      q: 'What does attention let a token do?',
      options: ['Delete other tokens', 'Look at other tokens and blend in their information', 'Change its spelling', 'Skip to the end'],
      answer: 1,
      why: 'It’s a weighted mix of information from the whole context.',
    },
    {
      q: 'The attention score between two tokens comes from…',
      options: ['Their alphabetical order', 'The dot product of a query and a key', 'Their word length', 'A random number'],
      answer: 1,
      why: 'score = q·k / √d, then softmax.',
    },
    {
      q: 'What does softmax do to attention scores?',
      options: ['Makes them all equal', 'Turns them into positive weights that sum to 1', 'Sorts them', 'Rounds them'],
      answer: 1,
      why: 'Softmax turns raw scores into a probability-like distribution.',
    },
  ],
  puzzles: [
    {
      id: 'w4p1',
      title: 'Spotlights',
      objective: 'Connect “it” to the word it refers to.',
      hints: ['The glowing token is the target.', 'Who was tired? The thing that sat.', 'Drag from “it” to “cat”.'],
      card: { term: 'Coreference', def: 'Working out which earlier word a pronoun like “it” refers to. Attention heads learn to do this.', leavesOut: 'No single head “is” coreference; the job is spread across many heads and layers.' },
      Component: SpotlightPuzzle,
    },
    {
      id: 'w4p2',
      title: 'Query Meets Key',
      objective: 'Rotate the query so “cat” gets ≥ 70% of the attention.',
      hints: ['Point the amber arrow at the glowing token.', 'The dot product is biggest when the vectors point the same way.', 'Set the direction to about 35°.'],
      card: { term: 'Query, Key, Value', def: 'Each token makes a query (what I’m looking for), a key (what I contain) and a value (what I share).', leavesOut: 'Q, K and V come from learned weight matrices applied to each token’s vector.' },
      Component: QKPuzzle,
    },
    {
      id: 'w4p3',
      title: 'Boss · Trophy & Suitcase',
      objective: 'Resolve “it” in two sentences that differ by one word.',
      boss: true,
      timeLimit: 90,
      camera: { pos: [0, 10, 16], target: [0, 1, -3.5] },
      hints: ['The glowing token is the answer.', 'Too big → the thing going in. Too small → the container.', 'Round 1: trophy. Round 2: suitcase.'],
      card: { term: 'Context', def: 'The same word can mean different things; attention uses the surrounding tokens to decide.', leavesOut: 'Models still fail on some of these puzzles. It’s an active research benchmark.' },
      Component: TrophyBoss,
    },
  ],
}
