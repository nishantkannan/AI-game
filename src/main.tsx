import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useGame } from './state/game'

// Always boot to the title screen; transient UI state isn't persisted.
useGame.setState({ screen: 'title', prevScreen: 'title', toasts: [] })
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame

// No <StrictMode>: its dev-only double effect run makes drei <Html> create two React roots
// on the same element, which blanks 3D labels after a scene remounts.
createRoot(document.getElementById('root')!).render(<App />)
