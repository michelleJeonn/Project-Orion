import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { MoleculeAnimation } from '../components/ui/molecule-animation'
import { FloatingPaths } from '../components/ui/background-paths'
import { SmokeBackground } from '../components/ui/spooky-smoke-animation'

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
        opacity: transitioning ? 0 : 0.22,
        transition: 'opacity 0.5s ease-out',
      }}>
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* ── z=2: purple smoke — sits behind paths and gradient ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none',
        opacity: transitioning ? 0 : 0.35,
        transition: 'opacity 0.5s ease-out',
      }}>
        <SmokeBackground smokeColor="#7B2FFF" />
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

        {/* ── z=10: LEFT 46% — brand ── */}
      <div style={{
        width: '46%',
        background: 'transparent',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 4rem)',
        paddingLeft: 'clamp(8rem, 14vw, 12rem)',
        paddingBottom: 'clamp(3rem, 6vh, 5rem)',
        position: 'relative',
        zIndex: 10,
        animation: 'fadeLeft 1.4s ease-out 0.2s both',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)',
            fontWeight: 700,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: '0.5rem',
            marginLeft: 0,
          }}>
            Project
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(6rem, 12vw, 13rem)',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1,
            marginLeft: '-0.12em',
          }}>
            ORION
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            marginTop: 2,
            marginLeft: 0,
          }}>
            Autonomous Drug Discovery
          </div>
          <button
            onClick={handleEnter}
            disabled={transitioning}
            style={{
              marginTop: '1.4rem',
              marginLeft: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'var(--sans, sans-serif)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.01em',
              color: 'rgba(255,255,255,0.88)',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 4,
              padding: '0.45rem 1.1rem 0.45rem 0.8rem',
              cursor: transitioning ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
              opacity: transitioning ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (transitioning) return
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'rgba(255,255,255,0.13)'
              b.style.borderColor = 'rgba(255,255,255,0.35)'
            }}
            onMouseLeave={e => {
              if (transitioning) return
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'rgba(255,255,255,0.07)'
              b.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>

      {/* ── z=10: RIGHT 54% — ASCII molecule ── */}
      <div style={{
        width: '54%',
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
          <MoleculeAnimation speedA={0.01} speedB={0.007} />
        </div>
      </div>

      </div>

    </div>
  )
}
