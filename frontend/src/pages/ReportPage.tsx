import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GenesisReport, DockingResult } from '../types'
import { MoleculeViewer3D } from '../components/MoleculeViewer3D'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v?: number | null, d = 1) {
  return v == null ? 'N/A' : v.toFixed(d)
}

// ── Pane components ───────────────────────────────────────────────────────────

function PaneDisease({ report }: { report: GenesisReport }) {
  return (
    <div style={paneStyle}>
      <Label>01 · Disease</Label>
      <Title>{report.disease_name}</Title>
      <Divider />
      <Body>{report.disease_description}</Body>

      <div style={{ display: 'flex', gap: '3rem', marginTop: '3rem', flexWrap: 'wrap' }}>
        <Stat label="Targets analyzed"   value={String(report.targets_analyzed)} />
        <Stat label="Molecules generated" value={String(report.molecules_generated)} />
        <Stat label="Molecules docked"    value={String(report.molecules_docked)} />
        {report.pipeline_duration_seconds && (
          <Stat label="Pipeline time" value={`${Math.round(report.pipeline_duration_seconds)}s`} />
        )}
      </div>
    </div>
  )
}

function PaneTargets({ report }: { report: GenesisReport }) {
  const [sel, setSel] = useState(0)
  const ti = report.target_insights[sel]

  return (
    <div style={paneStyle}>
      <Label>02 · Targets</Label>
      <Title>{report.target_insights.length} Therapeutic Targets Identified</Title>
      <Divider />

      {/* Target selector tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {report.target_insights.map((t, i) => (
          <button
            key={i}
            onClick={() => setSel(i)}
            style={{
              background: 'transparent',
              border: '1px solid',
              borderColor: i === sel ? 'rgba(255,255,255,0.35)' : 'var(--hair)',
              color: i === sel ? 'var(--ink-1)' : 'var(--ink-3)',
              fontFamily: 'var(--serif)', fontWeight: 300,
              fontSize: '0.60rem', letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '0.3rem 0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t.target_gene}
          </button>
        ))}
      </div>

      {ti && (
        <div>
          <FieldGroup label="Mechanism of action" text={ti.mechanism_of_action} />
          <FieldGroup label="Pathway relevance"   text={ti.pathway_relevance} />
          <FieldGroup label="Clinical context"    text={ti.clinical_context} />
          {ti.top_molecules.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <FieldLabel>Top molecule</FieldLabel>
              <code style={{
                display: 'block', marginTop: '0.3rem',
                fontFamily: 'var(--mono)', fontSize: '0.62rem',
                color: 'var(--ink-2)', letterSpacing: '0.06em',
                wordBreak: 'break-all',
              }}>
                {ti.top_molecules[0].molecule.smiles}
              </code>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '0.56rem', color: 'var(--ink-3)', marginTop: '0.3rem' }}>
                ΔG = {fmt(ti.top_molecules[0].binding_affinity_kcal)} kcal/mol
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PaneMolecules({ report }: { report: GenesisReport }) {
  const top = report.top_candidates.slice(0, 8)
  return (
    <div style={paneStyle}>
      <Label>03 · Molecules</Label>
      <Title>{report.molecules_generated} Candidates Generated</Title>
      <Divider />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {top.map((c, i) => <MolRow key={i} c={c} rank={i + 1} />)}
      </div>
    </div>
  )
}

function MolRow({ c, rank }: { c: DockingResult; rank: number }) {
  const a = c.molecule.admet
  return (
    <div style={{
      border: '1px solid var(--hair)', padding: '0.8rem 1rem',
      display: 'grid', gridTemplateColumns: '1.4rem 1fr auto', gap: '0.8rem',
      alignItems: 'start',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--ink-3)', marginTop: '0.1rem' }}>
        {String(rank).padStart(2, '0')}
      </span>
      <div>
        <code style={{
          fontFamily: 'var(--mono)', fontSize: '0.60rem',
          color: 'var(--ink-2)', wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {c.molecule.smiles.length > 60 ? c.molecule.smiles.slice(0, 60) + '…' : c.molecule.smiles}
        </code>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          <Chip label="MW"   value={`${fmt(a.mw, 0)} Da`} />
          <Chip label="LogP" value={fmt(a.log_p)} />
          <Chip label="QED"  value={fmt(a.qed_score, 2)} />
          <Chip label="SA"   value={fmt(a.synthetic_accessibility)} />
          {a.lipinski_pass && <Chip label="Lipinski" value="✓" ok />}
          {a.has_pains      && <Chip label="PAINS"   value="!" warn />}
        </div>
      </div>
      <div style={{ textAlign: 'right', minWidth: '5rem' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--accent)' }}>
          {fmt(c.binding_affinity_kcal)} kcal/mol
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.52rem', color: 'var(--ink-3)', marginTop: '0.2rem' }}>
          {c.target_uniprot_id}
        </div>
      </div>
    </div>
  )
}

const INTERACTION_COLORS: Record<string, string> = {
  'H-bond':      'rgba(100,160,255,0.85)',
  'Hydrophobic': 'rgba(255,180,60,0.85)',
  'Pi-stacking': 'rgba(200,100,255,0.85)',
  'Ionic':       'rgba(80,220,140,0.85)',
}

const INTERACTION_SHORT: Record<string, string> = {
  'H-bond':      'HBD',
  'Hydrophobic': 'HYD',
  'Pi-stacking': 'π–π',
  'Ionic':       'ION',
}

function PaneDocking({ report }: { report: GenesisReport }) {
  const sorted = [...report.top_candidates].sort(
    (a, b) => a.binding_affinity_kcal - b.binding_affinity_kcal
  ).slice(0, 8)

  const [selIdx, setSelIdx] = useState(0)
  const sel      = sorted[selIdx]
  const canView  = !!(sel?.pose_file && sel?.protein_structure_file)
  const affinity = sel?.binding_affinity_kcal ?? 0

  const strengthLabel =
    affinity <= -10 ? 'Excellent' :
    affinity <= -8  ? 'Strong'    :
    affinity <= -6  ? 'Moderate'  : 'Weak'
  const strengthColor =
    affinity <= -8 ? 'var(--accent)' :
    affinity <= -6 ? 'rgba(255,200,80,0.85)' : 'rgba(180,180,180,0.6)'
  const strengthFrac = Math.min(1, Math.abs(affinity) / 12)

  const best  = sorted[0]?.binding_affinity_kcal ?? 0
  const worst = sorted[sorted.length - 1]?.binding_affinity_kcal ?? 0
  const range = Math.abs(best - worst) || 1

  return (
    <div style={{ ...paneStyle, maxWidth: '860px' }}>
      <Label>04 · Docking</Label>
      <Title>Protein–Ligand Docking</Title>
      <Divider />

      {/* ── Two-column: 3D viewer | right info panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>

        {/* Left: 3D viewer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
            <FieldLabel>Protein–Ligand Complex</FieldLabel>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.46rem', letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              {sel?.docking_method ?? ''} · {sel?.protein_structure_file ?? ''}
            </span>
          </div>
          {canView ? (
            <MoleculeViewer3D
              proteinFile={sel.protein_structure_file!}
              poseFile={sel.pose_file!}
              interactions={sel.interactions}
              height={440}
            />
          ) : (
            <div style={{
              height: 440, border: '1px solid var(--hair)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.52rem', color: 'var(--ink-3)', letterSpacing: '0.12em' }}>
                NO POSE FILE · MOCK RESULT
              </span>
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem' }}>

          {/* Binding strength */}
          <div>
            <FieldLabel>Binding Strength</FieldLabel>
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontFamily: 'var(--mono)', letterSpacing: '0.02em', lineHeight: 1 }}>
                <span style={{ fontSize: '2rem', color: strengthColor }}>
                  {fmt(affinity, 1)}
                </span>
                <span style={{ fontSize: '0.55rem', color: 'var(--ink-3)', marginLeft: '0.35rem' }}>
                  kcal/mol
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--hair)', margin: '0.65rem 0 0.4rem', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${strengthFrac * 100}%`,
                  background: strengthColor,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: '0.50rem',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: strengthColor,
                }}>
                  {strengthLabel}
                </span>
                {sel?.rmsd_lb != null && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.44rem', color: 'var(--ink-3)' }}>
                    RMSD {fmt(sel.rmsd_lb, 2)}–{fmt(sel.rmsd_ub, 2)} Å
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Why it binds */}
          {sel?.interactions?.length > 0 && (
            <div>
              <FieldLabel>Why It Binds</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                {sel.interactions.slice(0, 7).map((ix, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0',
                    borderBottom: '1px solid var(--hair)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: '0.44rem',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '0.1rem 0.38rem',
                      border: `1px solid ${INTERACTION_COLORS[ix.interaction_type] ?? 'var(--hair)'}`,
                      color: INTERACTION_COLORS[ix.interaction_type] ?? 'var(--ink-3)',
                      flexShrink: 0,
                    }}>
                      {INTERACTION_SHORT[ix.interaction_type] ?? ix.interaction_type.slice(0, 3).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.56rem', color: 'var(--ink-1)' }}>
                        {ix.residue}
                      </span>
                      {ix.distance_angstrom != null && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.46rem', color: 'var(--ink-3)', marginLeft: '0.3rem' }}>
                          {fmt(ix.distance_angstrom, 1)} Å
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brief AI note */}
          {sel?.explanation && (
            <div>
              <FieldLabel>Notes</FieldLabel>
              <p style={{
                fontFamily: 'var(--serif)', fontWeight: 300,
                fontSize: '0.65rem', lineHeight: 1.7,
                color: 'var(--ink-3)', margin: 0,
              }}>
                {sel.explanation.length > 200
                  ? sel.explanation.slice(0, 200) + '…'
                  : sel.explanation}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: ranked candidates ── */}
      <div>
        <FieldLabel>Top Candidates · Ranked by Binding Strength</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.6rem' }}>
          {sorted.map((c, i) => {
            const frac       = Math.abs(c.binding_affinity_kcal - worst) / range
            const isSelected = i === selIdx
            const isBest     = i === 0

            return (
              <div
                key={i}
                onClick={() => setSelIdx(i)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.8rem 6rem 1fr 7rem 5rem',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.5rem 0.7rem',
                  cursor: 'pointer',
                  border: `1px solid ${
                    isSelected          ? 'rgba(255,91,42,0.5)'     :
                    isBest              ? 'rgba(255,255,255,0.12)'   :
                                          'var(--hair)'
                  }`,
                  background: isSelected
                    ? 'rgba(255,91,42,0.07)'
                    : isBest && !isSelected
                    ? 'rgba(255,255,255,0.025)'
                    : 'transparent',
                  transition: 'all 0.18s',
                }}
              >
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: '0.52rem',
                  color: isSelected ? 'var(--accent)' : isBest ? 'rgba(255,255,255,0.65)' : 'var(--ink-3)',
                }}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                <span style={{
                  fontFamily: 'var(--mono)', fontSize: '0.52rem', color: 'var(--ink-3)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.target_uniprot_id}
                </span>

                <div style={{ height: '1px', background: 'var(--hair)', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: '-1px', left: 0, height: '3px',
                    width: `${frac * 100}%`,
                    background: isSelected
                      ? 'var(--accent)'
                      : isBest
                      ? 'rgba(255,255,255,0.7)'
                      : 'rgba(255,255,255,0.22)',
                    transition: 'width 0.5s',
                  }} />
                </div>

                <span style={{
                  fontFamily: 'var(--mono)', fontSize: '0.58rem', textAlign: 'right',
                  color: isSelected ? 'var(--accent)' : isBest ? 'var(--ink-1)' : 'var(--ink-2)',
                }}>
                  {fmt(c.binding_affinity_kcal)} kcal/mol
                </span>

                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                  {isBest && (
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: '0.42rem', letterSpacing: '0.14em',
                      padding: '0.1rem 0.38rem',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'rgba(255,255,255,0.6)',
                      textTransform: 'uppercase',
                    }}>BEST</span>
                  )}
                  {isSelected && (
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: '0.42rem', letterSpacing: '0.14em',
                      padding: '0.1rem 0.38rem',
                      border: '1px solid rgba(255,91,42,0.55)',
                      color: 'var(--accent)',
                      textTransform: 'uppercase',
                    }}>VIEW</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PaneInsight({ report }: { report: GenesisReport }) {
  return (
    <div style={paneStyle}>
      <Label>05 · Insight</Label>
      <Title>Executive Summary</Title>
      <Divider />
      <Body>{report.executive_summary}</Body>

      {report.safety_flags.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <FieldLabel>Safety considerations</FieldLabel>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
            {report.safety_flags.map((f, i) => (
              <li key={i} style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: '0.72rem', color: 'var(--ink-2)', marginBottom: '0.35rem', lineHeight: 1.6 }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.limitations.length > 0 && (
        <div style={{ marginTop: '1.8rem' }}>
          <FieldLabel>Limitations</FieldLabel>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
            {report.limitations.map((l, i) => (
              <li key={i} style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: '0.35rem', lineHeight: 1.6 }}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.methodology_notes && (
        <div style={{ marginTop: '1.8rem' }}>
          <FieldLabel>Methodology</FieldLabel>
          <Body style={{ color: 'var(--ink-3)' }}>{report.methodology_notes}</Body>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--serif)', fontWeight: 300,
      fontSize: '0.56rem', letterSpacing: '0.38em',
      color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 0.8rem',
    }}>
      {children}
    </p>
  )
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--serif)', fontWeight: 300,
      fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
      letterSpacing: '0.10em', color: 'var(--ink-1)',
      textTransform: 'uppercase', margin: 0,
    }}>
      {children}
    </h2>
  )
}

function Divider() {
  return <div style={{ width: '2.4rem', height: '1px', background: 'var(--hair)', margin: '1.5rem 0' }} />
}

function Body({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontFamily: 'var(--serif)', fontWeight: 300,
      fontSize: '0.82rem', lineHeight: 1.85,
      color: 'var(--ink-2)', margin: 0,
      maxWidth: '66ch',
      ...style,
    }}>
      {children}
    </p>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: '1.3rem', letterSpacing: '0.04em', color: 'var(--ink-1)' }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: '0.58rem', letterSpacing: '0.18em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
        {label}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--serif)', fontWeight: 300,
      fontSize: '0.56rem', letterSpacing: '0.28em',
      color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 0.4rem',
    }}>
      {children}
    </p>
  )
}

function FieldGroup({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <FieldLabel>{label}</FieldLabel>
      <p style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: '0.78rem', lineHeight: 1.75, color: 'var(--ink-2)', margin: 0 }}>
        {text}
      </p>
    </div>
  )
}

function Chip({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: '0.52rem',
      letterSpacing: '0.06em',
      color: ok ? 'rgba(120,220,120,0.75)' : warn ? 'var(--accent)' : 'var(--ink-3)',
    }}>
      {label} {value}
    </span>
  )
}

const paneStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '700px',
  margin: '0 auto',
}

// ── Pane config ────────────────────────────────────────────────────────────────

const PANES = [
  { label: 'Disease',   key: 'disease'   },
  { label: 'Targets',   key: 'targets'   },
  { label: 'Molecules', key: 'molecules' },
  { label: 'Docking',   key: 'docking'   },
  { label: 'Insight',   key: 'insight'   },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate  = useNavigate()
  const [report, setReport]   = useState<GenesisReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [pane, setPane]       = useState(0)

  useEffect(() => {
    if (!jobId) return
    fetch(`/api/results/${jobId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (d.job_id) setReport(d as GenesisReport)
        else throw new Error('Report not ready')
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [jobId])

  const prevPane = useCallback(() => setPane(p => Math.max(0, p - 1)), [])
  const nextPane = useCallback(() => setPane(p => Math.min(PANES.length - 1, p + 1)), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prevPane()
      if (e.key === 'ArrowRight') nextPane()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prevPane, nextPane])

  if (loading) return <FullCenter><Spinner /></FullCenter>

  if (error || !report) return (
    <FullCenter>
      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', color: 'var(--ink-3)', marginBottom: '1.5rem' }}>
        {error || 'Report not found'}
      </p>
      <button onClick={() => navigate(`/jobs/${jobId}`)} style={backBtnStyle}>
        ← Back to job
      </button>
    </FullCenter>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem',
        borderBottom: '1px solid var(--hair)',
        background: 'rgba(7,7,7,0.92)',
        backdropFilter: 'blur(8px)',
      }}>
        <button onClick={() => navigate('/home')} style={backBtnStyle}>
          ← New Search
        </button>

        {/* Pane tabs */}
        <div style={{ display: 'flex', gap: '0.1rem' }}>
          {PANES.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setPane(i)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid ${i === pane ? 'rgba(255,255,255,0.45)' : 'transparent'}`,
                color: i === pane ? 'var(--ink-1)' : 'var(--ink-3)',
                fontFamily: 'var(--serif)', fontWeight: 300,
                fontSize: '0.58rem', letterSpacing: '0.22em',
                textTransform: 'uppercase',
                padding: '0.3rem 0.8rem 0.4rem',
                cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.55rem', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
          {pane + 1} / {PANES.length}  ·  ← →
        </div>
      </div>

      {/* ── Pane content ── */}
      <div style={{ flex: 1, paddingTop: '5rem', paddingBottom: '6rem', padding: '6rem 3rem 4rem' }}>
        {pane === 0 && <PaneDisease   report={report} />}
        {pane === 1 && <PaneTargets   report={report} />}
        {pane === 2 && <PaneMolecules report={report} />}
        {pane === 3 && <PaneDocking   report={report} />}
        {pane === 4 && <PaneInsight   report={report} />}
      </div>

      {/* ── Bottom arrow nav ── */}
      <div style={{
        position: 'fixed', bottom: '1.8rem', left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: '1rem',
        pointerEvents: 'none',
      }}>
        <NavArrow dir="left"  onClick={prevPane} disabled={pane === 0} />
        <NavArrow dir="right" onClick={nextPane} disabled={pane === PANES.length - 1} />
      </div>

    </div>
  )
}

function NavArrow({ dir, onClick, disabled }: { dir: 'left' | 'right'; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        pointerEvents: disabled ? 'none' : 'auto',
        background: 'transparent',
        border: '1px solid',
        borderColor: disabled ? 'rgba(255,255,255,0.06)' : 'var(--hair)',
        color: disabled ? 'rgba(255,255,255,0.12)' : 'var(--ink-2)',
        fontFamily: 'var(--serif)', fontSize: '1rem',
        width: '2.6rem', height: '2.6rem',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'border-color 0.2s, color 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.borderColor = 'var(--hair)' }}
    >
      {dir === 'left' ? '←' : '→'}
    </button>
  )
}

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-3)', letterSpacing: '0.12em' }}>
      Loading report…
    </p>
  )
}

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--ink-3)',
  fontFamily: 'var(--serif)', fontWeight: 300,
  fontSize: '0.60rem', letterSpacing: '0.20em',
  textTransform: 'uppercase',
  transition: 'color 0.2s',
}
