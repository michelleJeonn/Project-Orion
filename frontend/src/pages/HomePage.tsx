import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, Workflow, LayoutDashboard, BarChart2, FolderOpen, Users,
  Settings, CircleHelp, Search, PanelLeft, type LucideIcon,
} from 'lucide-react'
import { isDemoMode } from '../demoConfig'
import { DEMO_JOB_ID, mockCryosisReport as mockGenesisReport } from '../mockData'
import { useJobStream } from '../hooks/useJobStream'
import { ReportView } from '../components/ReportView'
import { ReportChat } from '../components/ReportChat'
import { CryosisReport as GenesisReport, PipelineStage } from '../types'

const EXAMPLES = [
  "Parkinson's disease", "Alzheimer's disease",
  "Triple-negative breast cancer", "ALS", "Rheumatoid arthritis",
]

const NAV_MAIN: { label: string; active: boolean; icon: LucideIcon }[] = [
  { label: 'New Study', active: true, icon: FlaskConical },
  { label: 'Agent Pipeline', active: false, icon: Workflow },
  { label: 'Dashboard', active: false, icon: LayoutDashboard },
  { label: 'Analytics', active: false, icon: BarChart2 },
  { label: 'Projects', active: false, icon: FolderOpen },
  { label: 'Team', active: false, icon: Users },
]

const NAV_BOTTOM: { label: string; icon: LucideIcon }[] = [
  { label: 'Settings', icon: Settings },
  { label: 'Get Help', icon: CircleHelp },
  { label: 'Search', icon: Search },
]

const STAGE_KEYS: PipelineStage[] = [
  'disease_analysis', 'target_discovery', 'molecular_generation', 'docking', 'insight_synthesis',
]

const STAGES = [
  {
    key: 'disease_analysis', n: 'I', label: 'Disease Analysis', desc: 'Parsing query · surveying literature', src: 'CLAUDE · PUBMED',
    lines: ['Resolving ICD ontology · mapping synonyms', 'Fetching PubMed abstracts', 'Cross-referencing OMIM · DisGeNET']
  },
  {
    key: 'target_discovery', n: 'II', label: 'Target Discovery', desc: 'Finding druggable proteins', src: 'DISGENET · UNIPROT · RCSB',
    lines: ['Ranking candidate proteins by relevance', 'Scoring druggability · clinical relevance', 'Retrieving structural coordinates']
  },
  {
    key: 'molecular_generation', n: 'III', label: 'Molecule Generation', desc: 'Synthesising drug-like candidates', src: 'RDKIT · CHEMBL',
    lines: ['Seeding scaffolds · diversifying', 'Lipinski · PAINS · SA filters', 'Drug-like molecules emitted']
  },
  {
    key: 'docking', n: 'IV', label: 'Docking Simulation', desc: 'Predicting ligand binding', src: 'AUTODOCK VINA',
    lines: ['Preparing receptor grid', 'Scheduling docking runs', 'Aggregating ΔG · interaction maps']
  },
  {
    key: 'insight_synthesis', n: 'V', label: 'Insight Synthesis', desc: 'Composing the dossier', src: 'CLAUDE',
    lines: ['Weighting evidence · triangulating', 'Drafting mechanistic narrative', 'Assembling dossier · final pass']
  },
]

function stageProgress(stage: PipelineStage, progress: number, idx: number): number {
  if (stage === 'completed') return 1
  if (stage === 'failed') return 0
  const currentIdx = STAGE_KEYS.indexOf(stage)
  if (idx < currentIdx) return 1
  if (idx === currentIdx) return progress / 100
  return 0
}

export function HomePage() {
  const navigate = useNavigate()
  const [fadeIn, setFadeIn] = useState(false)

  useEffect(() => {
    setFadeIn(true)
  }, [])

  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [phase, setPhase] = useState<'idle' | 'running'>('idle')
  const [jobId, setJobId] = useState<string | null>(null)
  const [report, setReport] = useState<GenesisReport | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const t0 = useRef(performance.now())
  const [elapsed, setElapsed] = useState(0)

  // Page transition state
  const [reportMounted, setReportMounted] = useState(false)
  const [reportVisible, setReportVisible] = useState(false)
  const [mainFadingOut, setMainFadingOut] = useState(false)

  const { stage, progress, isComplete, isFailed } = useJobStream(jobId)

  const isRunning = phase === 'running'

  // Tick + elapsed timer while pipeline runs
  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => {
      setTick(t => t + 1)
      setElapsed((performance.now() - t0.current) / 1000)
    }, 80)
    return () => clearInterval(timer)
  }, [isRunning])

  // Fetch report when stream completes
  useEffect(() => {
    if (!isComplete || !jobId) return
    if (isDemoMode()) { setReport(mockGenesisReport); return }
    fetch(`/api/results/${jobId}`)
      .then(r => r.json())
      .then(data => { if (data.job_id) setReport(data as GenesisReport) })
      .catch(e => console.error('Failed to fetch results:', e))
  }, [isComplete, jobId])

  // Fade from main → report when both complete and report data arrive
  useEffect(() => {
    if (!isComplete || !report || reportMounted) return
    setMainFadingOut(true)
    const t = setTimeout(() => {
      setReportMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setReportVisible(true)))
    }, 350)
    return () => clearTimeout(t)
  }, [isComplete, report, reportMounted])

  const handleSubmit = async (val?: string) => {
    const disease = (val ?? query).trim()
    if (!disease || isRunning) return

    setSubmittedQuery(disease)
    setPhase('running')
    setJobId(null)
    setReport(null)
    setChatOpen(false)
    setTick(0)
    setElapsed(0)
    t0.current = performance.now()

    try {
      if (isDemoMode()) {
        setJobId(DEMO_JOB_ID)
        return
      }
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disease, max_targets: 3, max_molecules: 50 }),
      })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json()
      setJobId(data.job_id)
    } catch (err) {
      alert(`Failed to start pipeline: ${err}`)
      setPhase('idle')
    }
  }

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

  const handleReset = () => {
    if (reportMounted) {
      setReportVisible(false)
      setTimeout(() => {
        setReportMounted(false)
        setMainFadingOut(false)
        setPhase('idle')
        setJobId(null)
        setReport(null)
        setSubmittedQuery('')
        setElapsed(0)
        setTick(0)
      }, 350)
    } else {
      setPhase('idle')
      setJobId(null)
      setReport(null)
      setSubmittedQuery('')
      setElapsed(0)
      setTick(0)
    }
  }

  const stageProgs = STAGES.map((_, i) => stageProgress(stage, progress, i))
  const overall = isComplete ? 100 : Math.round(stageProgs.reduce((a, b) => a + b, 0) / STAGES.length * 100)

  const SIDEBAR_W = 244
  const sidebarTransition = 'all 0.45s cubic-bezier(0.4,0,0.2,1)'

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>

      {/* ── Main layout (idle + running) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: mainFadingOut ? 0 : 1,
        transition: 'opacity 0.35s ease-in-out',
        pointerEvents: reportMounted ? 'none' : 'auto',
      }}>

        {/* ── Sidebar ── */}
        <aside style={{
          position: 'fixed', left: 12, top: 12, bottom: 12, width: 220,
          zIndex: 10,
          display: 'flex', flexDirection: 'column',
          padding: '28px 0',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          background: 'rgba(8,8,8,0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          opacity: fadeIn ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
        }}>
          <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => navigate('/')} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.03em',
              color: 'rgba(255,255,255,0.90)',
            }}>Genesis</button>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>
              Drug Discovery
            </div>
          </div>

          <nav style={{ padding: '18px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
              {NAV_MAIN.map(item => (
                <div key={item.label} style={{
                  padding: '7px 12px', borderRadius: 6, marginBottom: 2,
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em',
                  cursor: 'pointer',
                  color: item.active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.38)',
                  background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}>
                  <item.icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: item.active ? 0.85 : 0.5 }} />
                  {item.label}
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 4px' }} />
            {NAV_BOTTOM.map(item => (
              <div key={item.label} style={{
                padding: '7px 12px', borderRadius: 6, marginBottom: 1,
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                cursor: 'pointer', color: 'rgba(255,255,255,0.28)',
                display: 'flex', alignItems: 'center', gap: 9,
              }}>
                <item.icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.45 }} />
                {item.label}
              </div>
            ))}
          </nav>

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>MJ</div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.04em' }}>Michelle Jeon</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Free plan</div>
            </div>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div style={{ marginLeft: 244, height: '100vh', position: 'relative' }}>
          <div style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.5s ease-in', height: '100%', width: '100%' }}>

            {/* ── Status bar — fades in when running ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 32px',
              opacity: isRunning ? 1 : 0,
              transform: isRunning ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 0.4s, transform 0.4s',
              pointerEvents: 'none',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>
                  Target condition
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.85)' }}>
                  {submittedQuery}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 3 }}>
                    Elapsed
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                    {String(Math.floor(elapsed)).padStart(2, '0')}.{String(Math.floor((elapsed * 100) % 100)).padStart(2, '0')}s
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 3 }}>
                    Overall
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: isFailed ? '#f66' : 'rgba(255,255,255,0.65)' }}>
                    {isFailed ? 'FAILED' : `${overall}%`}
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    pointerEvents: 'auto',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, color: 'rgba(255,255,255,0.45)',
                    padding: '6px 14px', fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >Abort</button>
              </div>
            </div>

            {/* ── Agent chat feed — appears when running ── */}
            <div style={{
              position: 'absolute', top: 88, bottom: 110, left: 0, right: 0,
              opacity: isRunning ? 1 : 0,
              transform: isRunning ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.4s, transform 0.4s',
              pointerEvents: isRunning ? 'auto' : 'none',
              overflowY: 'auto',
            }}>
              <AgentChatFeed stageProgs={stageProgs} tick={tick} />
            </div>

            {/* ── Global progress bar — above prompt when running ── */}
            <div style={{
              position: 'absolute', bottom: 100, left: 24, right: 24, height: 2,
              background: 'rgba(255,255,255,0.08)', borderRadius: 1,
              opacity: isRunning ? 1 : 0, transition: 'opacity 0.4s', pointerEvents: 'none',
            }}>
              <div style={{
                height: '100%', width: `${overall}%`,
                background: 'rgba(255,255,255,0.7)', boxShadow: '0 0 8px rgba(255,255,255,0.4)',
                borderRadius: 1, transition: 'width 0.3s linear',
              }} />
            </div>

            {/* ── Prompt block — slides from centre to bottom ── */}
            <div style={{
              position: 'absolute', left: '50%',
              top: isRunning ? 'calc(100% - 110px)' : '50%',
              transform: isRunning ? 'translate(-50%, 0)' : 'translate(-50%, -50%)',
              transition: 'top 0.75s cubic-bezier(0.4,0,0.2,1), transform 0.75s cubic-bezier(0.4,0,0.2,1)',
              width: '100%', maxWidth: 600, zIndex: 5,
            }}>
              {/* Title — fades out when running */}
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 32px)', left: 0, right: 0, textAlign: 'center',
                opacity: isRunning ? 0 : 1,
                transform: isRunning ? 'translateY(-16px)' : 'translateY(0)',
                transition: 'opacity 0.35s, transform 0.35s', pointerEvents: 'none',
              }}>
                <h1 style={{
                  margin: 0, fontFamily: 'var(--serif)', fontWeight: 400,
                  fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                  letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.88)', lineHeight: 1.1,
                }}>
                  Discover drug candidates in{' '}
                  <span style={{ color: '#E493CE' }}>minutes</span>
                </h1>
                <p style={{
                  margin: '12px 0 0', fontFamily: 'var(--mono)', fontSize: 11,
                  letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)',
                }}>Name a disease. Genesis runs the full pipeline.</p>
              </div>

              {/* Input box */}
              <div style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                padding: '6px 6px 6px 20px', display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
              }}>
                <form
                  onSubmit={e => { e.preventDefault(); handleSubmit() }}
                  style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 10 }}
                >
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={isRunning}
                    placeholder={isRunning ? 'Pipeline running…' : "Enter a disease (e.g. Leukemia, Alzheimer's, Parkinson's)"}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontFamily: 'var(--sans)', fontSize: 15,
                      color: 'rgba(255,255,255,0.85)', padding: '14px 0',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isRunning || !query.trim()}
                    style={{
                      flexShrink: 0, width: 36, height: 36, borderRadius: 9, border: 'none',
                      background: query.trim() && !isRunning ? '#E493CE' : 'rgba(255,255,255,0.13)',
                      color: query.trim() && !isRunning ? '#0a0a0a' : 'rgba(255,255,255,0.30)',
                      cursor: query.trim() && !isRunning ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    {isRunning
                      ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
                      : '↑'}
                  </button>
                </form>
              </div>

              {/* Examples + powered-by — fade out when running */}
              <div style={{ opacity: isRunning ? 0 : 1, transition: 'opacity 0.3s', pointerEvents: isRunning ? 'none' : 'auto' }}>
                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {EXAMPLES.map(ex => (
                    <button
                      key={ex}
                      onClick={() => handleSubmit(ex)}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 999, color: 'rgba(255,255,255,0.45)',
                        padding: '5px 14px', fontFamily: 'var(--sans)', fontSize: 12, cursor: 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'
                      }}
                    >{ex}</button>
                  ))}
                </div>

                <div className="max-w-3xl mx-auto mt-10 border-t border-white/10 pt-6">
                  <p className="text-center text-[10px] tracking-[0.28em] uppercase text-neutral-500 mb-4">
                    Powered By
                  </p>
                  <div className="flex flex-wrap justify-center items-center gap-6">
                    {[
                      { label: 'DisGeNET',      sub: 'Gene–Disease',  domain: 'disgenet.org' },
                      { label: 'UniProt',       sub: 'Protein DB',    domain: 'uniprot.org' },
                      { label: 'AlphaFold',     sub: 'Structure',     domain: 'alphafold.ebi.ac.uk' },
                      { label: 'AutoDock Vina', sub: 'Docking',       domain: 'vina.scripps.edu' },
                    ].map(({ label, sub, domain }) => (
                      <div key={label} className="flex items-center gap-2">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                          alt={label}
                          className="h-4 w-4 opacity-70 flex-shrink-0"
                          style={{ filter: 'brightness(0) invert(1)' }}
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-neutral-400 hover:text-[#D78BFF] transition-colors duration-200 leading-none">{label}</span>
                          <span className="text-[9px] tracking-widest uppercase text-neutral-600 leading-none">{sub}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Report layout — fades in over main ── */}
      {reportMounted && (
        <div style={{
          position: 'absolute', inset: 0,
          opacity: reportVisible ? 1 : 0,
          transition: 'opacity 0.35s ease-in-out',
        }}>
          {/* Sidebar — slides in from left */}
          <aside style={{
            position: 'fixed', left: 12, top: 12, bottom: 12, width: 220,
            zIndex: 20,
            display: 'flex', flexDirection: 'column',
            padding: '28px 0',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16,
            background: 'rgba(8,8,8,0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            transform: sidebarOpen ? 'translateX(0)' : `translateX(calc(-100% - 12px))`,
            transition: sidebarTransition,
          }}>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.28)', padding: 4, display: 'flex',
                borderRadius: 6, transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.70)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}
              title="Collapse sidebar"
            >
              <PanelLeft size={15} strokeWidth={1.5} />
            </button>

            <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => navigate('/')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.03em',
                color: 'rgba(255,255,255,0.90)',
              }}>Genesis</button>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>
                Drug Discovery
              </div>
            </div>
            <nav style={{ padding: '18px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1 }}>
                {NAV_MAIN.map(item => (
                  <div key={item.label} style={{
                    padding: '7px 12px', borderRadius: 6, marginBottom: 2,
                    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em',
                    cursor: 'pointer',
                    color: item.active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.38)',
                    background: item.active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 9,
                  }}>
                    <item.icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: item.active ? 0.85 : 0.5 }} />
                    {item.label}
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 4px' }} />
              {NAV_BOTTOM.map(item => (
                <div key={item.label} style={{
                  padding: '7px 12px', borderRadius: 6, marginBottom: 1,
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.28)',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}>
                  <item.icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.45 }} />
                  {item.label}
                </div>
              ))}
            </nav>
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>MJ</div>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.04em' }}>Michelle Jeon</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Free plan</div>
              </div>
            </div>
          </aside>

          {/* Expand tab */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: 'fixed', left: 0, top: 24, zIndex: 19,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28,
              background: 'rgba(18,18,22,0.80)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.09)', borderLeft: 'none',
              borderRadius: '0 8px 8px 0', color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
              opacity: sidebarOpen ? 0 : 1, pointerEvents: sidebarOpen ? 'none' : 'auto',
              transform: sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
              transition: sidebarTransition,
            }}
            title="Open sidebar"
          >
            <PanelLeft size={13} strokeWidth={1.5} />
          </button>

          {/* Report — shifts right when sidebar opens */}
          <div style={{
            marginLeft: sidebarOpen ? SIDEBAR_W : 0,
            height: '100vh', position: 'relative', overflow: 'hidden',
            transition: sidebarTransition,
          }}>
            <ReportView
              report={report!}
              onBack={handleReset}
              onDownload={handleDownload}
              jobId={jobId!}
            />
          </div>

          {/* AI Consultant button */}
          <button
            onClick={() => setChatOpen(true)}
            style={{
              position: 'fixed', bottom: 28, right: 28, zIndex: 40,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '.65rem 1.4rem',
              background: 'rgba(8,8,10,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.50)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: '0.56rem', letterSpacing: '0.22em',
              textTransform: 'uppercase', transition: 'opacity .3s',
              opacity: chatOpen ? 0 : 1, pointerEvents: chatOpen ? 'none' : 'auto',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', display: 'block' }} />
            AI CONSULTANT
          </button>

          <div
            onClick={() => setChatOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
              opacity: chatOpen ? 1 : 0, pointerEvents: chatOpen ? 'auto' : 'none',
              transition: 'opacity .3s',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 60, width: 400,
            transform: chatOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <ReportChat jobId={jobId!} report={report!} onClose={() => setChatOpen(false)} />
          </div>
        </div>
      )}

    </div>
  )
}

// ── AgentChatFeed ─────────────────────────────────────────────────────────────

function AgentChatFeed({ stageProgs, tick }: { stageProgs: number[]; tick: number }) {
  return (
    <div style={{
      maxWidth: 660, margin: '0 auto', padding: '8px 24px 24px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {STAGES.map((s, i) => {
        const p = stageProgs[i]
        if (p === 0) return null
        const done = p >= 1
        const active = p > 0 && p < 1
        const lineIdx = Math.min(s.lines.length - 1, Math.floor(p * s.lines.length))

        return (
          <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/* Avatar */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.45)',
            }}>G</div>

            {/* Bubble */}
            <div style={{
              flex: 1, background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, padding: '14px 18px',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Genesis AI</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em', color: done ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {done
                    ? <><span style={{ fontSize: 8 }}>✓</span> complete</>
                    : <><span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', boxShadow: '0 0 6px rgba(255,255,255,0.5)', animation: 'pulse 1.2s ease-in-out infinite' }} /> running</>
                  }
                </span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginRight: 8 }}>{s.n}</span>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'rgba(255,255,255,0.85)', fontStyle: active ? 'italic' : 'normal' }}>{s.label}</span>
              </div>

              <div style={{ marginBottom: 10 }}>
                {s.lines.slice(0, lineIdx + 1).map((line, j) => (
                  <div key={j} style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em', lineHeight: 1.7, color: j < lineIdx ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.65)', animation: 'fadeInLine 0.45s ease-out both' }}>
                    <span style={{ color: 'rgba(255,255,255,0.20)', marginRight: 6 }}>▸</span>
                    {line}
                    {j === lineIdx && active && (
                      <span style={{ opacity: tick % 4 < 2 ? 1 : 0, marginLeft: 2, transition: 'opacity 0.15s' }}>█</span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                {s.src.split(' · ').map(src => (
                  <span key={src} style={{
                    fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4, padding: '2px 7px',
                  }}>{src}</span>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
