import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { LandingPage } from './pages/LandingPage'
import { HomePage } from './pages/HomePage'
import { JobPage } from './pages/JobPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { DemoToggle } from './components/DemoToggle'
import { StormBackground } from './components/StormBackground'

export default function App() {
  const [sharedTime, setSharedTime] = useState(0)
  const startRef = useRef(performance.now())

  useEffect(() => {
    let rafId: number
    const frame = () => {
      setSharedTime(performance.now() - startRef.current)
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <BrowserRouter>
      <DemoToggle />
      <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Persistent background across all pages */}
        <StormBackground sharedTime={sharedTime} />
        
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/home"      element={<HomePage />} />
          <Route path="/jobs/:jobId" element={<JobPage />} />
          <Route path="/projects"   element={<ProjectsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
