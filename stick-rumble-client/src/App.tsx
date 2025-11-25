import { PhaserGame } from './ui/common/PhaserGame'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <h1 style={{ textAlign: 'center', color: '#ffffff' }}>
        Stick Rumble - Multiplayer Arena Shooter
      </h1>
      <PhaserGame />
    </div>
  )
}

export default App
