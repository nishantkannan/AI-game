---
name: neural-quest-design
description: Neural Quest's visual design system (toy-diorama look, color-as-meaning, chunky cards, 3D style rules). Use whenever adding or changing UI, HUD, screens, 3D props or colors in this repo.
---

# Neural Quest design system

The look is a sunny **toy diorama**: low-poly 3D on a floating grass island under a sky gradient, with chunky
cream UI cards that have thick ink outlines and hard offset shadows. Keep new work consistent with it.

## Tokens (src/index.css `:root`)

| Token | Value | Use |
|---|---|---|
| `--ink` | `#2b2420` | all outlines, text, hard shadows |
| `--paper` / `--cream` | `#fffdf6` / `#fff6dc` | card fills |
| `--yellow` | `#ffd34d` | primary action, **selected** state, hint glow |
| `--orange` | `#f39a3c` | secondary action, merged tokens |
| `--shadow` | `0 6px 0 var(--ink)` | cards (buttons use `--shadow-sm`, 4px) |
| fonts | Nunito 800/900 (UI), JetBrains Mono (every real value) | |

## Color is meaning (never decoration)

`--token` cyan = input/tokens · `--vector` violet = vectors/embeddings · `--attention` amber = attention ·
`--good` green = correct/grounded · `--bad` red = error/hallucination.
In 3D, read these from `usePalette()` (`src/state/game.ts`) so colorblind and high-contrast palettes work.
Color is never the only signal: pair it with ✓ / ✗ / ★ or a shape.

## Components to reuse (don't restyle ad hoc)

- Buttons: `.btn`, plus `.btn-yellow` (primary), `.btn-orange`, `.btn-big` (with `<small>` subtitle), `.btn-sm`, and `.selected`. Pressing one drops it 3px.
- Cards: `.card` (and `.card.cream`); pills: `.pill`; segmented control: `.seg > button.on`.
- Titles: `.mega-title` with `span.t1/.t2/.t3` (extruded, stroked letters); `.headline` for screen titles.
- Data: `.chip` / `.chip.lit` / `.chip.hot` for tokens, `<Bar>` and `<Heatmap>` from `src/world/kit.tsx`.
- 3D labels: `<Label>` from `src/engine/Stage.tsx`, or the `label` prop on `<Block>`. Use `className="small"`/`"mono"`.

## 3D style rules

- Shapes are low-poly: use `RoundedBox`, icosahedrons and cylinders, with `flatShading` on natural props. No textures.
- Every scene sits on `<Island>` (the world passes its `island` colors). Echo hovers on the left.
- Interactive objects lift and glow on hover (built into `<Block>`). A hint "nudge" makes the right object glow yellow.
- Keep the action to the right of the dock (bottom-left). WorldPlayer already shifts world cameras by −1.3 on x.
- Respect `reducedMotion` from the store for any looping or large camera motion.

## Layout

HUD positions follow the PRD:
- Objective sits top-left, and hint cards stack under it.
- Stars, params and the timer sit top-right.
- The context tray sits top-center (hidden below 1180px).
- The dock (puzzle controls) sits bottom-left.
- The Lens, Hint and Codex buttons sit bottom-right.
- The Lens panel slides in on the right.
