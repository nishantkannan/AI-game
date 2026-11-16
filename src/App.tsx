import { useEffect } from 'react'
import { Stage } from './engine/Stage'
import { useGame } from './state/game'
import { WorldPlayer } from './world/WorldPlayer'
import { CodexScreen } from './screens/Codex'
import { CreditsScreen, EndingScreen, IntroScreen, MapScreen, SettingsScreen, TitleScreen } from './screens/Screens'
import { Sandbox } from './screens/Sandbox'

export default function App() {
  const screen = useGame((s) => s.screen)
  const world = useGame((s) => s.currentWorld)
  const palette = useGame((s) => s.palette)
  const scale = useGame((s) => s.textScale)
  const toasts = useGame((s) => s.toasts)

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    document.documentElement.style.setProperty('--scale', String(scale))
  }, [palette, scale])

  // Every screen except the Codex page renders 3D content into the shared canvas.
  return (
    <div className="app">
      <div className="canvas-layer">
        <Stage />
      </div>
      <main className="ui-layer">
        {screen === 'title' && <TitleScreen />}
        {screen === 'intro' && <IntroScreen />}
        {screen === 'map' && <MapScreen />}
        {screen === 'world' && <WorldPlayer key={world} />}
        {screen === 'codex' && <CodexScreen />}
        {screen === 'settings' && <SettingsScreen />}
        {screen === 'credits' && <CreditsScreen />}
        {screen === 'sandbox' && <Sandbox />}
        {screen === 'ending' && <EndingScreen />}
        <div className="toasts" aria-live="assertive">
          {toasts.map((t) => (
            <div key={t.id} className={'card toast ' + t.kind}>
              {t.kind === 'good' ? '✓ ' : t.kind === 'bad' ? '✗ ' : ''}
              {t.text}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
