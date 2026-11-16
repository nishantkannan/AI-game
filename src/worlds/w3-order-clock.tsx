import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { Block, Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette, useGame } from '../state/game'
import { Bar, Dock, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]

/* Sinusoidal positional encoding (Vaswani et al.), small d and base so differences are visible. */
const D = 8
const BASE = 100
export function posEnc(pos: number) {
  const out: number[] = []
  for (let i = 0; i < D / 2; i++) {
    const f = 1 / Math.pow(BASE, (2 * i) / D)
    out.push(Math.sin(pos * f), Math.cos(pos * f))
  }
  return out
}

/** Toy 4-d word embeddings for the bag-of-words demo. */
const EMB: Record<string, number[]> = {
  dog: [1, 0, 0.3, 0],
  man: [0, 1, 0, 0.3],
  bites: [0.2, 0.2, 1, 0],
}
const sumVec = (words: string[], withPos: boolean) =>
  [0, 1, 2, 3].map((d) => words.reduce((s, w, i) => s + EMB[w][d] + (withPos ? posEnc(i)[d] : 0), 0))

/* --------- shared 3D bits --------- */
function ClockBackdrop() {
  const hand = useRef<THREE.Group>(null)
  const hand2 = useRef<THREE.Group>(null)
  const reduced = useGame((s) => s.reducedMotion)
  useFrame((_, dt) => {
    if (reduced) return
    if (hand.current) hand.current.rotation.z -= dt * 0.6
    if (hand2.current) hand2.current.rotation.z -= dt * 0.08
  })
  return (
    <group position={[0, 5.2, -8]} scale={0.8}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[3.3, 3.3, 0.4, 48]} />
        <meshStandardMaterial color="#fffdf6" />
      </mesh>
      <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.6, 3.6, 0.3, 48]} />
        <meshStandardMaterial color="#4dd0c8" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 2.8, Math.cos(a) * 2.8, 0.22]}>
            <boxGeometry args={[0.12, i % 3 === 0 ? 0.5 : 0.25, 0.05]} />
            <meshStandardMaterial color="#2b2420" />
          </mesh>
        )
      })}
      <group ref={hand} position={[0, 0, 0.26]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.14, 2.2, 0.05]} />
          <meshStandardMaterial color="#f39a3c" />
        </mesh>
      </group>
      <group ref={hand2} position={[0, 0, 0.3]}>
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[0.2, 1.4, 0.05]} />
          <meshStandardMaterial color="#2b2420" />
        </mesh>
      </group>
      {/* sine wave ribbon */}
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={'w' + i} position={[-4.4 + i * 0.3, -4 + Math.sin(i * 0.5) * 0.35, 0.3]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial color="#4dd0c8" />
        </mesh>
      ))}
    </group>
  )
}

/** A clickable dial that cycles through positions 0..n-1. */
function Dial({ position, value, n, onTurn, glow }: { position: V3; value: number; n: number; onTurn: () => void; glow?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const target = -(value / n) * Math.PI * 2
    ref.current.rotation.z += (target - ref.current.rotation.z) * 0.2
  })
  return (
    <group position={position}>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onTurn()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
        castShadow
      >
        <cylinderGeometry args={[0.45, 0.5, 0.25, 24]} />
        <meshStandardMaterial color={glow ? '#ffd34d' : '#fffdf6'} emissive={glow ? '#ffd34d' : '#000'} emissiveIntensity={glow ? 0.4 : 0} />
      </mesh>
      <group ref={ref} position={[0, 0, 0.14]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.09, 0.42, 0.04]} />
          <meshStandardMaterial color="#2b2420" />
        </mesh>
      </group>
    </group>
  )
}

/** Position stamp: the PE vector drawn as 8 little bars (sine/cosine pairs). */
function Stamp({ position, pos, color }: { position: V3; pos: number; color: string }) {
  const pe = posEnc(pos)
  return (
    <group position={position}>
      {pe.map((v, i) => {
        const h = 0.08 + ((v + 1) / 2) * 0.6
        return (
          <mesh key={i} position={[(i - 3.5) * 0.13, h / 2, 0]}>
            <boxGeometry args={[0.1, h, 0.1]} />
            <meshStandardMaterial color={i % 2 ? '#2b2420' : color} />
          </mesh>
        )
      })}
    </group>
  )
}

const slotX = (p: number, n: number) => (p - (n - 1) / 2) * 2.3

function DialSentence({
  tokens,
  positions,
  setPositions,
  answer,
  hintLevel,
  solved,
}: {
  tokens: string[]
  positions: number[]
  setPositions: (p: number[]) => void
  answer: number[]
  hintLevel: number
  solved: boolean
}) {
  const n = tokens.length
  const teal = '#4dd0c8'
  const pal = usePalette()
  return (
    <>
      {Array.from({ length: n }, (_, p) => (
        <group key={'slot' + p} position={[slotX(p, n), 0.05, 1.6]}>
          <RoundedBox args={[1.9, 0.12, 1.2]} radius={0.05} receiveShadow>
            <meshStandardMaterial color="#e8faf8" />
          </RoundedBox>
          <Label position={[0, 0.2, 0.9]} className="small mono">
            pos {p}
          </Label>
        </group>
      ))}
      {tokens.map((t, i) => {
        const p = positions[i]
        const dupes = positions.slice(0, i).filter((x) => x === p).length
        const glow = hintLevel >= 1 && p !== answer[i] && !solved
        return (
          <group key={t + i}>
            <Block position={[slotX(p, n), 1 + dupes * 1.2, 1.6]} size={[1.7, 0.8, 0.8]} color={pal.token} label={t} />
            <Stamp position={[slotX(p, n), 1.55 + dupes * 1.2, 1.6]} pos={p} color={teal} />
            <Dial
              position={[slotX(p, n), 0.5 + dupes * 1.2, 2.3]}
              value={p}
              n={n}
              glow={glow}
              onTurn={() => {
                if (solved) return
                sfx.click()
                const next = [...positions]
                next[i] = (p + 1) % n
                setPositions(next)
              }}
            />
          </group>
        )
      })}
    </>
  )
}

/* -------------------- Puzzle 1 · Bag of words -------------------- */
function BagPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [stage, setStage] = useState<'ask' | 'stamp'>('ask')
  const [stamped, setStamped] = useState(false)
  const A = ['dog', 'bites', 'man']
  const B = ['man', 'bites', 'dog']
  const sa = sumVec(A, stamped)
  const sb = sumVec(B, stamped)
  const answer = (same: boolean) => {
    if (!same) return onWrong('Without positions, attention just mixes a set of tokens. The set {dog, bites, man} is identical.')
    sfx.good()
    echoMood('happy', 800)
    setStage('stamp')
  }
  const pull = () => {
    if (solved) return
    sfx.merge()
    setStamped(true)
    setTimeout(onSolve, 600)
  }
  return (
    <>
      <T3D.In>
        <ClockBackdrop />
        {[A, B].map((s, k) => (
          <group key={k} position={[k ? 3.6 : -3.6, 0, 1]}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[1.8, 1.2, 1, 32, 1, true]} />
              <meshStandardMaterial color={k ? '#f37c6b' : '#29b6e8'} side={THREE.DoubleSide} />
            </mesh>
            {s.map((w, i) => (
              <Block key={w} position={stamped ? [(i - 1) * 1.15, 2.2, 0] : [Math.sin(i * 2.1) * 0.6, 1.1 + i * 0.35, Math.cos(i * 2.1) * 0.5]} size={[1.05, 0.6, 0.6]} color={pal.token} label={w} labelClass="mono small" />
            ))}
            {stamped &&
              s.map((_, i) => <Stamp key={'s' + i} position={[(i - 1) * 1.15, 2.6, 0]} pos={i} color="#4dd0c8" />)}
            <Label position={[0, 3.6, 0]}>“{s.join(' ')}”</Label>
          </group>
        ))}
        {stage === 'stamp' && (
          <group position={[0, 0, 1]}>
            <mesh position={[0, 0.8, 0]} castShadow>
              <boxGeometry args={[0.6, 1.6, 0.6]} />
              <meshStandardMaterial color="#4a4f5a" />
            </mesh>
            <mesh
              position={[0, 1.9, 0]}
              rotation={[0, 0, stamped ? -0.8 : 0.8]}
              onClick={(e) => {
                e.stopPropagation()
                pull()
              }}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = '')}
            >
              <cylinderGeometry args={[0.1, 0.1, 1.4, 8]} />
              <meshStandardMaterial color={hintLevel >= 1 ? '#ffd34d' : '#f39a3c'} emissive="#ffd34d" emissiveIntensity={hintLevel >= 1 ? 0.6 : 0} />
            </mesh>
            <Label position={[0, 3.1, 0]} className="small">
              STAMP LEVER
            </Label>
          </group>
        )}
      </T3D.In>
      <Dock title={stage === 'ask' ? 'Same or different?' : 'Pull the stamp lever'}>
        {stage === 'ask' ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Attention blends tokens together like ingredients in a bowl. <b>Without any position information</b>, can the model tell these two sentences apart?
            </p>
            <div className="row">
              <button className="btn" onClick={() => answer(false)}>
                Different meanings
              </button>
              <button className="btn" onClick={() => answer(true)}>
                Identical bowls
              </button>
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            Right: same ingredients, same result. Click the lever (or the button) to add a <b>position stamp</b> to every token.
            <br />
            <button className="btn btn-yellow" style={{ marginTop: 10 }} onClick={pull} disabled={solved}>
              Stamp positions
            </button>
          </p>
        )}
      </Dock>
      {lensOpen && (
        <LensPanel title="Bowl contents">
          <p>Sum of the token vectors in each bowl{stamped ? ' (embedding + position stamp)' : ''}:</p>
          <table>
            <thead>
              <tr>
                <th>dim</th>
                <th>dog bites man</th>
                <th>man bites dog</th>
              </tr>
            </thead>
            <tbody>
              {sa.map((v, d) => (
                <tr key={d} style={{ background: Math.abs(v - sb[d]) > 1e-6 ? '#fff3c4' : undefined }}>
                  <td>{d}</td>
                  <td>{v.toFixed(2)}</td>
                  <td>{sb[d].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: stamped ? pal.good : pal.bad }}>{stamped ? '✓ The bowls now differ: order is visible.' : '✗ Identical: order is invisible.'}</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Puzzle 2 · Tune the dials -------------------- */
const P2_TOKENS = ['prompt', 'Echo', 'the', 'carries']
const P2_ANSWER = [3, 0, 2, 1]

function DialPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [positions, setPositions] = useState([0, 1, 2, 3])
  const order = [...P2_TOKENS.map((t, i) => ({ t, p: positions[i] }))].sort((a, b) => a.p - b.p)
  const check = () => {
    if (new Set(positions).size < positions.length) return onWrong('Two tokens share a position stamp. Each position must be unique.')
    if (positions.some((p, i) => p !== P2_ANSWER[i])) return onWrong(`That reads “${order.map((o) => o.t).join(' ')}”. Not quite the story!`)
    onSolve()
  }
  return (
    <>
      <T3D.In>
        <ClockBackdrop />
        <DialSentence tokens={P2_TOKENS} positions={positions} setPositions={setPositions} answer={P2_ANSWER} hintLevel={hintLevel} solved={solved} />
      </T3D.In>
      <Dock title="Stamp each token with its position">
        <p className="muted" style={{ marginTop: 0 }}>
          Tokens arrived shuffled. Click a token’s white dial to turn it; the sine-wave stamp above it changes. Make the sentence read in order.
        </p>
        <p className="mono">reads: “{order.map((o) => o.t).join(' ')}”</p>
        <button className="btn btn-yellow" onClick={check} disabled={solved}>
          Lock positions
        </button>
      </Dock>
      {lensOpen && <PELens tokens={P2_TOKENS} positions={positions} />}
    </>
  )
}

function PELens({ tokens, positions }: { tokens: string[]; positions: number[] }) {
  return (
    <LensPanel title="Position stamps">
      <p>
        PE(pos, 2i) = sin(pos / {BASE}^(2i/{D})), PE(pos, 2i+1) = cos(…). Each position gets a unique wave pattern that’s <b>added</b> to the token’s embedding.
      </p>
      {tokens.map((t, i) => (
        <div key={t} style={{ marginBottom: 10 }}>
          <div className="mono" style={{ fontSize: '.85em' }}>
            “{t}” · pos {positions[i]}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 3 }}>
            {posEnc(positions[i]).map((v, k) => (
              <div key={k} title={v.toFixed(3)}>
                <Bar value={(v + 1) / 2} color={k % 2 ? '#2b2420' : '#4dd0c8'} />
                <div className="mono" style={{ fontSize: '.62em', textAlign: 'center' }}>
                  {v.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </LensPanel>
  )
}

/* -------------------- Boss · Who bit whom? -------------------- */
const BOSS_TOKENS = ['dog', 'bites', 'man']
const BOSS_ROUNDS = [
  { picture: '🧍 → 🦷 → 🐕', meaning: 'The MAN bites the DOG (headline news!)', answer: [2, 1, 0], start: [0, 1, 2] },
  { picture: '🐕 → 🦷 → 🧍', meaning: 'The DOG bites the MAN (ouch)', answer: [0, 1, 2], start: [2, 1, 0] },
]

function OrderBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [ri, setRi] = useState(0)
  const [positions, setPositions] = useState(BOSS_ROUNDS[0].start)
  const round = BOSS_ROUNDS[Math.min(ri, BOSS_ROUNDS.length - 1)]
  const order = [...BOSS_TOKENS.map((t, i) => ({ t, p: positions[i] }))].sort((a, b) => a.p - b.p)
  const check = () => {
    if (new Set(positions).size < positions.length) return onWrong('Two tokens share a position. Every token needs a unique stamp.')
    if (positions.some((p, i) => p !== round.answer[i])) return onWrong(`“${order.map((o) => o.t).join(' ')}” means something else!`)
    sfx.good()
    echoMood('happy')
    if (ri + 1 >= BOSS_ROUNDS.length) onSolve()
    else {
      setRi(ri + 1)
      setPositions(BOSS_ROUNDS[ri + 1].start)
    }
  }
  return (
    <>
      <T3D.In>
        <ClockBackdrop />
        <DialSentence tokens={BOSS_TOKENS} positions={positions} setPositions={setPositions} answer={round.answer} hintLevel={hintLevel} solved={solved} />
      </T3D.In>
      <Dock title={`Round ${ri + 1}/2: same tokens, different meaning`}>
        <div style={{ fontSize: 34, textAlign: 'center' }} aria-hidden>
          {round.picture}
        </div>
        <p style={{ textAlign: 'center', margin: '4px 0 10px' }}>{round.meaning}</p>
        <p className="muted">Only the position stamps can change. Turn the dials so the sentence carries this meaning.</p>
        <p className="mono">reads: “{order.map((o) => o.t).join(' ')}”</p>
        <button className="btn btn-yellow" onClick={check} disabled={solved}>
          Lock positions
        </button>
      </Dock>
      {lensOpen && <PELens tokens={BOSS_TOKENS} positions={positions} />}
    </>
  )
}

export const world3: WorldDef = {
  id: 3,
  name: 'The Order Clock',
  concept: 'Positional encoding',
  oneLiner: 'Order has to be added in.',
  techTerm: 'positional encoding',
  explainBack: 'Attention on its own sees a bag of tokens. A position signal (a pattern of sine waves) is added to each token so word order matters.',
  island: { top: '#b5ebe5', side: '#79bdb5', trim: '#4dd0c8' },
  camera: { pos: [0, 5.5, 13], target: [0, 2, 0] },
  deepDive:
    'x_i = embedding(token_i) + PE(i)\nPE(pos,2k) = sin(pos / 10000^(2k/d))\nPE(pos,2k+1) = cos(pos / 10000^(2k/d))\nMany modern models use RoPE instead: rotate Q and K by a position-dependent angle.',
  card: {
    term: 'Positional encoding',
    def: 'A signal added to each token’s vector that tells the model where the token sits in the sequence.',
    leavesOut: 'Many modern LLMs use rotary (RoPE) or learned position schemes instead of fixed sine waves.',
  },
  quiz: [
    {
      q: 'Without position information, how does attention treat “dog bites man” vs “man bites dog”?',
      options: ['As opposites', 'As identical bags of tokens', 'It reverses them', 'It refuses to answer'],
      answer: 1,
      why: 'Attention is order-blind; it only sees which tokens are present.',
    },
    {
      q: 'How is position information usually given to the model?',
      options: ['By sorting tokens alphabetically', 'By adding a position signal to each token’s vector', 'By capitalising the first word', 'By adding spaces'],
      answer: 1,
      why: 'A position vector (e.g. sine waves) is added to the embedding.',
    },
    {
      q: 'Why sine waves of different frequencies?',
      options: ['They sound nice', 'They give every position a unique, smooth pattern', 'They make tokens shorter', 'They remove noise'],
      answer: 1,
      why: 'Fast and slow waves together create a unique fingerprint for each position.',
    },
  ],
  puzzles: [
    {
      id: 'w3p1',
      title: 'The Mixing Bowls',
      objective: 'Can attention tell “dog bites man” from “man bites dog”?',
      hints: ['Look at what’s inside each bowl.', 'Both bowls contain exactly the same three tokens.', 'Answer “Identical bowls”, then pull the lever.'],
      card: { term: 'Bag of tokens', def: 'Without positions, a set of tokens has no order. Attention alone can’t see the difference.', leavesOut: 'Causal masking in decoders leaks a little order information, but not enough on its own.' },
      Component: BagPuzzle,
    },
    {
      id: 'w3p2',
      title: 'Dial the Stamps',
      objective: 'Turn the dials so the tokens read “Echo carries the prompt”.',
      hints: ['Glowing dials are on the wrong position.', '“Echo” comes first (pos 0), then “carries”.', 'Echo=0, carries=1, the=2, prompt=3.'],
      card: { term: 'Sinusoidal encoding', def: 'Each position gets a fingerprint made of sine and cosine waves at different frequencies.', leavesOut: 'Real models use 512+ dimensions and base 10000.' },
      Component: DialPuzzle,
    },
    {
      id: 'w3p3',
      title: 'Boss · Who Bit Whom?',
      objective: 'Use only position stamps to make the tokens match each picture.',
      boss: true,
      timeLimit: 90,
      hints: ['Glowing dials need turning.', 'The biter comes first, the bitten comes last.', 'Round 1: man=0, bites=1, dog=2. Round 2: dog=0, bites=1, man=2.'],
      card: { term: 'Word order', def: 'Same tokens + different positions = different meaning. Position stamps make that visible to the model.', leavesOut: 'Models learn order effects statistically; they don’t parse grammar rules explicitly.' },
      Component: OrderBoss,
    },
  ],
}
