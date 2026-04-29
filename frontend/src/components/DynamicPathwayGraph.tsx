import { useMemo } from 'react'
import { PathwayGraph, PathwayNode, PathwayEdge } from '../types'

// ── Color palette ─────────────────────────────────────────────────
const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  driver:      { fill: 'rgba(215,139,255,0.18)', stroke: '#D78BFF' },
  protein:     { fill: 'rgba(96,165,250,0.14)',  stroke: '#60A5FA' },
  outcome:     { fill: 'rgba(52,211,153,0.14)',  stroke: '#34D399' },
  compound:    { fill: 'rgba(251,191,36,0.14)',  stroke: '#FBBF24' },
  complex:     { fill: 'rgba(45,212,191,0.14)',  stroke: '#2DD4BF' },
  pathway_ref: { fill: 'rgba(148,163,184,0.08)', stroke: '#475569' },
}

function nodeColors(type: string) {
  return NODE_COLORS[type] ?? NODE_COLORS.protein
}

// ── Layout ────────────────────────────────────────────────────────

const SVG_W = 660
const SVG_H = 280
const NODE_R = 14
const DRIVER_R = 17
const MIN_X_GAP = 80
const MIN_Y_GAP = 44

interface Pos { x: number; y: number }

function computeLayout(nodes: PathwayNode[], edges: PathwayEdge[], svgW: number, svgH: number): Map<string, Pos> {
  if (nodes.length === 0) return new Map()

  // Build adjacency + in-degree
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]))
  const outAdj = new Map<string, string[]>(nodes.map(n => [n.id, []]))

  for (const e of edges) {
    if (inDegree.has(e.source) && inDegree.has(e.target)) {
      outAdj.get(e.source)!.push(e.target)
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
  }

  // BFS level assignment from roots
  const level = new Map<string, number>()
  const roots = nodes.filter(n => inDegree.get(n.id) === 0)
  const starts = roots.length > 0 ? roots : [nodes[0]]

  const queue: string[] = starts.map(n => n.id)
  for (const id of queue) level.set(id, 0)

  let qi = 0
  while (qi < queue.length) {
    const curr = queue[qi++]
    const currLvl = level.get(curr) ?? 0
    for (const nb of outAdj.get(curr) ?? []) {
      if (!level.has(nb)) {
        level.set(nb, currLvl + 1)
        queue.push(nb)
      }
    }
  }
  // Nodes unreachable from roots get level 0
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, 0)
  }

  // Group by level
  const byLevel = new Map<number, string[]>()
  for (const [id, lvl] of level) {
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(id)
  }

  const maxLevel = Math.max(...byLevel.keys())
  const numLevels = maxLevel + 1

  // x positions: spread levels evenly across SVG_W with padding
  const padX = 44
  const xStep = numLevels > 1 ? (svgW - 2 * padX) / (numLevels - 1) : 0

  const positions = new Map<string, Pos>()
  for (const [lvl, ids] of byLevel) {
    const x = padX + lvl * xStep
    const count = ids.length
    const totalH = (count - 1) * MIN_Y_GAP
    const startY = svgH / 2 - totalH / 2
    ids.forEach((id, i) => {
      positions.set(id, { x, y: startY + i * MIN_Y_GAP })
    })
  }

  return positions
}

// ── Edge path ─────────────────────────────────────────────────────

function edgePath(src: Pos, tgt: Pos, srcR: number, tgtR: number): string {
  const x1 = src.x + srcR
  const y1 = src.y
  const x2 = tgt.x - tgtR
  const y2 = tgt.y
  const cx = (x1 + x2) / 2
  return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`
}

// ── Component ─────────────────────────────────────────────────────

interface Props {
  graph: PathwayGraph
  focalGene?: string
}

export function DynamicPathwayGraph({ graph, focalGene }: Props) {
  const { nodes, edges } = graph

  const maxNodesInColumn = useMemo(() => {
    if (nodes.length === 0) return 0
    const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]))
    const outAdj = new Map<string, string[]>(nodes.map(n => [n.id, []]))
    for (const e of edges) {
      if (inDegree.has(e.source) && inDegree.has(e.target)) {
        outAdj.get(e.source)!.push(e.target)
        inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
      }
    }
    const level = new Map<string, number>()
    const roots = nodes.filter(n => inDegree.get(n.id) === 0)
    const starts = roots.length > 0 ? roots : [nodes[0]]
    const queue: string[] = starts.map(n => n.id)
    for (const id of queue) level.set(id, 0)
    let qi = 0
    while (qi < queue.length) {
      const curr = queue[qi++]
      const currLvl = level.get(curr) ?? 0
      for (const nb of outAdj.get(curr) ?? []) {
        if (!level.has(nb)) {
          level.set(nb, currLvl + 1)
          queue.push(nb)
        }
      }
    }
    for (const n of nodes) if (!level.has(n.id)) level.set(n.id, 0)
    const counts = new Map<number, number>()
    for (const [, lvl] of level) counts.set(lvl, (counts.get(lvl) ?? 0) + 1)
    return Math.max(...counts.values())
  }, [nodes, edges])

  const svgHeight = useMemo(() => {
    const verticalPadding = 56
    const required = maxNodesInColumn > 0
      ? verticalPadding + (maxNodesInColumn - 1) * MIN_Y_GAP + (DRIVER_R + 20)
      : SVG_H
    return Math.max(SVG_H, required)
  }, [maxNodesInColumn])

  const positions = useMemo(() => computeLayout(nodes, edges, SVG_W, svgHeight), [nodes, edges, svgHeight])

  // Deduplicate rendered nodes (KGML can have label collisions)
  const renderedNodes = useMemo(() => {
    const seen = new Set<string>()
    return nodes.filter(n => {
      if (seen.has(n.id)) return false
      seen.add(n.id)
      return true
    })
  }, [nodes])

  if (nodes.length === 0) return null

  const sourceLabel = graph.source === 'reactome' ? 'Reactome' : 'KEGG'
  const pathwayLabel = graph.pathway_name ?? graph.pathway_id ?? ''

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
          {sourceLabel} · {nodes.length} nodes · {edges.length} edges
        </span>
        {pathwayLabel && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.2)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pathwayLabel}
          </span>
        )}
      </div>

      {/* SVG graph */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${svgHeight}`}
          style={{ width: '100%', height: `${svgHeight}px`, display: 'block' }}
          preserveAspectRatio="xMidYMin meet"
        >
          <defs>
            <marker id="dpg-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L5.5,3 z" fill="rgba(255,255,255,0.30)" />
            </marker>
            <marker id="dpg-arr-dashed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L5.5,3 z" fill="rgba(255,255,255,0.16)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const src = positions.get(e.source)
            const tgt = positions.get(e.target)
            if (!src || !tgt) return null
            const srcNode = nodes.find(n => n.id === e.source)
            const tgtNode = nodes.find(n => n.id === e.target)
            const srcR = srcNode?.type === 'driver' || srcNode?.type === 'outcome' ? DRIVER_R : NODE_R
            const tgtR = tgtNode?.type === 'driver' || tgtNode?.type === 'outcome' ? DRIVER_R : NODE_R
            const d = edgePath(src, tgt, srcR, tgtR)
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={e.indirect ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)'}
                strokeWidth={1}
                strokeDasharray={e.indirect ? '4 3' : undefined}
                markerEnd={e.indirect ? 'url(#dpg-arr-dashed)' : 'url(#dpg-arr)'}
              />
            )
          })}

          {/* Nodes */}
          {renderedNodes.map(node => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const r = node.type === 'driver' || node.type === 'outcome' ? DRIVER_R : NODE_R
            const { fill, stroke } = nodeColors(node.type)
            // Truncate long labels
            const label = node.id.length > 10 ? node.id.slice(0, 9) + '…' : node.id
            const isFocal = focalGene && node.id.toUpperCase() === focalGene.toUpperCase()
            return (
              <g key={node.id}>
                {isFocal && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r + 4}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={0.75}
                    strokeDasharray="3 2"
                    opacity={0.5}
                  />
                )}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={node.type === 'driver' ? 1.5 : 1}
                />
                <text
                  x={pos.x}
                  y={pos.y + r + 11}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fill="rgba(255,255,255,0.55)"
                  letterSpacing="0.04em"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem', flexShrink: 0 }}>
        {[
          { type: 'driver',  label: 'Driver' },
          { type: 'protein', label: 'Protein' },
          { type: 'outcome', label: 'Outcome' },
          { type: 'compound', label: 'Compound' },
        ].map(({ type, label }) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: nodeColors(type).stroke, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>
              {label}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <svg width="18" height="6" style={{ flexShrink: 0 }}>
            <line x1="0" y1="3" x2="14" y2="3" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="4 3" />
          </svg>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}>
            Indirect
          </span>
        </div>
      </div>
    </div>
  )
}
