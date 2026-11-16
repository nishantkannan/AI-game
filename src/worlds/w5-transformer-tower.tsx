import { useState } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Beam, Block, Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette } from '../state/game'
import { Bar, Dock, Heatmap, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]
const TOK = ['The', 'dog', 'chased', 'its', 'tail']

/** Attention patterns (rows = from-token, cols = to-token; causal: only look back). */
function pattern(kind: 'prev' | 'coref' | 'grammar' | 'sink'): number[][] {
  const n = TOK.length
  const m = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    if (kind === 'prev') {
      m[i][Math.max(0, i - 1)] = 0.85
      m[i][i] += 0.15
    } else if (kind === 'sink') {
      m[i][0] = 0.8
      m[i][i] += 0.2
    } else if (kind === 'coref') {
      if (i === 3) {
        m[i][1] = 0.82
        m[i][3] = 0.18
      } else m[i][i] = 1
    } else {
      if (i === 2) {
        m[i][1] = 0.75
        m[i][2] = 0.25
      } else if (i === 4) {
        m[i][2] = 0.7
        m[i][4] = 0.3
      } else m[i][i] = 1
    }
  }
  return m
}

const HEADS = [
  { id: 'A', color: '#29b6e8', kind: 'grammar' as const },
  { id: 'B', color: '#ec6fb3', kind: 'sink' as const },
  { id: 'C', color: '#8b6cf0', kind: 'prev' as const },
  { id: 'D', color: '#4dd0c8', kind: 'coref' as const },
]
const JOBS = [
  { kind: 'prev' as const, label: 'Nearby words (previous token)' },
  { kind: 'coref' as const, label: 'Coreference (“its” → owner)' },
  { kind: 'grammar' as const, label: 'Grammar (verb ↔ subject/object)' },
  { kind: 'sink' as const, label: 'Resting (parks on first token)' },
]

const tokPos = (i: number): V3 => [(i - 2) * 1.9 + 1.4, 1, 1.8]

function HeadArcs({ m, color }: { m: number[][]; color: string }) {
  return (
    <>
      {m.flatMap((row, i) =>
        row.map((w, j) =>
          i !== j && w > 0.1 ? (
            <group key={i + '-' + j}>
              <Beam from={[tokPos(i)[0], 1.5, 1.8]} to={[tokPos(j)[0], 2.6 + Math.abs(i - j) * 0.35, 1.8]} color={color} width={0.03 + w * 0.08} />
              <Beam from={[tokPos(j)[0], 2.6 + Math.abs(i - j) * 0.35, 1.8]} to={[tokPos(j)[0], 1.5, 1.8]} color={color} width={0.03 + w * 0.08} arrow />
            </group>
          ) : null,
        ),
      )}
    </>
  )
}

function HeadOrb({ position, color, label, selected, onClick, dim }: { position: V3; color: string; label: string; selected?: boolean; onClick?: () => void; dim?: boolean }) {
  return (
    <group position={position}>
      <mesh
        castShadow
        scale={selected ? 1.25 : 1}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={() => onClick && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <sphereGeometry args={[0.45, 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.2} transparent opacity={dim ? 0.3 : 1} />
      </mesh>
      <Label position={[0, 0.8, 0]} className="small">
        Head {label}
      </Label>
    </group>
  )
}

function FloorSlab({ y = 0, color = '#f37c6b' }: { y?: number; color?: string }) {
  return (
    <RoundedBox args={[12, 0.3, 6]} radius={0.12} position={[0, y, 0]} receiveShadow castShadow>
      <meshStandardMaterial color={color} />
    </RoundedBox>
  )
}

/* -------------------- Puzzle 1 · Hire the heads -------------------- */
function HeadsPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [sel, setSel] = useState(0)
  const [assign, setAssign] = useState<Record<string, string>>({})
  const head = HEADS[sel]
  const m = pattern(head.kind)
  const check = () => {
    if (Object.keys(assign).length < 4) return onWrong('Give every head a job first.')
    const wrong = HEADS.filter((h) => assign[h.id] !== h.kind)
    if (wrong.length) return onWrong(`${wrong.length} head${wrong.length > 1 ? 's are' : ' is'} in the wrong job. Watch where each head’s beams land.`)
    onSolve()
  }
  return (
    <>
      <T3D.In>
        <FloorSlab />
        {TOK.map((t, i) => (
          <Block key={t} position={tokPos(i)} size={[1.6, 0.7, 0.7]} color={pal.token} label={t} labelClass="small" />
        ))}
        <HeadArcs m={m} color={head.color} />
        {HEADS.map((h, i) => (
          <HeadOrb key={h.id} position={[(i - 1.5) * 2 + 1.4, 1.2, -1.4]} color={h.color} label={h.id} selected={i === sel} onClick={() => (sfx.select(), setSel(i))} />
        ))}
      </T3D.In>
      <Dock title="Assign each attention head a job">
        <p className="muted" style={{ marginTop: 0 }}>
          Click a head orb to watch its beams. Each head learned a different pattern. Pick its job:
        </p>
        <div className="seg" style={{ marginBottom: 10 }}>
          {HEADS.map((h, i) => (
            <button key={h.id} className={i === sel ? 'on' : ''} onClick={() => setSel(i)} style={{ borderBottom: `5px solid ${h.color}` }}>
              {h.id}
              {assign[h.id] ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {JOBS.map((j) => (
            <button
              key={j.kind}
              className={'btn btn-sm' + (assign[head.id] === j.kind ? ' selected' : '')}
              style={{ justifyContent: 'flex-start', outline: hintLevel >= 1 && j.kind === head.kind ? '3px dashed #f39a3c' : undefined }}
              onClick={() => {
                sfx.click()
                setAssign({ ...assign, [head.id]: j.kind })
                if (sel < 3) setSel(sel + 1)
              }}
              disabled={solved}
            >
              {j.label}
            </button>
          ))}
        </div>
        <button className="btn btn-yellow" style={{ marginTop: 10 }} onClick={check} disabled={solved}>
          Hire the team
        </button>
      </Dock>
      {lensOpen && (
        <LensPanel title={`Head ${head.id} attention matrix`}>
          <p>Rows = token doing the looking, columns = token looked at. Decoders can only look backwards, so the upper triangle is 0.</p>
          <Heatmap rows={TOK} cols={TOK} m={m} />
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Puzzle 2 · Build one Transformer block -------------------- */
const PARTS = [
  { id: 'attn', label: 'Multi-head attention', color: '#f5a623', h: 0.8 },
  { id: 'norm', label: 'Add & Norm (residual)', color: '#fffdf6', h: 0.35 },
  { id: 'ffn', label: 'Feed-forward network', color: '#8b6cf0', h: 0.8 },
  { id: 'sample', label: 'Sampling wheel', color: '#ec6fb3', h: 0.6 },
]
const ORDER = ['attn', 'norm', 'ffn', 'norm']

function BlockPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [stack, setStack] = useState<string[]>([])
  const add = (id: string) => {
    if (solved) return
    const want = ORDER[stack.length]
    if (id === 'sample') return onWrong('Sampling happens once at the very top of the model, not inside every block.')
    if (id !== want) {
      return onWrong(
        stack.length === 0
          ? 'A block starts by letting tokens talk to each other.'
          : want === 'norm'
            ? 'After each sub-layer, add the input back (residual) and normalise.'
            : 'Now each token is processed on its own by the feed-forward network.',
      )
    }
    sfx.merge()
    const s = [...stack, id]
    setStack(s)
    if (s.length === ORDER.length) {
      echoMood('happy')
      setTimeout(onSolve, 500)
    }
  }
  let y = 0.3
  const next = ORDER[stack.length]
  return (
    <>
      <T3D.In>
        <FloorSlab />
        {/* the stack */}
        <group position={[3.6, 0, 0.5]}>
          {stack.map((id, i) => {
            const p = PARTS.find((x) => x.id === id)!
            const cy = y + p.h / 2
            y += p.h + 0.05
            return (
              <group key={i}>
                <RoundedBox args={[3.2, p.h, 2.2]} radius={0.1} position={[0, cy, 0]} castShadow>
                  <meshStandardMaterial color={p.color} />
                </RoundedBox>
                <Label position={[0, cy, 1.2]} className="small">
                  {p.label}
                </Label>
              </group>
            )
          })}
          {/* residual pipe */}
          {stack.length >= 2 && <Beam from={[-1.9, 0.3, 0]} to={[-1.9, 1.5, 0]} color="#2b2420" width={0.07} arrow />}
          {stack.length >= 4 && <Beam from={[-1.9, 1.6, 0]} to={[-1.9, 2.6, 0]} color="#2b2420" width={0.07} arrow />}
          <Label position={[0, y + 0.6, 0]} className="small">
            {stack.length === 4 ? '× repeat 6 times' : 'ONE TRANSFORMER BLOCK'}
          </Label>
        </group>
        {/* shelf of parts */}
        {PARTS.map((p, i) => (
          <Block
            key={p.id}
            position={[-0.4, 0.6 + i * 0.95, 0.2 - i * 0.2]}
            size={[2.8, 0.7, 0.9]}
            color={p.color}
            label={p.label}
            labelClass="small"
            glow={hintLevel >= 1 && p.id === next && !solved}
            onClick={(e) => {
              e.stopPropagation()
              add(p.id)
            }}
          />
        ))}
      </T3D.In>
      <Dock title={`Stack the block (${stack.length}/4)`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Click parts from the shelf (or below) in the order data flows <b>upward</b> through one Transformer block.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {PARTS.map((p) => (
            <button key={p.id} className="btn btn-sm" style={{ justifyContent: 'flex-start', borderLeft: `8px solid ${p.color}` }} onClick={() => add(p.id)} disabled={solved}>
              {p.label}
            </button>
          ))}
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Inside a block">
          <p className="mono" style={{ fontSize: '.85em', whiteSpace: 'pre-wrap' }}>
            {'h = x + Attention(LayerNorm(x))\nout = h + FFN(LayerNorm(h))\n\nFFN(h) = W₂ · GELU(W₁ · h)'}
          </p>
          <p>The residual (“Add”) lets each layer add a small edit instead of rewriting everything. The FFN is where most of the model’s parameters and stored facts live.</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Boss · Repair the broken floor -------------------- */
const REPAIRS = [
  {
    missing: 'coref' as const,
    symptom: 'Asked “whose tail?”, the model now answers “the tail’s tail”. It lost track of what “its” points to.',
    drift: 0.72,
  },
  {
    missing: 'prev' as const,
    symptom: 'The output is word salad: “tail The its chased dog”. Each token lost track of the word right before it.',
    drift: 0.64,
  },
]

function RepairBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [ri, setRi] = useState(0)
  const [fixed, setFixed] = useState(false)
  const r = REPAIRS[Math.min(ri, REPAIRS.length - 1)]
  const install = (kind: string) => {
    if (solved || fixed) return
    if (kind !== r.missing) return onWrong('The drift meter barely moved. Read the symptom: which job is not being done?')
    sfx.merge()
    echoMood('happy')
    setFixed(true)
    setTimeout(() => {
      if (ri + 1 >= REPAIRS.length) onSolve()
      else {
        setRi(ri + 1)
        setFixed(false)
      }
    }, 1200)
  }
  const drift = fixed ? 0.04 : r.drift
  return (
    <>
      <T3D.In>
        {[0, 1, 2, 3, 4, 5].map((f) => (
          <group key={f} position={[1.2, f * 1.1, -3]}>
            <RoundedBox args={[5, 0.9, 2.5]} radius={0.12} position={[0, 0.5, 0]} castShadow>
              <meshStandardMaterial color={f === 3 ? (fixed ? '#f37c6b' : pal.bad) : '#f37c6b'} emissive={f === 3 && !fixed ? pal.bad : '#000'} emissiveIntensity={0.3} />
            </RoundedBox>
            <Label position={[3.2, 0.5, 0]} className="small">
              Layer {f + 1}
              {f === 3 && !fixed ? ' ⚠' : ''}
            </Label>
          </group>
        ))}
        {/* slots on the broken floor */}
        {HEADS.map((h, i) => {
          const isMissing = h.kind === r.missing
          return isMissing && !fixed ? (
            <mesh key={h.id} position={[(i - 1.5) * 1.1 + 1.2, 3.3 + 0.55, -1.7]}>
              <sphereGeometry args={[0.32, 16, 12]} />
              <meshBasicMaterial color={pal.bad} wireframe />
            </mesh>
          ) : (
            <mesh key={h.id} position={[(i - 1.5) * 1.1 + 1.2, 3.3 + 0.55, -1.7]}>
              <sphereGeometry args={[0.32, 16, 12]} />
              <meshStandardMaterial color={h.color} emissive={h.color} emissiveIntensity={0.3} />
            </mesh>
          )
        })}
        {/* spare heads */}
        {HEADS.map((h, i) => (
          <HeadOrb
            key={'spare' + h.id}
            position={[(i - 1.5) * 2.2 + 1.2, 1, 3]}
            color={h.color}
            label={JOBS.find((j) => j.kind === h.kind)!.label.split(' ')[0]}
            selected={hintLevel >= 1 && h.kind === r.missing && !fixed}
            onClick={() => install(h.kind)}
          />
        ))}
      </T3D.In>
      <Dock title={`Repair ${ri + 1}/2: layer 4 is missing a head`}>
        <div className="card cream" style={{ padding: '10px 12px', boxShadow: 'none', marginBottom: 10 }}>
          <b>Symptom:</b> {r.symptom}
        </div>
        <div className="slider-row">
          <label>Output drift</label>
          <span className="mono">{(drift * 100).toFixed(0)}%</span>
          <div style={{ gridColumn: '1/-1' }}>
            <Bar value={drift} color={drift > 0.2 ? pal.bad : pal.good} />
          </div>
        </div>
        <p className="muted">Click the spare head that does the missing job:</p>
        <div style={{ display: 'grid', gap: 6 }}>
          {JOBS.map((j) => (
            <button key={j.kind} className="btn btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => install(j.kind)} disabled={solved || fixed}>
              {j.label}
            </button>
          ))}
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Missing head’s pattern">
          <p>This is the pattern the floor should produce. Compare it with the symptom:</p>
          <Heatmap rows={TOK} cols={TOK} m={pattern(r.missing)} />
          <p className="muted">Researchers really do “knock out” heads like this (ablation) to discover what each one does.</p>
        </LensPanel>
      )}
    </>
  )
}

export const world5: WorldDef = {
  id: 5,
  name: 'Transformer Tower',
  concept: 'Multi-head attention, layers, residuals, FFN',
  oneLiner: 'Stack the same block many times.',
  techTerm: 'Transformer',
  explainBack: 'A Transformer is the same block, attention plus a feed-forward network with residual connections, stacked many layers deep. Many heads work in parallel, each on a different job.',
  island: { top: '#ffc7bd', side: '#d08a7e', trim: '#f37c6b' },
  camera: { pos: [0, 6.5, 13], target: [0, 1.8, 0] },
  deepDive:
    'MultiHead(X) = Concat(head₁…head_h) W_O\nBlock: h = x + MHA(LN(x)); y = h + FFN(LN(h))\nGPT-2 small: 12 layers × 12 heads, d_model = 768.',
  card: {
    term: 'Transformer',
    def: 'The architecture behind LLMs: a stack of identical blocks, each with multi-head attention and a feed-forward network.',
    leavesOut: 'Heads rarely have one clean job; most behaviour is distributed and only partly understood.',
  },
  quiz: [
    {
      q: 'Why have multiple attention heads?',
      options: ['To make it slower', 'So different heads can track different relationships at once', 'To store more words', 'For redundancy only'],
      answer: 1,
      why: 'Heads specialise: grammar, nearby words, coreference and more.',
    },
    {
      q: 'What does a residual (“Add”) connection do?',
      options: ['Deletes the input', 'Adds the layer’s input back to its output', 'Shuffles tokens', 'Samples the next word'],
      answer: 1,
      why: 'Layers make small edits on top of what came in.',
    },
    {
      q: 'A Transformer model is mostly…',
      options: ['One giant attention head', 'The same block stacked many times', 'A lookup table', 'A list of rules'],
      answer: 1,
      why: 'Depth = many identical blocks with different learned weights.',
    },
  ],
  puzzles: [
    {
      id: 'w5p1',
      title: 'Hire the Heads',
      objective: 'Watch each head’s beams and give it the right job.',
      hints: ['The dashed-outline job matches the selected head.', 'Head C always points one step back. Head D connects “its” to “dog”.', 'A = grammar, B = resting, C = nearby words, D = coreference.'],
      card: { term: 'Attention head', def: 'One of many parallel attention units in a layer. Each learns its own pattern of who-looks-at-whom.', leavesOut: 'Large models have thousands of heads, many with hard-to-name behaviours.' },
      Component: HeadsPuzzle,
    },
    {
      id: 'w5p2',
      title: 'Block Builder',
      objective: 'Stack one Transformer block in the right order.',
      hints: ['The glowing part goes next.', 'Talk (attention) → tidy (add & norm) → think (FFN) → tidy.', 'Attention, Add & Norm, Feed-forward, Add & Norm.'],
      card: { term: 'Feed-forward network', def: 'A small neural network applied to each token separately inside every block. It holds much of the model’s knowledge.', leavesOut: 'Modern models use variants like SwiGLU or mixture-of-experts FFNs.' },
      Component: BlockPuzzle,
    },
    {
      id: 'w5p3',
      title: 'Boss · Broken Floor',
      objective: 'Diagnose the symptom and reinstall the missing head.',
      boss: true,
      timeLimit: 90,
      hints: ['The highlighted spare head fits.', 'Round 1 is about pronouns; round 2 is about the word right before.', 'Coreference, then Nearby words.'],
      card: { term: 'Residual stream', def: 'The running vector each token carries up through the layers; every block reads from it and adds to it.', leavesOut: 'Real ablations often show partial, spread-out damage rather than one clean symptom.' },
      Component: RepairBoss,
    },
  ],
}
