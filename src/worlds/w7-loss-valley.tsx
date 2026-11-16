import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Label, T3D, echoMood } from '../engine/Stage'
import { sfx } from '../engine/audio'
import { usePalette, useGame } from '../state/game'
import { Bar, Dock, LensPanel } from '../world/kit'
import type { PuzzleProps, WorldDef } from '../world/types'

type V3 = [number, number, number]

/* The loss landscape: a wide bowl with a deep global minimum and a shallow local trap. */
const f = (x: number, z: number) =>
  0.06 * (x * x + z * z) - 2.2 * Math.exp(-((x - 2) ** 2 + (z - 1) ** 2) / 2.0) - 1.2 * Math.exp(-((x + 2.5) ** 2 + (z + 1.5) ** 2) / 1.0) + 0.12 * Math.sin(1.3 * x) * Math.cos(1.1 * z)
const grad = (x: number, z: number, h = 1e-4) => [(f(x + h, z) - f(x - h, z)) / (2 * h), (f(x, z + h) - f(x, z - h)) / (2 * h)]
const GLOBAL = [1.92, 0.98]
const LOCAL = [-2.38, -1.42]
const H0 = 1.9
const HS = 0.9
const height = (x: number, z: number) => H0 + f(x, z) * HS
const SIZE = 6

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
}

function descend(start: number[], lr: number, steps: number, noise = 0, seed = 3) {
  const r = rng(seed)
  const path: number[][] = [start]
  let [x, z] = start
  for (let i = 0; i < steps; i++) {
    const [gx, gz] = grad(x, z)
    x -= lr * (gx + noise * r() * 2)
    z -= lr * (gz + noise * r() * 2)
    path.push([x, z])
    if (Math.abs(x) > 9 || Math.abs(z) > 9) break
  }
  return path
}
const dist = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])

function Terrain({ onPick, marker }: { onPick?: (x: number, z: number) => void; marker?: number[] | null }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE * 2, SIZE * 2, 90, 90)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const lo = new THREE.Color('#2fb39a')
    const mid = new THREE.Color('#a8dd84')
    const hi = new THREE.Color('#f5a623')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const v = f(x, z)
      pos.setY(i, height(x, z))
      const t = Math.min(1, Math.max(0, (v + 1.9) / 4.5))
      const c = t < 0.4 ? lo.clone().lerp(mid, t / 0.4) : mid.clone().lerp(hi, (t - 0.4) / 0.6)
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group>
      <mesh
        geometry={geo}
        receiveShadow
        castShadow
        onClick={(e) => {
          if (!onPick) return
          e.stopPropagation()
          onPick(e.point.x, e.point.z)
        }}
        onPointerOver={() => onPick && (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <meshStandardMaterial vertexColors flatShading roughness={0.9} />
      </mesh>
      {marker && (
        <mesh position={[marker[0], height(marker[0], marker[1]) + 0.6, marker[1]]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.2, 0.6, 8]} />
          <meshStandardMaterial color="#2b2420" />
        </mesh>
      )}
      <Flag at={GLOBAL} label="global min" color="#4cc36b" />
      <Flag at={LOCAL} label="local min" color="#9aa3ad" />
    </group>
  )
}

function Flag({ at, label, color }: { at: number[]; label: string; color: string }) {
  const y = height(at[0], at[1])
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
        <meshStandardMaterial color="#2b2420" />
      </mesh>
      <mesh position={[0.22, 1.05, 0]}>
        <boxGeometry args={[0.4, 0.25, 0.03]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Label position={[0, 1.6, 0]} className="small">
        {label}
      </Label>
    </group>
  )
}

/** Animates a ball along a descent path; calls onDone(final) when finished. */
function Ball({ path, run, onDone }: { path: number[][]; run: number; onDone: (final: number[]) => void }) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const reduced = useGame((s) => s.reducedMotion)
  const done = useRef(false)
  const [trail, setTrail] = useState(0)
  useEffect(() => {
    t.current = 0
    done.current = false
    setTrail(0)
  }, [run])
  useFrame((_, dt) => {
    if (!ref.current || !path.length) return
    t.current = Math.min(path.length - 1, t.current + dt * (reduced ? 40 : 9))
    const i = Math.floor(t.current)
    const k = t.current - i
    const a = path[i]
    const b = path[Math.min(path.length - 1, i + 1)]
    const x = a[0] + (b[0] - a[0]) * k
    const z = a[1] + (b[1] - a[1]) * k
    const cx = Math.max(-SIZE, Math.min(SIZE, x))
    const cz = Math.max(-SIZE, Math.min(SIZE, z))
    ref.current.position.set(cx, height(cx, cz) + 0.3, cz)
    if (i !== trail) setTrail(i)
    if (t.current >= path.length - 1 && !done.current && run > 0) {
      done.current = true
      onDone(path[path.length - 1])
    }
  })
  return (
    <>
      <mesh ref={ref} castShadow>
        <sphereGeometry args={[0.3, 20, 14]} />
        <meshStandardMaterial color="#fffdf6" emissive="#29b6e8" emissiveIntensity={0.25} />
      </mesh>
      {path.slice(0, trail + 1).map((p, i) => {
        const cx = Math.max(-SIZE, Math.min(SIZE, p[0]))
        const cz = Math.max(-SIZE, Math.min(SIZE, p[1]))
        return (
          <mesh key={i} position={[cx, height(cx, cz) + 0.1, cz]}>
            <sphereGeometry args={[0.07, 6, 4]} />
            <meshBasicMaterial color="#f39a3c" />
          </mesh>
        )
      })}
    </>
  )
}

function LossLens({ path }: { path: number[][] }) {
  const last = path[path.length - 1]
  const losses = path.map((p) => f(p[0], p[1]))
  const maxL = Math.max(...losses)
  const minL = Math.min(...losses, -2)
  const [gx, gz] = grad(last[0], last[1])
  return (
    <LensPanel title="Training run">
      <p>Each step: <span className="mono">w ← w − lr · ∇loss(w)</span></p>
      <p className="mono" style={{ fontSize: '.85em' }}>
        w = [{last[0].toFixed(2)}, {last[1].toFixed(2)}]
        <br />
        loss = {f(last[0], last[1]).toFixed(3)}
        <br />
        ∇ = [{gx.toFixed(3)}, {gz.toFixed(3)}]
        <br />
        steps = {path.length - 1}
      </p>
      <p>Loss curve:</p>
      <svg viewBox={`0 0 ${Math.max(10, path.length)} 40`} style={{ width: '100%', height: 90, background: '#fff', border: '2.5px solid #2b2420', borderRadius: 8 }} preserveAspectRatio="none">
        <polyline fill="none" stroke="#f39a3c" strokeWidth="1.2" vectorEffect="non-scaling-stroke" points={losses.map((l, i) => `${i},${38 - ((l - minL) / (maxL - minL + 1e-6)) * 36}`).join(' ')} />
      </svg>
    </LensPanel>
  )
}

/* -------------------- Puzzle 1 · Learning rate -------------------- */
const P1_START = [5.5, 4.5]
function LRPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [lr, setLr] = useState(0.05)
  const [run, setRun] = useState(0)
  const [path, setPath] = useState<number[][]>([P1_START])
  const [busy, setBusy] = useState(false)
  const train = () => {
    sfx.whoosh()
    setPath(descend(P1_START, lr, 40))
    setRun((r) => r + 1)
    setBusy(true)
  }
  const done = (fin: number[]) => {
    setBusy(false)
    const d = dist(fin, GLOBAL)
    if (d < 0.5) return onSolve()
    if (Math.abs(fin[0]) > 8 || Math.abs(fin[1]) > 8 || lr > 0.9) return onWrong('Overshoot! The steps are so big the ball bounces right past the valley.')
    onWrong('Too slow. After 40 steps the ball is still crawling downhill.')
  }
  return (
    <>
      <T3D.In>
        <Terrain />
        <Ball path={path} run={run} onDone={done} />
      </T3D.In>
      <Dock title="Set the learning rate">
        <p className="muted" style={{ marginTop: 0 }}>
          Training = rolling downhill on the loss landscape. The <b>learning rate</b> is the step size. Reach the green flag within 40 steps.
        </p>
        <div className="slider-row">
          <label htmlFor="lr">Learning rate</label>
          <span className="mono">{lr.toFixed(2)}</span>
          <input id="lr" type="range" min={0.02} max={3} step={0.02} value={lr} onChange={(e) => setLr(+e.target.value)} disabled={busy || solved} style={hintLevel >= 1 ? { outline: '3px dashed #f39a3c' } : undefined} />
        </div>
        <button className="btn btn-yellow" onClick={train} disabled={busy || solved}>
          ▶ Train 40 steps
        </button>
      </Dock>
      {lensOpen && <LossLens path={path} />}
    </>
  )
}

/* -------------------- Puzzle 2 · Batch size -------------------- */
const BATCHES = [1, 4, 16, 64]
const MEMORY = 24 // pretend GPU fits 24 examples
function BatchPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const pal = usePalette()
  const [b, setB] = useState(1)
  const [run, setRun] = useState(0)
  const [path, setPath] = useState<number[][]>([[1, 0]])
  const [busy, setBusy] = useState(false)
  const train = () => {
    if (b > MEMORY) return onWrong(`Out of memory! A batch of ${b} doesn’t fit on this GPU (max ${MEMORY}).`)
    sfx.whoosh()
    setPath(descend([1, 0], 0.5, 40, 2 / Math.sqrt(b), 3 + run))
    setRun((r) => r + 1)
    setBusy(true)
  }
  const done = () => {
    setBusy(false)
    const tail = path.slice(-10)
    const avg = tail.reduce((s, p) => s + dist(p, GLOBAL), 0) / tail.length
    if (avg < 0.2) return onSolve()
    onWrong(`Too jittery (average wobble ${avg.toFixed(2)}). Tiny batches give noisy gradient estimates.`)
  }
  return (
    <>
      <T3D.In>
        <Terrain />
        <Ball path={path} run={run} onDone={done} />
      </T3D.In>
      <Dock title="Pick a batch size">
        <p className="muted" style={{ marginTop: 0 }}>
          Each step estimates the slope from a <b>batch</b> of examples. Small batches are noisy; big batches need more GPU memory. Make the ball <b>settle</b> in the valley.
        </p>
        <div className="seg" style={{ marginBottom: 10 }}>
          {BATCHES.map((x) => (
            <button key={x} className={b === x ? 'on' : ''} onClick={() => setB(x)} disabled={busy || solved} style={hintLevel >= 1 && x === 16 ? { outline: '3px dashed #f39a3c' } : undefined}>
              {x}
            </button>
          ))}
        </div>
        <div className="slider-row">
          <label>GPU memory</label>
          <span className="mono">
            {b}/{MEMORY}
          </span>
          <div style={{ gridColumn: '1/-1' }}>
            <Bar value={Math.min(1, b / MEMORY)} color={b > MEMORY ? pal.bad : pal.good} />
          </div>
        </div>
        <button className="btn btn-yellow" onClick={train} disabled={busy || solved}>
          ▶ Train
        </button>
      </Dock>
      {lensOpen && <LossLens path={path} />}
    </>
  )
}

/* -------------------- Boss · Find the global minimum -------------------- */
function GlobalBoss({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  const [start, setStart] = useState<number[] | null>(null)
  const [lr, setLr] = useState(0.4)
  const [run, setRun] = useState(0)
  const [path, setPath] = useState<number[][]>([])
  const [busy, setBusy] = useState(false)
  const train = () => {
    if (!start) return
    sfx.whoosh()
    setPath(descend(start, lr, 60))
    setRun((r) => r + 1)
    setBusy(true)
  }
  const done = (fin: number[]) => {
    setBusy(false)
    if (dist(fin, GLOBAL) < 0.5) {
      echoMood('happy')
      return onSolve()
    }
    if (dist(fin, LOCAL) < 0.8) return onWrong('Stuck in a local minimum! Every direction looks uphill from here. Try starting somewhere else.')
    onWrong('Didn’t settle in the global minimum. Check the learning rate.')
  }
  return (
    <>
      <T3D.In>
        <Terrain
          marker={start}
          onPick={(x, z) => {
            if (busy || solved) return
            sfx.click()
            setStart([x, z])
            setPath([[x, z]])
          }}
        />
        {path.length > 0 && <Ball path={path} run={run} onDone={done} />}
        {hintLevel >= 1 && !start && <Label position={[4, 4.5, -3]}>👇 try over here</Label>}
      </T3D.In>
      <Dock title="Boss: reach the global minimum in 60 steps">
        <p className="muted" style={{ marginTop: 0 }}>
          <b>Click the terrain</b> to choose where training starts (the random initial weights), set the learning rate, then train. Beware the local trap!
        </p>
        <p className="mono">start: {start ? `[${start[0].toFixed(1)}, ${start[1].toFixed(1)}]` : 'click the terrain'}</p>
        <div className="slider-row">
          <label htmlFor="blr">Learning rate</label>
          <span className="mono">{lr.toFixed(2)}</span>
          <input id="blr" type="range" min={0.02} max={3} step={0.02} value={lr} onChange={(e) => setLr(+e.target.value)} disabled={busy || solved} />
        </div>
        <button className="btn btn-yellow" onClick={train} disabled={!start || busy || solved}>
          ▶ Train 60 steps
        </button>
      </Dock>
      {lensOpen && path.length > 0 && <LossLens path={path} />}
    </>
  )
}

const V: V3 = [0, 1, 0]

export const world7: WorldDef = {
  id: 7,
  name: 'Loss Valley',
  concept: 'Training, loss & gradient descent',
  oneLiner: 'Learning is rolling downhill.',
  techTerm: 'gradient descent',
  explainBack: 'Training measures how wrong the model is (the loss) and nudges every weight a small step in the direction that reduces it, millions of times.',
  island: { top: '#bfe6a8', side: '#88b56f', trim: '#7cc56b' },
  camera: { pos: [8, 12.5, 15.5], target: V },
  deepDive: 'w_{t+1} = w_t − η ∇L(w_t)\nSGD: ∇L estimated on a mini-batch B; noise ∝ 1/√|B|\nAdam adds momentum + per-weight step sizes.\nReal models: billions of weights, not 2.',
  card: {
    term: 'Gradient descent',
    def: 'The training algorithm: compute the slope of the loss and step the weights downhill, over and over.',
    leavesOut: 'Real loss landscapes have billions of dimensions; “valleys” look very different from this 2D map.',
  },
  quiz: [
    {
      q: 'What is the “loss” during training?',
      options: ['The number of lost files', 'A score of how wrong the model’s predictions are', 'The model’s size', 'The learning rate'],
      answer: 1,
      why: 'Lower loss = better predictions on the training examples.',
    },
    {
      q: 'What happens if the learning rate is far too high?',
      options: ['Training is perfect', 'Steps overshoot and bounce around or diverge', 'The model gets smaller', 'Nothing changes'],
      answer: 1,
      why: 'Big steps jump over the valley.',
    },
    {
      q: 'How does a model learn from examples?',
      options: ['It memorises a rulebook', 'It nudges its weights to reduce error, step by step', 'Someone edits it by hand', 'It searches the internet'],
      answer: 1,
      why: 'That’s gradient descent.',
    },
  ],
  puzzles: [
    {
      id: 'w7p1',
      title: 'Step Size',
      objective: 'Pick a learning rate that reaches the green flag in 40 steps.',
      hints: ['Move the learning-rate slider.', 'Too small crawls; too big bounces. Aim for the middle.', 'Anything between about 0.2 and 0.8 works.'],
      card: { term: 'Learning rate', def: 'How big a step training takes each update. Too small = slow; too big = unstable.', leavesOut: 'Real training changes the learning rate over time (warm-up and decay schedules).' },
      Component: LRPuzzle,
    },
    {
      id: 'w7p2',
      title: 'Batch Balance',
      objective: 'Choose a batch size that settles the ball and fits in GPU memory.',
      hints: ['The outlined batch size is a good choice.', 'Bigger batch = smoother path, but 64 won’t fit.', 'Batch size 16.'],
      card: { term: 'Batch size', def: 'How many examples are used to estimate each gradient step. Bigger is smoother but costs more memory.', leavesOut: 'Large-scale training spreads giant batches across thousands of GPUs.' },
      Component: BatchPuzzle,
    },
    {
      id: 'w7p3',
      title: 'Boss · Global Minimum',
      objective: 'Choose a starting point and learning rate that avoid the local trap.',
      boss: true,
      timeLimit: 90,
      hints: ['Start on the far side, away from the grey flag.', 'The local minimum’s basin is around the grey flag. Start in the back-right instead.', 'Click near the right edge of the terrain, set lr ≈ 0.4, train.'],
      card: { term: 'Local minimum', def: 'A dip that looks like the bottom from inside but isn’t the lowest point overall.', leavesOut: 'In very high dimensions, true local minima are rare; saddle points are the bigger problem.' },
      Component: GlobalBoss,
    },
  ],
}
