import { useState } from 'react'
import { Clock, ChevronDown, Check } from 'lucide-react'
import { GenesisReport } from '../types'

const STAGES = [
  { label: 'Disease Analysis',    stat: (r: GenesisReport) => r.disease_name },
  { label: 'Target Discovery',    stat: (r: GenesisReport) => `${r.targets_analyzed} targets` },
  { label: 'Molecule Generation', stat: (r: GenesisReport) => `${r.molecules_generated} molecules` },
  { label: 'Docking Simulation',  stat: (r: GenesisReport) => `${r.molecules_docked} docked` },
  { label: 'Insight Synthesis',   stat: (r: GenesisReport) => `${r.top_candidates.length} top candidates` },
]

export function PipelineGraphic({ report }: { report: GenesisReport }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
    >
      {/* Collapsed preview — always visible, acts as the toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
      >
        {/* Stage name pills */}
        <div className="flex items-center gap-3 overflow-hidden">
          {STAGES.map((stage, i) => (
            <span key={stage.label} className="flex items-center gap-1.5 flex-shrink-0">
              <Check className="w-3 h-3 text-slate-400 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-[12px] text-slate-500">{stage.label}</span>
              {i < STAGES.length - 1 && (
                <span className="text-slate-200 ml-1.5">·</span>
              )}
            </span>
          ))}
        </div>

        {/* Right side: duration + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {report.pipeline_duration_seconds && (
            <span className="flex items-center gap-1 text-[12px] text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {(report.pipeline_duration_seconds / 60).toFixed(1)} min
            </span>
          )}
          <ChevronDown
            className="w-4 h-4 text-slate-300 transition-transform duration-300"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Expanded detail — smooth height reveal */}
      <div
        className="overflow-hidden transition-all duration-500 ease-in-out"
        style={{ maxHeight: expanded ? '160px' : '0px' }}
      >
        <div className="border-t border-slate-100 px-6 py-5">
          <div className="flex items-start overflow-x-auto">
            {STAGES.map((stage, i) => (
              <div key={stage.label} className="flex items-start flex-shrink-0">
                <div className="flex flex-col w-36">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" strokeWidth={2.5} />
                    <p className="text-[12.5px] font-semibold text-slate-700 leading-tight">
                      {stage.label}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">{stage.stat(report)}</p>
                </div>

                {i < STAGES.length - 1 && (
                  <div className="flex items-center mx-2 mt-2 flex-shrink-0">
                    <div className="w-5 h-px bg-slate-200" />
                    <svg width="6" height="8" viewBox="0 0 6 8" fill="none" className="flex-shrink-0">
                      <path d="M1 1L5 4L1 7" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
