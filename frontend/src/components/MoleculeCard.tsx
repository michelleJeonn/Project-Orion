import { useState } from 'react'
import { DockingResult, ParetoObjectives } from '../types'
import { MoleculeViewer3D } from './MoleculeViewer3D'

const INTERACTION_COLORS: Record<string, string> = {
  'H-bond':      'rgba(100,160,255,0.85)',
  'Hydrophobic': 'rgba(255,180,60,0.85)',
  'Pi-stacking': 'rgba(200,100,255,0.85)',
  'Ionic':       'rgba(80,220,140,0.85)',
}

const OBJ_META: { key: keyof ParetoObjectives; label: string }[] = [
  { key: 'binding_affinity',        label: 'BIND' },
  { key: 'selectivity',             label: 'SEL' },
  { key: 'bbb_penetration',         label: 'BBB' },
  { key: 'metabolic_stability',     label: 'MET' },
  { key: 'oral_absorption',         label: 'ORAL' },
  { key: 'synthetic_accessibility', label: 'SYNTH' },
]

interface MoleculeCardProps {
  result: DockingResult
  rank: number
}

export function MoleculeCard({ result, rank }: MoleculeCardProps) {
  const can3D = !!(result.pose_file && result.protein_structure_file)
  const [expanded, setExpanded] = useState(false)
  const [show3D, setShow3D] = useState(true)
  const { molecule, binding_affinity_kcal, interactions, explanation } = result
  const { admet } = molecule
  const pareto = molecule.pareto_objectives
  const isStrong = binding_affinity_kcal <= -8

  return (
    <div style={{
      position: 'relative',
      border: '1px solid var(--hair)',
      background: 'rgba(6,6,8,0.65)',
    }}>
      <span className="corner tl"/><span className="corner tr"/>
      <span className="corner bl"/><span className="corner br"/>

      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '.75rem .85rem', cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--hair)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '.62rem', letterSpacing: '.18em',
            color: rank === 1 ? 'var(--accent)' : 'var(--ink-3)',
            width: '1.8rem', flexShrink: 0,
          }}>
            {String(rank).padStart(2,'0')}
          </span>
          <div>
            <div className="mono" style={{ fontSize: '.62rem', color: 'var(--ink-2)', marginBottom: '.2rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {molecule.smiles}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: '.56rem', letterSpacing: '.16em',
                color: isStrong ? 'rgba(120,220,120,.9)' : 'var(--ink-2)',
                padding: '.15rem .5rem', border: `1px solid ${isStrong ? 'rgba(120,220,120,.3)' : 'var(--hair)'}`,
              }}>
                {binding_affinity_kcal.toFixed(1)} kcal/mol
              </span>
              <span className="hud-micro" style={{ color: admet.lipinski_pass ? 'var(--ink-2)' : 'rgba(255,120,60,.8)' }}>
                RO5 {admet.lipinski_pass ? '✓' : '✗'}
              </span>
              {pareto && (
                <span className="hud-micro" style={{
                  padding: '.12rem .4rem',
                  border: '1px solid var(--hair)',
                  color: pareto.pareto_rank === 1 ? 'rgba(100,180,255,.9)' : 'var(--ink-3)',
                }}>
                  P{pareto.pareto_rank}
                </span>
              )}
              {pareto && pareto.bbb_penetration >= 0.6 && (
                <span className="hud-micro" style={{ padding: '.12rem .4rem', border: '1px solid rgba(255,100,200,.3)', color: 'rgba(255,140,220,.85)' }}>
                  CNS+
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginLeft: '.5rem', flexShrink: 0 }}>
          {can3D && (
            <button
              onClick={e => { e.stopPropagation(); setShow3D(v => !v) }}
              style={{
                fontFamily: 'var(--mono)', fontSize: '.50rem', letterSpacing: '.18em',
                padding: '.2rem .55rem', cursor: 'pointer',
                background: show3D ? 'rgba(255,91,42,.15)' : 'transparent',
                border: `1px solid ${show3D ? 'var(--accent)' : 'var(--hair)'}`,
                color: show3D ? 'var(--accent)' : 'var(--ink-3)',
                textTransform: 'uppercase',
              }}
            >
              3D
            </button>
          )}
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '.62rem', color: 'var(--ink-3)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .2s',
            display: 'block',
          }}>▾</span>
        </div>
      </div>

      {/* 3D viewer */}
      {show3D && can3D && (
        <div style={{ borderBottom: '1px solid var(--hair)', padding: '.5rem' }}>
          <MoleculeViewer3D
            proteinFile={result.protein_structure_file!}
            poseFile={result.pose_file!}
            interactions={interactions}
          />
          <p className="hud-micro" style={{ marginTop: '.25rem', textAlign: 'center' }}>
            {result.protein_structure_file} · {result.docking_method}
          </p>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '.75rem .85rem', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>

          {/* Molecular properties */}
          <div>
            <div className="hud-label" style={{ marginBottom: '.4rem' }}>Molecular Properties</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '.4rem' }}>
              {[
                { label: 'MW',   value: admet.mw ? `${admet.mw.toFixed(0)}` : '—' },
                { label: 'LogP', value: admet.log_p?.toFixed(2) ?? '—' },
                { label: 'TPSA', value: admet.tpsa ? `${admet.tpsa.toFixed(0)}` : '—' },
                { label: 'HBD',  value: admet.hbd ?? '—' },
                { label: 'HBA',  value: admet.hba ?? '—' },
                { label: 'QED',  value: admet.qed_score?.toFixed(2) ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  border: '1px solid var(--hair)', padding: '.35rem .4rem', textAlign: 'center',
                  background: 'rgba(0,0,0,0.3)',
                }}>
                  <div className="hud-micro" style={{ color: 'var(--ink-3)' }}>{label}</div>
                  <div className="hud-num" style={{ marginTop: '.15rem', color: 'var(--ink-1)', fontSize: '.65rem' }}>{String(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pareto objectives */}
          {pareto && (
            <div>
              <div className="hud-label" style={{ marginBottom: '.4rem' }}>Multi-Objective Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.35rem' }}>
                {OBJ_META.map(({ key, label }) => {
                  const val = pareto[key] as number
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.2rem' }}>
                        <span className="hud-micro">{label}</span>
                        <span className="hud-micro" style={{ color: 'var(--ink-2)' }}>{val.toFixed(2)}</span>
                      </div>
                      <div style={{ height: 2, background: 'var(--hair)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${val*100}%`, background: 'rgba(255,255,255,.7)' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Safety flags */}
          {(admet.has_pains || admet.has_alerts) && (
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {admet.has_pains && (
                <span className="hud-micro" style={{ padding: '.2rem .5rem', border: '1px solid rgba(255,80,80,.3)', color: 'rgba(255,120,100,.85)' }}>
                  ⚠ PAINS
                </span>
              )}
              {admet.has_alerts && (
                <span className="hud-micro" style={{ padding: '.2rem .5rem', border: '1px solid rgba(255,160,60,.3)', color: 'rgba(255,180,80,.85)' }}>
                  ⚠ STRUCTURAL ALERT
                </span>
              )}
            </div>
          )}

          {/* Interactions */}
          {interactions.length > 0 && (
            <div>
              <div className="hud-label" style={{ marginBottom: '.4rem' }}>Predicted Interactions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
                {interactions.map((intr, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--mono)', fontSize: '.52rem', letterSpacing: '.12em',
                    padding: '.2rem .55rem',
                    border: '1px solid var(--hair)',
                    color: INTERACTION_COLORS[intr.interaction_type] ?? 'var(--ink-2)',
                    textTransform: 'uppercase',
                  }}>
                    {intr.residue} · {intr.interaction_type}{intr.distance_angstrom ? ` ${intr.distance_angstrom}Å` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI explanation */}
          {explanation && (
            <div style={{ borderTop: '1px solid var(--hair)', paddingTop: '.7rem' }}>
              <div className="hud-label" style={{ marginBottom: '.3rem' }}>AI Analysis</div>
              <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.5, color: 'var(--ink-2)' }}>
                {explanation}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="hud-micro" style={{ color: 'var(--ink-3)', paddingTop: '.3rem', borderTop: '1px solid var(--hair)' }}>
            GEN: {molecule.generation_method} · DOCKING: {result.docking_method}
            {molecule.molecule_id && ` · ID: ${molecule.molecule_id.slice(0, 12)}`}
          </div>
        </div>
      )}
    </div>
  )
}
