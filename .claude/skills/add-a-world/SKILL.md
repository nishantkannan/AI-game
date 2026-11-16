---
name: add-a-world
description: How to add or change a Neural Quest world or puzzle (WorldDef/PuzzleDef contract, Lens, hints, camera, testing) plus React Three Fiber gotchas found in this codebase. Use when building World 9 (Agent Workshop), adding puzzles, or debugging 3D interaction.
---

# Adding a world or puzzle

## Contract (src/world/types.ts)

A world is a `WorldDef` exported from `src/worlds/wN-name.tsx` and listed in `WORLDS` in `src/worlds/index.ts`.
Also give it a floor in `FLOORS` (color, short name).

- `oneLiner` is the plain-English opener, and `techTerm` + `explainBack` close the world (PRD level-design rule).
- `quiz` has exactly 3 questions for the debrief. `card` is the world's Codex card, and it needs a `leavesOut` note.
- `puzzles` has 2 mechanic puzzles and 1 `boss: true` puzzle (give it a `timeLimit`, which is used in Engineer mode only).
- Each puzzle needs `hints: [nudge, explanation, showMe]` and its own Codex `card`. An optional `camera` overrides the world camera.

## Writing a puzzle component (`PuzzleProps`)

```tsx
function MyPuzzle({ onSolve, onWrong, hintLevel, lensOpen, solved }: PuzzleProps) {
  return (
    <>
      <T3D.In>{/* 3D: renders into the shared canvas */}</T3D.In>
      <Dock title="…">{/* 2D controls, bottom-left */}</Dock>
      {lensOpen && <LensPanel title="…">{/* the REAL numbers */}</LensPanel>}
    </>
  )
}
```

- **Every lesson is a mechanic.** The player moves, cuts, aims or connects something. Text explains; it never replaces the mechanic.
- **Honest metaphors.** Compute real values (softmax, cosine, BPE, PE, gradient descent) and show them in the Lens.
  If data is illustrative, say so in the Lens.
- Call `onWrong(msg)` with a *why*, not just "wrong". WorldPlayer counts tries, nudges toward hints and scores stars.
- When `hintLevel >= 1`, glow the right object (`glow` on `<Block>`, a dashed outline on 2D controls).
- Disable inputs when `solved` is true. Multi-round puzzles call `onSolve()` only after the last round.
- Use `usePalette()` colors and the components from the `neural-quest-design` skill.

## Testing

In dev (`npm run dev`), the console exposes:
- `__game.getState().enterWorld(n)` jumps to world n.
- `__nq.goto(i)` jumps to puzzle i (and skips the arrival banner).
- `__nq.solve()` and `__nq.next()` solve the current puzzle and advance.

Settings → Lesson Mode unlocks every floor. Always run `npx tsc -b` and `npm run build` before committing.

## Gotchas already hit here

- **No `<StrictMode>`.** Its dev-only double effects make drei `<Html>` create two React roots on one element, which blanks 3D labels after a remount.
- **Dragging between 3D objects:** call `holdCamera()` (Stage.tsx) on pointer-down, or CameraControls orbits instead.
  Resolve the drop target with a window `pointerup` plus hovered-object tracking (see `useLinker` in w4). Don't rely on the target mesh's `onPointerUp`.
- **Remounting a component that receives a stale "trigger" prop** re-fires its effect (for example, the casino wheel spin). Clear the trigger (`setSpin(null)`) before the remount.
- Give new `<Html>` labels `zIndexRange={[10, 0]}` (the `Label` and `Block` helpers already do). The canvas layer is isolated, so labels stay under the HUD.
- Browser-pane screenshots can lag a frame. Re-screenshot, or read the DOM, before concluding something didn't render.
