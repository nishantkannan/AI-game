import { useMemo, useState } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Block, Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette } from '../state/game'
import { Dock, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]
const show = (t: string) => t.replace(/ /g, '␣')

/** Lay out variable-width token blocks in a row; returns centres and widths. */
function layoutRow(tokens: string[], unit = 0.5, gap = 0.18) {
  const widths = tokens.map((t) => Math.max(0.7, t.length * unit + 0.25))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (tokens.length - 1)
  let x = -total / 2
  return widths.map((w) => {
    const c = x + w / 2
    x += w + gap
    return { x: c, w }
  })
}

/* -------------------- Puzzle 1 · Slice words into vocabulary pieces -------------------- */
const VOCAB = ['the', 'un', 'believ', 'able', 'token', 'iz', 'ing', 're', 'ed', 's']
const VOCAB_ID: Record<string, number> = { the: 1169, un: 403, believ: 6487, able: 540, token: 30001, iz: 528, ing: 278, re: 260, ed: 276, s: 82 }
const SLICE_WORDS = [
  { text: 'unbelievable', answer: [2, 8] },
  { text: 'tokenizing', answer: [5, 7] },
]

function segments(text: string, cuts: number[]) {
  const c = [0, ...[...cuts].sort((a, b) => a - b), text.length]
  const out: string[] = []
  for (let i = 0; i < c.length - 1; i++) out.push(text.slice(c[i], c[i + 1]))
  return out
}

function SlicePuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [wi, setWi] = useState(0)
  const [cuts, setCuts] = useState<number[]>([])
  const word = SLICE_WORDS[Math.min(wi, SLICE_WORDS.length - 1)]
  const letters = word.text.split('')
  const segs = segments(word.text, cuts)

  const xs = useMemo(() => {
    let off = 0
    return letters.map((_, i) => {
      if (cuts.includes(i)) off += 0.55
      return (i - (letters.length - 1) / 2) * 0.82 + off - (cuts.length * 0.55) / 2
    })
  }, [letters, cuts])

  const toggle = (c: number) => {
    if (solved) return
    sfx.slice()
    setCuts((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))
  }

  const forge = () => {
    const bad = segs.find((s) => !VOCAB.includes(s))
    if (bad) return onWrong(`“${bad}” isn’t in the vocabulary shelf. Every piece must be a known token.`)
    sfx.merge()
    echoMood('happy')
    if (wi + 1 < SLICE_WORDS.length) {
      setWi(wi + 1)
      setCuts([])
    } else onSolve()
  }

  let segIdx = 0
  const letterSeg = letters.map((_, i) => {
    if (cuts.includes(i)) segIdx++
    return segIdx
  })

  return (
    <>
      <T3D.In>
        {letters.map((l, i) => (
          <Block
            key={wi + '-' + i}
            position={[xs[i], 1, 0]}
            size={[0.72, 0.9, 0.72]}
            color={letterSeg[i] % 2 ? '#7fd3f2' : pal.token}
            label={l}
          />
        ))}
        {letters.slice(1).map((_, k) => {
          const c = k + 1
          const x = (xs[c - 1] + xs[c]) / 2
          const isCut = cuts.includes(c)
          const nudge = hintLevel >= 1 && word.answer.includes(c) && !isCut
          return (
            <group key={'g' + wi + c} position={[x, 1, 0]}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(c)
                }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')}
                onPointerOut={() => (document.body.style.cursor = '')}
              >
                <boxGeometry args={[0.22, 1.5, 1.2]} />
                <meshBasicMaterial
                  color={isCut ? pal.bad : nudge ? '#ffd34d' : '#ffffff'}
                  transparent
                  opacity={isCut ? 0.85 : nudge ? 0.75 : 0.18}
                  depthWrite={false}
                />
              </mesh>
            </group>
          )
        })}
        {/* vocabulary shelf */}
        <group position={[0, 0.4, -4.2]}>
          <RoundedBox args={[11, 0.3, 1.4]} radius={0.1} position={[0, -0.35, 0]} receiveShadow>
            <meshStandardMaterial color="#c99a6b" />
          </RoundedBox>
          {VOCAB.map((v, i) => (
            <Block key={v} position={[(i - 4.5) * 1.08, 0.15, 0]} size={[0.95, 0.6, 0.6]} color="#e8f7fd" label={v} labelClass="mono small" />
          ))}
          <Label position={[0, 1.2, 0]} className="small">
            VOCABULARY SHELF
          </Label>
        </group>
      </T3D.In>
      <Dock title={`Word ${wi + 1} of ${SLICE_WORDS.length}: “${word.text}”`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Click the gaps between letters to slice. Each piece must exist on the vocabulary shelf.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          {segs.map((s, i) => (
            <span key={i} className="chip" style={{ background: VOCAB.includes(s) ? '#dff5e4' : '#ffe1de' }}>
              {VOCAB.includes(s) ? '✓ ' : '✗ '}
              {s}
            </span>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-yellow" onClick={forge} disabled={solved}>
            Forge tokens
          </button>
          <button className="btn btn-sm" onClick={() => setCuts([])} disabled={solved}>
            Reset cuts
          </button>
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Token IDs">
          <p>The model never sees letters, only these integer IDs, one per token.</p>
          <table>
            <thead>
              <tr>
                <th>piece</th>
                <th>in vocab?</th>
                <th>token ID</th>
              </tr>
            </thead>
            <tbody>
              {segs.map((s, i) => (
                <tr key={i}>
                  <td>“{s}”</td>
                  <td>{VOCAB.includes(s) ? '✓ yes' : '✗ no'}</td>
                  <td>{VOCAB_ID[s] ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">IDs come from this world’s mini-vocabulary. Real vocabularies hold 50k–200k pieces.</p>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Puzzle 2 · BPE: merge the most frequent pair -------------------- */
const CORPUS = [
  { w: 'low', n: 5 },
  { w: 'lower', n: 2 },
  { w: 'newest', n: 6 },
  { w: 'widest', n: 3 },
]
function pairCounts(words: string[][]) {
  const m = new Map<string, number>()
  words.forEach((toks, i) => {
    for (let j = 0; j < toks.length - 1; j++) {
      const k = toks[j] + '\u0000' + toks[j + 1]
      m.set(k, (m.get(k) ?? 0) + CORPUS[i].n)
    }
  })
  return [...m.entries()].map(([k, n]) => ({ a: k.split('\u0000')[0], b: k.split('\u0000')[1], n }))
}
function applyMerge(toks: string[], a: string, b: string) {
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    if (i < toks.length - 1 && toks[i] === a && toks[i + 1] === b) {
      out.push(a + b)
      i++
    } else out.push(toks[i])
  }
  return out
}

function MergePuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [words, setWords] = useState(() => CORPUS.map((c) => c.w.split('')))
  const [merges, setMerges] = useState<string[]>([])
  const pairs = pairCounts(words)
  const max = Math.max(...pairs.map((p) => p.n))
  const shown = [...pairs].sort((x, y) => (x.a + x.b).localeCompare(y.a + y.b))
  const GOAL = 3

  const pick = (a: string, b: string, n: number) => {
    if (solved) return
    if (n < max) return onWrong(`“${a}+${b}” appears ${n}×, but some pair appears ${max}×. Count each row’s ×N too!`)
    sfx.merge()
    echoMood('happy', 800)
    const next = words.map((t) => applyMerge(t, a, b))
    setWords(next)
    const m = [...merges, a + b]
    setMerges(m)
    if (m.length >= GOAL) onSolve()
  }

  return (
    <>
      <T3D.In>
        {words.map((toks, r) => {
          const lay = layoutRow(toks, 0.42, 0.12)
          const z = -3.2 + r * 2
          return (
            <group key={r} position={[1.6, 0.7, z]}>
              <Label position={[lay[0].x - lay[0].w / 2 - 0.9, 0, 0]}>×{CORPUS[r].n}</Label>
              {toks.map((t, i) => (
                <Block key={i + t} position={[lay[i].x, 0, 0]} size={[lay[i].w, 0.75, 0.75]} color={t.length > 1 ? '#f39a3c' : pal.token} label={t} />
              ))}
            </group>
          )
        })}
        {/* the anvil */}
        <group position={[-6, 0, 0.5]}>
          <RoundedBox args={[1.6, 0.6, 1]} radius={0.1} position={[0, 0.9, 0]} castShadow>
            <meshStandardMaterial color="#4a4f5a" metalness={0.4} roughness={0.4} />
          </RoundedBox>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#3a3e47" />
          </mesh>
          <Label position={[0, 1.8, 0]} className="small">
            ANVIL · {merges.length}/{GOAL} merges
          </Label>
        </group>
      </T3D.In>
      <Dock title={`Merge round ${Math.min(merges.length + 1, GOAL)} of ${GOAL}`}>
        <p className="muted" style={{ marginTop: 0 }}>
          Byte-Pair Encoding builds a vocabulary by repeatedly fusing the <b>most frequent adjacent pair</b>. Each row appears ×N times in the training text.
        </p>
        <div className="row">
          {shown.map((p) => (
            <button
              key={p.a + p.b}
              className={'btn btn-sm mono' + (hintLevel >= 1 && p.n === max ? ' selected' : '')}
              onClick={() => pick(p.a, p.b, p.n)}
              disabled={solved}
            >
              {p.a}+{p.b}
              {hintLevel >= 3 && <span className="kbd">{p.n}</span>}
            </button>
          ))}
        </div>
        {merges.length > 0 && (
          <p style={{ marginBottom: 0 }}>
            New tokens:{' '}
            {merges.map((m) => (
              <span key={m} className="chip lit" style={{ marginRight: 4 }}>
                {m}
              </span>
            ))}
          </p>
        )}
      </Dock>
      {lensOpen && (
        <LensPanel title="Pair counts">
          <p>Count of each adjacent pair across the corpus (pair occurrences × word frequency):</p>
          <table>
            <thead>
              <tr>
                <th>pair</th>
                <th>count</th>
              </tr>
            </thead>
            <tbody>
              {[...pairs]
                .sort((x, y) => y.n - x.n)
                .map((p) => (
                  <tr key={p.a + p.b} style={{ background: p.n === max ? '#fff3c4' : undefined }}>
                    <td>
                      {p.a} + {p.b}
                    </td>
                    <td>{p.n}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </LensPanel>
      )}
    </>
  )
}

/* -------------------- Boss · Fit the sentence into the token cart -------------------- */
const SENTENCE = 'the theme of the thesis is the theory'
const CAPACITY = 22
const MAX_MERGES = 4
const CANDIDATES: [string, string][] = [
  ['t', 'h'],
  ['q', 'u'],
  ['th', 'e'],
  ['e', 'm'],
  ['the', ' '],
  ['i', 's'],
  ['x', 'y'],
  ['o', 'f'],
]

function CartBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [chosen, setChosen] = useState<number[]>([])
  const tokens = useMemo(() => {
    let t = SENTENCE.split('')
    chosen.forEach((ci) => (t = applyMerge(t, CANDIDATES[ci][0], CANDIDATES[ci][1])))
    return t
  }, [chosen])
  const fits = tokens.length <= CAPACITY

  const toggle = (i: number) => {
    if (solved) return
    sfx.click()
    if (chosen.includes(i)) setChosen(chosen.filter((x) => x !== i))
    else if (chosen.length < MAX_MERGES) setChosen([...chosen, i])
  }
  const ship = () => {
    if (!fits) return onWrong(`${tokens.length} tokens won’t fit in a ${CAPACITY}-token cart. Order matters: you can only merge pieces that already exist.`)
    onSolve()
  }

  // 3D: cart grid of 22 slots, tokens fill in; overflow spills out in red.
  const cols = 11
  return (
    <>
      <T3D.In>
        <group position={[0, 0, 0]}>
          <RoundedBox args={[cols * 0.95 + 0.6, 0.3, 2.6]} radius={0.12} position={[0, 0.25, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#c99a6b" />
          </RoundedBox>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (cols * 0.47), 0.15, 1.45]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
              <meshStandardMaterial color="#2b2420" />
            </mesh>
          ))}
          {tokens.map((t, i) => {
            const inCart = i < CAPACITY
            const col = i % cols
            const row = Math.floor(i / cols)
            const pos: V3 = inCart ? [(col - (cols - 1) / 2) * 0.95, 0.85, row === 0 ? -0.55 : 0.55] : [(i - CAPACITY) * 0.95 - 3, 0.5, 2.6]
            return (
              <Block
                key={i}
                position={pos}
                size={[0.85, 0.8, 0.8]}
                color={!inCart ? pal.bad : t.length > 1 ? '#f39a3c' : pal.token}
                label={show(t)}
                labelClass="mono small"
              />
            )
          })}
          <Label position={[0, 2.3, 0]}>
            <span style={{ color: fits ? pal.good : pal.bad }}>
              {fits ? '✓' : '✗'} {tokens.length} / {CAPACITY} tokens
            </span>
          </Label>
        </group>
      </T3D.In>
      <Dock title="Boss: fit the sentence in the cart">
        <p className="mono" style={{ marginTop: 0, fontSize: '.85em' }}>
          “{SENTENCE}”
        </p>
        <p className="muted">
          Pick up to {MAX_MERGES} merge rules. They apply in the order you click them. ({chosen.length}/{MAX_MERGES})
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          {CANDIDATES.map(([a, b], i) => {
            const order = chosen.indexOf(i)
            const nudge = hintLevel >= 1 && [0, 2, 4].includes(i) && order < 0
            return (
              <button key={i} className={'btn btn-sm mono' + (order >= 0 || nudge ? ' selected' : '')} onClick={() => toggle(i)} disabled={solved}>
                {order >= 0 && <span className="kbd">{order + 1}</span>}
                {show(a)}+{show(b)}
              </button>
            )
          })}
        </div>
        <div className="row">
          <button className="btn btn-yellow" onClick={ship} disabled={solved}>
            Ship the cart
          </button>
          <button className="btn btn-sm" onClick={() => setChosen([])} disabled={solved}>
            Clear
          </button>
        </div>
      </Dock>
      {lensOpen && (
        <LensPanel title="Cart manifest">
          <p>
            {SENTENCE.length} characters → <b>{tokens.length}</b> tokens. Fewer tokens = more text fits in the context window.
          </p>
          <div className="row" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tokens.map((t, i) => (
              <span key={i} className={'chip ' + (i < CAPACITY ? 'lit' : 'hot')}>
                {show(t)}
              </span>
            ))}
          </div>
          <p className="muted">This is why models struggle to count the r’s in “strawberry”: they see pieces like “str|aw|berry”, not letters.</p>
        </LensPanel>
      )}
    </>
  )
}

export const world1: WorldDef = {
  id: 1,
  name: 'The Token Forge',
  concept: 'Tokenization (BPE)',
  oneLiner: 'Words become pieces.',
  techTerm: 'tokens',
  explainBack: 'Models read text as token pieces (sub-words), not whole words or letters. Each piece is just an ID number.',
  island: { top: '#a8dd84', side: '#c99a6b', trim: '#29b6e8' },
  deepDive:
    'BPE training loop:\n  repeat V times:\n    count every adjacent pair (weighted by word frequency)\n    merge the argmax pair into one new symbol\nEncoding applies the learned merges in the same order.',
  card: {
    term: 'Tokenization',
    def: 'Splitting text into sub-word pieces from a fixed vocabulary, then mapping each piece to an integer ID.',
    leavesOut: 'Real tokenizers work on bytes, handle spaces and Unicode, and learn tens of thousands of merges.',
  },
  quiz: [
    {
      q: 'What does a language model actually read?',
      options: ['Whole words', 'Individual letters', 'Token pieces turned into ID numbers', 'Pictures of text'],
      answer: 2,
      why: 'Text is split into tokens, and each token becomes an integer ID.',
    },
    {
      q: 'How does BPE decide which pair to merge next?',
      options: ['Alphabetical order', 'The most frequent adjacent pair', 'The longest word', 'At random'],
      answer: 1,
      why: 'Byte-Pair Encoding greedily merges the most frequent adjacent pair.',
    },
    {
      q: 'Why can “how many r’s in strawberry?” trip a model up?',
      options: ['It can’t spell', 'It sees token pieces, not individual letters', 'R is a rare letter', 'The word is too long'],
      answer: 1,
      why: 'The letters are hidden inside multi-letter tokens.',
    },
  ],
  puzzles: [
    {
      id: 'w1p1',
      title: 'Laser Slicer',
      objective: 'Slice each word into pieces that exist on the vocabulary shelf.',
      hints: [
        'The glowing gaps are where to cut.',
        'Look at the shelf: “un”, “believ” and “able” are all there.',
        'un | believ | able, then token | iz | ing.',
      ],
      card: { term: 'Vocabulary', def: 'The fixed list of pieces a tokenizer knows. Every token has an ID.', leavesOut: 'Real vocabularies are learned from data and hold ~50k–200k entries.' },
      Component: SlicePuzzle,
    },
    {
      id: 'w1p2',
      title: 'The Merge Anvil',
      objective: 'Merge the most frequent adjacent pair, three times.',
      hints: [
        'The highlighted pair is the most frequent right now.',
        'Multiply: “newest” (×6) and “widest” (×3) both contain “e s” → 9.',
        'Merge e+s (or s+t), then es+t, then l+o or o+w.',
      ],
      card: { term: 'Byte-Pair Encoding', def: 'Build tokens by repeatedly merging the most frequent pair of symbols.', leavesOut: 'Production BPE runs on raw bytes over billions of words.' },
      Component: MergePuzzle,
    },
    {
      id: 'w1p3',
      title: 'Boss · The Token Cart',
      objective: 'Choose smart merges so the sentence fits in a 22-token cart.',
      boss: true,
      timeLimit: 120,
      hints: [
        'The highlighted rules shrink the sentence the most.',
        '“th” appears 6 times. Once it exists, “th”+“e” makes “the”.',
        't+h, then th+e, then the+␣ → exactly 22 tokens.',
      ],
      card: { term: 'Context window', def: 'The maximum number of tokens a model can read at once. Efficient tokens fit more text.', leavesOut: 'Modern windows hold 100k+ tokens, but cost still grows with length.' },
      Component: CartBoss,
    },
  ],
}
