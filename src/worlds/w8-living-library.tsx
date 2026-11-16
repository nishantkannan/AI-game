import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { Beam, Block, Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette, useGame } from '../state/game'
import { Bar, Dock, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]

/* ---------------- tiny, honest retrieval: bag-of-words vectors + cosine ---------------- */
const STOP = new Set('a an the of in on at to for and or is are was were be by with from our we what did do does about every may up this that it its under need new next'.split(' '))
function stem(w: string) {
  let s = w
  for (const suf of ['ing', 'ed', 'es', 'ly', 's']) {
    if (s.length > 4 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length)
      break
    }
  }
  if (s.length > 4 && s.endsWith('e')) s = s.slice(0, -1)
  return s
}
export function terms(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
    .map(stem)
}
function bow(text: string) {
  const m = new Map<string, number>()
  terms(text).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1))
  return m
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0
  a.forEach((v, k) => (dot += v * (b.get(k) ?? 0)))
  const na = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0))
  const nb = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0))
  return na && nb ? dot / (na * nb) : 0
}

export const QUESTION = 'What did our company decide about remote work in 2025?'
export const CHUNKS = [
  { id: 'policy-2025 §1', text: 'In March 2025, Lumen Labs decided employees may work remotely up to three days a week.', relevant: true },
  { id: 'policy-2025 §2', text: 'Under the 2025 remote work policy, Tuesdays and Thursdays are shared office days. Fully remote roles need approval from a vice president.', relevant: true },
  { id: 'pilot-2023', text: 'In 2023, Lumen Labs ran a remote work pilot where staff worked from home every Friday. The pilot ended in December 2023.', relevant: false },
  { id: 'holidays-2025', text: 'The 2025 holiday calendar adds a company-wide day off in August.', relevant: false },
  { id: 'parking', text: 'Staff parking moved to the north garage in 2025.', relevant: false },
  { id: 'bikes', text: 'Bike racks are available next to the main entrance.', relevant: false },
  { id: 'kitchen', text: 'The kitchen is restocked every Monday morning.', relevant: false },
  { id: 'coffee', text: 'Tea and coffee are free on every floor.', relevant: false },
]
function rank() {
  const q = bow(QUESTION)
  return CHUNKS.map((c, i) => ({ i, score: cosine(q, bow(c.text)) })).sort((a, b) => b.score - a.score)
}

/** Books float on shelves; positions loosely grouped by topic (like a 2D embedding projection). */
const BOOK_POS: V3[] = [
  [-3.2, 2.6, -2.5],
  [-2.2, 2.6, -2.5],
  [-1.2, 2.6, -2.5],
  [1.4, 2.6, -2.5],
  [3.0, 1.0, -2.5],
  [4.0, 1.0, -2.5],
  [-3.6, 1.0, -2.5],
  [-2.6, 1.0, -2.5],
]
const BOOK_COLORS = ['#4cc36b', '#4cc36b', '#9aa3ad', '#f5a623', '#29b6e8', '#29b6e8', '#ec6fb3', '#ec6fb3']

function Shelves() {
  return (
    <>
      {[0.45, 2.05].map((y) => (
        <RoundedBox key={y} args={[10, 0.18, 1.3]} radius={0.06} position={[0.3, y, -2.5]} castShadow receiveShadow>
          <meshStandardMaterial color="#8a5a3b" />
        </RoundedBox>
      ))}
    </>
  )
}

const PULL_P2: V3 = [0.2, 3.5, 0.8]
const PULL_BOSS: V3 = [-2.6, 4.4, 0]
const pullPos = (base: V3, slot: number): V3 => [base[0] + slot * 1.25, base[1], base[2]]

function Book({ i, lit, slot, pullBase = PULL_P2, onClick, glow }: { i: number; lit?: boolean; slot?: number; pullBase?: V3; onClick?: () => void; glow?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const base = BOOK_POS[i]
  const target = slot !== undefined && slot >= 0 ? pullPos(pullBase, slot) : base
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.lerp(new THREE.Vector3(...target), 0.1)
  })
  return (
    <group ref={ref} position={base}>
      <Block position={[0, 0.55, 0]} size={[0.75, 1.1, 0.9]} color={BOOK_COLORS[i]} glow={glow || lit} onClick={onClick ? () => onClick() : undefined} />
      <Label position={[0, 1.35, 0]} className="small mono">
        {CHUNKS[i].id}
      </Label>
    </group>
  )
}

/* -------------------- Puzzle 1 · Chunking -------------------- */
const HANDBOOK = [
  { s: 'Remote work: In March 2025, Lumen Labs decided employees may work remotely up to three days a week.', topic: 'remote' },
  { s: 'Tuesdays and Thursdays are shared office days for every team.', topic: 'remote' },
  { s: 'Parking: Staff parking moved to the north garage in 2025.', topic: 'parking' },
  { s: 'Bike racks are available next to the main entrance.', topic: 'parking' },
  { s: 'Snacks: The kitchen is restocked every Monday morning.', topic: 'snacks' },
  { s: 'Tea and coffee are free on every floor.', topic: 'snacks' },
]
const CUT_ANSWER = [2, 4]

function ChunkPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [cuts, setCuts] = useState<number[]>([])
  const chunks = useMemo(() => {
    const c = [0, ...[...cuts].sort((a, b) => a - b), HANDBOOK.length]
    return c.slice(0, -1).map((s, i) => HANDBOOK.slice(s, c[i + 1]))
  }, [cuts])
  const toggle = (c: number) => {
    if (solved) return
    sfx.slice()
    setCuts((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))
  }
  const check = () => {
    const mixed = chunks.find((ch) => new Set(ch.map((x) => x.topic)).size > 1)
    if (mixed) return onWrong('One chunk mixes topics. A search for “remote work” would drag in parking or snack facts too.')
    if (chunks.length > 3) return onWrong('Some chunks are too small: a sentence on its own loses its context (“Tuesdays… for what?”).')
    onSolve()
  }
  let chunkIdx = 0
  const rowChunk = HANDBOOK.map((_, i) => {
    if (cuts.includes(i)) chunkIdx++
    return chunkIdx
  })
  return (
    <>
      <T3D.In>
        {/* the scroll */}
        <group position={[0, 0, -0.5]}>
          {HANDBOOK.map((h, i) => {
            const y = 5.2 - i * 0.85 - cuts.filter((c) => c <= i).length * 0.25
            return (
              <group key={i}>
                <RoundedBox args={[7.5, 0.7, 0.2]} radius={0.06} position={[0, y, 0]} castShadow>
                  <meshStandardMaterial color={['#fff6dc', '#e5f6ff', '#ffe9f5'][rowChunk[i] % 3]} />
                </RoundedBox>
                <Label position={[0, y, 0.15]} className="small">
                  {h.s.length > 58 ? h.s.slice(0, 56) + '…' : h.s}
                </Label>
                {i > 0 && (
                  <mesh
                    position={[4.2, y + 0.42 + (cuts.includes(i) ? 0.12 : 0), 0]}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(i)
                    }}
                    onPointerOver={() => (document.body.style.cursor = 'pointer')}
                    onPointerOut={() => (document.body.style.cursor = '')}
                  >
                    <boxGeometry args={[0.6, 0.3, 0.3]} />
                    <meshStandardMaterial
                      color={cuts.includes(i) ? pal.bad : hintLevel >= 1 && CUT_ANSWER.includes(i) ? '#ffd34d' : '#cfc6b9'}
                      emissive={hintLevel >= 1 && CUT_ANSWER.includes(i) && !cuts.includes(i) ? '#ffd34d' : '#000'}
                      emissiveIntensity={0.5}
                    />
                  </mesh>
                )}
              </group>
            )
          })}
          <Label position={[4.2, 5.9, 0]} className="small">
            ✂ cut
          </Label>
        </group>
      </T3D.In>
      <Dock title={`Chop the handbook into chunks (${chunks.length})`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Before a document can be searched, it’s split into <b>chunks</b>. Click the ✂ tabs (or the buttons) to cut between sentences. Each chunk should cover one topic.
        </p>
        <div style={{ display: 'grid', gap: 4, fontSize: '.85em' }}>
          {HANDBOOK.map((h, i) => (
            <div key={i}>
              {i > 0 && (
                <button className={'btn btn-sm' + (cuts.includes(i) ? ' selected' : '')} style={{ padding: '0 8px', margin: '2px 0' }} onClick={() => toggle(i)} disabled={solved} aria-pressed={cuts.includes(i)}>
                  ✂ {cuts.includes(i) ? 'cut' : 'cut here?'}
                </button>
              )}
              <div className="muted" style={{ fontWeight: 700 }} title={h.s}>
                {i + 1}. {h.s.length > 44 ? h.s.slice(0, 42) + '…' : h.s}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-yellow" style={{ marginTop: 10 }} onClick={check} disabled={solved}>
          Bind the chunks
        </button>
      </Dock>
      {lensOpen && (
        <LensPanel title="Chunks">
          {chunks.map((ch, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <span className="pill">chunk {i + 1}</span>{' '}
              <span className="mono" style={{ fontSize: '.8em' }}>
                {ch.reduce((s, x) => s + terms(x.s).length, 0)} terms · topics: {[...new Set(ch.map((x) => x.topic))].join(', ')}
              </span>
            </div>
          ))}
          <p className="muted">Real systems chunk by tokens (e.g. 200–500) with some overlap, often guided by headings.</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Puzzle 2 · Retrieval beam -------------------- */
function RetrievePuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [k, setK] = useState(5)
  const [fired, setFired] = useState<number[] | null>(null)
  const ranking = useMemo(rank, [])
  const fire = () => {
    sfx.whoosh()
    const top = ranking.slice(0, k).map((r) => r.i)
    setFired(top)
    setTimeout(() => {
      const hasBoth = CHUNKS.every((c, i) => !c.relevant || top.includes(i))
      if (!hasBoth) return onWrong('Missing a key fact: both 2025 policy chunks are needed for a full answer. Raise k.')
      if (k > 3) return onWrong(`k=${k} stuffs ${k - 2} irrelevant chunks into the context. Noise invites mistakes, and it costs tokens.`)
      onSolve()
    }, 900)
  }
  const Q: V3 = [3.2, 1.3, 2]
  return (
    <>
      <T3D.In>
        <Shelves />
        {CHUNKS.map((_, i) => (
          <Book key={i} i={i} lit={fired?.includes(i)} slot={fired ? fired.indexOf(i) : undefined} glow={hintLevel >= 1 && CHUNKS[i].relevant && !fired} />
        ))}
        <mesh position={Q}>
          <icosahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial color={pal.token} emissive={pal.token} emissiveIntensity={0.6} flatShading />
        </mesh>
        <Label position={[Q[0], Q[1] + 0.9, Q[2]]} className="small">
          ❓ question vector
        </Label>
        {fired?.map((i, s) => (
          <Beam key={i} from={Q} to={[PULL_P2[0] + s * 1.25, PULL_P2[1] + 0.5, PULL_P2[2]]} color={CHUNKS[i].relevant ? pal.good : pal.attention} width={0.05} />
        ))}
      </T3D.In>
      <Dock title="Fire the question beam">
        <p className="mono" style={{ marginTop: 0, fontSize: '.85em' }}>
          “{QUESTION}”
        </p>
        <p className="muted">
          The question is embedded too, and the <b>k</b> chunks with the highest cosine similarity are retrieved. Fetch everything needed, and as little noise as possible.
        </p>
        <div className="slider-row">
          <label htmlFor="rk">top-k chunks</label>
          <span className="mono">{k}</span>
          <input
            id="rk"
            type="range"
            min={1}
            max={8}
            value={k}
            onChange={(e) => {
              setK(+e.target.value)
              setFired(null)
            }}
            disabled={solved}
          />
        </div>
        <button className="btn btn-yellow" onClick={fire} disabled={solved}>
          🔦 Fire beam
        </button>
      </Dock>
      {lensOpen && (
        <LensPanel title="Similarity search">
          <p>
            Question terms: <span className="mono">{terms(QUESTION).join(', ')}</span>
          </p>
          <table>
            <thead>
              <tr>
                <th>chunk</th>
                <th>cosine</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, n) => (
                <tr key={r.i} style={{ background: n < k ? '#eaf8ee' : undefined }}>
                  <td>
                    {n < k ? '✓ ' : ''}
                    {CHUNKS[r.i].id}
                  </td>
                  <td style={{ width: 120 }}>
                    <Bar value={r.score} color="#4cc36b" />
                    {r.score.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">This toy uses word-count vectors. A neural embedder would also know “our company” ≈ “Lumen Labs”.</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Boss · The Hallucination Wraith -------------------- */
const CLAIMS = [
  { text: 'In March 2025, Lumen Labs decided staff may work remotely up to three days a week.', cite: 'policy-2025 §1', ok: true },
  { text: 'In 2025, Lumen Labs went fully remote for everyone.', cite: null, ok: false, why: 'No retrieved chunk says that. Pure hallucination!' },
  { text: 'Tuesdays and Thursdays are shared office days.', cite: 'policy-2025 §2', ok: true },
  { text: 'Everyone works from home every Friday.', cite: 'pilot-2023', ok: false, why: 'That’s from the 2023 pilot, which ended. Stale facts are a grounding trap!' },
  { text: 'Fully remote roles need approval from a vice president.', cite: 'policy-2025 §2', ok: true },
  { text: 'Remote workers get a $500 home-office stipend.', cite: null, ok: false, why: 'Sounds plausible, but no source supports it. The Wraith feeds on plausible guesses.' },
]

function Wraith({ hp, hurt }: { hp: number; hurt: number }) {
  const ref = useRef<THREE.Group>(null)
  const reduced = useGame((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = 3 + (reduced ? 0 : Math.sin(t * 1.5) * 0.3)
    ref.current.rotation.y = reduced ? 0 : Math.sin(t * 0.7) * 0.3
    const s = 0.5 + hp * 0.9
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 0.08)
    ref.current.position.x = 4 + (hurt && !reduced ? Math.sin(t * 60) * 0.08 : 0)
  })
  return (
    <group ref={ref} position={[4, 3, -1.2]}>
      <mesh castShadow>
        <sphereGeometry args={[1.2, 24, 16]} />
        <meshStandardMaterial color="#6b3a8f" emissive="#ef5350" emissiveIntensity={0.35} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -1.3, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.15, 2, 16, 1, true]} />
        <meshStandardMaterial color="#6b3a8f" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.15, 1.05]}>
          <sphereGeometry args={[0.18, 12, 8]} />
          <meshBasicMaterial color="#ffd34d" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -0.4, 1.08]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.35, 0.06, 6, 16, Math.PI]} />
        <meshBasicMaterial color="#2b2420" />
      </mesh>
    </group>
  )
}

function WraithBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [hp, setHp] = useState(1)
  const [used, setUsed] = useState<number[]>([])
  const [beam, setBeam] = useState<{ ok: boolean; n: number } | null>(null)
  const retrieved = [0, 1, 3, 2] // top-4 by cosine; includes a stale 2023 chunk
  const fire = (i: number) => {
    if (solved || used.includes(i)) return
    const c = CLAIMS[i]
    setUsed([...used, i])
    setBeam({ ok: c.ok, n: Date.now() })
    setTimeout(() => setBeam(null), 700)
    if (!c.ok) {
      setHp((h) => Math.min(1.3, h + 0.2))
      return onWrong(c.why)
    }
    sfx.good()
    echoMood('happy', 800)
    const nh = hp - 0.34
    setHp(nh)
    if (nh <= 0.05) setTimeout(onSolve, 500)
  }
  return (
    <>
      <T3D.In>
        <Shelves />
        {CHUNKS.map((_, i) => (
          <Book key={i} i={i} slot={retrieved.indexOf(i)} pullBase={PULL_BOSS} />
        ))}
        {hp > 0.05 && <Wraith hp={Math.max(0, hp)} hurt={beam && beam.ok ? 1 : 0} />}
        {beam && <Beam from={[-0.8, 4.6, 0.5]} to={[3.9, 3, -0.5]} color={beam.ok ? pal.good : pal.bad} width={0.12} />}
        <Label position={[4, 5.6, -1]}>
          <span style={{ color: pal.bad }}>Hallucination Wraith</span> · {Math.max(0, Math.round(hp * 100))}%
        </Label>
      </T3D.In>
      <Dock title="Boss: answer using ONLY retrieved facts">
        <p className="muted" style={{ marginTop: 0 }}>
          Fire claims at the Wraith. <b>Grounded</b> claims (supported by a retrieved chunk) hurt it. Made-up or stale claims make it stronger.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {CLAIMS.map((c, i) => (
            <button
              key={i}
              className={'btn btn-sm quiz-opt' + (used.includes(i) ? (c.ok ? ' right' : ' wrong') : '')}
              style={{ margin: 0, outline: hintLevel >= 1 && c.ok && !used.includes(i) ? '3px dashed #f39a3c' : undefined }}
              onClick={() => fire(i)}
              disabled={solved || used.includes(i)}
            >
              {used.includes(i) ? (c.ok ? '✓ ' : '✗ ') : '⚡ '}
              {c.text}
              {used.includes(i) && c.ok && (
                <span className="mono" style={{ color: pal.good }}>
                  {' '}
                  [{c.cite}]
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="slider-row">
          <label>Wraith strength</label>
          <span className="mono">{Math.max(0, Math.round(hp * 100))}%</span>
          <div style={{ gridColumn: '1/-1' }}>
            <Bar value={Math.max(0, hp)} color={pal.bad} />
          </div>
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Retrieved context">
          <p>The top-4 chunks were pasted into the model’s prompt. A grounded answer only says what they support, cites them, and checks they’re current.</p>
          {retrieved.map((i) => (
            <div key={i} className="card cream" style={{ boxShadow: 'none', padding: '8px 10px', marginBottom: 8 }}>
              <span className="pill">{CHUNKS[i].id}</span>
              <p style={{ margin: '6px 0 0' }}>{CHUNKS[i].text}</p>
            </div>
          ))}
        </LensPanel>
      )}
    </>
  )
}

export const world8: WorldDef = {
  id: 8,
  name: 'The Living Library',
  concept: 'RAG: chunking, embedding, vector search, grounding',
  oneLiner: 'Look it up before you answer.',
  techTerm: 'retrieval-augmented generation (RAG)',
  explainBack: 'RAG chops documents into chunks, embeds them, retrieves the ones closest to the question and puts them in the prompt, so answers are grounded in real, current facts.',
  island: { top: '#bfe8c9', side: '#7fb78f', trim: '#4cc36b' },
  camera: { pos: [0, 4.5, 12], target: [0, 2.6, 0] },
  deepDive:
    'index: chunk(doc) → embed(chunk) → vector store\nquery: q = embed(question); top_k = argmax_k cos(q, chunkᵢ)\nprompt = system + top_k chunks + question → LLM\nGrounding check: every claim must cite a retrieved chunk.',
  card: {
    term: 'RAG',
    def: 'Retrieval-Augmented Generation: fetch relevant documents at question time and give them to the model, so it answers from facts instead of memory.',
    leavesOut: 'RAG reduces hallucination but doesn’t eliminate it; retrieval can miss, and models can still misread sources.',
  },
  quiz: [
    {
      q: 'Why does RAG reduce hallucinations?',
      options: ['It makes the model bigger', 'It gives the model relevant, real facts to answer from', 'It blocks hard questions', 'It uses higher temperature'],
      answer: 1,
      why: 'Answers are grounded in retrieved text instead of guesses.',
    },
    {
      q: 'How are the “closest” chunks found?',
      options: ['Alphabetically', 'By comparing embedding vectors (e.g. cosine similarity)', 'By file size', 'Randomly'],
      answer: 1,
      why: 'Question and chunks are embedded, then compared.',
    },
    {
      q: 'A retrieved chunk is from 2023 but the question asks about 2025. What should a grounded answer do?',
      options: ['Use it anyway', 'Prefer the current source and ignore the stale one', 'Make up a compromise', 'Refuse to answer anything'],
      answer: 1,
      why: 'Retrieval can surface outdated facts; good answers check what applies.',
    },
  ],
  puzzles: [
    {
      id: 'w8p1',
      title: 'The Chunking Blade',
      objective: 'Cut the handbook into chunks that each cover one topic.',
      hints: ['The glowing ✂ tabs are where to cut.', 'Remote work (2 sentences), parking (2), snacks (2).', 'Cut before “Parking:” and before “Snacks:”.'],
      card: { term: 'Chunking', def: 'Splitting documents into small passages so search can find just the relevant part.', leavesOut: 'Chunk size is a real trade-off; teams tune it with evaluations.' },
      Component: ChunkPuzzle,
    },
    {
      id: 'w8p2',
      title: 'The Question Beam',
      objective: 'Choose top-k so both 2025 policy chunks come back with minimal noise.',
      hints: ['The glowing books are the ones you need.', 'Open the Lens (L) to see the similarity ranking.', 'k = 2 or 3.'],
      card: { term: 'Vector search', def: 'Finding the stored vectors most similar to a query vector, usually by cosine similarity.', leavesOut: 'Large stores use approximate indexes (HNSW, IVF) and often re-rank results.' },
      Component: RetrievePuzzle,
    },
    {
      id: 'w8p3',
      title: 'Boss · Hallucination Wraith',
      objective: 'Defeat the Wraith using only claims grounded in retrieved chunks.',
      boss: true,
      timeLimit: 120,
      hints: ['Outlined claims are grounded.', 'Check each claim against the Lens. Watch out for the 2023 pilot.', 'Fire the three claims that cite policy-2025.'],
      card: { term: 'Grounding', def: 'Making every claim in an answer traceable to a source, ideally with a citation.', leavesOut: 'Automatic grounding checks are still imperfect; human review matters for high stakes.' },
      Component: WraithBoss,
    },
  ],
}
