import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FlaskConical, Workflow, LayoutDashboard, BarChart2, FolderOpen, Users,
  Settings, CircleHelp, Search, Bookmark, Trash2, type LucideIcon,
} from 'lucide-react'
import { CryosisReport as GenesisReport } from '../types'

interface SavedProject {
  id: string
  diseaseName: string
  savedAt: string
  jobId: string
  report: GenesisReport
}

const NAV_MAIN_ITEMS: { label: string; id: string; icon: LucideIcon }[] = [
  { label: 'New Study',      id: 'new-study',   icon: FlaskConical },
  { label: 'Agent Pipeline', id: 'pipeline',    icon: Workflow },
  { label: 'Dashboard',      id: 'dashboard',   icon: LayoutDashboard },
  { label: 'Analytics',      id: 'analytics',   icon: BarChart2 },
  { label: 'Projects',       id: 'projects',    icon: FolderOpen },
  { label: 'Team',           id: 'team',        icon: Users },
]

const NAV_BOTTOM: { label: string; icon: LucideIcon }[] = [
  { label: 'Settings', icon: Settings },
  { label: 'Get Help', icon: CircleHelp },
  { label: 'Search',   icon: Search },
]

export function ProjectsPage() {
  const navigate = useNavigate()

  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    try { return JSON.parse(localStorage.getItem('orion-saved-projects') ?? '[]') }
    catch { return [] }
  })

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedProjects.filter(p => p.id !== id)
    setSavedProjects(updated)
    localStorage.setItem('orion-saved-projects', JSON.stringify(updated))
  }

  const handleLoad = (project: SavedProject) => {
    navigate('/home', { state: { loadProject: project } })
  }

  const handleNavClick = (id: string) => {
    if (id === 'projects') return
    navigate('/home', { state: { tab: id } })
  }

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
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
      }}>
        <div style={{ padding: '0 20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.03em',
            color: 'rgba(255,255,255,0.90)',
          }}>Project Orion</button>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginTop: 4 }}>
            Drug Discovery
          </div>
        </div>

        <nav style={{ padding: '18px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            {NAV_MAIN_ITEMS.map(item => {
              const active = item.id === 'projects'
              return (
                <div key={item.label} onClick={() => handleNavClick(item.id)} style={{
                  padding: '7px 12px', borderRadius: 6, marginBottom: 2,
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em',
                  cursor: 'pointer',
                  color: active ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.38)',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 9,
                  transition: 'background 0.15s, color 0.15s',
                }}>
                  <item.icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: active ? 0.85 : 0.5 }} />
                  {item.label}
                  {item.id === 'projects' && savedProjects.length > 0 && (
                    <span style={{
                      marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 9,
                      color: 'rgba(255,255,255,0.35)',
                      background: 'rgba(255,255,255,0.08)', borderRadius: 4,
                      padding: '1px 5px', lineHeight: 1.6,
                    }}>{savedProjects.length}</span>
                  )}
                </div>
              )
            })}
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

        {/* Save Project — always at bottom, disabled on this page */}
        <div style={{ padding: '0 12px 8px' }}>
          <button
            disabled
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', borderRadius: 6,
              background: 'rgba(228,147,206,0.04)',
              border: '1px solid rgba(228,147,206,0.12)',
              cursor: 'default',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'rgba(228,147,206,0.28)',
            }}
          >
            <Bookmark size={12} strokeWidth={1.5} />
            Save Project
          </button>
        </div>

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

      {/* ── Main content ── */}
      <div style={{ marginLeft: 244, height: '100vh', overflowY: 'auto' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 40px 80px' }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 10 }}>
              Run History
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.90)', lineHeight: 1.1 }}>
              Saved Projects
            </h1>
            {savedProjects.length > 0 && (
              <p style={{ margin: '10px 0 0', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                {savedProjects.length} {savedProjects.length === 1 ? 'project' : 'projects'} saved
              </p>
            )}
          </div>

          {/* Empty state */}
          {savedProjects.length === 0 ? (
            <div style={{
              padding: '80px 40px', textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 16,
            }}>
              <FolderOpen size={36} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 8 }}>
                No saved projects yet
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, color: 'rgba(255,255,255,0.28)', fontStyle: 'italic', marginBottom: 28 }}>
                Run a study and click Save Project to store it here
              </div>
              <button
                onClick={() => navigate('/home')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 20px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.13)',
                  color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.90)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.60)'
                }}
              >
                <FlaskConical size={13} strokeWidth={1.5} />
                Start a New Study
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {savedProjects.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => handleLoad(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '20px 24px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s',
                    animation: `fadeInUp 0.3s ease-out ${idx * 0.05}s both`,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.14)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(228,147,206,0.07)',
                    border: '1px solid rgba(228,147,206,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Bookmark size={18} strokeWidth={1.5} color="rgba(228,147,206,0.65)" />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--serif)', fontSize: 18,
                      color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em',
                      marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{p.diseaseName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        `${p.report.targets_analyzed} targets`,
                        `${p.report.molecules_generated} molecules`,
                        `${p.report.top_candidates.length} candidates`,
                      ].map(stat => (
                        <span key={stat} style={{
                          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.12em',
                          textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4, padding: '2px 8px',
                        }}>{stat}</span>
                      ))}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.22)' }}>
                        {new Date(p.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Arrow + Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={e => handleDelete(p.id, e)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.20)', padding: 8, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => {
                        const b = e.currentTarget as HTMLButtonElement
                        b.style.color = 'rgba(255,100,100,0.75)'
                        b.style.background = 'rgba(255,100,100,0.09)'
                      }}
                      onMouseLeave={e => {
                        const b = e.currentTarget as HTMLButtonElement
                        b.style.color = 'rgba(255,255,255,0.20)'
                        b.style.background = 'transparent'
                      }}
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'rgba(255,255,255,0.20)' }}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
