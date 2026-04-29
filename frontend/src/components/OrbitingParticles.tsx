import { useEffect, useRef } from 'react'

interface Particle {
  radius: number
  speed: number
  angle: number
  inclination: number
  color: string
  size: number
  trail: { x: number; y: number }[]
}

const PARTICLES: Omit<Particle, 'trail'>[] = [
  { radius: 130, speed: 0.007,  angle: 0.0, inclination:  0.35, color: '#c8c8c8', size: 5.5 },
  { radius: 185, speed: 0.004,  angle: 2.1, inclination: -0.55, color: '#888888', size: 7.0 },
  { radius: 230, speed: 0.0025, angle: 4.2, inclination:  0.70, color: '#b0b0b0', size: 4.5 },
  { radius: 95,  speed: 0.011,  angle: 1.0, inclination: -0.20, color: '#e0e0e0', size: 4.0 },
  { radius: 270, speed: 0.0018, angle: 3.0, inclination:  0.50, color: '#a0a0a0', size: 6.0 },
]

const TRAIL = 55

export function OrbitingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    const particles: Particle[] = PARTICLES.map(p => ({ ...p, trail: [] }))

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let rafId: number

    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width  / 2
      const cy = canvas.height / 2

      for (const p of particles) {
        p.angle += p.speed

        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius * Math.cos(p.inclination)

        p.trail.push({ x, y })
        if (p.trail.length > TRAIL) p.trail.shift()

        // trail
        for (let i = 0; i < p.trail.length; i++) {
          const progress = i / p.trail.length
          ctx.globalAlpha = progress * progress * 0.65
          ctx.beginPath()
          ctx.arc(p.trail[i].x, p.trail[i].y, p.size * 0.55 * progress, 0, Math.PI * 2)
          ctx.fillStyle = p.color
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // particle glow
        ctx.shadowBlur  = 14
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.shadowBlur = 0
      }

      rafId = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    />
  )
}
