import type { FC } from 'react'

export interface PuzzleProps {
  onSolve: () => void
  onWrong: (msg?: string) => void
  /** 0 none · 1 nudge (glow the right object) · 2 explanation · 3 show me */
  hintLevel: number
  lensOpen: boolean
  solved: boolean
}

export interface CodexCard {
  id: string
  term: string
  def: string
  leavesOut: string
}

export interface PuzzleDef {
  id: string
  title: string
  objective: string
  hints: [string, string, string]
  boss?: boolean
  /** seconds, Engineer mode only */
  timeLimit?: number
  card: Omit<CodexCard, 'id'>
  Component: FC<PuzzleProps>
  camera?: { pos: [number, number, number]; target: [number, number, number] }
}

export interface QuizQ {
  q: string
  options: string[]
  answer: number
  why: string
}

export interface WorldDef {
  id: number
  name: string
  concept: string
  oneLiner: string
  techTerm: string
  explainBack: string
  island: { top: string; side: string; trim: string }
  camera?: { pos: [number, number, number]; target: [number, number, number] }
  deepDive: string
  quiz: QuizQ[]
  card: Omit<CodexCard, 'id'>
  puzzles: PuzzleDef[]
}
