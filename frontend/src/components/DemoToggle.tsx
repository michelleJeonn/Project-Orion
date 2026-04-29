import { useEffect, useState } from 'react'
import { isDemoMode, setDemoMode } from '../demoConfig'

export function DemoToggle() {
  const [demo, setDemo] = useState(isDemoMode())

  useEffect(() => {
    const handleToggle = () => setDemo(isDemoMode())
    window.addEventListener('demo_mode_changed', handleToggle)
    return () => window.removeEventListener('demo_mode_changed', handleToggle)
  }, [])

  return (
    <button
      onClick={() => setDemoMode(!demo)}
      style={{
        position: 'fixed',
        bottom: 28,
        left: 28,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '.45rem .8rem',
        background: demo ? 'rgba(255,91,42,0.15)' : 'rgba(8,8,10,0.85)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${demo ? 'rgba(255,91,42,0.45)' : 'var(--hair)'}`,
        color: demo ? 'var(--accent)' : 'var(--ink-2)',
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        fontSize: '0.50rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        transition: 'all .3s',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: demo ? '#f44' : 'var(--ink-3)', display: 'block' }}/>
      DEMO MODE {demo ? 'ON' : 'OFF'}
    </button>
  )
}
