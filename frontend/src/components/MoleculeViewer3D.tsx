import { useEffect, useRef, useState } from 'react'
import { DockingInteraction } from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface MoleculeViewer3DProps {
  proteinFile: string          // e.g. "1ABC.pdb" or "AF-P00533.pdb"
  poseFile: string             // e.g. "pose_P00533_ab12cd34.pdb"
  interactions: DockingInteraction[]
  height?: number
}

export function MoleculeViewer3D({ proteinFile, poseFile, interactions, height = 320 }: MoleculeViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function load() {
      try {
        // Dynamic import keeps 3dmol out of the initial bundle
        const $3Dmol = await import('3dmol')

        const [proteinResp, poseResp] = await Promise.all([
          fetch(`${API_BASE}/api/structure/${proteinFile}`),
          fetch(`${API_BASE}/api/structure/${poseFile}`),
        ])

        if (!proteinResp.ok) throw new Error(`Protein not found: ${proteinFile}`)
        if (!poseResp.ok) throw new Error(`Pose not found: ${poseFile}`)

        const [proteinData, poseData] = await Promise.all([
          proteinResp.text(),
          poseResp.text(),
        ])

        if (cancelled || !containerRef.current) return

        // Clear any previous viewer
        if (viewerRef.current) viewerRef.current.clear()

        const viewer = ($3Dmol as any).createViewer(containerRef.current, {
          backgroundColor: '#0f172a',
        })
        viewerRef.current = viewer

        // --- Protein ---
        const pFormat = proteinFile.endsWith('.cif') ? 'mmcif' : 'pdb'
        viewer.addModel(proteinData, pFormat)
        viewer.setStyle({ model: 0 }, { cartoon: { color: 'spectrum', opacity: 0.75 } })

        // Highlight interacting residues
        const residueNums = interactions
          .map(i => parseInt(i.residue.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n))

        if (residueNums.length > 0) {
          viewer.addStyle(
            { model: 0, resi: residueNums },
            {
              stick: { color: '#f97316', radius: 0.25 },
              cartoon: { color: '#f97316' },
            }
          )
          // Label each interacting residue
          interactions.forEach(intr => {
            const resi = parseInt(intr.residue.replace(/\D/g, ''), 10)
            if (!isNaN(resi)) {
              viewer.addLabel(intr.residue, {
                resi,
                model: 0,
                fontSize: 10,
                fontColor: '#f97316',
                backgroundColor: 'transparent',
                showBackground: false,
              })
            }
          })
        }

        // --- Ligand pose ---
        const lFormat = poseFile.endsWith('.sdf') ? 'sdf' : 'pdb'
        viewer.addModel(poseData, lFormat)
        viewer.setStyle(
          { model: 1 },
          {
            stick: { colorscheme: 'greenCarbon', radius: 0.2 },
            sphere: { scale: 0.25 },
          }
        )

        viewer.zoomTo({ model: 1 })
        viewer.render()

        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load viewer')
          setStatus('error')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [proteinFile, poseFile])

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-700" style={{ height }}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-genesis-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading 3D structure…</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <p className="text-xs text-red-400 px-4 text-center">{errorMsg}</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {status === 'ready' && (
        <div className="absolute bottom-2 left-2 flex gap-3 text-xs text-slate-400 pointer-events-none">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Binding residues
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Ligand
          </span>
        </div>
      )}
    </div>
  )
}
