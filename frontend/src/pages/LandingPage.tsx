import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { MoleculeAnimation } from '../components/ui/molecule-animation'
import { FloatingPaths } from '../components/ui/background-paths'

export function LandingPage() {
  const navigate = useNavigate()
  const [transitioning, setTransitioning] = useState(false)

  const handleEnter = () => {
    setTransitioning(true)
    setTimeout(() => navigate('/home'), 520)
  }

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: 'transparent' }}>

      {/* ── z=3: right-to-left dark gradient — holds molecule visual space ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none',
        background: 'linear-gradient(to left, rgba(8,8,14,0.98) 0%, rgba(8,8,14,0.82) 20%, rgba(8,8,14,0.45) 45%, transparent 55%)',
        opacity: transitioning ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }} />

      {/* ── z=3: floating paths — bottom-left accent ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none', color: 'white',
        maskImage: 'radial-gradient(ellipse 70% 65% at 0% 100%, black 25%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 65% at 0% 100%, black 25%, transparent 75%)',
        opacity: transitioning ? 0 : 0.85,
        transition: 'opacity 0.5s ease-out',
      }}>
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* ── HUD wrapper ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        opacity: transitioning ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}>

        {/* ── z=10: LEFT 42% — brand ── */}
      <div style={{
        width: '38%',
        background: 'transparent',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 4rem)',
        paddingLeft: 'clamp(8rem, 14vw, 12rem)',
        position: 'relative',
        zIndex: 10,
        animation: 'fadeLeft 1.4s ease-out 0.2s both',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(4.5rem, 9vw, 9rem)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1,
          }}>
            Cryosis
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            marginTop: 12,
            marginLeft: '0.4rem',
          }}>
            Autonomous Drug Discovery
          </div>
          <button
            onClick={handleEnter}
            disabled={transitioning}
            style={{
              marginTop: '2.5rem',
              marginLeft: '0.4rem',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.75)',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '0.6rem 1.6rem',
              cursor: transitioning ? 'not-allowed' : 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
              opacity: transitioning ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (transitioning) return
              const b = e.currentTarget as HTMLButtonElement
              b.style.color = 'rgba(255,255,255,1)'
              b.style.borderColor = 'rgba(255,255,255,0.7)'
            }}
            onMouseLeave={e => {
              if (transitioning) return
              const b = e.currentTarget as HTMLButtonElement
              b.style.color = 'rgba(255,255,255,0.75)'
              b.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
          >
            Enter
          </button>
        </div>
      </div>

      {/* ── z=10: RIGHT 58% — ASCII molecule ── */}
      <div style={{
        width: '62%',
        minWidth: 540,
        position: 'relative',
        zIndex: 10,
        background: 'transparent',
        animation: 'fadeRight 1.8s ease-out 0.4s both',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', zIndex: 5, transform: 'scale(2.2)', transformOrigin: 'center center' }}>
          <MoleculeAnimation speedA={0.006} speedB={0.003} />
        </div>
      </div>

      </div>

    </div>
  )
}
