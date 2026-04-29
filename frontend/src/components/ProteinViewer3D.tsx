import { useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Props {
  uniprotId: string
  geneName: string
}

export function ProteinViewer3D({ uniprotId, geneName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!containerRef.current || !uniprotId) return
    let cancelled = false
    setStatus('loading')

    async function load() {
      try {
        // Ensure AlphaFold structure is downloaded, get filename
        const metaResp = await fetch(`${API_BASE}/api/alphafold/${uniprotId}`)
        if (!metaResp.ok) throw new Error(`No AlphaFold structure for ${uniprotId}`)
        const { filename } = await metaResp.json()

        const pdbResp = await fetch(`${API_BASE}/api/structure/${filename}`)
        if (!pdbResp.ok) throw new Error(`Structure file not found: ${filename}`)
        const pdbData = await pdbResp.text()

        if (cancelled || !containerRef.current) return

        const $3Dmol = await import('3dmol')

        if (viewerRef.current) {
          viewerRef.current.clear()
          viewerRef.current = null
        }

        const viewer = ($3Dmol as any).createViewer(containerRef.current, {
          backgroundColor: '#06060a',
          alpha: true,
        })
        viewer.setBackgroundColor(0x000000, 0.08)
        viewerRef.current = viewer

        viewer.addModel(pdbData, 'pdb')
        viewer.setStyle({}, {
          cartoon: {
            color: 'spectrum',
            opacity: 0.92,
            thickness: 0.4,
            arrows: true,
          },
        })
        viewer.zoomTo()
        viewer.zoom(0.85)
        viewer.render()

        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load structure')
          setStatus('error')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [uniprotId])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          background: '#06060a',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.15)',
            borderTopColor: 'rgba(200,170,255,0.8)',
            animation: 'spin 0.9s linear infinite',
          }}/>
          <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}>
            FETCHING ALPHAFOLD · {uniprotId}
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          background: '#06060a', padding: '1rem',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.10em', color: 'rgba(255,100,100,0.7)', textAlign: 'center' }}>
            {errorMsg}
          </span>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>
      {status === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.13em', color: 'rgba(255,255,255,0.65)',
          pointerEvents: 'none',
        }}>
          {geneName}
        </div>
      )}
      {status === 'ready' && (
        <div style={{
          position: 'absolute', top: 8, left: 10,
          fontFamily: 'monospace', fontSize: 6.5, letterSpacing: '0.13em',
          color: 'rgba(255,255,255,0.28)', pointerEvents: 'none',
        }}>
          ALPHAFOLD · {uniprotId}
        </div>
      )}
    </div>
  )
}
