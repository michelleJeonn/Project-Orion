import { useState } from 'react'
import { DockingResult, ParetoAnalysis, ParetoObjectives } from '../types'

// ── Constants ──────────────────────────────────────────────────────────────── //

const W = 520
const H = 400
const PAD = { top: 20, right: 20, bottom: 50, left: 54 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const RANK_COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']
const rankColor = (rank: number) => RANK_COLORS[Math.min(rank - 1, RANK_COLORS.length - 1)]

const AXES: { key: keyof ParetoObjectives; label: string }[] = [
  { key: 'binding_affinity',       label: 'Binding Affinity' },
  { key: 'selectivity',            label: 'Selectivity' },
  { key: 'bbb_penetration',        label: 'BBB Penetration' },
  { key: 'metabolic_stability',    label: 'Metabolic Stability' },
  { key: 'oral_absorption',        label: 'Oral Absorption' },
  { key: 'synthetic_accessibility', label: 'Synthesizability' },
]

// ── Tooltip ────────────────────────────────────────────────────────────────── //

interface TooltipData {
  x: number; y: number
  result: DockingResult
  obj: ParetoObjectives
}

function Tooltip({ data }: { data: TooltipData }) {
  const { x, y, result, obj } = data
  const left = x > PLOT_W * 0.65 ? x - 200 : x + 14
  const top  = y > PLOT_H * 0.65 ? y - 130  : y + 8

  return (
    <div
      className="absolute z-10 pointer-events-none bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs w-48"
      style={{ left: left + PAD.left, top: top + PAD.top }}
    >
      <p className="font-mono text-slate-300 mb-2 truncate">{result.molecule.smiles}</p>
      <p className="mb-1">
        <span className="text-slate-400">ΔG </span>
        <span className="font-semibold text-sky-300">{result.binding_affinity_kcal.toFixed(1)} kcal/mol</span>
      </p>
      <p className="mb-1">
        <span className="text-slate-400">Pareto rank </span>
        <span className="font-semibold text-white">#{obj.pareto_rank}</span>
      </p>
      <div className="border-t border-slate-700 mt-2 pt-2 space-y-0.5">
        {AXES.map(({ key, label }) => (
          <div key={key} className="flex justify-between">
            <span className="text-slate-400">{label.split(' ')[0]}</span>
            <span className="tabular-nums font-medium">{(obj[key] as number).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main chart ─────────────────────────────────────────────────────────────── //

interface ParetoChartProps {
  results: DockingResult[]
  analysis: ParetoAnalysis
  xKey?: keyof ParetoObjectives
  yKey?: keyof ParetoObjectives
}

export function ParetoChart({ results, analysis, xKey = 'binding_affinity', yKey = 'selectivity' }: ParetoChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [activeX, setActiveX] = useState<keyof ParetoObjectives>(xKey)
  const [activeY, setActiveY] = useState<keyof ParetoObjectives>(yKey)

  const withObj = results.filter(r => r.molecule.pareto_objectives)

  // Map 0-1 scores to pixel coords (invert Y so 1.0 = top)
  const toX = (v: number) => v * PLOT_W
  const toY = (v: number) => (1 - v) * PLOT_H

  // Pareto front line (rank=1 molecules sorted by x-axis value)
  const front1 = withObj
    .filter(r => r.molecule.pareto_objectives!.pareto_rank === 1)
    .sort((a, b) =>
      (a.molecule.pareto_objectives![activeX] as number) -
      (b.molecule.pareto_objectives![activeX] as number)
    )

  const frontPoints = front1.map(r => {
    const obj = r.molecule.pareto_objectives!
    return `${toX(obj[activeX] as number)},${toY(obj[activeY] as number)}`
  }).join(' ')

  return (
    <div className="space-y-4">
      {/* Axis selectors */}
      <div className="flex flex-wrap gap-3 items-center text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700">X:</span>
          <select
            value={activeX}
            onChange={e => setActiveX(e.target.value as keyof ParetoObjectives)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:border-genesis-400"
          >
            {AXES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700">Y:</span>
          <select
            value={activeY}
            onChange={e => setActiveY(e.target.value as keyof ParetoObjectives)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 focus:outline-none focus:border-genesis-400"
          >
            {AXES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <span className="text-slate-400">
          {analysis.pareto_front_count} on Pareto front · {withObj.length} total
        </span>
      </div>

      {/* Chart */}
      <div className="relative select-none">
        <svg width={W} height={H} className="w-full h-auto overflow-visible">
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <g key={v}>
                <line x1={0} y1={toY(v)} x2={PLOT_W} y2={toY(v)}
                  stroke="#f1f5f9" strokeWidth={1} />
                <line x1={toX(v)} y1={0} x2={toX(v)} y2={PLOT_H}
                  stroke="#f1f5f9" strokeWidth={1} />
                <text x={-6} y={toY(v) + 4} textAnchor="end"
                  className="fill-slate-400" fontSize={10}>{v.toFixed(2)}</text>
                <text x={toX(v)} y={PLOT_H + 16} textAnchor="middle"
                  className="fill-slate-400" fontSize={10}>{v.toFixed(2)}</text>
              </g>
            ))}

            {/* Axes */}
            <line x1={0} y1={0} x2={0} y2={PLOT_H} stroke="#cbd5e1" strokeWidth={1.5} />
            <line x1={0} y1={PLOT_H} x2={PLOT_W} y2={PLOT_H} stroke="#cbd5e1" strokeWidth={1.5} />

            {/* Axis labels */}
            <text x={PLOT_W / 2} y={PLOT_H + 38} textAnchor="middle"
              className="fill-slate-500" fontSize={11} fontWeight={500}>
              {AXES.find(a => a.key === activeX)?.label ?? activeX}
            </text>
            <text
              transform={`translate(-40,${PLOT_H / 2}) rotate(-90)`}
              textAnchor="middle" className="fill-slate-500" fontSize={11} fontWeight={500}>
              {AXES.find(a => a.key === activeY)?.label ?? activeY}
            </text>

            {/* Pareto front line */}
            {front1.length > 1 && (
              <polyline
                points={frontPoints}
                fill="none"
                stroke="#0284c7"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.5}
              />
            )}

            {/* Dots */}
            {withObj.map((result, i) => {
              const obj = result.molecule.pareto_objectives!
              const cx = toX(obj[activeX] as number)
              const cy = toY(obj[activeY] as number)
              const r  = 4 + (obj.metabolic_stability * 3)
              const isHovered = tooltip?.result === result
              return (
                <circle
                  key={i}
                  cx={cx} cy={cy} r={isHovered ? r + 2 : r}
                  fill={rankColor(obj.pareto_rank)}
                  fillOpacity={obj.pareto_rank === 1 ? 0.9 : 0.55}
                  stroke={isHovered ? '#0f172a' : rankColor(obj.pareto_rank)}
                  strokeWidth={isHovered ? 2 : obj.pareto_rank === 1 ? 1.5 : 0.5}
                  className="cursor-pointer transition-all duration-100"
                  onMouseEnter={() => setTooltip({ x: cx, y: cy, result, obj })}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </g>
        </svg>

        {tooltip && <Tooltip data={tooltip} />}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[1, 2, 3].map(rank => (
          <div key={rank} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: rankColor(rank) }}
            />
            Front {rank}{rank === 1 ? ' (Pareto optimal)' : ''}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Dot size = metabolic stability</span>
        </div>
      </div>

      {/* Claude weights explanation */}
      <div className="bg-genesis-50 border border-genesis-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-genesis-700 mb-2">Objective Weights (Claude-assigned)</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {Object.entries(analysis.weights)
            .filter(([k]) => k !== 'rationale')
            .map(([key, val]) => {
              const label = AXES.find(a => a.key === key)?.label ?? key
              const pct   = Math.round((val as number) * 100)
              return (
                <div key={key} className="text-xs">
                  <div className="flex justify-between text-slate-500 mb-0.5">
                    <span>{label}</span>
                    <span className="font-semibold text-slate-700">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-genesis-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
        {analysis.disease_context && (
          <p className="text-xs text-genesis-800 italic">{analysis.disease_context}</p>
        )}
      </div>
    </div>
  )
}
