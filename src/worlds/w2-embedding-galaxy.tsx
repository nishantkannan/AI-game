import { useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sparkles } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import { Beam, Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette } from '../state/game'
import { Dock, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]

/* Each word is a sparse feature vector (D dims). A fixed linear projection maps it to 3D,
   the same way real 384-d embeddings get projected for display. Cosine is computed in full D. */
const DIMS = ['royal', 'female', 'person', 'animal', 'feline', 'canine', 'young', 'food', 'fruit', 'place', 'capital', 'fr', 'jp', 'it', 'vehicle', 'big', 'rail', 'small', 'wild', 'noodle'] as const
type Dim = (typeof DIMS)[number]
// Projection directions, laid out so clusters spread across the screen plane (x/y), with gentle depth.
const DIR: Record<Dim, V3> = {
  person: [3.9, 0.9, 0],
  royal: [-0.5, 2.0, -0.3],
  female: [1.0, -0.9, 0.9],
  young: [-0.6, -0.7, 0.5],
  animal: [3.2, -3.4, -1],
  feline: [-1.0, 0.3, -0.6],
  canine: [1.0, -0.3, 0.6],
  wild: [-0.4, 0.8, -0.8],
  food: [-3.4, -3.4, 0.6],
  fruit: [0.8, 0.5, 1.0],
  noodle: [-0.7, 0.6, 0.5],
  place: [-4.8, 1.8, -1],
  capital: [-0.5, 1.4, 0.8],
  fr: [-0.8, -0.6, -0.8],
  jp: [0.7, -0.6, 0.8],
  it: [0.1, 0.5, 0.2],
  vehicle: [0.3, 4.9, -1.5],
  big: [0.8, 0.3, 0.4],
  rail: [-0.8, 0.5, 0.4],
  small: [0.3, -0.7, -0.3],
}
const W: Record<string, Partial<Record<Dim, number>>> = {
  man: { person: 1 },
  woman: { person: 1, female: 1 },
  king: { person: 1, royal: 1 },
  queen: { person: 1, royal: 1, female: 1 },
  boy: { person: 1, young: 0.6 },
  girl: { person: 1, female: 1, young: 0.6 },
  prince: { person: 1, royal: 1, young: 0.6 },
  cat: { animal: 1, feline: 1 },
  kitten: { animal: 1, feline: 1, young: 0.6 },
  lion: { animal: 1, feline: 1, wild: 0.8 },
  dog: { animal: 1, canine: 1 },
  puppy: { animal: 1, canine: 1, young: 0.6 },
  wolf: { animal: 1, canine: 1, wild: 0.8 },
  pizza: { food: 1, it: 0.6 },
  pasta: { food: 1, it: 0.6, noodle: 0.5 },
  sushi: { food: 1, jp: 0.6 },
  ramen: { food: 1, jp: 0.6, noodle: 0.5 },
  banana: { food: 1, fruit: 1 },
  apple: { food: 1, fruit: 1, small: 0.3 },
  france: { place: 1, fr: 1 },
  paris: { place: 1, capital: 1, fr: 1 },
  japan: { place: 1, jp: 1 },
  tokyo: { place: 1, capital: 1, jp: 1 },
  italy: { place: 1, it: 1 },
  rome: { place: 1, capital: 1, it: 1 },
  car: { vehicle: 1 },
  bus: { vehicle: 1, big: 0.6 },
  train: { vehicle: 1, big: 0.6, rail: 0.7 },
  bike: { vehicle: 1, small: 0.6 },
}
const vec = (w: string) => DIMS.map((d) => W[w][d] ?? 0)
const add = (a: number[], b: number[], s = 1) => a.map((x, i) => x + s * b[i])
const cos = (a: number[], b: number[]) => {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0)
  const na = Math.hypot(...a)
  const nb = Math.hypot(...b)
  return na && nb ? dot / (na * nb) : 0
}
const OFFSET: V3 = [0, 4.4, 0]
const project = (v: number[]): V3 => {
  const p: V3 = [...OFFSET]
  DIMS.forEach((d, i) => {
    p[0] += DIR[d][0] * v[i]
    p[1] += DIR[d][1] * v[i]
    p[2] += DIR[d][2] * v[i]
  })
  return p
}
const POS: Record<string, V3> = Object.fromEntries(Object.keys(W).map((w) => [w, project(vec(w))]))
const nearest = (v: number[], exclude: string[] = [], pool = Object.keys(W)) =>
  pool
    .filter((w) => !exclude.includes(w))
    .map((w) => ({ w, c: cos(v, vec(w)) }))
    .sort((a, b) => b.c - a.c)

const CLUSTERS = [
  { name: 'People', words: ['man', 'woman', 'king', 'queen', 'boy', 'girl', 'prince'] },
  { name: 'Animals', words: ['cat', 'kitten', 'lion', 'dog', 'puppy', 'wolf'] },
  { name: 'Food', words: ['pizza', 'pasta', 'sushi', 'ramen', 'banana', 'apple'] },
  { name: 'Places', words: ['france', 'paris', 'japan', 'tokyo', 'italy', 'rome'] },
  { name: 'Vehicles', words: ['car', 'bus', 'train', 'bike'] },
]
const centre = (ws: string[]): V3 => {
  const s = ws.reduce((a, w) => [a[0] + POS[w][0], a[1] + POS[w][1], a[2] + POS[w][2]], [0, 0, 0])
  return [s[0] / ws.length, s[1] / ws.length, s[2] / ws.length]
}

function Star({
  word,
  color,
  onClick,
  onHover,
  highlight,
  dim,
  note,
}: {
  word: string
  color: string
  onClick?: () => void
  onHover?: (h: boolean) => void
  highlight?: boolean
  dim?: boolean
  note?: string
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.8
  })
  return (
    <group position={POS[word]}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover?.(true)
          if (onClick) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHover?.(false)
          document.body.style.cursor = ''
        }}
        scale={highlight ? 1.6 : 1}
      >
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={highlight ? '#ffd34d' : color} emissive={highlight ? '#ffd34d' : color} emissiveIntensity={0.6} transparent opacity={dim ? 0.3 : 1} />
      </mesh>
      <Html position={[0, 0.42, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
        <div className={'label3d small' + (dim ? ' muted' : '')} style={{ opacity: dim ? 0.5 : 1 }}>
          {word}
          {note && <span className="mono"> {note}</span>}
        </div>
      </Html>
    </group>
  )
}

function GalaxyBackdrop() {
  return (
    <>
      <mesh position={OFFSET}>
        <sphereGeometry args={[9.5, 32, 16]} />
        <meshBasicMaterial color="#2a2350" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      <Sparkles position={OFFSET} count={120} scale={[16, 10, 16]} size={3} speed={0.3} color="#cbb8ff" />
    </>
  )
}

/* -------------------- Puzzle 1 · Drop new words into the galaxy -------------------- */
const DROPS = [
  { word: 'kitten', cluster: 'Animals' },
  { word: 'bus', cluster: 'Vehicles' },
  { word: 'banana', cluster: 'Food' },
]

function DropPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [di, setDi] = useState(0)
  const placed = DROPS.slice(0, di).map((d) => d.word)
  const current = DROPS[Math.min(di, DROPS.length - 1)]
  const hidden = DROPS.map((d) => d.word).filter((w) => !placed.includes(w))
  const drop = (name: string) => {
    if (solved || di >= DROPS.length) return
    if (name !== current.cluster) return onWrong(`“${current.word}” doesn’t mean anything like ${name.toLowerCase()}. Where do similar meanings live?`)
    sfx.good()
    echoMood('happy', 800)
    if (di + 1 >= DROPS.length) {
      setDi(di + 1)
      onSolve()
    } else setDi(di + 1)
  }
  const nn = nearest(vec(current.word), [current.word]).slice(0, 4)
  return (
    <>
      <T3D.In>
        <GalaxyBackdrop />
        {Object.keys(W)
          .filter((w) => !hidden.includes(w))
          .map((w) => (
            <Star key={w} word={w} color={pal.vector} highlight={placed.includes(w)} />
          ))}
        {CLUSTERS.map((c) => {
          const p = centre(c.words.filter((w) => !hidden.includes(w)))
          const nudge = hintLevel >= 1 && c.name === current.cluster && !solved
          return (
            <group key={c.name} position={p}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation()
                  drop(c.name)
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <sphereGeometry args={[1.5, 24, 16]} />
                <meshBasicMaterial color={nudge ? '#ffd34d' : '#b9a6ff'} transparent opacity={nudge ? 0.35 : 0.14} depthWrite={false} />
              </mesh>
              <Label position={[0, 1.75, 0]} className="small">
                {c.name.toUpperCase()}
              </Label>
            </group>
          )
        })}
      </T3D.In>
      <Dock title={di < DROPS.length ? `New word: “${current.word}”` : 'All words placed!'}>
        <p className="muted" style={{ marginTop: 0 }}>
          In an embedding, <b>meaning is a position</b>. Click the nebula where “{current.word}” belongs. ({Math.min(di, DROPS.length)}/{DROPS.length})
        </p>
        <div className="row">
          {DROPS.map((d, i) => (
            <span key={d.word} className={'chip' + (i < di ? ' lit' : '')}>
              {i < di ? '✓ ' : ''}
              {d.word}
            </span>
          ))}
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title={`Vector for “${current.word}”`}>
          <p>Each word is a list of numbers. Here are the non-zero dimensions (real models use 384+ dimensions you can’t name):</p>
          <table>
            <tbody>
              {DIMS.map((d, i) => ({ d, v: vec(current.word)[i] }))
                .filter((x) => x.v)
                .map((x) => (
                  <tr key={x.d}>
                    <td>{x.d}</td>
                    <td>{x.v.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p>Projected 3D position:</p>
          <p className="mono">[{POS[current.word].map((x) => x.toFixed(2)).join(', ')}]</p>
          <p>Nearest neighbours by cosine similarity:</p>
          <table>
            <tbody>
              {nn.map((n) => (
                <tr key={n.w}>
                  <td>{n.w}</td>
                  <td>{n.c.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Puzzle 2 · Find the nearest neighbour -------------------- */
const NN_ROUNDS = ['cat', 'paris']

function NeighbourPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [ri, setRi] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const [tried, setTried] = useState<string[]>([])
  const target = NN_ROUNDS[Math.min(ri, NN_ROUNDS.length - 1)]
  const ranking = useMemo(() => nearest(vec(target), [target]), [target])
  const best = ranking[0].w
  const pick = (w: string) => {
    if (solved || w === target) return
    setTried((t) => [...t, w])
    const c = cos(vec(target), vec(w))
    if (w !== best) return onWrong(`cos(${target}, ${w}) = ${c.toFixed(2)}. Something is closer!`)
    sfx.good()
    echoMood('happy', 800)
    if (ri + 1 >= NN_ROUNDS.length) onSolve()
    else {
      setRi(ri + 1)
      setTried([])
    }
  }
  return (
    <>
      <T3D.In>
        <GalaxyBackdrop />
        {Object.keys(W).map((w) => {
          const c = cos(vec(target), vec(w))
          const showNote = w !== target && (hover === w || tried.includes(w) || solved)
          return (
            <Star
              key={w}
              word={w}
              color={w === target ? pal.token : pal.vector}
              highlight={w === target || (hintLevel >= 1 && w === best && !solved)}
              onClick={() => pick(w)}
              onHover={(h) => setHover(h ? w : null)}
              note={showNote ? c.toFixed(2) : undefined}
            />
          )
        })}
        {hover && hover !== target && <Beam from={POS[target]} to={POS[hover]} color="#ffd34d" width={0.04} opacity={0.8} />}
      </T3D.In>
      <Dock title={`Round ${ri + 1}/${NN_ROUNDS.length}: closest to “${target}”`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Hover stars to see their <b>cosine similarity</b> to “{target}” (1.0 = same direction, 0 = unrelated). Click the most similar word.
        </p>
      </Dock>
      {lensOpen && (
        <LensPanel title={`Cosine similarity to “${target}”`}>
          <p>cos(a, b) = (a · b) / (|a| |b|). It measures the angle between two vectors.</p>
          <table>
            <thead>
              <tr>
                <th>word</th>
                <th>cos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 8).map((n) => (
                <tr key={n.w}>
                  <td>{n.w}</td>
                  <td>{n.c.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Boss · Vector arithmetic gates -------------------- */
const GATES = [
  { start: 'king', goal: 'queen' },
  { start: 'paris', goal: 'tokyo' },
]

function ArithmeticBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [gi, setGi] = useState(0)
  const [minus, setMinus] = useState<string | null>(null)
  const [plus, setPlus] = useState<string | null>(null)
  const gate = GATES[Math.min(gi, GATES.length - 1)]
  const answer = gi === 0 ? ['man', 'woman'] : ['france', 'japan']
  const result = minus && plus ? add(add(vec(gate.start), vec(minus), -1), vec(plus)) : null
  const land = result ? nearest(result, [gate.start, minus!, plus!])[0] : null
  const mid = minus ? project(add(vec(gate.start), vec(minus), -1)) : null
  const end = result ? project(result) : null

  const pick = (w: string) => {
    if (solved || w === gate.start) return
    sfx.select()
    if (!minus) setMinus(w)
    else if (!plus) setPlus(w)
  }
  const fly = () => {
    if (!land) return
    sfx.whoosh()
    if (land.w !== gate.goal) {
      onWrong(`${gate.start} − ${minus} + ${plus} landed nearest “${land.w}”, not “${gate.goal}”.`)
      setMinus(null)
      setPlus(null)
      return
    }
    echoMood('happy')
    if (gi + 1 >= GATES.length) onSolve()
    else {
      setGi(gi + 1)
      setMinus(null)
      setPlus(null)
    }
  }
  return (
    <>
      <T3D.In>
        <GalaxyBackdrop />
        {Object.keys(W).map((w) => (
          <Star
            key={w}
            word={w}
            color={w === gate.goal ? pal.good : w === gate.start ? pal.token : pal.vector}
            highlight={w === minus || w === plus || (hintLevel >= 1 && answer.includes(w) && w !== minus && w !== plus)}
            onClick={() => pick(w)}
            note={w === minus ? '−' : w === plus ? '+' : w === gate.goal ? '🏁' : undefined}
          />
        ))}
        {mid && <Beam from={POS[gate.start]} to={mid} color={pal.bad} width={0.06} arrow />}
        {mid && end && <Beam from={mid} to={end} color={pal.good} width={0.06} arrow />}
        {end && (
          <mesh position={end}>
            <coneGeometry args={[0.25, 0.6, 8]} />
            <meshStandardMaterial color="#f39a3c" />
          </mesh>
        )}
      </T3D.In>
      <Dock title={`Gate ${gi + 1}/${GATES.length}: steer from “${gate.start}” to “${gate.goal}”`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Click one star to <b>subtract</b>, then one to <b>add</b>. Directions in embedding space carry meaning.
        </p>
        <p className="mono" style={{ fontSize: '1.05em' }}>
          {gate.start} − <span style={{ color: pal.bad }}>{minus ?? '?'}</span> + <span style={{ color: pal.good }}>{plus ?? '?'}</span> ={' '}
          {land ? land.w : '?'}
        </p>
        <div className="row">
          <button className="btn btn-yellow" onClick={fly} disabled={!land || solved}>
            🚀 Fly the ship
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setMinus(null)
              setPlus(null)
            }}
          >
            Clear
          </button>
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Vector arithmetic">
          <p>The ship’s position is computed dimension by dimension:</p>
          <table>
            <thead>
              <tr>
                <th>dim</th>
                <th>{gate.start}</th>
                <th>−{minus ?? '?'}</th>
                <th>+{plus ?? '?'}</th>
                <th>=</th>
              </tr>
            </thead>
            <tbody>
              {DIMS.map((d, i) => {
                const a = vec(gate.start)[i]
                const b = minus ? vec(minus)[i] : 0
                const c = plus ? vec(plus)[i] : 0
                if (!a && !b && !c) return null
                return (
                  <tr key={d}>
                    <td>{d}</td>
                    <td>{a.toFixed(1)}</td>
                    <td>{b.toFixed(1)}</td>
                    <td>{c.toFixed(1)}</td>
                    <td>{(a - b + c).toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {land && (
            <p>
              Nearest word to the result: <b>{land.w}</b> (cos {land.c.toFixed(3)})
            </p>
          )}
        </LensPanel>
      )}
    </>
  )
}

const cam = { pos: [0, 6.8, 19] as V3, target: [-0.3, 4.4, 0] as V3 }

export const world2: WorldDef = {
  id: 2,
  name: 'Embedding Galaxy',
  concept: 'Embeddings & vector similarity',
  oneLiner: 'Meaning is a position.',
  techTerm: 'embeddings',
  explainBack: 'Every token becomes a vector, a point in space. Similar meanings sit close together, measured by cosine similarity.',
  island: { top: '#c3b6ef', side: '#8d7bc9', trim: '#8b6cf0' },
  camera: cam,
  deepDive:
    'cos(a,b) = Σ aᵢbᵢ / (‖a‖‖b‖)\nAnalogy: argmax_w cos(w, king − man + woman)\nReal embeddings (e.g. all-MiniLM-L6-v2) are 384-d; we project to 3D with PCA/UMAP for display.',
  card: {
    term: 'Embedding',
    def: 'A list of numbers (a vector) that represents a token’s meaning. Similar meanings → nearby vectors.',
    leavesOut: 'Real embedding dimensions aren’t labelled “royal” or “female”. Meaning is spread across hundreds of unnamed numbers.',
  },
  quiz: [
    {
      q: 'In an embedding space, what does it mean if two words are close together?',
      options: ['They’re spelled similarly', 'They have similar meanings or usage', 'They’re the same length', 'They appeared in the same sentence once'],
      answer: 1,
      why: 'Distance and angle encode similarity of meaning.',
    },
    {
      q: 'What does cosine similarity measure?',
      options: ['The angle between two vectors', 'How many letters match', 'Word frequency', 'The length of a sentence'],
      answer: 0,
      why: '1.0 means pointing the same way; 0 means unrelated.',
    },
    {
      q: 'king − man + woman lands near…',
      options: ['prince', 'queen', 'man', 'paris'],
      answer: 1,
      why: 'Directions like “male → female” are consistent across the space.',
    },
  ],
  puzzles: [
    {
      id: 'w2p1',
      title: 'Star Drop',
      objective: 'Drop each new word into the nebula where its meaning belongs.',
      hints: ['The glowing nebula is the right one.', 'A kitten is a young cat. Look for where cat, dog and lion live.', 'kitten → Animals, bus → Vehicles, banana → Food.'],
      card: { term: 'Vector', def: 'An ordered list of numbers. In AI, a point in a high-dimensional space.', leavesOut: 'We show 3 dimensions; models use hundreds or thousands.' },
      Component: DropPuzzle,
    },
    {
      id: 'w2p2',
      title: 'Nearest Neighbour',
      objective: 'Find the star with the highest cosine similarity to the blue one.',
      hints: ['The highlighted star is the closest.', 'Look for a word that shares almost every feature, like a younger version.', 'cat → kitten, paris → france.'],
      card: { term: 'Cosine similarity', def: 'A score from −1 to 1 for how closely two vectors point the same way.', leavesOut: 'Search systems approximate it with indexes (like HNSW) to compare millions of vectors fast.' },
      Component: NeighbourPuzzle,
    },
    {
      id: 'w2p3',
      title: 'Boss · Arithmetic Gates',
      objective: 'Steer the ship with vector arithmetic to land on the 🏁 word.',
      boss: true,
      timeLimit: 120,
      hints: ['The highlighted stars are the ones to use.', 'Subtract what you want to remove (male), add what you want (female).', 'king − man + woman; paris − france + japan.'],
      card: { term: 'Vector arithmetic', def: 'Adding and subtracting embeddings moves along directions of meaning.', leavesOut: 'Real analogies are noisy and only approximately land on the right word.' },
      Component: ArithmeticBoss,
    },
  ],
}
