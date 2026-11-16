import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Screen = 'title' | 'intro' | 'map' | 'world' | 'codex' | 'credits' | 'settings' | 'sandbox' | 'ending'
export type Mode = 'explorer' | 'engineer'
export type Palette = 'default' | 'colorblind' | 'contrast'

export interface Toast {
  id: number
  text: string
  kind: 'good' | 'bad' | 'info'
}

interface GameState {
  screen: Screen
  prevScreen: Screen
  currentWorld: number
  /** stars earned per puzzle id, best score kept */
  puzzleStars: Record<string, number>
  /** worlds whose debrief has been finished */
  completed: number[]
  codex: string[]
  quizScores: Record<number, number>
  mode: Mode
  reducedMotion: boolean
  textScale: number
  sound: boolean
  palette: Palette
  lessonMode: boolean
  started: boolean
  toasts: Toast[]

  go: (s: Screen) => void
  back: () => void
  enterWorld: (id: number) => void
  awardStars: (puzzleId: string, stars: number) => void
  completeWorld: (id: number, quizScore: number) => void
  unlockCard: (id: string) => void
  set: (p: Partial<GameState>) => void
  toast: (text: string, kind?: Toast['kind']) => void
  newGame: () => void
}

let toastId = 1

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      screen: 'title',
      prevScreen: 'title',
      currentWorld: 1,
      puzzleStars: {},
      completed: [],
      codex: [],
      quizScores: {},
      mode: 'explorer',
      reducedMotion: false,
      textScale: 1,
      sound: true,
      palette: 'default',
      lessonMode: false,
      started: false,
      toasts: [],

      go: (s) => set({ prevScreen: get().screen, screen: s }),
      back: () => set({ screen: get().prevScreen === get().screen ? 'title' : get().prevScreen }),
      enterWorld: (id) => set({ currentWorld: id, prevScreen: get().screen, screen: 'world' }),
      awardStars: (puzzleId, stars) =>
        set({ puzzleStars: { ...get().puzzleStars, [puzzleId]: Math.max(stars, get().puzzleStars[puzzleId] ?? 0) } }),
      completeWorld: (id, quizScore) =>
        set({
          completed: get().completed.includes(id) ? get().completed : [...get().completed, id],
          quizScores: { ...get().quizScores, [id]: Math.max(quizScore, get().quizScores[id] ?? 0) },
        }),
      unlockCard: (id) => {
        if (!get().codex.includes(id)) set({ codex: [...get().codex, id] })
      },
      set: (p) => set(p),
      toast: (text, kind = 'info') => {
        const t = { id: toastId++, text, kind }
        set({ toasts: [...get().toasts, t].slice(-3) })
        setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 2800)
      },
      newGame: () =>
        set({ puzzleStars: {}, completed: [], codex: [], quizScores: {}, currentWorld: 1, started: true, lessonMode: false }),
    }),
    {
      name: 'neural-quest-save',
      partialize: (s) => ({
        puzzleStars: s.puzzleStars,
        completed: s.completed,
        codex: s.codex,
        quizScores: s.quizScores,
        mode: s.mode,
        reducedMotion: s.reducedMotion,
        textScale: s.textScale,
        sound: s.sound,
        palette: s.palette,
        lessonMode: s.lessonMode,
        started: s.started,
        currentWorld: s.currentWorld,
      }),
    },
  ),
)

export const TOTAL_PUZZLES = 24 // 8 worlds × 3 puzzles

export function totalStars(ps: Record<string, number>) {
  return Object.values(ps).reduce((a, b) => a + b, 0)
}

/** Parameters as XP: the model grows from 1M to 1B parameters across the game. */
export function paramsFromStars(stars: number) {
  const max = TOTAL_PUZZLES * 3
  return 1e6 * Math.pow(1000, Math.min(1, stars / max))
}

export function formatParams(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 9.95e9 ? 0 : 1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 9.95e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  return Math.round(n).toLocaleString()
}

export function isUnlocked(world: number, completed: number[], lessonMode: boolean) {
  return lessonMode || world === 1 || completed.includes(world - 1)
}

/** Color-as-meaning, with colorblind-safe and high-contrast alternates. */
export function paletteColors(p: Palette) {
  if (p === 'colorblind')
    return { token: '#56b4e9', vector: '#cc79a7', attention: '#e69f00', good: '#009e73', bad: '#d55e00', ink: '#2b2420' }
  if (p === 'contrast')
    return { token: '#0077cc', vector: '#6a1bd1', attention: '#c46a00', good: '#00873c', bad: '#c40000', ink: '#000000' }
  return { token: '#29b6e8', vector: '#8b6cf0', attention: '#f5a623', good: '#4cc36b', bad: '#ef5350', ink: '#2b2420' }
}

export function usePalette() {
  return paletteColors(useGame((s) => s.palette))
}
