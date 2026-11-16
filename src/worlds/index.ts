import { world1 } from './w1-token-forge'
import { world2 } from './w2-embedding-galaxy'
import { world3 } from './w3-order-clock'
import { world4 } from './w4-attention-arena'
import { world5 } from './w5-transformer-tower'
import { world6 } from './w6-probability-casino'
import { world7 } from './w7-loss-valley'
import { world8 } from './w8-living-library'
import type { CodexCard, WorldDef } from '../world/types'

export const WORLDS: WorldDef[] = [world1, world2, world3, world4, world5, world6, world7, world8]

/** Tower floors in the real order of an LLM request (World 9 is the post-launch expansion). */
export const FLOORS = [
  { id: 1, name: 'The Token Forge', short: 'Tokens', color: '#29b6e8' },
  { id: 2, name: 'Embedding Galaxy', short: 'Embeddings', color: '#8b6cf0' },
  { id: 3, name: 'The Order Clock', short: 'Position', color: '#4dd0c8' },
  { id: 4, name: 'Attention Arena', short: 'Attention', color: '#f5a623' },
  { id: 5, name: 'Transformer Tower', short: 'Layers', color: '#f37c6b' },
  { id: 6, name: 'Probability Casino', short: 'Sampling', color: '#ec6fb3' },
  { id: 7, name: 'Loss Valley', short: 'Training', color: '#7cc56b' },
  { id: 8, name: 'The Living Library', short: 'RAG', color: '#4cc36b' },
  { id: 9, name: 'Agent Workshop', short: 'Agents', color: '#9aa3ad' },
]

export const STORY_PROMPT = ['What', ' did', ' our', ' company', ' decide', ' about', ' remote', ' work', ' in', ' 2025', '?']

/** Every collectible Codex card: one per world + one per puzzle. */
export const ALL_CARDS: (CodexCard & { world: number })[] = WORLDS.flatMap((w) => [
  { id: 'w' + w.id, world: w.id, ...w.card },
  ...w.puzzles.map((p) => ({ id: p.id, world: w.id, ...p.card })),
])
