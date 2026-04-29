import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { PipelineStage } from '../types'

const STAGES: { key: PipelineStage; label: string; description: string }[] = [
  { key: 'disease_analysis',      label: 'Disease Analysis',      description: 'Parsing query, identifying disease context' },
  { key: 'target_discovery',      label: 'Target Discovery',      description: 'Finding druggable proteins via biomedical databases' },
  { key: 'molecular_generation',  label: 'Molecule Generation',   description: 'Generating drug-like candidate molecules' },
  { key: 'docking',               label: 'Docking Simulation',    description: 'Predicting protein–ligand binding affinities' },
  { key: 'insight_synthesis',     label: 'Insight Synthesis',     description: 'Generating biological narrative and report' },
  { key: 'completed',             label: 'Complete',              description: 'Report ready' },
]

const STAGE_ORDER: PipelineStage[] = [
  'queued', 'disease_analysis', 'target_discovery',
  'molecular_generation', 'docking', 'insight_synthesis', 'completed',
]

function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage)
}

interface ProgressTrackerProps {
  stage: PipelineStage
  progress: number
  message: string
  error?: string
}

export function ProgressTracker({ stage, progress, message, error }: ProgressTrackerProps) {
  const currentIdx = stageIndex(stage)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 w-full max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-700">
            {error ? 'Pipeline Failed' : stage === 'completed' ? 'Complete!' : 'Running pipeline...'}
          </span>
          <span className="text-sm font-mono text-genesis-600">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              error ? 'bg-red-400' : 'bg-genesis-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-slate-500 min-h-[20px]">{message}</p>
        {error && (
          <p className="mt-1 text-sm text-red-600 font-medium">Error: {error}</p>
        )}
      </div>

      {/* Stage checklist */}
      <div className="space-y-3">
        {STAGES.map(({ key, label, description }) => {
          const idx = stageIndex(key)
          const isActive = key === stage && stage !== 'completed'
          const isDone = idx < currentIdx || stage === 'completed'
          const isFuture = idx > currentIdx

          return (
            <div key={key} className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {error && isActive ? (
                  <XCircle className="w-5 h-5 text-red-400" />
                ) : isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-genesis-500" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-genesis-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-200" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  isDone ? 'text-genesis-700' :
                  isActive ? 'text-slate-800' :
                  'text-slate-400'
                }`}>
                  {label}
                </p>
                <p className={`text-xs ${isFuture ? 'text-slate-300' : 'text-slate-400'}`}>
                  {description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
