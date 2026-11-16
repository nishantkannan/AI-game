import { useGame } from '../state/game'

// Tiny Web Audio synth: every interaction gets a short, distinct sound, no assets to download.
let ctx: AudioContext | null = null
function ac() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', gain = 0.12, delay = 0, slideTo?: number) {
  if (!useGame.getState().sound) return
  const c = ac()
  const t0 = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
}

export const sfx = {
  click: () => tone(660, 0.07, 'square', 0.05),
  select: () => tone(520, 0.1, 'triangle', 0.1, 0, 780),
  slice: () => tone(1400, 0.15, 'sawtooth', 0.05, 0, 300),
  merge: () => {
    tone(330, 0.12, 'triangle', 0.12)
    tone(495, 0.14, 'triangle', 0.1, 0.06)
  },
  good: () => {
    tone(523, 0.12, 'triangle', 0.12)
    tone(659, 0.12, 'triangle', 0.12, 0.08)
    tone(784, 0.22, 'triangle', 0.12, 0.16)
  },
  bad: () => tone(220, 0.25, 'sawtooth', 0.06, 0, 140),
  star: () => {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'sine', 0.09, i * 0.07))
  },
  whoosh: () => tone(200, 0.4, 'sine', 0.08, 0, 900),
  spin: () => {
    for (let i = 0; i < 10; i++) tone(900 - i * 40, 0.04, 'square', 0.03, i * 0.09)
  },
}
