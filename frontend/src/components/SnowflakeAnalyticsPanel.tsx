import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const D = {
  panel: 'rgba(8,8,10,0.60)',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.13)',
  text1: 'rgba(255,255,255,0.88)',
  text2: 'rgba(255,255,255,0.55)',
  text3: 'rgba(255,255,255,0.30)',
  pink: 'rgba(228,147,206,0.90)',
  pinkBorder: 'rgba(228,147,206,0.28)',
  pinkPanel: 'rgba(228,147,206,0.07)',
  purple: 'rgba(140,80,255,0.90)',
  purpleBorder: 'rgba(120,60,220,0.25)',
  purplePanel: 'rgba(80,20,160,0.10)',
}

interface GenMethod {
  method: string
  avg_binding: number
  avg_qed: number
  molecule_count: number
}

interface TargetRow {
  target: string
  avg_qed: number
  avg_binding: number
  molecule_count: number
}

interface DiseaseRow {
  disease: string
  best_binding: number
  avg_qed: number
  molecule_count: number
}

interface Analytics {
  generation_methods: GenMethod[]
  targets: TargetRow[]
  diseases: DiseaseRow[]
}

function SectionHeader({ label, index }: { label: string; index: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      paddingBottom: '.4rem', borderBottom: `1px solid ${D.border}`,
      marginBottom: '.6rem',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', color: 'rgba(228,147,206,0.55)' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text3 }}>{index}</span>
    </div>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div style={{
      height: 3, background: 'rgba(255,255,255,0.06)',
      borderRadius: 2, overflow: 'hidden', flex: 1,
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

function GenMethodsTable({ rows }: { rows: GenMethod[] }) {
  if (rows.length === 0) return (
    <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '.5rem 0' }}>
      No data — run a pipeline to populate
    </div>
  )
  const maxCount = Math.max(...rows.map(r => r.molecule_count), 1)
  const bestBinding = Math.min(...rows.map(r => r.avg_binding))

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 60px 60px 50px',
        gap: '.4rem', alignItems: 'center',
        fontFamily: 'var(--mono)', fontSize: 8, color: D.text3,
        paddingBottom: '.3rem', marginBottom: '.2rem',
        borderBottom: `1px solid ${D.border}`,
        letterSpacing: '0.08em',
      }}>
        <span>METHOD</span>
        <span>MOLECULES</span>
        <span style={{ textAlign: 'right' }}>AVG QED</span>
        <span style={{ textAlign: 'right' }}>AVG ΔG</span>
        <span style={{ textAlign: 'right' }}>RANK</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.method} style={{
          display: 'grid', gridTemplateColumns: '120px 1fr 60px 60px 50px',
          gap: '.4rem', alignItems: 'center',
          padding: '.3rem 0',
          borderBottom: i < rows.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, color: r.avg_binding === bestBinding ? D.pink : D.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.method}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bar value={r.molecule_count} max={maxCount} color="rgba(140,80,255,0.55)" />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.text3, minWidth: 28, textAlign: 'right' }}>
              {r.molecule_count}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text1, textAlign: 'right' }}>
            {r.avg_qed.toFixed(2)}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, textAlign: 'right',
            color: r.avg_binding === bestBinding ? D.pink : D.text2,
          }}>
            {r.avg_binding.toFixed(1)}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.text3, textAlign: 'right' }}>
            #{i + 1}
          </span>
        </div>
      ))}
    </div>
  )
}

function TargetsTable({ rows }: { rows: TargetRow[] }) {
  if (rows.length === 0) return (
    <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '.5rem 0' }}>No data</div>
  )
  const maxQed = Math.max(...rows.map(r => r.avg_qed), 1)
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 60px 50px',
        gap: '.4rem',
        fontFamily: 'var(--mono)', fontSize: 8, color: D.text3,
        paddingBottom: '.3rem', marginBottom: '.2rem',
        borderBottom: `1px solid ${D.border}`,
        letterSpacing: '0.08em',
      }}>
        <span>TARGET</span>
        <span>AVG QED</span>
        <span style={{ textAlign: 'right' }}>AVG ΔG</span>
        <span style={{ textAlign: 'right' }}>COUNT</span>
      </div>
      {rows.slice(0, 8).map((r, i) => (
        <div key={r.target} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 60px 50px',
          gap: '.4rem', alignItems: 'center',
          padding: '.3rem 0',
          borderBottom: i < Math.min(rows.length, 8) - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: i === 0 ? D.pink : D.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.target}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bar value={r.avg_qed} max={maxQed} color="rgba(228,147,206,0.50)" />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: i === 0 ? D.pink : D.text1, minWidth: 32, textAlign: 'right' }}>
              {r.avg_qed.toFixed(3)}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text2, textAlign: 'right' }}>
            {r.avg_binding.toFixed(1)}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.text3, textAlign: 'right' }}>
            {r.molecule_count}
          </span>
        </div>
      ))}
    </div>
  )
}

function DiseasesTable({ rows }: { rows: DiseaseRow[] }) {
  if (rows.length === 0) return (
    <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '.5rem 0' }}>No data</div>
  )
  const best = Math.min(...rows.map(r => r.best_binding))
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 70px 60px 50px',
        gap: '.4rem',
        fontFamily: 'var(--mono)', fontSize: 8, color: D.text3,
        paddingBottom: '.3rem', marginBottom: '.2rem',
        borderBottom: `1px solid ${D.border}`,
        letterSpacing: '0.08em',
      }}>
        <span>DISEASE</span>
        <span style={{ textAlign: 'right' }}>BEST ΔG</span>
        <span style={{ textAlign: 'right' }}>AVG QED</span>
        <span style={{ textAlign: 'right' }}>COUNT</span>
      </div>
      {rows.slice(0, 8).map((r, i) => (
        <div key={r.disease} style={{
          display: 'grid', gridTemplateColumns: '1fr 70px 60px 50px',
          gap: '.4rem', alignItems: 'center',
          padding: '.3rem 0',
          borderBottom: i < Math.min(rows.length, 8) - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
        }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            color: r.best_binding === best ? D.pink : D.text2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.disease}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9, textAlign: 'right',
            color: r.best_binding === best ? D.pink : D.text2,
          }}>
            {r.best_binding.toFixed(1)}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.text1, textAlign: 'right' }}>
            {r.avg_qed.toFixed(2)}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.text3, textAlign: 'right' }}>
            {r.molecule_count}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SnowflakeAnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/snowflake/analytics`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 10, padding: '2rem', textAlign: 'center', letterSpacing: '0.12em' }}>
        LOADING ANALYTICS...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '2rem', textAlign: 'center', letterSpacing: '0.10em', lineHeight: 1.8 }}>
        ANALYTICS UNAVAILABLE<br />
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)' }}>Configure Snowflake to enable cross-run analytics</span>
      </div>
    )
  }

  const isEmpty = data.generation_methods.length === 0 && data.targets.length === 0 && data.diseases.length === 0

  if (isEmpty) {
    return (
      <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 9, padding: '2rem', textAlign: 'center', letterSpacing: '0.10em', lineHeight: 1.8 }}>
        NO CROSS-RUN DATA<br />
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)' }}>Complete at least one pipeline run with Snowflake configured</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {/* Generation Methods */}
      <div style={{
        background: D.panel, border: `1px solid ${D.border2}`,
        borderRadius: 4, padding: '.75rem',
      }}>
        <SectionHeader label="GENERATION METHODS" index="A" />
        <GenMethodsTable rows={data.generation_methods} />
      </div>

      {/* Target performance */}
      <div style={{
        background: D.panel, border: `1px solid ${D.border2}`,
        borderRadius: 4, padding: '.75rem',
      }}>
        <SectionHeader label="TOP TARGETS BY QED" index="B" />
        <TargetsTable rows={data.targets} />
      </div>

      {/* Disease leaderboard */}
      <div style={{
        background: D.panel, border: `1px solid ${D.border2}`,
        borderRadius: 4, padding: '.75rem',
      }}>
        <SectionHeader label="DISEASE LEADERBOARD" index="C" />
        <DiseasesTable rows={data.diseases} />
      </div>
    </div>
  )
}
