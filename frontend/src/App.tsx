import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState<string>('Loading...')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/data')
        const data = await response.json()
        setMessage(data.message)
        setLoading(false)
      } catch (err) {
        setError('Failed to connect to backend')
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="app-container">
      <h1>🥔 Potatoo</h1>
      <p className="subtitle">Full-Stack Web Application</p>

      <div className="card">
        {loading && <p>Connecting to backend...</p>}
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
      </div>

      <div className="stack-info">
        <div className="stack-item">
          <h3>Frontend</h3>
          <p>React + TypeScript + Vite</p>
        </div>
        <div className="stack-item">
          <h3>Backend</h3>
          <p>Node.js + Express</p>
        </div>
        <div className="stack-item">
          <h3>Python</h3>
          <p>Utilities & Scripts</p>
        </div>
      </div>
    </div>
  )
}

export default App
