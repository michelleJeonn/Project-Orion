import { CryosisReport } from './types'

export const mockCryosisReport: CryosisReport = {
  job_id: 'demo-job-123',
  disease_query: "Parkinson's disease",
  disease_name: "Parkinson's Disease (PD)",
  disease_description: "A progressive neurodegenerative disorder characterized by the loss of dopaminergic neurons in the substantia nigra, leading to motor symptoms such as bradykinesia, resting tremor, rigidity, and postural instability.",
  mondo_id: "MONDO:0005180",
  do_id: "DOID:14330",
  affected_genes: ["LRRK2", "SNCA", "PARK7", "PINK1", "PRKN", "GBA", "VPS35", "ATP13A2", "FBXO7", "PLA2G6"],
  executive_summary: "Parkinson's Disease remains one of the most challenging neurodegenerative disorders, affecting over 10 million people worldwide with no disease-modifying therapy currently approved. The progressive loss of dopaminergic neurons in the substantia nigra drives irreversible motor decline, creating a substantial unmet medical need for targeted kinase inhibitors capable of crossing the blood-brain barrier.\n\nThe Genesis pipeline identified LRRK2 as the primary druggable target, supported by strong genetic validation — G2019S gain-of-function mutations account for the most common inherited form of PD. Secondary targets PINK1 and GBA were selected for their roles in mitochondrial quality control and lysosomal function respectively, both converging on alpha-synuclein clearance pathways.\n\n50 candidate molecules were generated using structure-based scaffold hopping against the LRRK2 kinase domain (PDB: 6VNO). BBB penetration was heavily weighted in the multi-objective Pareto optimization given the CNS target, alongside metabolic stability and selectivity against the broader kinase family.\n\nThe top candidate (ΔG = −10.5 kcal/mol) forms a critical hydrogen bond with hinge residue Met1949 and achieves a predicted QED of 0.81 with full Lipinski compliance. Two additional Pareto-front molecules show complementary selectivity profiles suitable for analog series development.\n\nRecommended next steps include in vitro LRRK2 kinase inhibition assays (IC₅₀), Caco-2 permeability screening for BBB validation, and CYP450 metabolic stability profiling. Lead optimization should focus on improving selectivity against LRRK1 and reducing predicted hERG liability in the top scaffold.",
  targets_analyzed: 5,
  molecules_generated: 50,
  molecules_docked: 50,
  target_insights: [
    {
      target_gene: "LRRK2",
      mechanism_of_action: "Inhibition of LRRK2 kinase activity to prevent excessive phosphorylation of Rab GTPases, thereby restoring lysosomal function and reducing alpha-synuclein aggregation.",
      pathway_relevance: "Autophagy-lysosomal pathway; intimately linked to vesicular trafficking.",
      clinical_context: "LRRK2 mutations (e.g., G2019S) are the most common cause of familial PD. LRRK2 inhibitors are currently in clinical trials (e.g., DNL151).",
      top_molecules: [
        {
          molecule: {
            smiles: "Cc1nc(Nc2ncc(C(F)(F)F)cc2OC)cc(N2CCN(C)CC2)n1",
            molecule_id: "mol_001_1",
            name: "Demo_LRRK2_Inhibitor_1",
            inchi_key: "KVDXXXXXX",
            generation_method: "scaffold_hopping",
            rank: 1,
            tanimoto_to_known: 0.65,
            admet: {
              mw: 425.2,
              log_p: 3.1,
              hbd: 1,
              hba: 6,
              tpsa: 85.4,
              rotatable_bonds: 5,
              lipinski_pass: true,
              has_pains: false,
              has_alerts: false
            },
            pareto_objectives: {
              binding_affinity: 0.92,
              selectivity: 0.88,
              bbb_penetration: 0.85,
              metabolic_stability: 0.75,
              oral_absorption: 0.80,
              synthetic_accessibility: 0.90,
              pareto_rank: 1,
              weighted_score: 0.87
            }
          },
          target_uniprot_id: "Q5S007",
          pdb_id: "6VNO",
          binding_affinity_kcal: -10.5,
          docking_method: "mock",
          rank: 1,
          interactions: [
            { residue: "Met1949", interaction_type: "Hydrogen Bond" },
            { residue: "Ala1950", interaction_type: "Hydrophobic" }
          ],
          explanation: "Strong hydrogen bonding with hinge region residue Met1949."
        }
      ],
      pathway_graph: {
        nodes: [
          { id: "LRRK2",  type: "driver"  },
          { id: "RAB8A",  type: "protein" },
          { id: "RAB10",  type: "protein" },
          { id: "RAB35",  type: "protein" },
          { id: "PINK1",  type: "protein" },
          { id: "PRKN",   type: "protein" },
          { id: "ULK1",   type: "protein" },
          { id: "BECN1",  type: "protein" },
          { id: "VPS35",  type: "protein" },
          { id: "SNCA",   type: "protein" },
          { id: "Dopamine", type: "compound" },
          { id: "Autophagy", type: "outcome" },
          { id: "Neurodegeneration", type: "outcome" }
        ],
        edges: [
          { source: "LRRK2",  target: "RAB8A",           indirect: false },
          { source: "LRRK2",  target: "RAB10",           indirect: false },
          { source: "LRRK2",  target: "RAB35",           indirect: false },
          { source: "LRRK2",  target: "VPS35",           indirect: false },
          { source: "PINK1",  target: "PRKN",            indirect: false },
          { source: "PRKN",   target: "SNCA",            indirect: true  },
          { source: "RAB8A",  target: "Autophagy",       indirect: false },
          { source: "RAB10",  target: "Autophagy",       indirect: false },
          { source: "ULK1",   target: "BECN1",           indirect: false },
          { source: "BECN1",  target: "Autophagy",       indirect: false },
          { source: "Autophagy", target: "SNCA",         indirect: true  },
          { source: "SNCA",   target: "Neurodegeneration", indirect: false },
          { source: "LRRK2",  target: "Neurodegeneration", indirect: true },
          { source: "Dopamine", target: "Neurodegeneration", indirect: true }
        ],
        source: "kegg",
        pathway_id: "hsa05012",
        pathway_name: "Parkinson disease"
      }
    }
  ],
  top_candidates: [],
  safety_flags: [
    "Potential for off-target kinase inhibition due to structural similarity to other kinases.",
    "Monitor for CNS toxicity."
  ],
  limitations: [
    "Generated poses require molecular dynamics (MD) validation.",
    "BBB penetrance models are predictive only."
  ],
  methodology_notes: "Used AlphaFold models where high-resolution PDBs were unavailable. Docking performed with AutoDock Vina.",
  generated_at: new Date().toISOString(),
  pipeline_duration_seconds: 45,
  pareto_analysis: {
    weights: {
      binding_affinity: 0.4,
      selectivity: 0.2,
      bbb_penetration: 0.2,
      metabolic_stability: 0.1,
      oral_absorption: 0.05,
      synthetic_accessibility: 0.05,
      rationale: "BBB penetration is critical for PD."
    },
    pareto_front_count: 5,
    disease_context: "Neurological disorder requiring high BBB penetration.",
    is_neurological: true
  }
}
mockCryosisReport.top_candidates = mockCryosisReport.target_insights[0].top_molecules;

export const DEMO_JOB_ID = 'demo-job-123';
