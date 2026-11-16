import { useEffect, useMemo, useState } from 'react'
import { Beam, Block, Echo, Island, Label, T3D, useCameraRig } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette, useGame } from '../state/game'
import { Heatmap, softmax } from '../world/kit'
import { posEnc } from '../worlds/w3-order-clock'

type V3 = [number, number, number]
const MAX_TOKENS = 64
const SUFFIXES = ['ing', 'tion', 'ness', 'able', 'ed', 'er', 'est', 'ly', 's']
const COMMON = new Set(
  'the a an and or but of to in on at for with from by is are was were be been it its this that these those i you he she we they me my your our their what which who how why when where can will would should could do did does not no yes all any some more most very just than then there here about into over after before up down out if so as model token tokens prompt answer word words echo tower'.split(
    ' ',
  ),
)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function seeded(seed: number) {
  let s = seed % 2147483647 || 1
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
}

/** A toy sub-word tokenizer: whole common words, split suffixes off longer ones, chunk the rest. */
function toyTokenize(text: string) {
  const out: string[] = []
  const parts = text.match(/\s?[A-Za-z]+|\s?\d+|\s?[^\sA-Za-z\d]/g) ?? []
  for (const p of parts) {
    const space = p.startsWith(' ') ? ' ' : ''
    let w = p.trim()
    if (COMMON.has(w.toLowerCase()) || w.length <= 4 || /^\d+$/.test(w)) {
      out.push(space + w)
      continue
    }
    const tail: string[] = []
    const suf = SUFFIXES.find((s) => w.toLowerCase().endsWith(s) && w.length - s.length >= 3)
    if (suf) {
      tail.push(w.slice(-suf.length))
      w = w.slice(0, -suf.length)
    }
    const pieces: string[] = []
    while (w.length > 6) {
      pieces.push(w.slice(0, 4))
      w = w.slice(4)
    }
    pieces.push(w)
    pieces[0] = space + pieces[0]
    out.push(...pieces, ...tail)
  }
  return out.slice(0, MAX_TOKENS)
}

function embed(tok: string) {
  const r = seeded(hash(tok.trim().toLowerCase()))
  return Array.from({ length: 8 }, () => r() * 2)
}

const STAGES = ['Tokens', 'Token IDs', 'Embeddings', '+ Positions', 'Attention']

export function Sandbox() {
  const g = useGame()
  const pal = usePalette()
  const [text, setText] = useState('Echo carries the prompt to the top of the tower!')
  const [stage, setStage] = useState(0)
  const [running, setRunning] = useState(false)
  const tokens = useMemo(() => toyTokenize(text), [text])
  const ids = tokens.map((t) => hash(t) % 50257)
  const vecs = tokens.map((t, i) => embed(t).map((v, d) => v + posEnc(i)[d] * (stage >= 3 ? 0.6 : 0)))
  const n = Math.min(tokens.length, 16)
  const attn = useMemo(() => {
    const x = vecs.slice(0, n)
    return x.map((q, i) =>
      softmax(x.map((k, j) => (j > i ? -1e9 : q.reduce((s, v, d) => s + v * k[d], 0) / Math.sqrt(8)))).map((w, j) => (j > i ? 0 : w)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, stage >= 3, n])

  useCameraRig([0, 7, 15], [0, 3, 0])
  useEffect(() => {
    if (!running) return
    if (stage >= STAGES.length - 1) {
      setRunning(false)
      return
    }
    const t = setTimeout(() => {
      sfx.select()
      setStage((s) => s + 1)
    }, 1100)
    return () => clearTimeout(t)
  }, [running, stage])

  const run = () => {
    sfx.whoosh()
    setStage(0)
    setRunning(true)
  }
  const shown = tokens.slice(0, 16)
  const x = (i: number) => (i - (shown.length - 1) / 2) * 1.15
  const starPos = (i: number): V3 => {
    const v = vecs[i]
    return [v[0] * 5, 4.4 + v[1] * 3, v[2] * 4 - 1]
  }
  const last = shown.length - 1

  return (
    <>
      <T3D.In>
        <Island radius={12} />
        <Echo position={[-7, 3, 0]} />
        {shown.map((t, i) => (
          <group key={i + t}>
            <Block position={[x(i), 0.8, 3]} size={[1.05, 0.7, 0.7]} color={pal.token} label={stage >= 1 ? ids[i] : t.replace(' ', '␣')} labelClass="mono small" />
            {stage >= 2 && (
              <>
                <mesh position={starPos(i)}>
                  <octahedronGeometry args={[0.2, 0]} />
                  <meshStandardMaterial color={pal.vector} emissive={pal.vector} emissiveIntensity={0.6} />
                </mesh>
                <Beam from={[x(i), 1.2, 3]} to={starPos(i)} color={pal.vector} width={0.015} opacity={0.4} />
                <Label position={[starPos(i)[0], starPos(i)[1] + 0.4, starPos(i)[2]]} className="small">
                  {t.trim()}
                </Label>
              </>
            )}
          </group>
        ))}
        {stage >= 4 &&
          last > 0 &&
          attn[last]?.map((w, j) =>
            j === last ? null : <Beam key={'a' + j} from={starPos(last)} to={starPos(j)} color={pal.attention} width={0.01 + w * 0.15} opacity={0.3 + w * 0.7} />,
          )}
      </T3D.In>

      <section className="card" style={{ position: 'absolute', top: 16, left: 16, width: 'min(420px, calc(100vw - 32px))' }}>
        <div className="page-head" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={g.back}>
            ◀ Back
          </button>
          <h2 style={{ margin: 0 }}>🧪 Sandbox</h2>
        </div>
        <label htmlFor="sbx" className="muted">
          Type any prompt (max {MAX_TOKENS} tokens):
        </label>
        <textarea
          id="sbx"
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 400))
            setStage(0)
            setRunning(false)
          }}
          rows={3}
          style={{ width: '100%', marginTop: 6, font: 'inherit', fontWeight: 700, padding: 10, border: '3px solid var(--ink)', borderRadius: 12, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-yellow" onClick={run} disabled={running || !tokens.length}>
            ▶ Send it up the tower
          </button>
          <span className="mono muted" style={{ fontSize: '.85em' }}>
            {tokens.length} tokens
          </span>
        </div>
        <div className="seg" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => (
            <button key={s} className={i === stage ? 'on' : ''} onClick={() => setStage(i)} style={{ fontSize: '.8em', padding: '6px 9px' }}>
              {i + 1}. {s}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.8em', marginBottom: 0 }}>
          Toy mode: these numbers come from a simple built-in tokenizer and random (untrained) vectors, so you can see the <i>shape</i> of the data. Your text never leaves this
          device.
        </p>
      </section>

      <aside className="card lens" style={{ top: 16 }} aria-live="polite">
        <h3>🔍 {STAGES[stage]}</h3>
        {stage <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tokens.map((t, i) => (
              <span key={i} className="chip lit" title={'ID ' + ids[i]}>
                {stage === 0 ? t.replace(' ', '␣') : ids[i]}
              </span>
            ))}
          </div>
        )}
        {(stage === 2 || stage === 3) && (
          <table>
            <thead>
              <tr>
                <th>token</th>
                <th>vector (first 4 of 8 dims)</th>
              </tr>
            </thead>
            <tbody>
              {tokens.slice(0, 16).map((t, i) => (
                <tr key={i}>
                  <td>{t.trim()}</td>
                  <td>[{vecs[i].slice(0, 4).map((v) => v.toFixed(2)).join(', ')}]</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {stage === 4 && (
          <>
            <p>Causal self-attention (each token looks only backwards). Beams show what the last token attends to.</p>
            <Heatmap rows={shown.map((t) => t.trim())} cols={shown.map((t) => t.trim().slice(0, 4))} m={attn} />
          </>
        )}
      </aside>
    </>
  )
}
