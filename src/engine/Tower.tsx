import { RoundedBox } from '@react-three/drei'
import { useState } from 'react'
import { FLOORS } from '../worlds'
import { Label } from './Stage'

const H = 1.25

/** The model as a vertical city: text enters at street level and rises floor by floor. */
export function Tower({
  completed = [],
  unlocked = () => true,
  stars = {},
  onPick,
  labels = false,
}: {
  completed?: number[]
  unlocked?: (id: number) => boolean
  stars?: Record<number, number>
  onPick?: (id: number) => void
  labels?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <group>
      {/* street-level lobby */}
      <RoundedBox args={[4.6, 0.9, 4.6]} radius={0.15} position={[0, 0.45, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#fffdf6" />
      </RoundedBox>
      <RoundedBox args={[1.2, 0.7, 0.2]} radius={0.08} position={[0, 0.4, 2.3]}>
        <meshStandardMaterial color="#2b2420" />
      </RoundedBox>
      {FLOORS.map((f, i) => {
        const y = 0.9 + i * H + H / 2
        const open = f.id <= 8 && unlocked(f.id)
        const done = completed.includes(f.id)
        const hot = hover === f.id
        const w = 4 - i * 0.12
        return (
          <group key={f.id} position={[0, y, 0]}>
            <RoundedBox
              args={[w, H - 0.14, w]}
              radius={0.16}
              smoothness={3}
              castShadow
              receiveShadow
              onClick={(e) => {
                e.stopPropagation()
                if (open && onPick) onPick(f.id)
              }}
              onPointerOver={(e) => {
                if (!onPick) return
                e.stopPropagation()
                setHover(f.id)
                document.body.style.cursor = open ? 'pointer' : 'not-allowed'
              }}
              onPointerOut={() => {
                setHover(null)
                document.body.style.cursor = ''
              }}
            >
              <meshStandardMaterial
                color={open ? f.color : '#c9c3ba'}
                emissive={open ? f.color : '#000'}
                emissiveIntensity={hot ? 0.45 : done ? 0.18 : 0.05}
                roughness={0.5}
              />
            </RoundedBox>
            {/* windows on each face */}
            {[0, 1, 2, 3].map((side) => (
              <group key={side} rotation={[0, (side * Math.PI) / 2, 0]}>
                {[-1, 0, 1].map((k) => (
                  <mesh key={k} position={[k * (w / 3.4), 0, w / 2 + 0.01]}>
                    <planeGeometry args={[w / 5, H * 0.38]} />
                    <meshBasicMaterial color={open ? (done ? '#fff6b0' : '#ffffff') : '#8d867d'} toneMapped={false} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* trim between floors */}
            <mesh position={[0, -H / 2 + 0.02, 0]}>
              <boxGeometry args={[w + 0.12, 0.08, w + 0.12]} />
              <meshStandardMaterial color="#2b2420" />
            </mesh>
            {labels && (
              <Label position={[w / 2 + 1.9, 0, 0]} className={'small' + (open ? '' : ' muted')}>
                {f.id}. {f.short} {f.id > 8 ? '· soon' : !open ? '🔒' : done ? '★'.repeat(stars[f.id] ?? 0) || '✓' : ''}
              </Label>
            )}
          </group>
        )
      })}
      {/* rooftop answer beacon */}
      <group position={[0, 0.9 + FLOORS.length * H + 0.1, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
          <meshStandardMaterial color="#2b2420" />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshStandardMaterial color="#ffd34d" emissive="#ffd34d" emissiveIntensity={completed.includes(8) ? 1.2 : 0.3} />
        </mesh>
      </group>
    </group>
  )
}

export const TOWER_TOP = 0.9 + FLOORS.length * H
