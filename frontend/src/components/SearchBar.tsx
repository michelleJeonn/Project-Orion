import { useState, FormEvent } from 'react'
import { Search, FlaskConical } from 'lucide-react'

const EXAMPLES = [
  "Alzheimer's disease",
  "Parkinson's disease",
  "Triple-negative breast cancer",
  "Type 2 diabetes",
  "Rheumatoid arthritis",
]

interface SearchBarProps {
  onSubmit: (disease: string) => void
  isLoading: boolean
}

export function SearchBar({ onSubmit, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) onSubmit(query.trim())
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a disease name (e.g. Parkinson's disease)"
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-white
                       text-slate-800 placeholder-slate-400 text-base shadow-sm
                       focus:outline-none focus:ring-2 focus:ring-genesis-500 focus:border-transparent
                       disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 py-4 bg-genesis-600 hover:bg-genesis-700 text-white font-semibold
                     rounded-xl shadow-sm transition-colors duration-150
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          <FlaskConical className="w-5 h-5" />
          {isLoading ? 'Running...' : 'Discover'}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <span className="text-sm text-slate-500">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setQuery(ex)}
            disabled={isLoading}
            className="text-sm px-3 py-1 rounded-full border border-genesis-200 text-genesis-700
                       hover:bg-genesis-50 transition-colors duration-100 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
