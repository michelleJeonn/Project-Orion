import { useEffect, useRef, useMemo } from 'react'

// ── Geometry constants ─────────────────────────────────────────────────────────
const TURNS     = 5.5
const N         = Math.round(TURNS * 22)   // 121 nodes per strand
const RADIUS    = 1.2                       // world units
const HEIGHT    = 12.0
const CAM_Z     = 8.0
const FOV_RAD   = (44 * Math.PI) / 180
const TUBE_R    = 0.09                      // particle cluster radius (world units)
const RUNG_STEP = 3                         // rung every N nodes
const RUNG_P    = 4                         // particles per rung
const HAZE_N    = 300                       // background haze count

// ── Seeded XOR-shift PRNG ─────────────────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0
  return (): number => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return (s >>> 0) / 0xffffffff
  }
}

// ── Pre-computed geometry types ───────────────────────────────────────────────
interface SPt { strand: 0|1; ni: number; dx: number; dy: number; dz: number; sz: number; gr: number; op: number }
interface RPt { ni: number; t: number;  jy: number; sz: number; gr: number; op: number }
interface HPt { px: number; py: number; sz: number; op: number }
interface Geo  { s: SPt[]; r: RPt[]; h: HPt[] }

// ── Build particle geometry ONCE (stable, no flicker) ─────────────────────────
function buildGeo(): Geo {
  const rng = mkRng(77)
  const s: SPt[] = [], r: RPt[] = [], h: HPt[] = []

  // Strand particle clusters: 8–12 particles per node, per strand
  for (let strand = 0; strand < 2; strand++) {
    for (let i = 0; i <= N; i++) {
      const count = 8 + Math.floor(rng() * 5)
      for (let p = 0; p < count; p++) {
        const theta = rng() * Math.PI * 2
        const rad   = Math.sqrt(rng()) * TUBE_R    // uniform disc distribution
        const roll  = rng()
        // 5% bright anchors, 15% medium, 80% small
        s.push({
          strand: strand as 0|1, ni: i,
          dx: rad * Math.cos(theta),
          dy: (rng() - 0.5) * TUBE_R * 0.8,
          dz: rad * Math.sin(theta),
          sz: roll < 0.05 ? 4.5 : roll < 0.20 ? 2.8 : 1.5,
          gr: roll < 0.05 ? 255 : roll < 0.20 ? 195 + ~~(rng() * 45) : 150 + ~~(rng() * 50),
          op: roll < 0.05 ? 0.90 : roll < 0.20 ? 0.65 : 0.42,
        })
      }
    }
  }

  // Rung particles: 4 scattered along each bridge
  for (let i = 0; i <= N; i += RUNG_STEP) {
    for (let p = 0; p < RUNG_P; p++) {
      r.push({
        ni: i,
        t:  (p + 0.5 + (rng() - 0.5) * 0.4) / RUNG_P,
        jy: (rng() - 0.5) * TUBE_R * 0.6,
        sz: 1.4 + rng() * 1.2,
        gr: 110 + ~~(rng() * 65),
        op: 0.25 + rng() * 0.20,
      })
    }
  }

  // Background haze: 300 faint random particles within bounding cylinder
  for (let i = 0; i < HAZE_N; i++) {
    const a  = rng() * Math.PI * 2
    const rr = Math.sqrt(rng()) * 0.30
    h.push({ px: 0.5 + Math.cos(a) * rr, py: rng(), sz: 0.9 + rng() * 0.9, op: 0.10 + rng() * 0.14 })
  }

  return { s, r, h }
}

// Per-frame trig cache (avoids recomputing cos/sin per particle)
const _cos = new Float64Array(N + 1)
const _sin = new Float64Array(N + 1)

// ── Component ─────────────────────────────────────────────────────────────────
export function DNAHelix() {
  const cvRef = useRef<HTMLCanvasElement>(null)
  const geo   = useMemo(buildGeo, [])

  useEffect(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext('2d')!
    let rot = 0, time = 0, raf = 0
    let flashNi = -1, flashMs = 0, nextFlashMs = 4000 + Math.random() * 2000

    const resize = () => {
      const w = cv.offsetWidth, h = cv.offsetHeight
      if (w > 0 && h > 0) { cv.width = w; cv.height = h }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)

    let prev = performance.now()

    const loop = (now: number) => {
      const dt = now - prev; prev = now
      time += dt
      rot  += 0.003 * (dt / 16.67)

      // Flash lifecycle
      flashMs     -= dt
      nextFlashMs -= dt
      if (flashMs <= 0)   { flashNi = -1; flashMs = 0 }
      if (nextFlashMs <= 0) {
        flashNi     = ~~(Math.random() * N)
        flashMs     = 200
        nextFlashMs = 3500 + Math.random() * 2500
      }

      const W = cv.width, H = cv.height
      if (!W || !H) { raf = requestAnimationFrame(loop); return }

      const f     = (H / 2) / Math.tan(FOV_RAD / 2)
      const drift = Math.sin(time * 0.0005) * 8   // slow vertical breathing

      const proj = (x: number, y: number, z: number) => {
        const zc = CAM_Z - z
        const s  = f / zc
        return { sx: W / 2 + x * s, sy: H / 2 - y * s + drift, zc }
      }

      // 0 = back of helix, 1 = front
      const depF = (zc: number) =>
        Math.max(0, Math.min(1, (CAM_Z + RADIUS - zc) / (2 * RADIUS)))

      // ── Black background ─────────────────────────────────────
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      // ── Haze: faint static scatter ───────────────────────────
      for (const h of geo.h) {
        ctx.beginPath()
        ctx.arc(h.px * W, h.py * H, h.sz, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,200,200,${h.op.toFixed(3)})`
        ctx.fill()
      }

      // ── Trig cache for this frame ────────────────────────────
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TURNS * Math.PI * 2 + rot
        _cos[i] = Math.cos(a)
        _sin[i] = Math.sin(a)
      }

      // ── Strand node screen positions ─────────────────────────
      type Pt = { sx: number; sy: number; zc: number }
      const p0: Pt[] = new Array(N + 1)
      const p1: Pt[] = new Array(N + 1)
      for (let i = 0; i <= N; i++) {
        const wy = (i / N) * HEIGHT - HEIGHT / 2
        p0[i] = proj( RADIUS * _cos[i], wy,  RADIUS * _sin[i])
        p1[i] = proj(-RADIUS * _cos[i], wy, -RADIUS * _sin[i])
      }

      // ── Lines (z-sorted back-to-front) ───────────────────────
      type Line = { x1:number; y1:number; x2:number; y2:number; zc:number; op:number; w:number }
      const lines: Line[] = []

      // Strand backbone
      for (let i = 0; i < N; i++) {
        const za = (p0[i].zc + p0[i+1].zc) / 2
        const zb = (p1[i].zc + p1[i+1].zc) / 2
        lines.push({ x1:p0[i].sx, y1:p0[i].sy, x2:p0[i+1].sx, y2:p0[i+1].sy, zc:za, op:0.10 + depF(za)*0.28, w:1.0 })
        lines.push({ x1:p1[i].sx, y1:p1[i].sy, x2:p1[i+1].sx, y2:p1[i+1].sy, zc:zb, op:0.10 + depF(zb)*0.28, w:1.0 })
      }
      // Rungs
      for (let i = 0; i <= N; i += RUNG_STEP) {
        const zc = (p0[i].zc + p1[i].zc) / 2
        lines.push({ x1:p0[i].sx, y1:p0[i].sy, x2:p1[i].sx, y2:p1[i].sy, zc, op:0.05 + depF(zc)*0.18, w:0.6 })
      }
      // Diagonal mesh triangulation
      for (let i = 0; i < N; i++) {
        if (i % 2 === 0) {
          const zc = (p0[i].zc + p1[i+1].zc) / 2
          lines.push({ x1:p0[i].sx, y1:p0[i].sy, x2:p1[i+1].sx, y2:p1[i+1].sy, zc, op:0.02 + depF(zc)*0.09, w:0.35 })
        } else {
          const zc = (p1[i].zc + p0[i+1].zc) / 2
          lines.push({ x1:p1[i].sx, y1:p1[i].sy, x2:p0[i+1].sx, y2:p0[i+1].sy, zc, op:0.02 + depF(zc)*0.09, w:0.35 })
        }
      }

      lines.sort((a, b) => b.zc - a.zc)
      for (const l of lines) {
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2)
        ctx.strokeStyle = `rgba(232,232,232,${l.op.toFixed(3)})`
        ctx.lineWidth   = l.w
        ctx.stroke()
      }

      // ── Strand particle clusters ─────────────────────────────
      for (const p of geo.s) {
        const sg = p.strand === 0 ? 1 : -1
        const wx = sg * RADIUS * _cos[p.ni] + p.dx
        const wz = sg * RADIUS * _sin[p.ni] + p.dz
        const wy = (p.ni / N) * HEIGHT - HEIGHT / 2 + p.dy
        const { sx, sy, zc } = proj(wx, wy, wz)
        const d  = depF(zc)
        const fl = flashNi === p.ni && flashMs > 0
        const op = Math.min(1, p.op * (0.3 + d * 0.7) * (fl ? 2.2 : 1))
        const gr = fl ? 255 : p.gr
        ctx.beginPath()
        ctx.arc(sx, sy, p.sz / 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${gr},${gr},${gr},${op.toFixed(3)})`
        ctx.fill()
      }

      // ── Rung bridge particles ────────────────────────────────
      for (const rp of geo.r) {
        // Interpolate in world space from s0[ni] to s1[ni] at parameter t
        const wy = (rp.ni / N) * HEIGHT - HEIGHT / 2 + rp.jy
        const wx = RADIUS * _cos[rp.ni] * (1 - 2 * rp.t)
        const wz = RADIUS * _sin[rp.ni] * (1 - 2 * rp.t)
        const { sx, sy, zc } = proj(wx, wy, wz)
        const op = Math.min(1, rp.op * (0.25 + depF(zc) * 0.75))
        ctx.beginPath()
        ctx.arc(sx, sy, rp.sz / 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rp.gr},${rp.gr},${rp.gr},${op.toFixed(3)})`
        ctx.fill()
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [geo])

  // ── Static overlay data ──────────────────────────────────────────────────────
  const leftData  = ['−334.71 Å', '+0.0023 rad', '128.44 nm', '11.0 bp/turn', '3.32 Å / bp', '−1.2 kJ/mol', '0.34 Å rise', '+36.0° twist']
  const rightData = ['2.37 nm pitch', '−9.8 kcal/mol', '0.9847 corr', '23.7% GC bias', '1.14 e⁻ density', '48 bridges', '+0.0031 ω', '99.2% conf']
  const floatLabels = [
    { label: '· G-C pair',     top: '20%', left: '60%' },
    { label: '· major groove', top: '35%', left: '67%' },
    { label: '· phosphate',    top: '50%', left: '57%' },
    { label: '· minor groove', top: '64%', left: '63%' },
    { label: '· base stack',   top: '77%', left: '58%' },
  ]

  const monoStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.08em',
    color: 'rgba(232,232,232,0.30)',
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>

      {/* Canvas */}
      <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}/>

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)',
      }}/>

      {/* ── Left vertical data strip ── */}
      <div style={{
        position: 'absolute', left: '1.4rem', top: 0, bottom: 0, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly',
      }}>
        {leftData.map((v, i) => <div key={i} style={monoStyle}>{v}</div>)}
      </div>

      {/* ── Right vertical data strip ── */}
      <div style={{
        position: 'absolute', right: '1.4rem', top: 0, bottom: 0, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'flex-end',
      }}>
        {rightData.map((v, i) => <div key={i} style={monoStyle}>{v}</div>)}
      </div>

      {/* ── Bottom-left annotation ── */}
      <div style={{
        position: 'absolute', bottom: '2rem', left: '2rem', pointerEvents: 'none',
        fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em',
        color: 'rgba(241,237,230,0.38)', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <span>DOUBLE HELIX · STRUCTURAL SCAFFOLD</span>
        <span>DEOXYRIBONUCLEIC ACID · B-FORM</span>
      </div>

      {/* ── Top-right data block ── */}
      <div style={{
        position: 'absolute', top: '2rem', right: '2rem', pointerEvents: 'none',
        fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.14em',
        color: 'rgba(232,232,232,0.32)', textAlign: 'right',
        display: 'flex', flexDirection: 'column', gap: 3,
        lineHeight: 1.6,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(232,232,232,0.50)' }}>GENESIS · NODE-01</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.60 0.08 140)', boxShadow: '0 0 5px oklch(0.60 0.08 140)', display: 'inline-block' }}/>
          <span>ONLINE</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(232,232,232,0.15)', marginTop: 2, paddingTop: 4 }}/>
        <div>STRAND_A&nbsp;&nbsp; 0.9847</div>
        <div>STRAND_B&nbsp;&nbsp; 0.9761</div>
        <div>BRIDGE_CT&nbsp; 48</div>
        <div>ROT_VEL&nbsp;&nbsp;&nbsp; 0.0031</div>
        <div>T_ELAPSED&nbsp; 00:04:12</div>
        <div>CONF&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 99.2%</div>
        <div>SEQ_MATCH&nbsp; B-FORM</div>
      </div>

      {/* ── Floating node labels ── */}
      {floatLabels.map((fl, i) => (
        <div key={i} style={{
          position: 'absolute', top: fl.top, left: fl.left, pointerEvents: 'none',
          fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.06em',
          color: 'rgba(232,232,232,0.35)', whiteSpace: 'nowrap',
        }}>
          {fl.label}
        </div>
      ))}

    </div>
  )
}
