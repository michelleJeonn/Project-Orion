import { useState, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const D = {
  panel: 'rgba(8,8,10,0.60)',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',
  text1: 'rgba(255,255,255,0.88)',
  text2: 'rgba(255,255,255,0.55)',
  text3: 'rgba(255,255,255,0.30)',
  pink: 'rgba(228,147,206,0.90)',
  pinkBorder: 'rgba(228,147,206,0.30)',
  pinkPanel: 'rgba(228,147,206,0.07)',
  purple: 'rgba(140,80,255,0.85)',
}

interface SearchResult {
  job_id: string
  disease: string
  matched_section: string
  snippet: string
  created_at: string
}

const SECTION_LABELS: Record<string, string> = {
  report_text: 'SUMMARY',
  pathway_summary: 'PATHWAY',
  molecule_rationale: 'RATIONALE',
}

const SUGGESTIONS = [
  'BACE1 strong binders',
  'autophagy pathway',
  'high QED molecules',
  'kinase inhibitor',
  'blood-brain barrier',
]

export function ReportSearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const doSearch = (q: string) => {
    if (!q || q.trim().length < 2) return
    setLoading(true)
    setError(null)
    setSearched(true)
    fetch(`${API_BASE}/api/snowflake/search_reports?query=${encodeURIComponent(q.trim())}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((data) => setResults(Array.isArray(data) ? data : []))
      .catch((e) => {
        if (e.message === '400') setError('Query too short')
        else setError('Search unavailable — Snowflake not configured')
        setResults([])
      })
      .finally(() => setLoading(false))
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch(query)
  }

  const useSuggestion = (s: string) => {
    setQuery(s)
    doSearch(s)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Search bar */}
      <div style={{
        display: 'flex', gap: '.6rem', alignItems: 'center',
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${D.border2}`,
          borderRadius: 4, padding: '.5rem .75rem',
          gap: '.6rem',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: D.text3 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search reports — e.g. BACE1 strong binders, autophagy pathway..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: 'var(--mono)', fontSize: 11,
              color: D.text1, letterSpacing: '0.03em',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: D.text3, fontFamily: 'var(--mono)', fontSize: 12, padding: 0, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => doSearch(query)}
          disabled={loading || query.trim().length < 2}
          style={{
            background: query.trim().length >= 2 ? D.pinkPanel : 'transparent',
            border: `1px solid ${query.trim().length >= 2 ? D.pinkBorder : D.border}`,
            borderRadius: 4, cursor: query.trim().length >= 2 ? 'pointer' : 'default',
            color: query.trim().length >= 2 ? D.pink : D.text3,
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.12em', padding: '.5rem .9rem',
            transition: 'background .15s, border-color .15s',
          }}
        >
          {loading ? '...' : 'SEARCH'}
        </button>
      </div>

      {/* Suggestions */}
      {!searched && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => useSuggestion(s)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${D.border}`,
                borderRadius: 3, cursor: 'pointer',
                color: D.text2, fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.06em', padding: '.3rem .6rem',
                transition: 'border-color .12s, color .12s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = D.pinkBorder
                ;(e.target as HTMLButtonElement).style.color = D.pink
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = D.border
                ;(e.target as HTMLButtonElement).style.color = D.text2
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,160,100,0.70)',
          letterSpacing: '0.08em', padding: '.4rem 0',
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !loading && !error && results.length === 0 && (
        <div style={{
          color: D.text3, fontFamily: 'var(--mono)', fontSize: 10,
          padding: '1.5rem 0', textAlign: 'center', letterSpacing: '0.10em',
        }}>
          NO MATCHING REPORTS
        </div>
      )}

      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 8, color: D.text3,
            letterSpacing: '0.10em', paddingBottom: '.3rem',
            borderBottom: `1px solid ${D.border}`,
          }}>
            {results.length} RESULT{results.length !== 1 ? 'S' : ''} FOR &ldquo;{query}&rdquo;
          </div>

          {results.map((r, i) => (
            <div key={`${r.job_id}-${i}`} style={{
              background: D.panel,
              border: `1px solid ${D.border2}`,
              borderRadius: 4, padding: '.65rem .8rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.4rem' }}>
                <div style={{ display: 'flex', gap: '.7rem', alignItems: 'baseline' }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 8,
                    letterSpacing: '0.10em', padding: '.15rem .4rem',
                    background: D.pinkPanel,
                    border: `1px solid ${D.pinkBorder}`,
                    borderRadius: 2, color: D.pink,
                  }}>
                    {SECTION_LABELS[r.matched_section] ?? r.matched_section}
                  </span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: '.88rem', color: D.text1 }}>
                    {r.disease}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: D.text3 }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                </span>
              </div>

              <p style={{
                margin: 0, fontFamily: 'var(--mono)', fontSize: '.75rem',
                lineHeight: 1.65, color: D.text2, letterSpacing: '0.02em',
              }}>
                {r.snippet}
                {r.snippet && r.snippet.length >= 298 ? '…' : ''}
              </p>

              <div style={{
                marginTop: '.4rem', fontFamily: 'var(--mono)', fontSize: 8,
                color: D.text3, letterSpacing: '0.06em',
              }}>
                JOB {r.job_id.slice(0, 8).toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
