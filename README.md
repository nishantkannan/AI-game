# Neural Quest

A browser-based 3D adventure that takes you **inside a language model**. Built by **Nishant Kannan**.

You play **Echo**, a courier drone carrying one user prompt, *“What did our company decide about remote work in 2025?”*, up through the model’s tower. Each floor turns one AI concept into a hands-on mechanic. At the top, you beat the Hallucination Wraith with grounded facts from the Library (RAG).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
```

No accounts, servers or model downloads are needed. Progress is saved in your browser only.

## The eight worlds

| # | World | Concept | What you do |
|---|---|---|---|
| 1 | The Token Forge | Tokenization (BPE) | Laser-slice words into vocabulary pieces, merge the most frequent pairs, and fit a sentence into a 22-token cart |
| 2 | Embedding Galaxy | Embeddings, cosine similarity | Drop words into the right nebula, find nearest neighbours, and steer `king − man + woman` |
| 3 | The Order Clock | Positional encoding | See why attention is order-blind, then dial sine-wave position stamps |
| 4 | Attention Arena | Self-attention (Q·K·V) | Drag spotlights from “it”, aim a query at a key, and solve the trophy/suitcase puzzle |
| 5 | Transformer Tower | Heads, layers, residuals, FFN | Hire attention heads, stack a Transformer block, and repair a broken layer |
| 6 | Probability Casino | Sampling: temperature, top-k | Spin a 3D roulette of next-token probabilities, and write a sentence in 5 spins |
| 7 | Loss Valley | Gradient descent | Tune the learning rate and batch size, and escape a local minimum |
| 8 | The Living Library | RAG | Chunk a handbook, fire a retrieval beam, and defeat the Hallucination Wraith |

Every world follows the PRD’s core loop:
1. **Arrive.** A fly-in introduces the world and its one-line idea.
2. **Play.** Two puzzles, each built around one mechanic.
3. **Inspect.** The Lens (press **L**) shows the real numbers behind what you just did.
4. **Boss.** A puzzle that combines the world's mechanics.
5. **Debrief.** A 3-question quiz, then a Codex card unlocks and you explain the idea back.

The game also includes:
- **Parameters as XP**, so your model grows from 1M to 1B parameters as you earn stars.
- **Hints in three levels:** a nudge, then an explanation, then "show me".
- **Explorer and Engineer modes.** Engineer adds boss timers and Deep Dive math.
- **Lesson Mode**, which unlocks every floor for classrooms.
- **A Sandbox** where you can watch any prompt flow through the tower.
- **A Credits screen.**

## Honest numbers

The PRD’s “Lite mode” is used throughout: every value is computed live in the browser by small, real algorithms, with nothing faked.
- Tokenization uses real BPE pair counting and merge-order application.
- Embeddings use cosine similarity over feature vectors, projected linearly to 3D.
- Positions use sinusoidal encoding.
- Attention uses softmax(q·k/√d).
- Sampling uses temperature and top-k.
- Training uses gradient descent on a real loss surface.
- Retrieval uses bag-of-words cosine search.

Where data is illustrative (for example, trained attention weights), the Lens says so. Running real models in the browser with Transformers.js is the PRD's "Live mode", left as a next step.

## Controls

| Action | Keys |
|---|---|
| Look around | Drag, or press A / D |
| Zoom | Scroll, or press W / S |
| Interact | Click; drag between tokens in the Attention Arena |
| Lens | L |
| Hint | H |
| Codex | C |
| Pause | Esc |

Accessibility options: a colorblind-safe palette, a high-contrast palette, reduced motion, and text size up to 200%. Color always comes with an icon.

## Tech

TypeScript, Vite, React 19, React Three Fiber v9, drei, three.js and Zustand. Sounds come from a tiny Web Audio synth.

```
src/
  engine/   Stage (shared canvas, camera rig, Echo, props), Tower, audio
  world/    WorldPlayer (arrive → play → debrief), Debrief, puzzle kit, types
  worlds/   w1…w8: one file per world (puzzles, Lens, quiz, Codex cards)
  screens/  Title, cold open, map, codex, settings, sandbox, ending, credits
  state/    Zustand store (persisted save, settings, params-as-XP)
.claude/skills/  project skills for Claude Code: design system, adding a world
```

Design inspired by playful toy-diorama browser games: chunky cards, ink outlines and a sunny low-poly world.
