import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJobStream } from '../hooks/useJobStream'
import { ReportView } from '../components/ReportView'
import { ReportChat } from '../components/ReportChat'
import { CryosisReport, PipelineStage } from '../types'
import { isDemoMode } from '../demoConfig'
import { mockCryosisReport } from '../mockData'

const STAGE_KEYS: PipelineStage[] = [
  'disease_analysis', 'target_discovery', 'molecular_generation', 'docking', 'insight_synthesis',
]

const STAGES = [
  { key: 'disease_analysis',     n: 'I',   label: 'Disease Analysis',    desc: 'Parsing query · surveying literature', src: 'CLAUDE · PUBMED',
    lines: ['Resolving ICD ontology · mapping synonyms', 'Fetching PubMed abstracts', 'Cross-referencing OMIM · DisGeNET'] },
  { key: 'target_discovery',     n: 'II',  label: 'Target Discovery',    desc: 'Finding druggable proteins',           src: 'DISGENET · UNIPROT · RCSB',
    lines: ['Ranking candidate proteins by relevance', 'Scoring druggability · clinical relevance', 'Retrieving structural coordinates'] },
  { key: 'molecular_generation', n: 'III', label: 'Molecule Generation', desc: 'Synthesising drug-like candidates',    src: 'RDKIT · CHEMBL',
    lines: ['Seeding scaffolds · diversifying', 'Lipinski · PAINS · SA filters', 'Drug-like molecules emitted'] },
  { key: 'docking',              n: 'IV',  label: 'Docking Simulation',  desc: 'Predicting ligand binding',            src: 'AUTODOCK VINA',
    lines: ['Preparing receptor grid', 'Scheduling docking runs', 'Aggregating ΔG · interaction maps'] },
  { key: 'insight_synthesis',    n: 'V',   label: 'Insight Synthesis',   desc: 'Composing the dossier',               src: 'CLAUDE',
    lines: ['Weighting evidence · triangulating', 'Drafting mechanistic narrative', 'Assembling dossier · final pass'] },
]

function stageProgress(stage: PipelineStage, progress: number, idx: number): number {
  if (stage === 'completed') return 1
  if (stage === 'failed') return 0
  const currentIdx = STAGE_KEYS.indexOf(stage)
  if (idx < currentIdx) return 1
  if (idx === currentIdx) return progress / 100
  return 0
}

export function JobPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { stage, progress, message, error, isComplete, isFailed } = useJobStream(jobId ?? null)
  const [report, setReport] = useState<CryosisReport | null>(null)
  const [diseaseQuery, setDiseaseQuery] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const t0 = useRef(performance.now())
  const [elapsed, setElapsed] = useState(0)
  const [plate] = useState(() => String(100 + Math.floor(Math.random() * 900)))

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1)
      setElapsed((performance.now() - t0.current) / 1000)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isComplete || !jobId) return
    if (isDemoMode()) {
      setReport(mockCryosisReport)
      return
    }
    fetch(`/api/results/${jobId}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) {
          throw new Error(data?.detail || `Failed to fetch results (${r.status})`)
        }
        return data
      })
      .then(data => setReport(data as CryosisReport))
      .catch(e => console.error('Failed to fetch results:', e))
  }, [isComplete, jobId])

  useEffect(() => {
    if (!jobId) return
    if (isDemoMode()) {
      setDiseaseQuery(mockCryosisReport.disease_query)
      return
    }
    fetch(`/api/jobs/${jobId}`)
      .then(r => r.json())
      .then(data => setDiseaseQuery(data.disease_query || ''))
      .catch(() => {})
  }, [jobId])

  const handleDownload = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `genesis-report-${jobId?.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stageProgs = STAGES.map((_, i) => stageProgress(stage, progress, i))
  const overall = isComplete ? 100 : Math.round(stageProgs.reduce((a, b) => a + b, 0) / STAGES.length * 100)
  const showReport = isComplete && !!report

  if (showReport) {
    return (
      <>
        <ReportView
          report={report!}
          onBack={() => navigate('/home')}
          onDownload={handleDownload}
          jobId={jobId!}
        />

        {/* Floating AI Assistant button */}
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '.65rem 1.4rem',
            background: 'rgba(8,8,10,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,91,42,0.5)',
            boxShadow: '0 0 16px rgba(255,91,42,0.18)',
            color: 'var(--ink-1)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: '0.56rem', letterSpacing: '0.22em',
            textTransform: 'uppercase',
            transition: 'opacity .3s',
            opacity: chatOpen ? 0 : 1,
            pointerEvents: chatOpen ? 'none' : 'auto',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'block', boxShadow: '0 0 6px var(--accent)' }}/>
          AI CONSULTANT
        </button>

        {/* Chat backdrop */}
        <div
          onClick={() => setChatOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
            opacity: chatOpen ? 1 : 0,
            pointerEvents: chatOpen ? 'auto' : 'none',
            transition: 'opacity .3s',
          }}
        />

        {/* Chat sliding panel */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60,
          width: 400,
          transform: chatOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ReportChat jobId={jobId!} report={report!} onClose={() => setChatOpen(false)} />
        </div>
      </>
    )
  }

  return (
    <div className="dark-zone" style={{
      position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden',
      padding: 'clamp(1rem, 2.2vh, 1.8rem) clamp(2rem, 3.5vw, 3rem)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div className="hud-dots"/>
      <div className="accent-spine"/>
      <div className="accent-label">GENESIS · RUNTIME</div>

      {/* Header */}
      <header style={{
        position: 'relative',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: '2rem',
        paddingBottom: '1rem', borderBottom: '1px solid var(--hair)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.6rem' }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--ink-2)', fontFamily: 'var(--mono)',
              fontSize: '.60rem', letterSpacing: '.30em', textTransform: 'uppercase', padding: 0,
            }}
          >
            ◀ ABORT · NEW INQUIRY
          </button>
          <span className="hud-micro">PLATE {plate}</span>
          <span className="hud-micro" style={{ color: 'var(--ink-2)' }}>
            T+{String(Math.floor(elapsed)).padStart(2,'0')}.{String(Math.floor((elapsed*100)%100)).padStart(2,'0')}s
          </span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p className="hud-micro" style={{ margin: 0 }}>INQUIRY · 01 OF 01</p>
          <p style={{
            margin: '.2rem 0 0', fontFamily: 'var(--serif)',
            fontStyle: 'italic', fontSize: '1.15rem',
            color: 'var(--ink-1)', letterSpacing: '.01em',
          }}>
            {diseaseQuery || '…'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.2rem' }}>
          {isFailed
            ? <span className="hud-micro" style={{ color: '#f44' }}>● FAILED</span>
            : <span className="hud-micro" style={{ color: 'var(--accent)' }}>● RUNNING</span>
          }
          <span className="hud-num">{String(overall).padStart(3,'0')}.00%</span>
        </div>
      </header>

      {/* Headline */}
      <div style={{
        position: 'relative',
        margin: 'clamp(.8rem, 1.8vh, 1.5rem) 0 clamp(.8rem, 2vh, 1.6rem)',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '2rem',
        flexShrink: 0,
      }}>
        <div>
          <p className="hud-label" style={{ margin: 0 }}>THE APPARATUS · FIVE AGENTS IN DELIBERATION</p>
          <h2 style={{
            margin: '.35rem 0 0', fontFamily: 'var(--serif)', fontWeight: 300,
            fontStyle: 'italic', fontSize: 'clamp(1.4rem, 2.6vw, 2rem)',
            color: 'var(--ink-1)', letterSpacing: '.01em',
          }}>
            Pipeline · {diseaseQuery || '…'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'baseline' }}>
          <Readout label="AGENTS" value="05"/>
          <Readout label="SOURCES" value="09"/>
          {message && <Readout label="STATUS" value={message.slice(0, 20)}/>}
        </div>
      </div>

      {/* Error banner */}
      {isFailed && error && (
        <div style={{
          padding: '.75rem 1rem', marginBottom: '1rem', flexShrink: 0,
          border: '1px solid rgba(255,60,60,0.3)', background: 'rgba(255,0,0,0.07)',
          fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'rgba(255,100,100,0.9)',
          letterSpacing: '0.14em',
        }}>
          ● PIPELINE FAULT: {error}
        </div>
      )}

      {/* 5 agent panels */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
        gap: 'clamp(.6rem, 1vw, 1rem)',
      }}>
        {STAGES.map((s, i) => (
          <AgentPanel
            key={s.key}
            stage={s}
            index={i}
            p={stageProgs[i]}
            plate={plate}
            tick={tick}
          />
        ))}
      </div>

      {/* Footer */}
      <footer style={{
        position: 'relative', marginTop: 'clamp(.8rem, 1.8vh, 1.4rem)',
        paddingTop: '.7rem', borderTop: '1px solid var(--hair)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem',
        flexShrink: 0,
      }}>
        <span className="hud-micro">GENESIS · AUTONOMOUS DRUG DISCOVERY</span>
        <GlobalProgress overall={overall}/>
        <span className="hud-micro">MMXXVI · IN-SILICO</span>
      </footer>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="hud-micro">{label}</div>
      <div className="hud-num" style={{ color: 'var(--ink-1)', fontSize: '.85rem', marginTop: '.1rem' }}>{value}</div>
    </div>
  )
}

function GlobalProgress({ overall }: { overall: number }) {
  return (
    <div style={{ flex: 1, maxWidth: 520, display: 'flex', alignItems: 'center', gap: '.8rem' }}>
      <span className="hud-micro">GLOBAL</span>
      <div style={{ flex: 1, position: 'relative', height: 1, background: 'var(--hair)' }}>
        <div style={{
          position: 'absolute', left: 0, top: -1, height: 3,
          width: `${overall}%`, background: 'rgba(255,255,255,.95)',
          boxShadow: '0 0 8px rgba(255,255,255,0.35)',
          transition: 'width .15s linear',
        }}/>
      </div>
      <span className="hud-num" style={{ color: 'var(--ink-1)' }}>{String(overall).padStart(3,'0')}.00</span>
    </div>
  )
}

function AgentPanel({ stage, index, p, plate, tick }: {
  stage: typeof STAGES[0]
  index: number
  p: number
  plate: string
  tick: number
}) {
  const status = p >= 1 ? 'complete' : p > 0 ? 'running' : 'queued'
  const pct = p * 100
  const active = status === 'running'
  const done = status === 'complete'
  const lineIdx = Math.min(stage.lines.length - 1, Math.floor(p * stage.lines.length))

  return (
    <article style={{
      position: 'relative',
      border: '1px solid var(--hair)',
      background: 'rgba(8,8,10,0.55)',
      padding: '.9rem .9rem .7rem',
      display: 'flex', flexDirection: 'column',
      minHeight: 0, minWidth: 0, overflow: 'hidden',
      opacity: status === 'queued' ? 0.55 : 1,
      transition: 'opacity .5s',
    }}>
      <span className="corner tl"/><span className="corner tr"/>
      <span className="corner bl"/><span className="corner br"/>

      {/* Panel header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: '.55rem', borderBottom: '1px solid var(--hair)',
      }}>
        <span className="hud-label">► PANEL {plate}·{String(index+1).padStart(2,'00')}</span>
        <span className="hud-micro" style={{
          color: done ? 'var(--ink-1)' : active ? 'var(--accent)' : 'var(--ink-3)',
        }}>
          {done ? '■ DONE' : active ? '● RUN' : '□ WAIT'}
        </span>
      </div>

      {/* Stage title */}
      <div style={{ padding: '.9rem 0 .4rem', display: 'flex', alignItems: 'baseline', gap: '.6rem' }}>
        <span className="mono" style={{
          fontSize: '.82rem', letterSpacing: '.22em',
          color: active ? 'var(--accent)' : done ? 'var(--ink-1)' : 'var(--ink-3)',
        }}>{stage.n}</span>
        <span style={{
          fontFamily: 'var(--serif)', fontStyle: active ? 'italic' : 'normal',
          fontSize: '1.02rem', color: 'var(--ink-1)', lineHeight: 1.2,
        }}>{stage.label}</span>
      </div>

      <p className="hud-micro" style={{ margin: 0, color: 'var(--ink-2)', letterSpacing: '.14em' }}>{stage.src}</p>

      {/* Mini visualization */}
      <div style={{
        position: 'relative', marginTop: '.9rem',
        height: 'clamp(80px, 14vh, 140px)',
        border: '1px solid var(--hair)',
        background: 'rgba(0,0,0,0.35)',
        overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{ position: 'absolute', top: 5, left: 7 }} className="hud-micro">
          FIG {String(index+1).padStart(2,'0')}·{String(Math.floor(pct)).padStart(3,'0')}
        </div>
        <MiniViz stageKey={stage.key} p={p} tick={tick}/>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: '.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.25rem' }}>
          <span className="hud-label">PROGRESS</span>
          <span className="hud-num" style={{ color: 'var(--ink-1)' }}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{ position: 'relative', height: 1, background: 'var(--hair)' }}>
          <div style={{
            position: 'absolute', left: 0, top: -1, height: 3,
            width: `${pct}%`,
            background: active ? 'rgba(255,255,255,.95)' : done ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.30)',
            boxShadow: active ? '0 0 8px rgba(255,255,255,0.35)' : 'none',
            transition: 'width .2s linear',
          }}/>
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: '.35rem' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <i key={i} style={{
              flex: 1, height: 4, display: 'block',
              background: i < Math.round(p * 16)
                ? (active ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)')
                : 'rgba(255,255,255,.08)',
            }}/>
          ))}
        </div>
      </div>

      {/* Live log line */}
      <div style={{ marginTop: '.7rem', paddingTop: '.55rem', borderTop: '1px solid var(--hair)', minHeight: '2.4em' }}>
        {stage.lines.slice(0, lineIdx + 1).map((line, j) => (
          <div key={j} className="mono" style={{
            fontSize: '.56rem', letterSpacing: '.06em',
            color: j === lineIdx ? 'var(--ink-2)' : 'var(--ink-3)',
            lineHeight: 1.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <span style={{ color: j === lineIdx && active ? 'var(--accent)' : 'var(--ink-3)' }}>
              {j < lineIdx ? '▸ ' : (tick % 2 ? '▸ ' : '▹ ')}
            </span>
            {line}
          </div>
        ))}
      </div>
    </article>
  )
}

function MiniViz({ stageKey, p, tick }: { stageKey: string; p: number; tick: number }) {
  if (stageKey === 'disease_analysis') {
    const rows = 9
    return (
      <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: rows }).map((_, i) => {
          const y = 8 + i * 9
          const w = 40 + ((i * 37 + tick * 2) % 120)
          const revealed = i < Math.ceil(p * rows)
          return (
            <g key={i} opacity={revealed ? 0.4 + ((i*13)%40)/100 : 0.08}>
              <text x={4} y={y+3} fontFamily="monospace" fontSize="4" fill="rgba(255,255,255,.45)">{String(i+1).padStart(3,'0')}</text>
              <rect x={22} y={y} width={w} height={2.5} fill="rgba(255,255,255,.7)"/>
            </g>
          )
        })}
      </svg>
    )
  }
  if (stageKey === 'target_discovery') {
    const proteins = [{ y: 22, label: 'TARGET A', amp: 0.85 }, { y: 48, label: 'TARGET B', amp: 0.70 }, { y: 74, label: 'TARGET C', amp: 0.55 }]
    return (
      <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {proteins.map((pr, i) => {
          const reveal = Math.max(0, Math.min(1, p * 3 - i))
          let d = `M 16 ${pr.y}`
          for (let k = 0; k <= 32; k++) {
            const t = k/32
            const xx = 16 + t * 170
            const yy = pr.y + Math.sin(t*Math.PI*3)*8*pr.amp + Math.sin(t*Math.PI*7)*2.5*pr.amp
            d += ` L ${xx.toFixed(1)} ${yy.toFixed(1)}`
          }
          return (
            <g key={i} opacity={reveal}>
              <text x={4} y={pr.y-4} fontFamily="monospace" fontSize="4" fill="rgba(255,255,255,.7)">{pr.label}</text>
              <path d={d} stroke="rgba(255,255,255,.85)" strokeWidth="1.1" fill="none"/>
            </g>
          )
        })}
      </svg>
    )
  }
  if (stageKey === 'molecular_generation') {
    const N = 80; const reveal = Math.floor(p * N)
    const dots = Array.from({ length: N }, (_, i) => ({
      x: (Math.sin(i*97.3)*0.5+0.5)*186+7,
      y: (Math.cos(i*97.3*1.7)*0.5+0.5)*78+6,
    }))
    return (
      <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <line x1="12" y1="80" x2="192" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4"/>
        <line x1="12" y1="8"  x2="12"  y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4"/>
        {dots.map((d, i) => i < reveal
          ? <circle key={i} cx={d.x} cy={d.y} r={i%17===0?1.4:0.7} fill={i%17===0?'rgba(255,255,255,.9)':'rgba(255,255,255,.45)'}/>
          : null)}
        <text x={14} y={14} fontFamily="monospace" fontSize="4" fill="rgba(255,255,255,.45)">n = {reveal}</text>
      </svg>
    )
  }
  if (stageKey === 'docking') {
    const N = 50; const reveal = Math.floor(p * N)
    return (
      <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: N }).map((_, i) => {
          if (i >= reveal) return null
          const u = i/N; const x = 10 + u*180; const ph = u*Math.PI*4
          const yA = 45 + Math.sin(ph)*20; const yB = 45 + Math.sin(ph+Math.PI)*20
          const zA = Math.cos(ph); const zB = Math.cos(ph+Math.PI)
          return (
            <g key={i}>
              <circle cx={x} cy={yA} r={1+Math.abs(zA)*0.6} fill="rgba(255,255,255,.9)" opacity={0.3+Math.abs(zA)*0.5}/>
              <circle cx={x} cy={yB} r={1+Math.abs(zB)*0.6} fill="rgba(255,255,255,.9)" opacity={0.3+Math.abs(zB)*0.5}/>
              {i%3===0&&<line x1={x} y1={yA} x2={x} y2={yB} stroke="rgba(255,255,255,.18)" strokeWidth="0.4"/>}
            </g>
          )
        })}
        <text x={10} y={12} fontFamily="monospace" fontSize="4" fill="rgba(255,255,255,.45)">ΔG → {(-4 - p*5.8).toFixed(1)}</text>
      </svg>
    )
  }
  if (stageKey === 'insight_synthesis') {
    return (
      <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        {[0,1,2,3].map(i => {
          const r = 8 + i * 10
          const op = Math.max(0, Math.min(1, p*3 - i*0.5))
          return <circle key={i} cx={100} cy={45} r={r} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="0.5" strokeDasharray={`${2+i} ${3+i}`} opacity={op}/>
        })}
        <line x1={100} y1={15} x2={100} y2={75} stroke="rgba(255,255,255,.3)" strokeWidth="0.4"/>
        <line x1={70} y1={45} x2={130} y2={45} stroke="rgba(255,255,255,.3)" strokeWidth="0.4"/>
        <circle cx={100} cy={45} r={2} fill="rgba(255,91,42,.95)" opacity={p}/>
      </svg>
    )
  }
  return null
}
