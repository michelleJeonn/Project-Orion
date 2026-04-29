import { ExternalLink, Database } from 'lucide-react'
import { Target } from '../types'

function ScoreBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-genesis-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface TargetCardProps {
  target: Target
  rank: number
}

export function TargetCard({ target, rank }: TargetCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold bg-genesis-100 text-genesis-700 px-2 py-0.5 rounded-full">
              #{rank}
            </span>
            <h3 className="text-lg font-bold text-slate-800">{target.gene_symbol}</h3>
          </div>
          <p className="text-sm text-slate-500">{target.protein_name}</p>
        </div>
        <div className="flex gap-2">
          {target.uniprot_id && (
            <a
              href={`https://www.uniprot.org/uniprot/${target.uniprot_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-genesis-600 hover:text-genesis-800"
            >
              <Database className="w-3 h-3" />
              UniProt
            </a>
          )}
          {target.preferred_pdb_id && (
            <a
              href={`https://www.rcsb.org/structure/${target.preferred_pdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-genesis-600 hover:text-genesis-800"
            >
              <ExternalLink className="w-3 h-3" />
              PDB
            </a>
          )}
        </div>
      </div>

      {target.function_summary && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-3">{target.function_summary}</p>
      )}

      <div className="space-y-2 mb-4">
        <ScoreBar value={target.druggability_score} label="Druggability" />
        <ScoreBar value={target.clinical_relevance_score} label="Clinical Relevance" />
        <ScoreBar value={target.overall_score} label="Overall Score" />
      </div>

      {target.pathways.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Pathways
          </p>
          <div className="flex flex-wrap gap-1">
            {target.pathways.slice(0, 4).map((p, i) => (
              <span
                key={i}
                className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
