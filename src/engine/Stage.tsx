import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { CameraControls, ContactShadows, Html, RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import tunnel from 'tunnel-rat'
import { create } from 'zustand'
import { useGame } from '../state/game'

/** Any screen can render 3D content into the single persistent canvas via <T3D.In>. */
export const T3D = tunnel()

export const rig: { controls: CameraControls | null } = { controls: null }

/** Freeze camera orbiting while the player drags something (e.g. an attention beam). */
export function holdCamera() {
  const c = rig.controls
  if (!c) return
  c.enabled = false
  const release = () => {
    c.enabled = true
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)
}

type Vec3 = [number, number, number]

/** Point the camera at a scene. `from` lets a world open with a fly-in. */
export function useCameraRig(pos: Vec3, target: Vec3, opts: { from?: Vec3; key?: unknown } = {}) {
  const reduced = useGame((s) => s.reducedMotion)
  useEffect(() => {
    const c = rig.controls
    if (!c) return
    if (opts.from && !reduced) {
      void c.setLookAt(...opts.from, ...target, false)
      const id = setTimeout(() => void c.setLookAt(...pos, ...target, true), 50)
      return () => clearTimeout(id)
    }
    void c.setLookAt(...pos, ...target, !reduced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, opts.key, ...pos, ...target])
}

function KeyboardOrbit() {
  const keys = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      keys.current[e.key.toLowerCase()] = true
    }
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false)
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
  useFrame((_, dt) => {
    const c = rig.controls
    if (!c) return
    const k = keys.current
    const r = 1.4 * dt
    if (k['a'] || k['arrowleft']) void c.rotate(r, 0, false)
    if (k['d'] || k['arrowright']) void c.rotate(-r, 0, false)
    if (k['w'] || k['arrowup']) void c.dolly(8 * dt, false)
    if (k['s'] || k['arrowdown']) void c.dolly(-8 * dt, false)
  })
  return null
}

function Cloud({ position, scale = 1, speed = 0.2 }: { position: Vec3; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null)
  const reduced = useGame((s) => s.reducedMotion)
  useFrame(({ clock }) => {
    if (ref.current && !reduced) ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * speed) * 2
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      {[
        [0, 0, 0, 1.2],
        [1.1, -0.2, 0.2, 0.9],
        [-1.1, -0.25, 0, 0.85],
        [0.4, 0.5, -0.2, 0.8],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

export function Stage() {
  const reduced = useGame((s) => s.reducedMotion)
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 7, 16], fov: 45, near: 0.1, far: 300 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <hemisphereLight args={['#ffffff', '#b9e39c', 1.15]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        position={[9, 16, 8]}
        intensity={1.7}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0005}
      />
      <CameraControls
        ref={(c) => {
          rig.controls = c
        }}
        makeDefault
        minDistance={4}
        maxDistance={45}
        maxPolarAngle={Math.PI * 0.49}
        smoothTime={reduced ? 0.05 : 0.35}
        draggingSmoothTime={0.12}
      />
      <KeyboardOrbit />
      <Cloud position={[-16, 9, -14]} scale={1.4} />
      <Cloud position={[14, 11, -18]} scale={1.8} speed={0.15} />
      <Cloud position={[20, 6, -6]} scale={1} speed={0.25} />
      <T3D.Out />
    </Canvas>
  )
}

/* ------------------------------------------------------------------ */
/* Ground: a floating toy island (grass top, soil sides, circuit trim) */
/* ------------------------------------------------------------------ */
export function Island({
  radius = 11,
  top = '#a8dd84',
  side = '#c99a6b',
  trim = '#29b6e8',
  y = 0,
}: {
  radius?: number
  top?: string
  side?: string
  trim?: string
  y?: number
}) {
  const decor = useMemo(() => {
    const out: { p: Vec3; s: number; kind: number }[] = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2
      const r = radius * (0.8 + rnd() * 0.15)
      out.push({ p: [Math.cos(a) * r, 0, Math.sin(a) * r], s: 0.5 + rnd() * 0.6, kind: i % 3 })
    }
    return out
  }, [radius])
  return (
    <group position={[0, y, 0]}>
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <cylinderGeometry args={[radius, radius, 0.5, 48]} />
        <meshStandardMaterial color={top} roughness={0.9} />
      </mesh>
      <mesh position={[0, -1.6, 0]}>
        <cylinderGeometry args={[radius - 0.05, radius * 0.55, 2.3, 24]} />
        <meshStandardMaterial color={side} flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -3.4, 0]}>
        <coneGeometry args={[radius * 0.55, 2.4, 12]} />
        <meshStandardMaterial color="#a77b52" flatShading roughness={1} />
      </mesh>
      {/* glowing circuit ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius - 0.6, radius - 0.4, 64]} />
        <meshBasicMaterial color={trim} transparent opacity={0.7} />
      </mesh>
      {decor.map((d, i) =>
        d.kind === 0 ? (
          <group key={i} position={d.p} scale={d.s}>
            <mesh castShadow position={[0, 0.9, 0]}>
              <icosahedronGeometry args={[0.7, 0]} />
              <meshStandardMaterial color="#6cc25a" flatShading />
            </mesh>
            <mesh castShadow position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.12, 0.16, 0.5, 6]} />
              <meshStandardMaterial color="#8a5a3b" />
            </mesh>
          </group>
        ) : d.kind === 1 ? (
          <mesh key={i} castShadow position={[d.p[0], 0.2 * d.s, d.p[2]]} scale={d.s}>
            <dodecahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color="#b9b2a6" flatShading />
          </mesh>
        ) : (
          <group key={i} position={d.p} scale={d.s}>
            {/* little "chip" building */}
            <RoundedBox args={[0.9, 0.5, 0.9]} radius={0.08} position={[0, 0.25, 0]} castShadow>
              <meshStandardMaterial color="#3c4a5c" />
            </RoundedBox>
            <mesh position={[0, 0.52, 0]}>
              <boxGeometry args={[0.5, 0.04, 0.5]} />
              <meshBasicMaterial color={trim} />
            </mesh>
          </group>
        ),
      )}
      <ContactShadows position={[0, 0.02, 0]} scale={radius * 2} blur={2.2} opacity={0.35} far={6} />
    </group>
  )
}

/* ---------------------------------------------- */
/* Echo — the courier drone. Mood is global.      */
/* ---------------------------------------------- */
export type Mood = 'idle' | 'happy' | 'confused' | 'thinking'
export const useEcho = create<{ mood: Mood; set: (m: Mood) => void }>((set) => ({
  mood: 'idle',
  set: (m) => set({ mood: m }),
}))
let moodTimer: ReturnType<typeof setTimeout> | undefined
export function echoMood(m: Mood, ms = 1600) {
  useEcho.getState().set(m)
  clearTimeout(moodTimer)
  if (m !== 'idle') moodTimer = setTimeout(() => useEcho.getState().set('idle'), ms)
}

export function Echo({ position = [0, 2, 0], scale = 1, follow }: { position?: Vec3; scale?: number; follow?: Vec3 }) {
  const root = useRef<THREE.Group>(null)
  const prop = useRef<THREE.Mesh>(null)
  const eyes = useRef<THREE.Group>(null)
  const mood = useEcho((s) => s.mood)
  const reduced = useGame((s) => s.reducedMotion)
  const target = useRef(new THREE.Vector3(...(follow ?? position)))
  const base = useRef(new THREE.Vector3(...(follow ?? position)))
  const [tx, ty, tz] = follow ?? position
  useEffect(() => {
    target.current.set(tx, ty, tz)
  }, [tx, ty, tz])
  const eyeColor = mood === 'happy' ? '#7dffa0' : mood === 'confused' ? '#ffb35c' : '#5fe0ff'
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (root.current) {
      base.current.lerp(target.current, Math.min(1, dt * 3))
      root.current.position.copy(base.current)
      if (!reduced) root.current.position.y += Math.sin(t * 2.2) * 0.12
      const tilt = mood === 'confused' ? Math.sin(t * 6) * 0.25 : mood === 'happy' ? Math.sin(t * 10) * 0.15 : 0
      root.current.rotation.z = tilt
      if (mood === 'happy' && !reduced) root.current.position.y += Math.abs(Math.sin(t * 8)) * 0.3
    }
    if (prop.current) prop.current.rotation.y += dt * (mood === 'thinking' ? 30 : 14)
    if (eyes.current) {
      const blink = Math.sin(t * 1.3) > 0.985 ? 0.15 : 1
      eyes.current.scale.y = mood === 'happy' ? 0.45 : blink
      eyes.current.position.y = mood === 'thinking' ? 0.08 + Math.sin(t * 5) * 0.04 : 0.05
    }
  })
  return (
    <group ref={root} position={position} scale={scale}>
      <mesh castShadow>
        <sphereGeometry args={[0.55, 32, 24]} />
        <meshStandardMaterial color="#fffdf6" roughness={0.35} />
      </mesh>
      {/* visor */}
      <mesh position={[0, 0.05, 0.36]} scale={[1, 0.62, 0.55]}>
        <sphereGeometry args={[0.42, 32, 16]} />
        <meshStandardMaterial color="#2b2420" roughness={0.2} />
      </mesh>
      <group ref={eyes} position={[0, 0.05, 0.6]}>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0, 0]} scale={mood === 'confused' && x > 0 ? 0.6 : 1}>
            <capsuleGeometry args={[0.045, 0.1, 4, 8]} />
            <meshBasicMaterial color={eyeColor} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <torusGeometry args={[0.62, 0.06, 10, 40]} />
        <meshStandardMaterial color="#29b6e8" emissive="#29b6e8" emissiveIntensity={0.5} />
      </mesh>
      {/* antenna + propeller */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 6]} />
        <meshStandardMaterial color="#2b2420" />
      </mesh>
      <mesh ref={prop} position={[0, 0.8, 0]}>
        <boxGeometry args={[0.9, 0.03, 0.12]} />
        <meshStandardMaterial color="#ffd34d" />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color="#f39a3c" />
      </mesh>
      {mood === 'confused' && (
        <Html position={[0.5, 0.9, 0]} center>
          <div className="label3d bare">?</div>
        </Html>
      )}
      {mood === 'thinking' && (
        <Html position={[0.5, 0.9, 0]} center>
          <div className="label3d bare">…</div>
        </Html>
      )}
    </group>
  )
}

/* ---------------------------------------------- */
/* Reusable props                                  */
/* ---------------------------------------------- */
export function Label({
  children,
  position,
  className = '',
  zIndex,
}: {
  children: ReactNode
  position: Vec3
  className?: string
  zIndex?: number
}) {
  return (
    <Html position={position} center zIndexRange={zIndex ? [zIndex, 0] : undefined} style={{ pointerEvents: 'none' }}>
      <div className={'label3d ' + className}>{children}</div>
    </Html>
  )
}

export function Block({
  position,
  size = [1, 1, 1],
  color,
  label,
  labelClass = 'mono',
  onClick,
  glow = false,
  selected = false,
  dim = false,
  onPointerDown,
  onPointerUp,
  onHoverChange,
  title,
}: {
  onHoverChange?: (h: boolean) => void
  position: Vec3
  size?: Vec3
  color: string
  label?: ReactNode
  labelClass?: string
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void
  glow?: boolean
  selected?: boolean
  dim?: boolean
  title?: string
}) {
  const [hover, setHover] = useState(false)
  const ref = useRef<THREE.Group>(null)
  const interactive = !!(onClick || onPointerDown)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const lift = (hover && interactive ? 0.15 : 0) + (selected ? 0.25 : 0)
    ref.current.position.y += (position[1] + lift - ref.current.position.y) * 0.2
    if (glow) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.05)
    else ref.current.scale.setScalar(1)
  })
  return (
    <group ref={ref} position={position}>
      <RoundedBox
        args={size}
        radius={Math.min(...size) * 0.18}
        smoothness={3}
        castShadow
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => {
          if (!interactive) return
          e.stopPropagation()
          setHover(true)
          onHoverChange?.(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          onHoverChange?.(false)
          document.body.style.cursor = ''
        }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          emissive={glow || selected ? '#ffd34d' : color}
          emissiveIntensity={glow ? 0.55 : selected ? 0.35 : hover && interactive ? 0.18 : 0.05}
          transparent={dim}
          opacity={dim ? 0.35 : 1}
        />
      </RoundedBox>
      {label !== undefined && (
        <Html position={[0, 0, size[2] / 2 + 0.01]} center style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
          <div className={'label3d ' + labelClass} title={title}>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

export function Pedestal({ position, color = '#fffdf6', r = 0.7 }: { position: Vec3; color?: string; r?: number }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[r, r * 1.1, 0.4, 24]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

/** A thick beam between two points (attention links, retrieval rays, vector arrows). */
export function Beam({
  from,
  to,
  color,
  width = 0.08,
  opacity = 0.9,
  arrow = false,
}: {
  from: Vec3
  to: Vec3
  color: string
  width?: number
  opacity?: number
  arrow?: boolean
}) {
  const { mid, len, quat } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    return { mid: a.clone().add(b).multiplyScalar(0.5), len, quat }
  }, [from, to])
  if (len < 0.001) return null
  return (
    <group position={mid} quaternion={quat}>
      <mesh>
        <cylinderGeometry args={[width, width, arrow ? len - 0.35 : len, 10]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
      </mesh>
      {arrow && (
        <mesh position={[0, len / 2 - 0.18, 0]}>
          <coneGeometry args={[width * 3, 0.38, 12]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** Gentle spin for showpiece objects. */
export function Spin({ children, speed = 0.3 }: { children: ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null)
  const reduced = useGame((s) => s.reducedMotion)
  useFrame((_, dt) => {
    if (ref.current && !reduced) ref.current.rotation.y += dt * speed
  })
  return <group ref={ref}>{children}</group>
}
