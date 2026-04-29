import { useEffect, useRef } from 'react'

interface Segment {
  x1: number; y1: number; x2: number; y2: number
  z: number; width: number; opacity: number; color: string
  isRung?: boolean
}

interface HelixProps {
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
}

export function Helix({ width = '100%', height = '100%', style }: HelixProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const rafRef = useRef<number>(0)
  const tRef   = useRef<number>(0)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    function draw() {
      if (!svg) return
      const W = svg.clientWidth  || 400
      const H = svg.clientHeight || 600

      const cx     = W / 2
      const cy     = H / 2
      const RADIUS = W * 0.18
      const HALF_H = H * 0.46
      const TURNS  = 3.5
      const STEPS  = 180
      const t      = tRef.current

      const segments: Segment[] = []

      // ── Build strand points ─────────────────────────────────
      const strand1: { x: number; y: number; z: number }[] = []
      const strand2: { x: number; y: number; z: number }[] = []

      for (let i = 0; i <= STEPS; i++) {
        const frac = i / STEPS
        const angle = frac * TURNS * Math.PI * 2 + t
        const y = cy + (frac - 0.5) * HALF_H * 2
        strand1.push({ x: cx + RADIUS * Math.cos(angle),        y, z: Math.sin(angle) })
        strand2.push({ x: cx + RADIUS * Math.cos(angle + Math.PI), y, z: Math.sin(angle + Math.PI) })
      }

      // ── Backbone segments ───────────────────────────────────
      function addBackbone(
        pts: { x: number; y: number; z: number }[],
        baseColor: string
      ) {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1]
          const z    = (a.z + b.z) / 2
          const lit  = (z + 1) / 2               // 0..1, front = 1
          const op   = 0.25 + lit * 0.70
          const w    = 0.8 + lit * 1.6
          segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, z, width: w, opacity: op, color: baseColor })
        }
      }

      addBackbone(strand1, '#c8d8ff')
      addBackbone(strand2, '#c8d8ff')

      // ── Base-pair rungs (every ~8th step) ───────────────────
      const RUNG_N = 22
      for (let i = 0; i < RUNG_N; i++) {
        const idx = Math.floor((i / RUNG_N) * STEPS)
        const a   = strand1[idx]
        const b   = strand2[idx]
        if (!a || !b) continue
        const z   = (a.z + b.z) / 2
        const lit = (z + 1) / 2
        const op  = 0.18 + lit * 0.55
        const w   = 0.5 + lit * 0.9
        segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, z, width: w, opacity: op, color: '#ffffff', isRung: true })
      }

      // ── Sort back-to-front ──────────────────────────────────
      segments.sort((a, b) => a.z - b.z)

      // ── Write to SVG ────────────────────────────────────────
      const lines = segments.map(s => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        el.setAttribute('x1',            String(s.x1))
        el.setAttribute('y1',            String(s.y1))
        el.setAttribute('x2',            String(s.x2))
        el.setAttribute('y2',            String(s.y2))
        el.setAttribute('stroke',        s.color)
        el.setAttribute('stroke-width',  String(s.width))
        el.setAttribute('stroke-opacity', String(s.opacity))
        el.setAttribute('stroke-linecap', 'round')
        return el
      })

      // replace contents
      while (svg.firstChild) svg.removeChild(svg.firstChild)
      lines.forEach(l => svg.appendChild(l))
    }

    function loop() {
      tRef.current += 0.004
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }

    // ResizeObserver for responsive sizing
    const ro = new ResizeObserver(() => draw())
    ro.observe(svg)

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ display: 'block', ...style }}
    />
  )
}
