export interface ADMETProfile {
  mw?: number
  log_p?: number
  hbd?: number
  hba?: number
  tpsa?: number
  rotatable_bonds?: number
  lipinski_pass: boolean
  qed_score?: number
  has_pains: boolean
  has_alerts: boolean
  synthetic_accessibility?: number
}

export interface ParetoObjectives {
  binding_affinity: number       // 0-1, higher = stronger binder
  selectivity: number            // 0-1, higher = more selective
  bbb_penetration: number        // 0-1, higher = better CNS access
  metabolic_stability: number    // 0-1, higher = more stable
  oral_absorption: number        // 0-1, higher = better bioavailability
  synthetic_accessibility: number // 0-1, higher = easier to synthesize
  pareto_rank: number            // 1 = Pareto front (best)
  weighted_score: number         // Claude-weighted composite 0-1
}

export interface ObjectiveWeights {
  binding_affinity: number
  selectivity: number
  bbb_penetration: number
  metabolic_stability: number
  oral_absorption: number
  synthetic_accessibility: number
  rationale: string
}

export interface ParetoAnalysis {
  weights: ObjectiveWeights
  pareto_front_count: number
  disease_context: string
  is_neurological: boolean
}

export interface Molecule {
  smiles: string
  molecule_id: string
  name?: string
  inchi_key?: string
  admet: ADMETProfile
  pareto_objectives?: ParetoObjectives
  generation_method: string
  rank?: number
  tanimoto_to_known?: number
  nearest_known_drug?: string
}

export interface DockingInteraction {
  residue: string
  interaction_type: string
  distance_angstrom?: number
}

export interface DockingResult {
  molecule: Molecule
  target_uniprot_id: string
  pdb_id: string
  binding_affinity_kcal: number
  rmsd_lb?: number
  rmsd_ub?: number
  pose_file?: string             // filename served by /api/structure/{pose_file}
  protein_structure_file?: string // PDB filename for the receptor
  docking_method: string         // "vina" | "diffdock" | "mock"
  interactions: DockingInteraction[]
  rank: number
  explanation: string
}

export interface Pathway {
  pathway_id: string
  name: string
  database: string
}

export interface PathwayNode {
  id: string
  type: 'driver' | 'protein' | 'compound' | 'outcome' | 'pathway_ref' | 'complex'
}

export interface PathwayEdge {
  source: string
  target: string
  indirect?: boolean
}

export interface PathwayGraph {
  nodes: PathwayNode[]
  edges: PathwayEdge[]
  source?: string        // "kegg" | "reactome"
  pathway_id?: string
  pathway_name?: string
}

export interface Target {
  gene_symbol: string
  protein_name: string
  uniprot_id: string
  pdb_ids: string[]
  preferred_pdb_id?: string
  function_summary: string
  pathways: Pathway[]
  druggability_score: number
  clinical_relevance_score: number
  overall_score: number
  pathway_graph?: PathwayGraph
}

export interface TargetInsight {
  target_gene: string
  mechanism_of_action: string
  pathway_relevance: string
  clinical_context: string
  top_molecules: DockingResult[]
  pathway_graph?: PathwayGraph
}

export interface CryosisReport {
  job_id: string
  disease_query: string
  disease_name: string
  disease_description: string
  mondo_id?: string
  do_id?: string
  affected_genes?: string[]
  executive_summary: string
  targets_analyzed: number
  molecules_generated: number
  molecules_docked: number
  target_insights: TargetInsight[]
  top_candidates: DockingResult[]
  safety_flags: string[]
  limitations: string[]
  methodology_notes: string
  generated_at: string
  pipeline_duration_seconds?: number
  pareto_analysis?: ParetoAnalysis
}

export interface JobStatus {
  job_id: string
  disease_query: string
  stage: PipelineStage
  progress: number
  message: string
  started_at?: string
  updated_at: string
  error?: string
  has_results: boolean
}

export type PipelineStage =
  | 'queued'
  | 'disease_analysis'
  | 'target_discovery'
  | 'molecular_generation'
  | 'docking'
  | 'insight_synthesis'
  | 'completed'
  | 'failed'

export interface SSEUpdate {
  job_id: string
  stage: PipelineStage
  progress: number
  message: string
  error?: string
}
