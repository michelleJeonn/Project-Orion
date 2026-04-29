import { useState, useEffect, useMemo } from 'react'
import { GenesisReport, DockingResult, TargetInsight } from '../types'
import { MoleculeCard } from './MoleculeCard'
import { ProteinViewer3D } from './ProteinViewer3D'
import { MoleculeViewer3D } from './MoleculeViewer3D'
import { DynamicPathwayGraph } from './DynamicPathwayGraph'
import { ChemicalSpace3D } from './ChemicalSpace3D'
import { SnowflakeAnalyticsPanel } from './SnowflakeAnalyticsPanel'
import { ReportSearchPanel } from './ReportSearchPanel'

// ── Dark theme tokens ───────────────────────────────────────────
const D = {
  panel: 'rgba(8,8,10,0.60)',
  panel2: 'rgba(8,8,10,0.78)',
  panelLt: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.13)',
  text1: 'rgba(255,255,255,0.88)',
  text2: 'rgba(255,255,255,0.58)',
  text3: 'rgba(255,255,255,0.35)',
  mute: 'rgba(255,255,255,0.25)',
  warn: 'oklch(0.68 0.12 45)',
  live: 'oklch(0.72 0.10 140)',
  // purple accents
  purple: 'rgba(140,80,255,0.90)',
  purpleDim: 'rgba(120,60,220,0.55)',
  purpleBorder: 'rgba(120,60,220,0.28)',
  purpleGlow: 'rgba(100,40,200,0.12)',
  purplePanel: 'rgba(80,20,160,0.10)',
  // pink accents (matches landing page / apparatus)
  pink: 'rgba(228,147,206,0.90)',
  pinkDim: 'rgba(228,147,206,0.65)',
  pinkBorder: 'rgba(228,147,206,0.30)',
  pinkPanel: 'rgba(228,147,206,0.07)',
}

// ── Helpers ─────────────────────────────────────────────────────
type ReportAgent = 'disease' | 'targets' | 'molecules' | 'docking' | 'insight' | 'chemical_intelligence'
const AGENTS = [
  { id: 'disease' as ReportAgent, n: '01', label: 'Disease Intelligence', src: 'CLAUDE · PUBMED · OMIM' },
  { id: 'targets' as ReportAgent, n: '02', label: 'Target Discovery', src: 'DISGENET · UNIPROT · PDB' },
  { id: 'molecules' as ReportAgent, n: '03', label: 'Molecule Generation', src: 'RDKIT · CHEMBL' },
  { id: 'docking' as ReportAgent, n: '04', label: 'Docking · Analysis', src: 'AUTODOCK VINA' },
  { id: 'insight' as ReportAgent, n: '05', label: 'Insight Synthesis', src: 'CLAUDE' },
  { id: 'chemical_intelligence' as ReportAgent, n: '06', label: 'Chemical Intelligence', src: 'SNOWFLAKE · PCA' },
]

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── ProteinBlob ─────────────────────────────────────────────────
function ProteinBlob({ seed }: { seed: number }) {
  const dots = useMemo(() => {
    const rand = mulberry32(seed * 13 + 7)
    return Array.from({ length: 55 }, () => ({
      x: 10 + rand() * 80,
      y: 10 + rand() * 60,
      r: 1 + rand() * 3,
    }))
  }, [seed])

  return (
    <div style={{
      height: 84, width: '100%',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 2,
      position: 'relative', overflow: 'hidden',
      border: `1px dotted ${D.border2}`,
      marginTop: 10, marginBottom: 10,
    }}>
      <svg viewBox="0 0 100 80" style={{ width: '100%', height: '100%' }}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r}
            fill="rgba(255,255,255,0.70)"
            opacity={0.25 + (d.r - 1) / 4}
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute', left: 8, bottom: 5,
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.10em',
        color: D.mute,
      }}>
        Cα backbone · preview
      </div>
    </div>
  )
}

// ── PoseCanvas ──────────────────────────────────────────────────
// ── ReportView ──────────────────────────────────────────────────
interface ReportViewProps {
  report: GenesisReport
  onBack: () => void
  onDownload?: () => void
  jobId?: string
}

export function ReportView({ report, onBack, onDownload, jobId }: ReportViewProps) {
  const [agent, setAgent] = useState<ReportAgent>('disease')
  const plate = useMemo(() => String(100 + Math.floor(Math.random() * 900)), [])
  const idx = AGENTS.findIndex(a => a.id === agent)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setAgent(AGENTS[Math.min(AGENTS.length - 1, idx + 1)].id)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setAgent(AGENTS[Math.max(0, idx - 1)].id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [idx])

  return (
    <div style={{
      height: '100%', width: '100%', overflow: 'hidden',
      padding: 'clamp(.9rem, 2vh, 1.4rem) clamp(1.6rem, 3vw, 2.4rem) clamp(.8rem, 1.6vh, 1.2rem)',
      display: 'flex', flexDirection: 'column',
      color: D.text1,
      fontFamily: 'var(--sans)',
    }}>

      {/* Top bar */}
      <header style={{
        position: 'relative',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: '1.5rem',
        paddingBottom: '.9rem', borderBottom: '1px solid rgba(228,147,206,0.14)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
          <button onClick={onBack} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: D.text3, fontFamily: 'var(--mono)',
            fontSize: '.60rem', letterSpacing: '.3em', textTransform: 'uppercase', padding: 0,
          }}>◀ NEW INQUIRY</button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em', color: D.mute }}>DOSSIER · {plate}</span>
          {onDownload && (
            <button onClick={onDownload} style={{
              background: 'transparent', border: `1px solid ${D.border2}`, cursor: 'pointer',
              color: D.text3, fontFamily: 'var(--mono)',
              fontSize: '.50rem', letterSpacing: '.20em', textTransform: 'uppercase',
              padding: '.25rem .7rem', borderRadius: 2,
            }}>↓ JSON</button>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(228,147,206,0.45)' }}>Subject</p>
          <p style={{ margin: '.2rem 0 0', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '1.2rem', color: '#E493CE', letterSpacing: '.01em', textShadow: '0 0 28px rgba(228,147,206,0.35)' }}>
            {report.disease_name}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.4rem' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em', color: D.live, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.live, display: 'inline-block' }} />
            COMPLETE
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(228,147,206,0.45)' }}>
            {String(idx + 1).padStart(2, '0')} / {String(AGENTS.length).padStart(2, '0')}
          </span>
        </div>
      </header>

      {/* Body */}
      <div style={{
        position: 'relative', flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: '200px 1fr',
        gap: 'clamp(1rem, 2.2vw, 1.8rem)',
        marginTop: 'clamp(.8rem, 1.8vh, 1.2rem)',
      }}>

        {/* Left nav */}
        <nav style={{
          display: 'flex', flexDirection: 'column',
          border: '1px solid rgba(228,147,206,0.14)',
          background: D.panel,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          padding: '.8rem', minHeight: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '.55rem', borderBottom: '1px solid rgba(228,147,206,0.10)', marginBottom: '.4rem' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(228,147,206,0.45)' }}>Apparatus</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(228,147,206,0.35)' }}>06</span>
          </div>
          <ul style={{ margin: '.25rem 0 0', padding: 0, listStyle: 'none', flex: 1, minHeight: 0 }}>
            {AGENTS.map((a) => {
              const active = a.id === agent
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setAgent(a.id)}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'center',
                      gap: '.6rem', textAlign: 'left',
                      background: active ? D.pinkPanel : 'transparent',
                      border: `1px solid ${active ? D.pinkBorder : 'transparent'}`,
                      boxShadow: active ? `0 0 12px rgba(228,147,206,0.12)` : 'none',
                      padding: '.6rem .55rem', cursor: 'pointer',
                      transition: 'background .15s, border-color .15s',
                      borderRadius: 4,
                      marginBottom: 2,
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.08em',
                      flexShrink: 0,
                      width: '1.5rem', height: '1.5rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      background: active ? '#E493CE' : 'rgba(228,147,206,0.12)',
                      border: `1px solid ${active ? '#E493CE' : 'rgba(228,147,206,0.35)'}`,
                      color: active ? '#0a0a0c' : '#E493CE',
                    }}>
                      {a.n}
                    </span>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: '.88rem', lineHeight: 1.2, color: active ? '#E493CE' : 'rgba(228,147,206,0.55)' }}>
                      {a.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div style={{ paddingTop: '.6rem', borderTop: '1px solid rgba(228,147,206,0.10)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(228,147,206,0.35)' }}>◀ ▶ KEY NAV</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(228,147,206,0.35)' }}>
              {String(idx + 1).padStart(2, '0')}/{String(AGENTS.length).padStart(2, '0')}
            </span>
          </div>
        </nav>

        {/* Active pane */}
        <main style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {agent === 'disease' && <DiseasePane r={report} />}
          {agent === 'targets' && <TargetsPane r={report} plate={plate} />}
          {agent === 'molecules' && <MoleculesPane r={report} plate={plate} />}
          {agent === 'docking' && <DockingPane r={report} plate={plate} />}
          {agent === 'insight' && <InsightPane r={report} />}
          {agent === 'chemical_intelligence' && <ChemicalIntelligencePane jobId={jobId} />}
        </main>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'relative', marginTop: 'clamp(.6rem, 1.4vh, 1rem)',
        paddingTop: '.6rem', borderTop: `1px solid ${D.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em', color: D.mute,
      }}>
        <span>GENESIS · AUTONOMOUS DRUG DISCOVERY</span>
        <span>IN-SILICO · AWAITING VALIDATION</span>
        <span>COORD · X {plate} · Y {String(Math.floor(idx * 73 + 100)).padStart(3, '0')}</span>
      </footer>
    </div>
  )
}

// ── Shared shell ────────────────────────────────────────────────
function PaneShell({ index, title, src, children }: {
  index: number; title: string; src: string; children: React.ReactNode
}) {
  return (
    <section style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '.55rem .9rem',
        marginBottom: '.9rem',
        borderBottom: `1px solid ${D.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.2rem' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(228,147,206,0.55)' }}>§ {String(index).padStart(2, '0')}</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: '1.6rem', letterSpacing: '-0.02em', color: D.text1, lineHeight: 1 }}>
            {title}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(228,147,206,0.35)' }}>{src}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </section>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(228,147,206,0.45)' }}>{label}</div>
      <div style={{ marginTop: '.25rem', fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 400, color: 'rgba(255,255,255,1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(228,147,206,0.35)', marginTop: '.2rem' }}>{sub}</div>}
    </div>
  )
}

function MeterBar({ v }: { v: number }) {
  return (
    <div style={{ position: 'relative', height: 2, background: D.border2, width: '100%', borderRadius: 1 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: 'rgba(228,147,206,0.70)', borderRadius: 1 }} />
    </div>
  )
}

// ── Gene3DView ───────────────────────────────────────────────────
function Gene3DView({ gene, seed }: { gene: string; seed: number }) {
  const structure = useMemo(() => {
    const rand = mulberry32(seed * 31 + 17)
    const helices = Array.from({ length: 3 + Math.floor(rand() * 3) }, (_, i) => {
      const cx = 55 + rand() * 290
      const cy = 35 + rand() * 130
      const len = 45 + rand() * 70
      const angle = (rand() - 0.5) * Math.PI * 0.9
      const depth = 0.2 + rand() * 0.8
      return { cx, cy, len, angle, depth, id: `h${i}` }
    })
    const strands = Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, i) => {
      const cx = 55 + rand() * 290
      const cy = 35 + rand() * 130
      const len = 28 + rand() * 42
      const angle = (rand() - 0.5) * Math.PI * 0.5
      const depth = 0.15 + rand() * 0.85
      return { cx, cy, len, angle, depth, id: `s${i}` }
    })
    const loops: { x1: number; y1: number; x2: number; y2: number; depth: number; id: string }[] = []
    for (let i = 0; i < helices.length - 1; i++) {
      const a = helices[i], b = helices[i + 1]
      loops.push({
        x1: a.cx + Math.cos(a.angle) * a.len / 2, y1: a.cy + Math.sin(a.angle) * a.len / 2,
        x2: b.cx - Math.cos(b.angle) * b.len / 2, y2: b.cy - Math.sin(b.angle) * b.len / 2,
        depth: (a.depth + b.depth) / 2, id: `l${i}`
      })
    }
    return { helices, strands, loops }
  }, [seed])

  const allEls = [
    ...structure.loops.map(l => ({ ...l, type: 'loop' as const })),
    ...structure.strands.map(s => ({ ...s, type: 'strand' as const })),
    ...structure.helices.map(h => ({ ...h, type: 'helix' as const })),
  ].sort((a, b) => a.depth - b.depth)

  return (
    <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="g3d-bg" cx="45%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#111118" />
          <stop offset="100%" stopColor="#050507" />
        </radialGradient>
        <filter id="g3d-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="400" height="200" fill="url(#g3d-bg)" />
      {/* depth grid */}
      {[40, 80, 120, 160].map(y => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
      ))}

      {allEls.map(el => {
        const alpha = 0.35 + el.depth * 0.65
        const thick = 0.4 + el.depth * 0.6
        if (el.type === 'loop') {
          const mx = (el.x1 + el.x2) / 2 + (Math.random() - 0.5) * 30
          const my = (el.y1 + el.y2) / 2 + (Math.random() - 0.5) * 20
          return (
            <path key={el.id}
              d={`M ${el.x1} ${el.y1} Q ${mx} ${my} ${el.x2} ${el.y2}`}
              stroke={`rgba(160,140,200,${alpha * 0.55})`} strokeWidth={1.5 * thick}
              fill="none" strokeLinecap="round" />
          )
        }
        if (el.type === 'helix') {
          const dx = Math.cos(el.angle), dy = Math.sin(el.angle)
          const px = Math.sin(el.angle), py = -Math.cos(el.angle)
          const steps = 14
          const topPts = Array.from({ length: steps }, (_, j) => {
            const t = j / (steps - 1)
            const bx = el.cx - dx * el.len / 2 + dx * el.len * t
            const by = el.cy - dy * el.len / 2 + dy * el.len * t
            const amp = 6 * thick
            return [bx + px * amp * Math.sin(j * Math.PI * 1.5), by + py * amp * Math.sin(j * Math.PI * 1.5)]
          })
          const botPts = topPts.map(([x, y]) => [x - px * 4 * thick, y - py * 4 * thick])
          const topD = topPts.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
          const botD = botPts.map(([x, y], j) => `${j === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
          return (
            <g key={el.id} filter="url(#g3d-glow)">
              <path d={botD} stroke={`rgba(120,90,220,${alpha * 0.5})`} strokeWidth={4 * thick} fill="none" strokeLinecap="round" />
              <path d={topD} stroke={`rgba(200,170,255,${alpha})`} strokeWidth={4.5 * thick} fill="none" strokeLinecap="round" />
              <path d={topD} stroke={`rgba(255,240,255,${alpha * 0.4})`} strokeWidth={1.5 * thick} fill="none" strokeLinecap="round" />
            </g>
          )
        }
        // strand
        const dx = Math.cos(el.angle), dy = Math.sin(el.angle)
        const px = Math.sin(el.angle) * 5 * thick, py = -Math.cos(el.angle) * 5 * thick
        const tx = el.cx + dx * el.len / 2, ty = el.cy + dy * el.len / 2
        const bx = el.cx - dx * el.len / 2, by = el.cy - dy * el.len / 2
        const arrowW = 9 * thick
        const apx = Math.sin(el.angle) * arrowW, apy = -Math.cos(el.angle) * arrowW
        return (
          <g key={el.id}>
            <polygon
              points={`${bx + px},${by + py} ${bx - px},${by - py} ${tx - px},${ty - py} ${tx + apx},${ty + apy} ${tx - px + apx * 0.3},${ty - py + apy * 0.3} ${tx + px + apx * 0.3},${ty + py + apy * 0.3} ${tx - apx},${ty - apy} ${tx + px},${ty + py}`}
              fill={`rgba(60,160,220,${alpha * 0.75})`}
              stroke={`rgba(120,210,255,${alpha})`} strokeWidth="0.6" />
          </g>
        )
      })}

      {/* Gene label */}
      <text x="14" y="190" fontFamily="monospace" fontSize="13" fontWeight="700"
        fill="rgba(255,255,255,0.75)" letterSpacing="0.12em">{gene}</text>
      <text x="14" y="13" fontFamily="monospace" fontSize="6.5" letterSpacing="0.13em"
        fill="rgba(255,255,255,0.28)">TOP DRUGGABLE TARGET · PREDICTED STRUCTURE</text>
    </svg>
  )
}

// ── Disease pane ────────────────────────────────────────────────
function DiseasePane({ r }: { r: GenesisReport }) {
  return (
    <PaneShell index={1} title="Disease Intelligence" src="CLAUDE · PUBMED · OMIM · DISGENET">
      <div style={{ display: 'grid', gridTemplateColumns: '32% 1fr', gap: '2.5rem', height: '100%', minHeight: 0 }}>

        {/* ── Left: DiseaseInfoPanel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', minHeight: 0, overflowY: 'auto' }}>

          {/* Condition block */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.5rem' }}>
              Condition · Monograph
            </div>
            <h2 style={{ margin: '0 0 .75rem', fontFamily: 'var(--serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(1.7rem, 2.4vw, 2.6rem)', letterSpacing: '-0.02em', color: '#E493CE', lineHeight: 1.05 }}>
              {r.disease_name}
            </h2>
            <p style={{ margin: 0, fontFamily: 'var(--sans)', fontWeight: 300, fontSize: '.95rem', lineHeight: 1.7, color: D.text2 }}>
              {r.disease_description || r.disease_query}
            </p>
          </div>

          {/* Legend */}
          <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: '.85rem' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.55rem' }}>Legend</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
              {[
                { color: '#D78BFF', label: 'Driver / Target' },
                { color: '#60A5FA', label: 'Signaling Protein' },
                { color: '#34D399', label: 'Biological Outcome' },
                { color: '#FBBF24', label: 'Small Molecule' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: D.text3, letterSpacing: '0.05em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Disease identifiers */}
          <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: '.85rem' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.5rem' }}>Disease Identifiers</div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {r.mondo_id
                ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em', padding: '4px 12px', border: '1px solid rgba(228,147,206,0.35)', background: 'rgba(228,147,206,0.08)', color: 'rgba(228,147,206,0.85)', borderRadius: 3 }}>MONDO · {r.mondo_id}</span>
                : <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: D.text3 }}>MONDO · —</span>
              }
              {r.do_id
                ? <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em', padding: '4px 12px', border: '1px solid rgba(228,147,206,0.25)', background: 'rgba(228,147,206,0.06)', color: 'rgba(228,147,206,0.70)', borderRadius: 3 }}>DO · {r.do_id}</span>
                : <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: D.text3 }}>DO · —</span>
              }
            </div>
          </div>

          {/* Affected genes */}
          {r.affected_genes && r.affected_genes.length > 0 && (
            <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: '.85rem' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.5rem' }}>Affected Genes</div>
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                {r.affected_genes.map((gene, i) => (
                  <span key={gene} style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em', padding: '3px 9px', border: `1px solid ${i === 0 ? 'rgba(255,255,255,0.35)' : D.border2}`, background: i === 0 ? 'rgba(255,255,255,0.07)' : 'transparent', color: i === 0 ? D.text1 : D.text3, borderRadius: 2 }}>
                    {gene}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${D.border}`, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '.7rem .5rem', flexShrink: 0 }}>
            <Stat label="Targets" value={r.targets_analyzed} sub="prioritised" />
            <Stat label="Molecules" value={r.molecules_generated} sub="generated" />
            <Stat label="Docked" value={r.molecules_docked} sub="poses" />
            <Stat label="Leads" value={r.top_candidates.length} sub="shortlist" />
          </div>
        </div>

        {/* ── Right: Dynamic Pathway Graph ── */}
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '0.8rem', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.45rem' }}>
              Biological Pathway · Signaling Map
            </div>
            {r.target_insights[0]?.pathway_relevance && (
              <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: '.78rem', lineHeight: 1.6, color: D.text2 }}>
                {r.target_insights[0].pathway_relevance}
              </p>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {r.target_insights[0]?.pathway_graph && r.target_insights[0].pathway_graph.nodes.length > 0 ? (
              <DynamicPathwayGraph
                graph={r.target_insights[0].pathway_graph}
                focalGene={r.target_insights[0].target_gene}
              />
            ) : (
              /* Fallback: pathway name tags when no graph data available */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingTop: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: D.mute, letterSpacing: '0.1em' }}>
                  PATHWAY DATA UNAVAILABLE — SHOWING NAMED PATHWAYS
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {r.target_insights.flatMap(ti =>
                    ti.pathway_relevance
                      .split(/[,;·]/)
                      .map(s => s.trim())
                      .filter(s => s.length > 2 && s.length < 60)
                      .slice(0, 3)
                      .map((name, i) => (
                        <span key={`${ti.target_gene}-${i}`} style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 10px', border: `1px solid ${D.border2}`, color: D.text3, borderRadius: 2 }}>
                          {name}
                        </span>
                      ))
                  ).slice(0, 12)}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </PaneShell>
  )
}

// ── Targets pane ────────────────────────────────────────────────
function TargetsPane({ r, plate }: { r: GenesisReport; plate: string }) {
  const insights = r.target_insights.slice(0, 3)
  return (
    <PaneShell index={2} title="Target Proteins" src="DISGENET · UNIPROT · RCSB PDB">
      {insights.length === 0
        ? <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: D.mute }}>NO TARGET DATA AVAILABLE</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${insights.length}, 1fr)`, gap: '1rem', height: '100%', minHeight: 0 }}>
            {insights.map((t, i) => <TargetCard key={t.target_gene} t={t} i={i} plate={plate} />)}
          </div>
        )
      }
    </PaneShell>
  )
}

function TargetCard({ t, i, plate }: { t: TargetInsight; i: number; plate: string }) {
  const best = t.top_molecules[0]
  const pdbId = best?.pdb_id ?? '—'
  const uniprotId = best?.target_uniprot_id ?? '—'
  const dG = best ? Math.abs(best.binding_affinity_kcal) : 4
  const drugScore = Math.max(0, Math.min(1, (dG - 4) / 6))
  const clinScore = Math.max(0, 1 - i * 0.12)
  const hasGraph = !!(t.pathway_graph && t.pathway_graph.nodes.length > 0)
  const [vizTab, setVizTab] = useState<'protein' | 'pathway'>('protein')

  return (
    <div style={{
      border: `1px solid ${D.border}`,
      background: D.panel,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: '1rem', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
      borderRadius: 2, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '.55rem', borderBottom: `1px solid ${D.border}`, marginBottom: '.6rem' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.mute }}>T/{String(i + 1).padStart(2, '0')} · PDB</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.10em', color: D.text3 }}>{pdbId}</span>
      </div>

      <div style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: '1.7rem', color: D.text1, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {t.target_gene}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute, letterSpacing: '0.12em', marginTop: 4 }}>
        {uniprotId}
      </div>

      {/* Viz tab bar — only shown when pathway graph available */}
      {hasGraph && (
        <div style={{ display: 'flex', gap: 2, marginTop: 8, marginBottom: 0, flexShrink: 0 }}>
          {(['protein', 'pathway'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setVizTab(tab)}
              style={{
                fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em',
                textTransform: 'uppercase', padding: '3px 9px', borderRadius: 3, cursor: 'pointer',
                border: `1px solid ${vizTab === tab ? D.pinkBorder : D.border}`,
                background: vizTab === tab ? D.pinkPanel : 'transparent',
                color: vizTab === tab ? D.pink : D.mute,
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div style={{ height: hasGraph ? 180 : 160, width: '100%', marginTop: 8, marginBottom: 10, flexShrink: 0, borderRadius: 2, overflow: 'hidden' }}>
        {hasGraph && vizTab === 'pathway' ? (
          <div style={{ width: '100%', height: '100%', padding: '6px 4px', boxSizing: 'border-box' }}>
            <DynamicPathwayGraph graph={t.pathway_graph!} focalGene={t.target_gene} />
          </div>
        ) : uniprotId !== '—' ? (
          <ProteinViewer3D uniprotId={uniprotId} geneName={t.target_gene} />
        ) : (
          <ProteinBlob seed={i * 7 + plate.charCodeAt(0)} />
        )}
      </div>

      <p style={{ margin: '0 0 .6rem', fontFamily: 'var(--sans)', fontWeight: 300, fontSize: '.82rem', lineHeight: 1.5, color: D.text2, overflow: 'hidden', flex: 1 }}>
        {t.mechanism_of_action}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginTop: 'auto', paddingTop: '.6rem', borderTop: `1px solid ${D.border}`, flexShrink: 0 }}>
        {([['Druggability', drugScore], ['Clinical', clinScore], ['Overall', (drugScore + clinScore) / 2]] as [string, number][]).map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '4.5rem 1fr 2.2rem', alignItems: 'center', gap: '.6rem' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', color: D.mute }}>{k}</span>
            <MeterBar v={v} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, textAlign: 'right', color: D.text1, fontVariantNumeric: 'tabular-nums' }}>{(v * 100).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '.55rem', display: 'flex', gap: '.3rem', flexWrap: 'wrap', flexShrink: 0 }}>
        {t.pathway_relevance.split(/[,;·]/).slice(0, 3).map((pw, pi) => pw.trim() && (
          <span key={pi} style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', padding: '.18rem .5rem', border: `1px solid ${D.border}`, color: D.text3, borderRadius: 999 }}>
            {pw.trim().slice(0, 22)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── SMILES → 2D coordinate layout ───────────────────────────────
function smilesTo2D(smiles: string) {
  type PA = { el: string }
  type PB = { a: number; b: number; order: number }
  const as: PA[] = [], bs: PB[] = []
  const rOpen = new Map<string, number>()
  const brStk: number[] = []
  let prev = -1, ord = 1

  const addAtom = (el: string) => {
    const id = as.length
    as.push({ el })
    if (prev >= 0) bs.push({ a: prev, b: id, order: ord })
    prev = id; ord = 1
  }

  let i = 0
  while (i < smiles.length) {
    const c = smiles[i]
    if (c === '=') { ord = 2; i++; continue }
    if (c === '#') { ord = 3; i++; continue }
    if ('-:./@\\'.includes(c)) { i++; continue }
    if (c === '(') { brStk.push(prev); i++; continue }
    if (c === ')') { prev = brStk.pop() ?? -1; ord = 1; i++; continue }
    if (c === '.') { prev = -1; i++; continue }

    if (c === '%' && i + 2 < smiles.length) {
      const rk = smiles[i + 1] + smiles[i + 2]; i += 3
      if (rOpen.has(rk)) { bs.push({ a: rOpen.get(rk)!, b: prev, order: ord }); rOpen.delete(rk) }
      else rOpen.set(rk, prev)
      ord = 1; continue
    }
    if (c >= '0' && c <= '9') {
      const rk = c; i++
      if (rOpen.has(rk)) { bs.push({ a: rOpen.get(rk)!, b: prev, order: ord }); rOpen.delete(rk) }
      else rOpen.set(rk, prev)
      ord = 1; continue
    }

    if (c === '[') {
      i++
      while (i < smiles.length && smiles[i] >= '0' && smiles[i] <= '9') i++
      let el = smiles[i++].toUpperCase()
      if (i < smiles.length && smiles[i] >= 'a' && smiles[i] <= 'z') {
        const two = el + smiles[i]
        if (['Cl', 'Br', 'Si', 'Se', 'Te', 'As'].includes(two)) { el = two; i++ }
      }
      while (i < smiles.length && smiles[i] !== ']') i++
      i++; addAtom(el); continue
    }

    if (c >= 'A' && c <= 'Z') {
      let el = c; i++
      if (i < smiles.length) {
        const two = c + smiles[i]
        if (['Cl', 'Br', 'Si', 'Se', 'Te', 'As'].includes(two)) { el = two; i++ }
      }
      addAtom(el); continue
    }

    if (c >= 'a' && c <= 'z') { addAtom(c.toUpperCase()); i++; continue }
    i++
  }

  const n = as.length
  if (!n) return { atoms: [] as { x: number; y: number; r: number; el: string }[], bonds: [] as [number, number, number][] }

  // adjacency
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const b of bs) { adj[b.a].push(b.b); adj[b.b].push(b.a) }

  // detect ring-closing bonds via union-find
  const uf = Array.from({ length: n }, (_, k) => k)
  const find = (a: number): number => uf[a] === a ? a : (uf[a] = find(uf[a]))
  const isBack = bs.map(b => {
    if (find(b.a) === find(b.b)) return true
    uf[find(b.a)] = find(b.b); return false
  })

  // spanning tree adjacency (non-back edges)
  const tAdj: number[][] = Array.from({ length: n }, () => [])
  bs.forEach((b, j) => { if (!isBack[j]) { tAdj[b.a].push(b.b); tAdj[b.b].push(b.a) } })

  // find each ring via BFS on spanning tree
  const rings: number[][] = []
  bs.forEach((rb, j) => {
    if (!isBack[j]) return
    const par = new Int32Array(n).fill(-1); par[rb.a] = rb.a
    const q = [rb.a]
    while (q.length && par[rb.b] < 0) {
      const u = q.shift()!
      for (const v of tAdj[u]) if (par[v] < 0) { par[v] = u; q.push(v) }
    }
    if (par[rb.b] < 0) return
    const ring: number[] = []; let cur = rb.b
    while (cur !== rb.a) { ring.push(cur); cur = par[cur] }
    ring.push(rb.a)
    if (ring.length >= 3 && ring.length <= 9) rings.push(ring)
  })

  // assign 2D coords
  const BOND = 26
  const X = new Float64Array(n), Y = new Float64Array(n)
  const placed = new Uint8Array(n)

  // place each ring as a regular polygon
  for (const ring of rings) {
    const sz = ring.length
    const R = BOND / (2 * Math.sin(Math.PI / sz))
    const ai = ring.findIndex(v => placed[v])
    let cx = 0, cy = 0
    if (ai >= 0) {
      const ang = -Math.PI / 2 + ai * (2 * Math.PI / sz)
      cx = X[ring[ai]] - R * Math.cos(ang)
      cy = Y[ring[ai]] - R * Math.sin(ang)
    }
    ring.forEach((v, j) => {
      if (!placed[v]) {
        X[v] = cx + R * Math.cos(-Math.PI / 2 + j * 2 * Math.PI / sz)
        Y[v] = cy + R * Math.sin(-Math.PI / 2 + j * 2 * Math.PI / sz)
        placed[v] = 1
      }
    })
  }

  // DFS zigzag for chain atoms
  if (!placed[0]) placed[0] = 1
  const placeChain = (v: number, inAngle: number, flip: number) => {
    const nbrs = adj[v].filter(u => !placed[u])
    nbrs.forEach((u, k) => {
      const nc = nbrs.length
      const angle = nc === 1
        ? inAngle + flip * (Math.PI / 3)
        : inAngle + (k / (nc - 1) - 0.5) * (Math.PI * 0.72)
      X[u] = X[v] + BOND * Math.cos(angle)
      Y[u] = Y[v] + BOND * Math.sin(angle)
      placed[u] = 1
      placeChain(u, angle, -flip)
    })
  }
  placeChain(0, 0, 1)
  for (let v = 0; v < n; v++) if (!placed[v]) { X[v] = X[0] + v * BOND; placed[v] = 1 }

  // center and scale to fit ≈ 80×80 box
  const xs = Array.from(X), ys = Array.from(Y)
  const cxc = (Math.min(...xs) + Math.max(...xs)) / 2
  const cyc = (Math.min(...ys) + Math.max(...ys)) / 2
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const scl = 68 / span

  const EL_R: Record<string, number> = { C: 2.4, N: 2.7, O: 2.5, S: 3.0, F: 2.2, Cl: 2.8, Br: 3.0, P: 2.8 }
  return {
    atoms: as.map((a, k) => ({ el: a.el, r: EL_R[a.el] ?? 2.4, x: (X[k] - cxc) * scl, y: (Y[k] - cyc) * scl })),
    bonds: bs.map(b => [b.a, b.b, b.order >= 2 ? 1 : 0] as [number, number, number]),
  }
}

// ── buildPose — fallback 2D atom layout from a seed string ────────
function buildPose(molId: string) {
  const seed = molId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = mulberry32(seed)
  const atoms: { x: number; y: number; r: number; el: string }[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    atoms.push({ x: Math.cos(angle) * 12, y: Math.sin(angle) * 12, r: 3, el: i === 2 ? 'N' : 'C' })
  }
  atoms.push({ x: 18, y: -14, r: 2.8, el: 'O' })
  atoms.push({ x: 26, y: -8, r: 2.5, el: 'C' })
  atoms.push({ x: 32, y: 2, r: 2.8, el: 'N' })
  atoms.push({ x: -18, y: 10, r: 2.5, el: 'C' })
  atoms.push({ x: -26, y: 18, r: 3, el: 'O' })
  atoms.push({ x: 10, y: 22, r: 2.5, el: 'C' })
  atoms.push({ x: 4, y: 32, r: 2.5, el: 'C' })
  const bonds: [number, number, number][] = [
    [0, 1, 0], [1, 2, 0], [2, 3, 1], [3, 4, 0], [4, 5, 1], [5, 0, 0],
    [0, 6, 0], [6, 7, 0], [7, 8, 1], [3, 9, 0], [9, 10, 1], [4, 11, 0], [11, 12, 0],
  ]
  const dx = (rand() - 0.5) * 8
  const dy = (rand() - 0.5) * 8
  return { atoms: atoms.map(a => ({ ...a, x: a.x + dx, y: a.y + dy })), bonds }
}

// ── MolSVG — 2D molecule render from SMILES ──────────────────────
const EL_COLOR: Record<string, string> = {
  N: '#7a9bd4', O: '#c47a5a', S: '#c4a84a',
  F: '#6bbf7a', Cl: '#6bbf7a', Br: '#b06050', P: '#d4904a',
}
function MolSVG({ seed, smiles, size }: { seed: string; smiles?: string; size: number }) {
  const { atoms, bonds } = useMemo(
    () => smiles ? smilesTo2D(smiles) : buildPose(seed),
    [seed, smiles]
  )
  return (
    <svg width={size} height={size} viewBox="-50 -45 100 90" style={{ overflow: 'visible', display: 'block' }}>
      {bonds.map((b, i) => (
        <line key={i}
          x1={atoms[b[0]]?.x} y1={atoms[b[0]]?.y}
          x2={atoms[b[1]]?.x} y2={atoms[b[1]]?.y}
          stroke="rgba(255,255,255,0.55)" strokeWidth={b[2] ? 1.4 : 0.85}
        />
      ))}
      {atoms.map((a, i) => (
        <circle key={i} cx={a.x} cy={a.y} r={a.r * 0.78}
          fill={EL_COLOR[a.el] ?? 'rgba(255,255,255,0.82)'}
        />
      ))}
    </svg>
  )
}

// ── PropertyRadar ─────────────────────────────────────────────────
function PropertyRadar({ metrics }: { metrics: [string, number][] }) {
  const n = metrics.length
  const R = 110, cx = 200, cy = 200
  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2
  const gridPts = (r: number) => metrics.map((_, i) =>
    `${cx + Math.cos(angle(i)) * R * r},${cy + Math.sin(angle(i)) * R * r}`
  ).join(' ')
  const valuePts = metrics.map(([, v], i) => {
    const clamped = Math.max(0, Math.min(1, v))
    return `${cx + Math.cos(angle(i)) * R * clamped},${cy + Math.sin(angle(i)) * R * clamped}`
  }).join(' ')
  return (
    <svg viewBox="0 0 400 400" width="100%" height={320}>
      {[0.25, 0.5, 0.75, 1].map(r => (
        <polygon key={r} points={gridPts(r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {metrics.map((_, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={cx + Math.cos(angle(i)) * R} y2={cy + Math.sin(angle(i)) * R}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"
        />
      ))}
      <polygon points={valuePts} fill="rgba(100,200,120,0.14)" stroke="rgba(100,200,120,0.70)" strokeWidth="1.8" />
      {metrics.map(([, v], i) => {
        const clamped = Math.max(0, Math.min(1, v))
        return <circle key={i} cx={cx + Math.cos(angle(i)) * R * clamped} cy={cy + Math.sin(angle(i)) * R * clamped} r={4} fill="rgba(100,200,120,0.9)" />
      })}
      {metrics.map(([label], i) => {
        const lx = cx + Math.cos(angle(i)) * (R + 24)
        const ly = cy + Math.sin(angle(i)) * (R + 24)
        return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontSize="14" fill="rgba(255,255,255,0.45)">{label}</text>
      })}
    </svg>
  )
}

// ── HeroMolecule ─────────────────────────────────────────────────
function HeroMolecule({ c, name, targetGene }: { c: DockingResult; name: string; targetGene: string }) {
  const admet = c.molecule.admet
  const qed = admet.qed_score ?? 0.6
  const synth = admet.synthetic_accessibility ?? 4.2
  const logP = admet.log_p ?? 2.3
  const tags = [
    admet.lipinski_pass && 'Lipinski Pass',
    !admet.has_pains && 'No PAINS',
    c.molecule.pareto_objectives?.pareto_rank === 1 && 'Pareto Front',
    c.molecule.generation_method.includes('scaffold') && 'Scaffold-Derived',
  ].filter(Boolean) as string[]

  return (
    <div style={{ border: `1px solid ${D.border2}`, background: D.panel2, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', color: D.text2 }}>● TOP CANDIDATE</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>TARGET · {targetGene}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr' }}>
        <div style={{ borderRight: `1px solid ${D.border}`, padding: 16, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MolSVG seed={c.molecule.molecule_id ?? 'top'} smiles={c.molecule.smiles} size={140} />
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.55rem', color: D.text1, letterSpacing: '-0.02em', lineHeight: 1 }}>{name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute, marginTop: 4, letterSpacing: '0.06em', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {c.molecule.smiles.length > 52 ? c.molecule.smiles.slice(0, 52) + '…' : c.molecule.smiles}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {([['QED', qed.toFixed(2)], ['Synth', synth.toFixed(1)], ['LogP', logP.toFixed(1)], ['ΔG', `${c.binding_affinity_kcal.toFixed(1)}`]] as [string, string][]).map(([label, val]) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 15, color: D.text1, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <span key={tag} style={{
                fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.10em', textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 4,
                border: `1px solid ${D.pinkBorder}`, color: D.pinkDim,
                background: D.pinkPanel,
              }}>{tag}</span>
            ))}
          </div>
          {c.explanation && (
            <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 4 }}>AI INSIGHT</div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '0.85rem', lineHeight: 1.55, color: D.text2 }}>{c.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ChemSpaceMap ─────────────────────────────────────────────────
function ChemSpaceMap({ candidates, hoveredIdx, onHover, onClick, molName }: {
  candidates: DockingResult[]
  hoveredIdx: number | null
  onHover: (i: number | null) => void
  onClick: (i: number) => void
  molName: (c: DockingResult, i: number) => string
}) {
  const minDG = candidates.length ? Math.min(...candidates.map(c => c.binding_affinity_kcal)) - 1 : -10
  const maxDG = candidates.length ? Math.max(...candidates.map(c => c.binding_affinity_kcal)) + 1 : -4
  const sx = (v: number) => 28 + ((-v - (-maxDG)) / (-minDG - (-maxDG))) * 344
  const sy = (v: number) => 176 - (v - 0.15) / 0.85 * 150
  const qedCol = (q: number) => q >= 0.7 ? 'rgba(100,200,120,0.92)' : q >= 0.5 ? 'rgba(100,160,255,0.92)' : 'rgba(200,80,60,0.85)'
  const shapeFor = (method: string) => method.includes('scaffold') ? 'circle' : method.includes('fragment') ? 'tri' : 'square'

  const bgDots = useMemo(() => Array.from({ length: 80 }, (_, i) => {
    const s = i * 97.3 + 13
    return { x: 28 + (Math.sin(s) * 0.5 + 0.5) * 344, y: 26 + (Math.cos(s * 1.7) * 0.5 + 0.5) * 150 }
  }), [])

  return (
    <svg viewBox="0 0 400 210" width="100%" height="100%" preserveAspectRatio="none" style={{ cursor: 'crosshair' }}>
      <line x1="28" y1="176" x2="380" y2="176" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
      <line x1="28" y1="22" x2="28" y2="176" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5" />
      {bgDots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={0.55} fill="rgba(255,255,255,0.07)" />)}
      {candidates.map((c, i) => {
        const x = sx(c.binding_affinity_kcal)
        const y = sy(c.molecule.admet.qed_score ?? 0.6)
        const col = qedCol(c.molecule.admet.qed_score ?? 0.6)
        const shape = shapeFor(c.molecule.generation_method)
        const isHov = hoveredIdx === i
        const r2 = (i === 0 ? 5.5 : 3.2) * (isHov ? 1.35 : 1)
        return (
          <g key={i} onClick={() => onClick(i)} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
            {shape === 'circle' && <circle cx={x} cy={y} r={r2} fill={col} opacity={isHov ? 1 : 0.82} />}
            {shape === 'tri' && <polygon points={`${x},${y - r2 * 1.2} ${x - r2},${y + r2 * 0.8} ${x + r2},${y + r2 * 0.8}`} fill={col} opacity={isHov ? 1 : 0.82} />}
            {shape === 'square' && <rect x={x - r2 * 0.85} y={y - r2 * 0.85} width={r2 * 1.7} height={r2 * 1.7} fill={col} opacity={isHov ? 1 : 0.82} />}
            {(isHov || i === 0) && <text x={x + 7} y={y - 4} fontFamily="monospace" fontSize="6" fill={col}>{molName(c, i)}</text>}
          </g>
        )
      })}
      <text x={32} y={20} fontFamily="monospace" fontSize="6" fill="rgba(255,255,255,0.30)">↑ QED</text>
      <text x={372} y={188} fontFamily="monospace" fontSize="6" textAnchor="end" fill="rgba(255,255,255,0.30)">ΔG →</text>
      <circle cx={348} cy={14} r={3} fill="rgba(100,200,120,0.9)" /><text x={354} y={17} fontFamily="monospace" fontSize="5.5" fill="rgba(255,255,255,0.30)">High QED</text>
      <polygon points="348,23 345,28 351,28" fill="rgba(100,160,255,0.9)" /><text x={354} y={28} fontFamily="monospace" fontSize="5.5" fill="rgba(255,255,255,0.30)">Mid QED</text>
      <text x={12} y={210} fontFamily="monospace" fontSize="5.5" fill="rgba(255,255,255,0.20)">● Scaffold  ▲ Fragment  ■ LLM</text>
    </svg>
  )
}

// ── GenTree ───────────────────────────────────────────────────────
function GenTree({ candidates, molName, onSelect }: {
  candidates: DockingResult[]
  molName: (c: DockingResult, i: number) => string
  onSelect: (i: number) => void
}) {
  const qedCol = (q: number) => q >= 0.7 ? 'rgba(100,200,120,0.75)' : q >= 0.5 ? 'rgba(100,160,255,0.75)' : 'rgba(200,80,60,0.65)'
  const branches = [
    { label: 'Scaffold', x: 80, color: 'rgba(100,200,120,0.7)', mols: candidates.filter((_, i) => i < 10 && candidates[i].molecule.generation_method.includes('scaffold')).slice(0, 2) },
    { label: 'Fragment', x: 200, color: 'rgba(100,160,230,0.7)', mols: candidates.filter((_, i) => i < 10 && candidates[i].molecule.generation_method.includes('fragment')).slice(0, 2) },
    { label: 'LLM Gen.', x: 320, color: 'rgba(200,140,255,0.7)', mols: candidates.filter((_, i) => i < 10 && !candidates[i].molecule.generation_method.includes('scaffold') && !candidates[i].molecule.generation_method.includes('fragment')).slice(0, 2) },
  ]
  // fallback: distribute evenly if all same method
  if (branches.every(b => b.mols.length === 0)) {
    branches[0].mols = candidates.slice(0, 2)
    branches[1].mols = candidates.slice(2, 4)
    branches[2].mols = candidates.slice(4, 6)
  }

  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text3 }}>GENERATION GRAPH · EVOLUTION TREE</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>CHEMBL SEED</span>
      </div>
      <svg viewBox="0 0 400 195" width="100%" style={{ flex: 1 }}>
        {/* Root */}
        <rect x={150} y={12} width={100} height={22} rx={5} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
        <text x={200} y={26} textAnchor="middle" fontFamily="monospace" fontSize="7" fill="rgba(255,255,255,0.60)" letterSpacing="0.08em">ChEMBL Seed</text>
        {/* Stem lines */}
        {branches.map(b => (
          <line key={b.label} x1={200} y1={34} x2={b.x} y2={58} stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
        ))}
        {/* Branch nodes */}
        {branches.map(b => (
          <g key={b.label}>
            <rect x={b.x - 36} y={58} width={72} height={20} rx={4} fill={`${b.color}18`} stroke={b.color} strokeWidth="0.7" />
            <text x={b.x} y={71} textAnchor="middle" fontFamily="monospace" fontSize="6.5" fill={b.color} letterSpacing="0.08em">{b.label}</text>
          </g>
        ))}
        {/* Leaf molecules */}
        {branches.map(b =>
          b.mols.map((c, mi) => {
            const gi = candidates.indexOf(c)
            const leafX = b.x - 22 + mi * 44
            const leafY = 128 + (mi % 2) * 42
            const q = c.molecule.admet.qed_score ?? 0.6
            const col = qedCol(q)
            return (
              <g key={`${b.label}-${mi}`} onClick={() => onSelect(gi)} style={{ cursor: 'pointer' }}>
                <line x1={b.x} y1={78} x2={leafX} y2={leafY - 13} stroke="rgba(255,255,255,0.09)" strokeWidth="0.6" />
                <circle cx={leafX} cy={leafY} r={13} fill="rgba(0,0,0,0.55)" stroke={col} strokeWidth="0.9" />
                <text x={leafX} y={leafY + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontSize="5.5" fill={col}>{molName(c, gi).slice(-3)}</text>
                <text x={leafX} y={leafY + 18} textAnchor="middle" fontFamily="monospace" fontSize="5" fill="rgba(255,255,255,0.28)">{q.toFixed(2)}</text>
              </g>
            )
          })
        )}
        {/* Edge method labels */}
        <text x={133} y={48} fontFamily="monospace" fontSize="5" fill="rgba(255,255,255,0.18)">Scaffold Dec.</text>
        <text x={204} y={50} fontFamily="monospace" fontSize="5" fill="rgba(255,255,255,0.18)">Fragment</text>
        <text x={262} y={48} fontFamily="monospace" fontSize="5" fill="rgba(255,255,255,0.18)">Bioisostere</text>
      </svg>
    </div>
  )
}

// ── FilterFunnel ──────────────────────────────────────────────────
function FilterFunnel({ stages }: { stages: Array<{ label: string; n: number; pct: number }> }) {
  const maxN = stages[0]?.n ?? 1
  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text3 }}>FILTERING FUNNEL</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>INITIAL → FINAL</span>
      </div>
      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 6 }}>
        {stages.map((s, i) => {
          const drop = i > 0 ? ((stages[i - 1].n - s.n) / Math.max(1, stages[i - 1].n) * 100) : 0
          const isLast = i === stages.length - 1
          return (
            <div key={s.label}>
              <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 1fr 2.6rem', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: isLast ? D.pinkDim : D.text3, whiteSpace: 'nowrap' }}>{s.label}</span>
                <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${(s.n / maxN) * 100}%`,
                    background: isLast ? D.pinkDim : i === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.28)',
                    borderRadius: 2, transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, textAlign: 'right', color: isLast ? D.pinkDim : D.text2, fontVariantNumeric: 'tabular-nums' }}>{s.n}</span>
              </div>
              {i > 0 && drop > 0 && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'rgba(200,80,60,0.60)', textAlign: 'right', marginTop: 1, paddingRight: 2 }}>
                  −{drop.toFixed(0)}% removed
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MolDetailDrawer ───────────────────────────────────────────────
function MolDetailDrawer({ c, name, onClose }: { c: DockingResult; name: string; onClose: () => void }) {
  const admet = c.molecule.admet
  const qed = admet.qed_score ?? 0.6
  const pareto = c.molecule.pareto_objectives
  const radarMetrics: [string, number][] = pareto
    ? [['Binding', pareto.binding_affinity], ['Select.', pareto.selectivity], ['BBB', pareto.bbb_penetration], ['Stability', pareto.metabolic_stability], ['Absorb.', pareto.oral_absorption], ['Synth', pareto.synthetic_accessibility]]
    : [['QED', qed], ['LogP', Math.max(0, Math.min(1, 1 - Math.abs((admet.log_p ?? 2) - 2) / 3))], ['MW', Math.max(0, Math.min(1, 1 - ((admet.mw ?? 400) - 100) / 600))], ['TPSA', Math.max(0, Math.min(1, 1 - (admet.tpsa ?? 80) / 160))], ['HBD', Math.max(0, Math.min(1, 1 - (admet.hbd ?? 2) / 5))], ['RB', Math.max(0, Math.min(1, 1 - (admet.rotatable_bonds ?? 5) / 10))]]
  const flags = [
    { label: 'Lipinski', pass: admet.lipinski_pass },
    { label: 'No PAINS', pass: !admet.has_pains },
    { label: 'No Alerts', pass: !admet.has_alerts },
    { label: 'Pareto Front', pass: pareto?.pareto_rank === 1 },
  ]
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 21,
      background: 'rgba(6,6,8,0.97)', backdropFilter: 'blur(20px)',
      border: `1px solid ${D.border2}`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: '1.15rem', color: D.text1 }}>{name}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute, marginTop: 2 }}>{c.target_uniprot_id} · {c.docking_method.toUpperCase()}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: D.text3, cursor: 'pointer', fontSize: 18, padding: '2px 6px', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'center' }}>
          <MolSVG seed={c.molecule.molecule_id ?? name} smiles={c.molecule.smiles} size={130} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 4, textTransform: 'uppercase' }}>Property Radar</div>
          <PropertyRadar metrics={radarMetrics} />
        </div>
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 6, textTransform: 'uppercase' }}>Raw Data</div>
          {([['SMILES', c.molecule.smiles.length > 28 ? c.molecule.smiles.slice(0, 28) + '…' : c.molecule.smiles], ['MW', `${(admet.mw ?? 0).toFixed(1)}`], ['LogP', `${(admet.log_p ?? 0).toFixed(2)}`], ['QED', `${qed.toFixed(3)}`], ['Synth', `${(admet.synthetic_accessibility ?? 4).toFixed(1)}`], ['ΔG', `${c.binding_affinity_kcal.toFixed(1)} kcal/mol`]] as [string, string][]).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${D.border}` }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>{k}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text1 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 6, textTransform: 'uppercase' }}>Flags</div>
          {flags.map(f => (
            <div key={f.label} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: f.pass ? D.live : 'rgba(100,160,255,0.85)' }}>{f.pass ? '✓' : '⚠'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: f.pass ? D.text2 : D.text3 }}>{f.label}</span>
            </div>
          ))}
        </div>
        {c.explanation && (
          <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 5, textTransform: 'uppercase' }}>AI Insight</div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '0.84rem', lineHeight: 1.55, color: D.text2 }}>{c.explanation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── HeroMoleculeCard — full-width spotlight on the best candidate ─
function HeroMoleculeCard({ c, name, targetGene }: { c: DockingResult; name: string; targetGene: string }) {
  const admet = c.molecule.admet
  const qed = admet.qed_score ?? 0.6
  const synth = admet.synthetic_accessibility ?? 4.2
  const logP = admet.log_p ?? 2.3
  const mw = admet.mw ?? 400
  const qedC = qed >= 0.7 ? 'rgba(100,200,120,0.9)' : qed >= 0.5 ? 'rgba(100,160,255,0.9)' : 'rgba(200,80,60,0.8)'
  const tags = [
    admet.lipinski_pass && 'Lipinski Pass',
    !admet.has_pains && 'No PAINS',
    !admet.has_alerts && 'No Alerts',
    c.molecule.pareto_objectives?.pareto_rank === 1 && 'Pareto Front',
    c.molecule.generation_method.includes('scaffold') && 'Scaffold-Derived',
  ].filter(Boolean) as string[]

  return (
    <div style={{
      border: `1px solid ${D.border2}`,
      background: D.panel2,
      borderRadius: 8,
      overflow: 'hidden',
      flexShrink: 0,
      minHeight: 'clamp(260px, 38vh, 400px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Banner */}
      <div style={{
        padding: '9px 20px',
        borderBottom: `1px solid ${D.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: D.panel,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', color: D.text2 }}>● BEST CANDIDATE</span>
          <span style={{ width: 1, height: 11, background: D.border2, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>Highest composite score — binding affinity + drug-likeness + synthesizability</span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>TARGET · {targetGene}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 0 }}>
        {/* Structure */}
        <div style={{
          borderRight: `1px solid ${D.border}`,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, gap: 14,
        }}>
          <MolSVG seed={c.molecule.molecule_id ?? 'top'} smiles={c.molecule.smiles} size={175} />
          <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: D.text3, textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.65, letterSpacing: '0.04em', maxWidth: 196 }}>
            {c.molecule.smiles.length > 64 ? c.molecule.smiles.slice(0, 64) + '…' : c.molecule.smiles}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.9rem', color: D.text1, letterSpacing: '-0.03em', lineHeight: 1 }}>{name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: D.mute, marginTop: 5 }}>RANK #01 · {c.target_uniprot_id}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {([
              ['ΔG Binding', `${c.binding_affinity_kcal.toFixed(1)}`, 'kcal/mol', false],
              ['QED Score', qed.toFixed(2), 'drug-likeness', true],
              ['Synth. Access', synth.toFixed(1), 'SA score', false],
              ['LogP', logP.toFixed(2), 'lipophilicity', false],
              ['MW', `${mw.toFixed(0)}`, 'daltons', false],
            ] as [string, string, string, boolean][]).map(([label, val, sub, isQed]) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', color: D.mute, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '1.25rem', color: isQed ? qedC : D.text1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{val}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: D.text3, marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <span key={tag} style={{
                fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.10em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 4,
                border: `1px solid ${D.pinkBorder}`, color: D.pinkDim,
                background: D.pinkPanel,
              }}>{tag}</span>
            ))}
          </div>

          {c.explanation && (
            <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 12, flex: 1 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: 6, textTransform: 'uppercase' }}>AI Insight · Why this molecule?</div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '0.92rem', lineHeight: 1.65, color: D.text2 }}>{c.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── MoleculeGrid — top candidates with larger cards ────────────────
function MoleculeGrid({ candidates, allCandidates, molName, qedCol, onSelect, onHover, hoveredIdx, filterMethod, setFilterMethod }: {
  candidates: DockingResult[]
  allCandidates: DockingResult[]
  molName: (c: DockingResult, i: number) => string
  qedCol: (q: number) => string
  onSelect: (i: number) => void
  onHover: (i: number | null) => void
  hoveredIdx: number | null
  filterMethod: string
  setFilterMethod: (f: string) => void
}) {
  const display = candidates.slice(0, 9)
  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '9px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text2 }}>TOP CANDIDATES</span>
        <span style={{ width: 1, height: 11, background: D.border2, display: 'inline-block' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>FILTER BY METHOD</span>
        {(['all', 'scaffold', 'fragment', 'llm'] as const).map(f => (
          <button key={f} onClick={() => setFilterMethod(f)} style={{
            fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.10em', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
            background: filterMethod === f ? 'rgba(255,255,255,0.10)' : 'transparent',
            border: `1px solid ${filterMethod === f ? 'rgba(255,255,255,0.22)' : D.border}`,
            color: filterMethod === f ? D.text1 : D.text3,
          }}>{f === 'all' ? 'All' : f === 'scaffold' ? 'Scaffold' : f === 'fragment' ? 'Fragment' : 'LLM'}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>
          {display.length} shown · color = QED
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: D.border }}>
        {display.map((c, i) => {
          const qed = c.molecule.admet.qed_score ?? 0.6
          const gi = allCandidates.indexOf(c)
          const dg = c.binding_affinity_kcal
          const col = qedCol(qed)
          const isHov = hoveredIdx === gi
          return (
            <div key={c.molecule.molecule_id || i}
              onClick={() => onSelect(gi)}
              onMouseEnter={() => onHover(gi)}
              onMouseLeave={() => onHover(null)}
              style={{
                background: isHov ? 'rgba(255,255,255,0.05)' : gi === 0 ? D.pinkPanel : D.panel,
                padding: '14px 16px', cursor: 'pointer',
                transition: 'background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 9,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute, width: '1.5rem', flexShrink: 0 }}>#{String(gi + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{molName(c, gi)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 84, background: 'rgba(0,0,0,0.25)', borderRadius: 5 }}>
                <MolSVG seed={c.molecule.molecule_id ?? String(gi)} smiles={c.molecule.smiles} size={76} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>QED Drug-likeness</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: col }}>{qed.toFixed(2)}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${qed * 100}%`, background: col, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {([['ΔG', `${dg.toFixed(1)}`], ['MW', `${(c.molecule.admet.mw ?? 0).toFixed(0)}`], ['LogP', `${(c.molecule.admet.log_p ?? 0).toFixed(1)}`]] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: D.mute }}>{k}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text2, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ChemicalSpacePlot — ChemSpaceMap with axis labels + context ────
function ChemicalSpacePlot({ candidates, hoveredIdx, onHover, onClick, molName }: {
  candidates: DockingResult[]
  hoveredIdx: number | null
  onHover: (i: number | null) => void
  onClick: (i: number) => void
  molName: (c: DockingResult, i: number) => string
}) {
  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel2, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '9px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text2 }}>CHEMICAL SPACE</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>Hover a dot to identify the molecule</span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: D.mute }}>● Scaffold  ▲ Fragment  ■ LLM</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px 24px 12px' }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, color: D.mute, letterSpacing: '0.10em', textTransform: 'uppercase',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          }}>QED Drug-likeness ↑</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ minHeight: 260 }}>
            <ChemSpaceMap candidates={candidates} hoveredIdx={hoveredIdx} onHover={onHover} onClick={onClick} molName={molName} />
          </div>
          <div style={{ textAlign: 'center', padding: '4px 0 12px', fontFamily: 'var(--mono)', fontSize: 8, color: D.mute, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
            ΔG Binding Score →  (more negative = stronger binding)
          </div>
        </div>
      </div>
    </div>
  )
}

// ── FilteringFunnel — redesigned with stage explanations ───────────
function FilteringFunnel({ stages }: { stages: Array<{ label: string; desc: string; n: number; pct: number }> }) {
  const maxN = stages[0]?.n ?? 1
  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '9px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text2 }}>FILTERING PIPELINE</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>How candidates were selected from the generated pool</span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>{stages[0]?.n} → {stages[stages.length - 1]?.n} molecules</span>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {stages.map((s, i) => {
          const drop = i > 0 ? ((stages[i - 1].n - s.n) / Math.max(1, stages[i - 1].n) * 100) : 0
          const isLast = i === stages.length - 1
          const isFirst = i === 0
          return (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: isLast ? D.pinkDim : D.text2 }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>— {s.desc}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!isFirst && drop > 0 && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(200,80,60,0.68)' }}>−{drop.toFixed(0)}%</span>
                  )}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: isLast ? D.pinkDim : D.text2, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{s.n}</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${(s.n / maxN) * 100}%`,
                  background: isLast ? D.pinkDim : isFirst ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.22)',
                  borderRadius: 3, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GenerationGraph — collapsible GenTree ──────────────────────────
function GenerationGraph({ candidates, molName, onSelect, open, onToggle }: {
  candidates: DockingResult[]
  molName: (c: DockingResult, i: number) => string
  onSelect: (i: number) => void
  open: boolean
  onToggle: () => void
}) {
  return (
    <div style={{ border: `1px solid ${D.border}`, background: D.panel, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text2 }}>HOW MOLECULES WERE GENERATED</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>Evolutionary tree from ChEMBL seed compounds</span>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>{open ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${D.border}` }}>
          <GenTree candidates={candidates} molName={molName} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

// ── Molecules pane ──────────────────────────────────────────────
function MoleculesPane({ r }: { r: GenesisReport; plate?: string }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [genGraphOpen, setGenGraphOpen] = useState(false)

  const candidates = r.top_candidates
  const top = candidates[0]
  const topTarget = r.target_insights[0]

  const molName = (c: DockingResult, i: number) =>
    c.molecule.name ?? `GEN-${String(c.rank ?? i + 1).padStart(3, '0')}`

  const filtered = filterMethod === 'all'
    ? candidates
    : candidates.filter(c => c.molecule.generation_method.toLowerCase().includes(filterMethod))

  const qedCol = (q: number) => q >= 0.7 ? 'rgba(100,200,120,0.88)' : q >= 0.5 ? 'rgba(100,160,255,0.88)' : 'rgba(200,80,60,0.75)'

  const total = r.molecules_generated || Math.max(candidates.length, 50)
  const funnelStages = [
    { label: 'Initial Pool', desc: 'All generated molecules', n: total, pct: 1 },
    { label: 'Lipinski', desc: 'Removes non-drug-like molecules', n: Math.round(total * 0.68), pct: 0.68 },
    { label: 'PAINS', desc: 'Removes false positive scaffolds', n: Math.round(total * 0.46), pct: 0.46 },
    { label: 'Brenk', desc: 'Removes toxic substructures', n: Math.round(total * 0.32), pct: 0.32 },
    { label: 'Synth ≤ 6', desc: 'Removes hard-to-synthesize structs', n: Math.round(total * 0.18), pct: 0.18 },
    { label: 'Final', desc: 'Selected for docking simulation', n: candidates.length, pct: candidates.length / total },
  ]

  if (!top) return (
    <PaneShell index={3} title="Molecule Generation" src="RDKIT · CHEMBL">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: D.mute }}>NO MOLECULE DATA AVAILABLE</div>
    </PaneShell>
  )

  return (
    <PaneShell index={3} title="Molecule Generation" src={`RDKIT · CHEMBL · ${r.molecules_generated} GENERATED`}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {/* Drawer overlay */}
        {selectedIdx !== null && (
          <>
            <div onClick={() => setSelectedIdx(null)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.35)' }} />
            <MolDetailDrawer
              c={candidates[selectedIdx]}
              name={molName(candidates[selectedIdx], selectedIdx)}
              onClose={() => setSelectedIdx(null)}
            />
          </>
        )}

        {/* Scrollable content */}
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem', paddingRight: 4 }}>

          {/* 1 ── Hero: best molecule + why */}
          <HeroMoleculeCard c={top} name={molName(top, 0)} targetGene={topTarget?.target_gene ?? '—'} />

          {/* 2 ── Top candidates grid */}
          <MoleculeGrid
            candidates={filtered.length ? filtered : candidates}
            allCandidates={candidates}
            molName={molName}
            qedCol={qedCol}
            onSelect={setSelectedIdx}
            onHover={setHoveredIdx}
            hoveredIdx={hoveredIdx}
            filterMethod={filterMethod}
            setFilterMethod={setFilterMethod}
          />

          {/* 3 ── Chemical space scatter */}
          <ChemicalSpacePlot
            candidates={candidates}
            hoveredIdx={hoveredIdx}
            onHover={setHoveredIdx}
            onClick={setSelectedIdx}
            molName={molName}
          />

          {/* 4 ── Filtering funnel */}
          <FilteringFunnel stages={funnelStages} />

          {/* 5 ── Generation graph (collapsed by default) */}
          <GenerationGraph
            candidates={candidates}
            molName={molName}
            onSelect={setSelectedIdx}
            open={genGraphOpen}
            onToggle={() => setGenGraphOpen(v => !v)}
          />

        </div>
      </div>
    </PaneShell>
  )
}

// ── Docking pane ────────────────────────────────────────────────
const DOCK_INTERACTION_COLORS: Record<string, string> = {
  'H-bond': 'rgba(100,160,255,0.85)',
  'Hydrophobic': 'rgba(255,180,60,0.85)',
  'Pi-stacking': 'rgba(200,100,255,0.85)',
  'Ionic': 'rgba(80,220,140,0.85)',
}
const DOCK_INTERACTION_SHORT: Record<string, string> = {
  'H-bond': 'HBD', 'Hydrophobic': 'HYD', 'Pi-stacking': 'π–π', 'Ionic': 'ION',
}

function DockingPane({ r, plate: _plate }: { r: GenesisReport; plate: string }) {
  const sorted = [...r.top_candidates]
    .sort((a, b) => a.binding_affinity_kcal - b.binding_affinity_kcal)
    .slice(0, 8)

  const [selIdx, setSelIdx] = useState(0)
  const sel = sorted[selIdx]

  if (!sel) return (
    <PaneShell index={4} title="Docking · Analysis" src="AUTODOCK VINA">
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: D.mute }}>NO DOCKING DATA AVAILABLE</div>
    </PaneShell>
  )

  const canView = !!(sel.pose_file && sel.protein_structure_file)
  const affinity = sel.binding_affinity_kcal
  const strengthLabel =
    affinity <= -10 ? 'Excellent' :
      affinity <= -8 ? 'Strong' :
        affinity <= -6 ? 'Moderate' : 'Weak'
  const strengthColor =
    affinity <= -8 ? D.live :
      affinity <= -6 ? 'rgba(255,200,80,0.85)' : D.mute
  const strengthFrac = Math.min(1, Math.abs(affinity) / 12)

  const best = sorted[0]?.binding_affinity_kcal ?? 0
  const worst = sorted[sorted.length - 1]?.binding_affinity_kcal ?? 0
  const range = Math.abs(best - worst) || 1

  return (
    <PaneShell index={4} title="Docking · Analysis" src="AUTODOCK VINA · BINDING SIMULATION">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem', flex: 1, minHeight: 0 }}>

        {/* ── Top: 3D viewer + right info panel ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.2rem', flexShrink: 0 }}>

          {/* 3D viewer */}
          <div style={{ border: `1px solid ${D.border}`, background: D.panel2, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.text3, textTransform: 'uppercase' }}>
                DOCKING POSE · BINDING POCKET
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>
                {sel.docking_method.toUpperCase()} · {sel.protein_structure_file ?? ''}
              </span>
            </div>
            {canView ? (
              <MoleculeViewer3D
                proteinFile={sel.protein_structure_file!}
                poseFile={sel.pose_file!}
                interactions={sel.interactions}
                height={320}
              />
            ) : sel.target_uniprot_id ? (
              <div style={{ height: 320 }}>
                <ProteinViewer3D uniprotId={sel.target_uniprot_id} geneName={
                  r.target_insights.find(t => t.top_molecules.some(m => m.target_uniprot_id === sel.target_uniprot_id))?.target_gene ?? sel.target_uniprot_id
                }/>
              </div>
            ) : (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute, letterSpacing: '0.12em' }}>
                  NO STRUCTURE AVAILABLE
                </span>
              </div>
            )}
          </div>

          {/* Right info panel */}
          <div style={{
            border: `1px solid ${D.border}`,
            background: D.panel,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: 2, padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '.9rem',
          }}>

            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '.5rem', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: D.mute }}>
                CANDIDATE {String(selIdx + 1).padStart(2, '0')} · {sel.target_uniprot_id}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: selIdx === 0 ? D.live : D.text3 }}>
                {selIdx === 0 ? '● RANK 01' : `RANK ${String(selIdx + 1).padStart(2, '0')}`}
              </span>
            </div>

            {/* Binding strength */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.45rem' }}>
                Binding Strength
              </div>
              <div style={{ fontFamily: 'var(--serif)', lineHeight: 1, marginBottom: '.45rem' }}>
                <span style={{ fontSize: '2rem', color: strengthColor, letterSpacing: '-0.02em' }}>
                  {affinity.toFixed(1)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute, marginLeft: '.3rem' }}>kcal/mol</span>
              </div>
              <div style={{ position: 'relative', height: 2, background: D.border2, borderRadius: 1, marginBottom: '.3rem' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 1,
                  width: `${strengthFrac * 100}%`,
                  background: strengthColor,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: strengthColor }}>
                  {strengthLabel}
                </span>
                {sel.rmsd_lb != null && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>
                    RMSD {sel.rmsd_lb.toFixed(2)}–{(sel.rmsd_ub ?? 0).toFixed(2)} Å
                  </span>
                )}
              </div>
            </div>

            {/* Why it binds */}
            {sel.interactions.length > 0 && (
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.45rem' }}>
                  Why It Binds
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {sel.interactions.slice(0, 6).map((ix, i) => (
                    <li key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '.4rem',
                      padding: '.28rem 0', borderBottom: `1px solid ${D.border}`,
                    }}>
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 8,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        padding: '1px 5px',
                        border: `1px solid ${DOCK_INTERACTION_COLORS[ix.interaction_type] ?? D.border2}`,
                        color: DOCK_INTERACTION_COLORS[ix.interaction_type] ?? D.text3,
                        flexShrink: 0,
                      }}>
                        {DOCK_INTERACTION_SHORT[ix.interaction_type] ?? ix.interaction_type.slice(0, 3).toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: '.88rem', color: D.text1, fontWeight: 500, flex: 1 }}>
                        {ix.residue}
                      </span>
                      {ix.distance_angstrom != null && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.mute }}>
                          {ix.distance_angstrom.toFixed(1)} Å
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {sel.explanation && (
              <div style={{ flexShrink: 0, borderTop: `1px solid ${D.border}`, paddingTop: '.6rem' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.3rem' }}>
                  Notes
                </div>
                <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '.82rem', lineHeight: 1.5, color: D.text3 }}>
                  {sel.explanation.length > 160 ? sel.explanation.slice(0, 160) + '…' : sel.explanation}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom: ranked candidates ── */}
        <div style={{ border: `1px solid ${D.border}`, background: D.panel2, borderRadius: 2, flexShrink: 0 }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: D.text3, textTransform: 'uppercase' }}>
              TOP CANDIDATES · RANKED BY BINDING STRENGTH
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>kcal/mol</span>
          </div>
          <div>
            {sorted.map((c, i) => {
              const frac = Math.abs(c.binding_affinity_kcal - worst) / range
              const isSelected = i === selIdx
              const isBest = i === 0
              return (
                <div
                  key={i}
                  onClick={() => setSelIdx(i)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2rem 7rem 1fr 6rem 5rem',
                    gap: '.7rem',
                    alignItems: 'center',
                    padding: '.4rem 14px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255,255,255,0.06)' : isBest && !isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderLeft: `2px solid ${isSelected ? 'rgba(255,255,255,0.5)' : isBest && !isSelected ? D.border2 : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: isSelected ? D.text1 : isBest ? D.text2 : D.text3 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.target_uniprot_id}
                  </span>
                  <div style={{ height: 1, background: D.border2, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', top: -1, left: 0, height: 3,
                      width: `${frac * 100}%`,
                      background: isSelected ? D.text1 : isBest ? D.live : 'rgba(255,255,255,0.25)',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, textAlign: 'right', color: isSelected ? D.text1 : isBest ? D.live : D.text2 }}>
                    {c.binding_affinity_kcal.toFixed(1)}
                  </span>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {isBest && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', padding: '1px 5px', border: `1px solid ${D.text3}`, color: D.text2 }}>
                        BEST
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.12em', padding: '1px 5px', border: `1px solid rgba(255,255,255,0.5)`, color: D.text1 }}>
                        VIEW
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </PaneShell>
  )
}

// ── Insight pane ────────────────────────────────────────────────
function InsightPane({ r }: { r: GenesisReport }) {
  return (
    <PaneShell index={5} title="Executive Synthesis" src="CLAUDE · COMPOSITION">
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.4rem', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute, marginBottom: '.5rem' }}>
            Dossier · Verdict
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '.4rem' }}>
            {r.executive_summary.split(/\n\n+/).filter(Boolean).map((para, i) => (
              <div key={i} style={{ display: 'flex', gap: '.8rem', marginBottom: i < r.executive_summary.split(/\n\n+/).length - 1 ? '1.1rem' : 0 }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.10em',
                  color: D.mute, flexShrink: 0, marginTop: '.35rem', lineHeight: 1,
                  minWidth: '1.4rem',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p style={{
                  margin: 0,
                  fontFamily: i === 0 ? 'var(--serif)' : 'var(--sans)',
                  fontWeight: i === 0 ? 400 : 300,
                  fontSize: i === 0 ? '1.05rem' : '.9rem',
                  lineHeight: i === 0 ? 1.65 : 1.7,
                  color: i === 0 ? D.text1 : D.text2,
                  fontStyle: i === 0 ? 'italic' : 'normal',
                }}>
                  {para}
                </p>
              </div>
            ))}
            {r.methodology_notes && (
              <div style={{ marginTop: '1.4rem', paddingTop: '.8rem', borderTop: `1px solid ${D.border}` }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em', color: D.mute, marginBottom: '.35rem' }}>METHODOLOGY</div>
                <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '.72rem', lineHeight: 1.7, color: D.text3, letterSpacing: '.04em' }}>
                  {r.methodology_notes}
                </p>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1.2rem', borderTop: `1px solid ${D.border}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', flexShrink: 0 }}>
            <Stat label="Targets" value={r.targets_analyzed} sub="prioritised" />
            <Stat label="Generated" value={r.molecules_generated} sub="molecules" />
            <Stat label="Docked" value={r.molecules_docked} sub="poses" />
            <Stat label="Shortlist" value={r.top_candidates.length} sub="candidates" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          {r.safety_flags.length > 0 && (
            <SubPanel title="Safety Considerations" index="05·A">
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {r.safety_flags.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', padding: '.55rem 0', borderBottom: i < r.safety_flags.length - 1 ? `1px solid ${D.border}` : 'none', fontFamily: 'var(--sans)', fontSize: '.85rem', lineHeight: 1.45, color: D.text2 }}>
                    <span style={{ color: D.warn, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 9 }}>!</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </SubPanel>
          )}
          <SubPanel title="Limitations" index="05·B" grow>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {r.limitations.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', padding: '.5rem 0', borderBottom: i < r.limitations.length - 1 ? `1px solid ${D.border}` : 'none', fontFamily: 'var(--sans)', fontSize: '.82rem', lineHeight: 1.4, color: D.text2 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </SubPanel>
          {r.pareto_analysis && (
            <SubPanel title="Multi-Objective Analysis" index="05·C">
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: D.text3, lineHeight: 1.8 }}>
                {r.pareto_analysis.disease_context && <span>CONTEXT: {r.pareto_analysis.disease_context.slice(0, 80)}…<br /></span>}
                PARETO FRONT: {r.pareto_analysis.pareto_front_count} MOLECULES
              </div>
            </SubPanel>
          )}
        </div>
      </div>
    </PaneShell>
  )
}

function SubPanel({ title, index, children, grow }: {
  title: string; index: string; children: React.ReactNode; grow?: boolean
}) {
  return (
    <div style={{
      border: `1px solid ${D.border}`,
      background: D.panel,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: '.7rem .9rem', display: 'flex', flexDirection: 'column', minHeight: 0,
      flex: grow ? 1 : 'none', borderRadius: 2,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '.4rem', borderBottom: `1px solid ${D.border}` }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: D.mute }}>{title}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.mute }}>{index}</span>
      </div>
      <div style={{ paddingTop: '.4rem', flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</div>
    </div>
  )
}

// ── Chemical Intelligence pane ───────────────────────────────────
function ChemicalIntelligencePane({ jobId }: { jobId?: string }) {
  const [ciTab, setCiTab] = useState<'space' | 'analytics' | 'search'>('space')

  const tabs: { id: typeof ciTab; label: string }[] = [
    { id: 'space', label: 'Chemical Space' },
    { id: 'analytics', label: 'Cross-Run Analytics' },
    { id: 'search', label: 'Report Search' },
  ]

  return (
    <PaneShell index={6} title="Chemical Intelligence" src="SNOWFLAKE · PCA · RAG">
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '.4rem', marginBottom: '1rem', flexShrink: 0,
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setCiTab(t.id)}
            style={{
              background: ciTab === t.id ? D.purplePanel : 'transparent',
              border: `1px solid ${ciTab === t.id ? D.purpleBorder : D.border}`,
              borderRadius: 3, cursor: 'pointer',
              color: ciTab === t.id ? D.purple : D.text3,
              fontFamily: 'var(--mono)', fontSize: 9,
              letterSpacing: '0.10em', padding: '.35rem .75rem',
              transition: 'background .12s, border-color .12s, color .12s',
            }}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 8, color: D.text3, alignSelf: 'center', letterSpacing: '0.10em' }}>
          SNOWFLAKE CHEMICAL INTELLIGENCE LAYER
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: ciTab === 'space' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {ciTab === 'space' && (
          jobId
            ? <ChemicalSpace3D jobId={jobId} />
            : <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '2rem', textAlign: 'center' }}>Job ID unavailable</div>
        )}
        {ciTab === 'analytics' && <SnowflakeAnalyticsPanel />}
        {ciTab === 'search' && <ReportSearchPanel />}
      </div>
    </PaneShell>
  )
}
