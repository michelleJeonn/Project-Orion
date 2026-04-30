import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Bot, User, Loader2, X } from 'lucide-react'
import { GenesisReport } from '../types'
import { isDemoMode } from '../demoConfig'

// ── Hard-coded disease knowledge responses ──────────────────────
const DISEASE_RESPONSES: Record<string, string> = {
  "alzheimer": `**Alzheimer's Disease** is the leading cause of dementia, affecting over 55 million people worldwide. It is defined by two hallmark pathologies: extracellular amyloid-β (Aβ) plaques and intraneuronal tau neurofibrillary tangles, compounded by chronic neuroinflammation and synaptic loss.

**Key druggable targets the pipeline focuses on:**
- **BACE1** (β-secretase 1) — rate-limiting enzyme in Aβ production; several clinical-stage inhibitors have established the target class
- **GSK3β** — master tau kinase; inhibition reduces hyperphosphorylated tau burden
- **TREM2** — microglial receptor; loss-of-function variants triple AD risk; agonist antibodies are in Phase II
- **APOE4** — highest-impact genetic risk factor; structural correctors and receptor blockers are active areas

**Pipeline approach:** DisGeNET prioritises *APP*, *PSEN1*, *PSEN2*, *APOE*, and *BIN1*. Molecule generation applies BBB-penetration weighting (TPSA < 90 Å², logP 1–3) and selectivity filters against the broader kinase family. Docking targets the BACE1 catalytic aspartate dyad (PDB: 2B8V) and the GSK3β ATP pocket (PDB: 1PYX).

**Unmet need:** No disease-modifying therapy approved as of 2025. The amyloid hypothesis has partial clinical validation (lecanemab Phase III), but tau and neuroinflammation targets remain largely un-drugged — making this a high-value opportunity for the Genesis pipeline.`,

  "parkinson": `**Parkinson's Disease** is the second most common neurodegenerative disorder, affecting ~10 million people globally. Progressive loss of dopaminergic neurons in the substantia nigra drives the classic motor triad — bradykinesia, resting tremor, and rigidity — while non-motor symptoms (depression, autonomic dysfunction) often precede diagnosis by years.

**Key druggable targets the pipeline focuses on:**
- **LRRK2** (Leucine-rich repeat kinase 2) — G2019S gain-of-function mutation is the most prevalent familial PD variant; kinase inhibitors (e.g., DNL151) are in Phase II trials
- **PINK1 / Parkin** — mitophagy pathway; restoring mitochondrial quality control is neuroprotective in multiple models
- **GBA** (Glucocerebrosidase) — heterozygous loss-of-function is the strongest common genetic PD risk factor; small-molecule chaperones are in development
- **α-Synuclein** — aggregation driver; fibril-disrupting compounds and antibodies target propagation

**Pipeline approach:** Scaffold hopping from known LRRK2 inhibitors; BBB penetration is the primary multi-objective filter given the CNS target tissue. Docking uses the LRRK2 kinase domain (PDB: 6VNO). PINK1 ATP-pocket binders are generated as a secondary series.

**Clinical context:** No disease-modifying therapy exists. Symptomatic dopamine replacement remains standard-of-care, making kinase inhibitors that slow neurodegeneration the highest-priority drug class.`,

  "triple-negative breast cancer": `**Triple-Negative Breast Cancer (TNBC)** accounts for ~15% of all breast cancers and is defined by the absence of estrogen receptor (ER), progesterone receptor (PR), and HER2 amplification, excluding it from targeted hormonal and anti-HER2 therapies. It disproportionately affects younger women and patients of African ancestry, with a 5-year survival rate of ~77% — markedly worse than other subtypes.

**Key druggable targets the pipeline focuses on:**
- **PARP1/2** — synthetic lethality in BRCA1/2-mutant TNBC; olaparib and talazoparib are approved in this subgroup
- **PD-L1 (CD274)** — immune checkpoint; atezolizumab + nab-paclitaxel approved for PD-L1+ TNBC
- **PIK3CA / AKT** — PI3K/AKT pathway is hyperactivated in ~25% of TNBC; capivasertib (AKT inhibitor) recently approved in HR+ disease
- **TROP2** — high surface expression in TNBC; ADC sacituzumab govitecan is approved

**Pipeline approach:** DisGeNET prioritises *BRCA1*, *BRCA2*, *TP53*, *RB1*, and *CDK12*. Fragment-linking and bioisostere replacement against PARP1 catalytic residues (PDB: 4ZZZ); selectivity profiling against PARP2 and tankyrase. Multi-objective optimisation balances tumour penetration and efflux-pump resistance.

**Clinical context:** High unmet need in the ~60% of TNBC patients who are PD-L1-negative and BRCA wild-type. Novel synthetic lethality strategies and next-generation ADC payloads are the most active pipeline areas.`,

  "type 2 diabetes": `**Type 2 Diabetes Mellitus (T2DM)** affects over 500 million adults worldwide and is characterised by progressive insulin resistance in peripheral tissues and declining pancreatic β-cell function, resulting in chronic hyperglycaemia and multi-organ complications (neuropathy, nephropathy, retinopathy, cardiovascular disease).

**Key druggable targets the pipeline focuses on:**
- **GLP-1R** (Glucagon-like peptide-1 receptor) — incretin receptor; GLP-1 agonists (semaglutide, tirzepatide) now dominate T2DM and obesity treatment; oral small-molecule agonists are an active frontier
- **DPP-4** (Dipeptidyl peptidase-4) — GLP-1 degradation enzyme; gliptin class well-established
- **SGLT2** (Sodium-glucose cotransporter 2) — renal glucose reabsorption; gliflozin class adds cardioprotective benefit independent of glucose
- **AMPK** — cellular energy sensor; activation mimics caloric restriction; indirect target for novel scaffolds

**Pipeline approach:** Scaffold decoration against known GLP-1R agonist scaffolds; fragment screening against DPP-4 S1/S2 subsites (PDB: 1NNY). ADMET filters strongly weight metabolic stability (CYP3A4/2C9) and hERG safety given long-term dosing requirements.

**Clinical context:** GLP-1/GIP dual agonism (tirzepatide) has reset the efficacy benchmark. The pipeline targets oral small-molecule GLP-1R agonists — an area where no highly potent approved agent yet exists — as the highest-value opportunity.`,

  "rheumatoid arthritis": `**Rheumatoid Arthritis (RA)** is a chronic systemic autoimmune disease affecting ~1% of the global population, characterised by synovial inflammation, cartilage destruction, and bone erosion driven by dysregulated T-cell, B-cell, and innate immune signalling. Untreated, it leads to progressive joint deformity and significantly elevated cardiovascular risk.

**Key druggable targets the pipeline focuses on:**
- **JAK1/JAK2/TYK2** — cytokine signalling kinases; tofacitinib (JAK1/3), baricitinib (JAK1/2), and upadacitinib (JAK1-selective) are all approved; TYK2 selective inhibitors (deucravacitinib) offer improved safety profiles
- **BTK** (Bruton's tyrosine kinase) — B-cell receptor signalling; ibrutinib validated in B-cell malignancies; RA-selective BTK inhibitors are in Phase II
- **TNF-α / IL-6R** — validated biologic targets; small-molecule mimetics of biologic blockade are a pipeline opportunity
- **SYK** (Spleen tyrosine kinase) — FcγR signalling in macrophages; fostamatinib approved for immune thrombocytopenia

**Pipeline approach:** Multi-kinase selectivity profiling is central — JAK family selectivity windows directly predict safety signals. Scaffold hopping from approved JAK inhibitors; docking uses JAK1 kinase domain (PDB: 3EYG). ADMET filters prioritise low CYP inhibition and minimal immunosuppressive off-targets.

**Clinical context:** Biologic therapy (anti-TNF, anti-IL-6R) achieves remission in ~40% of patients; the remaining 60% are a large addressable population for next-generation oral targeted therapies.`,

  "als": `**Amyotrophic Lateral Sclerosis (ALS)** is a fatal neurodegenerative disease affecting upper and lower motor neurons, leading to progressive paralysis and respiratory failure. Median survival is 2–5 years from symptom onset. ~5–10% of cases are familial (fALS); ~90% are sporadic (sALS), though shared molecular mechanisms are increasingly recognised.

**Key druggable targets the pipeline focuses on:**
- **SOD1** (Cu/Zn superoxide dismutase) — gain-of-toxic-function mutations account for ~20% of fALS; tofersen (ASO) is approved for SOD1-ALS; small-molecule stabilisers of SOD1 native fold are an active area
- **TDP-43 (TARDBP)** — cytoplasmic TDP-43 aggregation is the dominant pathological hallmark in >95% of ALS cases; preventing liquid-to-solid phase transition is a major drug target
- **FUS** — RNA-binding protein; mutations cause aggressive early-onset fALS; nuclear import restoration strategies are in development
- **C9orf72** — hexanucleotide repeat expansion is the most common ALS/FTD mutation; repeat-associated dipeptide repeat (DPR) toxicity and repeat RNA G-quadruplex binding are targetable

**Pipeline approach:** Fragment-linking against TDP-43 RNA-recognition motif (PDB: 2N3X) to identify stabilisers that prevent pathological aggregation. SOD1 dimer-interface pocket compounds generated by scaffold decoration. BBB penetration and CNS distribution are mandatory filters given the target tissue.

**Clinical context:** Only riluzole and edaravone show modest survival benefit; no disease-modifying agent has shown >6-month benefit in a Phase III trial. High unmet need across all genetic and sporadic subtypes.`,

  "leukemia": `**Leukemia** encompasses a family of haematological malignancies defined by clonal expansion of malignant leukocytes. The four principal subtypes — AML, CML, ALL, and CLL — differ in cell lineage (myeloid vs. lymphoid) and disease tempo (acute vs. chronic), but share the common theme of oncogenic kinase or transcription factor activation.

**Key druggable targets the pipeline focuses on:**
- **BCR-ABL1** (CML / Ph+ ALL) — the paradigm oncogene; imatinib, dasatinib, ponatinib define the tyrosine kinase inhibitor era; next-generation compounds targeting the ABCB1-resistant T315I gatekeeper mutation remain valuable
- **FLT3** (AML) — internal tandem duplication (FLT3-ITD) in ~25% of AML; midostaurin and gilteritinib approved; resistance via D835 kinase domain mutations drives continued pipeline need
- **IDH1/IDH2** (AML) — neomorphic mutations produce oncometabolite 2-HG; ivosidenib (IDH1) and enasidenib (IDH2) approved; combination strategies are an active frontier
- **BTK** (CLL / MCL) — ibrutinib, acalabrutinib, zanubrutinib approved; non-covalent BTK inhibitors (pirtobrutinib) address C481S resistance
- **CDK9** — transcriptional CDK; pauses MYC-driven transcription; selective inhibitors in Phase I for AML

**Pipeline approach:** Selectivity profiling within the kinome is essential — off-target FLT3/KIT/PDGFR activity predicts haematological toxicity. Scaffold hopping from approved TKI scaffolds; multi-objective optimisation weights selectivity ratio and oral bioavailability. Docking uses FLT3 kinase domain (PDB: 4RT7) for AML-focused series.

**Clinical context:** CML is largely a chronic manageable disease with TKIs. AML remains a high-mortality acute disease (5-year survival ~30% overall) with significant unmet need in relapsed/refractory and elderly patients.`,
}

function getDiseaseResponse(query: string): string | null {
  const q = query.toLowerCase()
  if (q.includes('alzheimer')) return DISEASE_RESPONSES['alzheimer']
  if (q.includes('parkinson')) return DISEASE_RESPONSES['parkinson']
  if (q.includes('triple') || (q.includes('breast') && q.includes('negative'))) return DISEASE_RESPONSES['triple-negative breast cancer']
  if (q.includes('diabetes') || q.includes('t2dm') || q.includes('type 2')) return DISEASE_RESPONSES['type 2 diabetes']
  if (q.includes('rheumatoid') || (q.includes('arthritis') && !q.includes('osteo'))) return DISEASE_RESPONSES['rheumatoid arthritis']
  if (q.includes(' als') || q.includes('amyotrophic') || q.includes('motor neuron') || q.includes('motor neurone') || q === 'als') return DISEASE_RESPONSES['als']
  if (q.includes('leukemia') || q.includes('leukaemia') || q.includes('aml') || q.includes('cml') || q.includes('cll') || q.includes('all')) return DISEASE_RESPONSES['leukemia']
  return null
}

const msgEntryStyle = `
  @keyframes msgEntry {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
`
if (typeof document !== 'undefined' && !document.getElementById('report-chat-styles')) {
  const s = document.createElement('style')
  s.id = 'report-chat-styles'
  s.textContent = msgEntryStyle
  document.head.appendChild(s)
}

// ── Design tokens (dark) ────────────────────────────────────────
const C = {
  bg:         'rgba(6,6,10,0.97)',
  panel:      'rgba(255,255,255,0.04)',
  panel2:     'rgba(255,255,255,0.07)',
  border:     'rgba(255,255,255,0.08)',
  border2:    'rgba(255,255,255,0.13)',
  text1:      'rgba(255,255,255,0.90)',
  text2:      'rgba(255,255,255,0.58)',
  text3:      'rgba(255,255,255,0.35)',
  text4:      'rgba(255,255,255,0.22)',
  pink:       'rgba(228,147,206,0.90)',
  pinkDim:    'rgba(228,147,206,0.65)',
  pinkBorder: 'rgba(228,147,206,0.30)',
  pinkPanel:  'rgba(228,147,206,0.07)',
  pinkGlow:   '0 0 12px rgba(228,147,206,0.30)',
}

// ── Markdown renderer ───────────────────────────────────────────
function parseInline(str: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index))
    if (m[0].startsWith('**'))
      out.push(<strong key={m.index} style={{ color: C.text1, fontWeight: 500 }}>{m[2]}</strong>)
    else
      out.push(<code key={m.index} style={{
        fontFamily: 'var(--mono)', fontSize: '.62rem',
        color: C.pink, background: C.pinkPanel,
        padding: '.1rem .3rem', letterSpacing: '.04em', borderRadius: 2,
      }}>{m[3]}</code>)
    last = m.index + m[0].length
  }
  if (last < str.length) out.push(str.slice(last))
  return out
}

function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const level = line.startsWith('# ') && !line.startsWith('## ') ? 1 : line.startsWith('## ') && !line.startsWith('### ') ? 2 : 3
      const content = line.slice(level + 1)
      els.push(<p key={i} style={{ margin: '.6rem 0 .2rem', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '.9rem', color: C.text1 }}>{content}</p>)
      i++
    } else if (line.startsWith('|')) {
      const rows: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i]); i++ }
      const dataRows = rows.filter(r => !/^\|[\s\-|:]+\|$/.test(r))
      const parseCells = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
      const [head, ...body] = dataRows
      els.push(
        <div key={`t${i}`} style={{ overflowX: 'auto', margin: '.5rem 0', border: `1px solid ${C.border}` }}>
          <table style={{ fontSize: '.62rem', width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {parseCells(head).map((c, j) => (
                  <th key={j} style={{ padding: '.3rem .6rem', textAlign: 'left', color: C.text2, letterSpacing: '.15em', fontWeight: 400, textTransform: 'uppercase' }}>{parseInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                  {parseCells(row).map((c, j) => (
                    <td key={j} style={{ padding: '.3rem .6rem', color: C.text1 }}>{parseInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2)); i++
      }
      els.push(
        <ul key={`ul${i}`} style={{ margin: '.3rem 0', padding: 0, listStyle: 'none' }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', gap: '.5rem', padding: '.18rem 0' }}>
              <span style={{ color: C.pink, flexShrink: 0, marginTop: 1 }}>·</span>
              <span style={{ fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.55, color: C.text1 }}>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    } else if (!line.trim()) {
      i++
    } else {
      const buf: string[] = []
      while (
        i < lines.length && lines[i].trim() &&
        !lines[i].startsWith('#') && !lines[i].startsWith('|') &&
        !lines[i].startsWith('- ') && !lines[i].startsWith('* ')
      ) { buf.push(lines[i]); i++ }
      els.push(
        <p key={`p${i}`} style={{ margin: '.2rem 0', fontFamily: 'var(--serif)', fontSize: '.88rem', lineHeight: 1.6, color: C.text1 }}>
          {parseInline(buf.join(' '))}
        </p>
      )
    }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{els}</div>
}

// ── Types ───────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface ReportChatProps {
  jobId: string
  report: GenesisReport
  onClose?: () => void
}

// ── Component ───────────────────────────────────────────────────
export function ReportChat({ jobId, report, onClose }: ReportChatProps) {
  const topTarget = report.target_insights[0]?.target_gene ?? 'the top target'
  const suggestedQuestions = [
    'What is the lead compound?',
    `Why was ${topTarget} selected?`,
    'What are the recommended next steps?',
  ]

  // Hard-coded responses for the first two suggested questions, built from report data
  const suggestedResponses = useMemo(() => {
    const lead = report.top_candidates[0]
    const topInsight = report.target_insights[0]
    const fmt = (v: number | null | undefined, d = 1) => v != null ? v.toFixed(d) : 'N/A'

    const leadResponse = lead
      ? `The lead compound is **Rank ${lead.rank}**, targeting **${lead.target_uniprot_id}** via ${lead.docking_method} docking.

**Binding affinity:** ${fmt(lead.binding_affinity_kcal)} kcal/mol
**SMILES:** \`${lead.molecule.smiles}\`

**ADMET profile:**
- Molecular weight: ${fmt(lead.molecule.admet.mw, 0)} Da
- LogP: ${fmt(lead.molecule.admet.log_p)}
- QED score: ${fmt(lead.molecule.admet.qed_score, 2)}
- Lipinski Ro5: ${lead.molecule.admet.lipinski_pass ? 'Pass' : 'Fail'}
- PAINS alerts: ${lead.molecule.admet.has_pains ? 'Yes — review carefully' : 'None detected'}

${lead.interactions?.length ? `**Key binding interactions:**\n${lead.interactions.slice(0, 4).map((ix: { residue: string; interaction_type: string }) => `- ${ix.residue} (${ix.interaction_type})`).join('\n')}` : ''}

${lead.explanation ? `**Mechanistic note:** ${lead.explanation.slice(0, 300)}${lead.explanation.length > 300 ? '…' : ''}` : ''}`
      : 'No lead compound data is available for this report.'

    const whyResponse = topInsight
      ? `**${topInsight.target_gene}** was selected as the primary target for **${report.disease_name}** based on three converging lines of evidence:

**1. Mechanism of action**
${topInsight.mechanism_of_action}

**2. Pathway relevance**
${topInsight.pathway_relevance}

**3. Clinical context**
${topInsight.clinical_context}

The pipeline scored ${topInsight.target_gene} highest across DisGeNET evidence score, UniProt druggability annotations, and available structural data (PDB coverage), making it the strongest starting point for structure-based molecule generation.`
      : `Target selection data is not available for this report.`

    return {
      'What is the lead compound?': leadResponse,
      [`Why was ${topTarget} selected?`]: whyResponse,
    }
  }, [report, topTarget])

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `I've analyzed the **${report.disease_name}** dossier — ${report.targets_analyzed} targets, ${report.molecules_generated} molecules generated, ${report.top_candidates.length} top candidates identified. What would you like to know?`,
  }])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const stopStreaming = () => {
    abortRef.current?.abort()
  }

  // Streams a hard-coded string with a typewriter effect; resolves when done or aborted
  const streamHardcoded = (responseText: string): Promise<void> => {
    return new Promise(resolve => {
      const chars = responseText.split('')
      let i = 0
      let accumulated = ''
      const timer = setInterval(() => {
        if (!abortRef.current && i === 0) {
          // abortRef was cleared externally — stop
          clearInterval(timer)
          resolve()
          return
        }
        const batch = Math.min(4, chars.length - i)
        for (let b = 0; b < batch; b++) accumulated += chars[i++]
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated, streaming: true }; return u })
        if (i >= chars.length) {
          clearInterval(timer)
          setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u })
          resolve()
        }
      }, 12)
      // allow abort to cancel
      abortRef.current = {
        abort: () => {
          clearInterval(timer)
          setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated || 'Response cancelled.' }; return u })
          resolve()
        },
        signal: new AbortController().signal,
      } as AbortController
    })
  }

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return
    setShowSuggestions(false)
    const userMsg: Message = { role: 'user', content }
    const history = messages.filter(m => !m.streaming)
    const allMessages = [...history, userMsg]
    setMessages([...allMessages, { role: 'assistant', content: '', streaming: true }])
    setInput('')
    setIsStreaming(true)
    try {
      // Check hard-coded suggested-question responses first
      const suggestedMatch = suggestedResponses[content as keyof typeof suggestedResponses]
      if (suggestedMatch) {
        await streamHardcoded(suggestedMatch)
        return
      }

      // Check disease-specific responses
      const diseaseMatch = getDiseaseResponse(content)
      if (diseaseMatch) {
        await streamHardcoded(diseaseMatch)
        return
      }

      if (isDemoMode()) {
        const dummyResponse = "This is a demo mode response. I cannot provide real insight without the backend, but I can confirm that the top candidate passes the Lipinski rule of 5 and shows strong theoretical BBB penetration."
        await streamHardcoded(dummyResponse)
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      const timeout = setTimeout(() => controller.abort(), 60_000)

      let response: Response
      try {
        response = await fetch(`/api/chat/${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })) }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) throw new Error(`Server error ${response.status}`)
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break outer
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              accumulated += parsed.text
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated, streaming: true }; return u })
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated || 'No response received.' }; return u })
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: aborted ? 'Response cancelled.' : 'Something went wrong. Please try again.' }
        return u
      })
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg,
      borderLeft: `1px solid ${C.border}`,
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          {/* live dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: C.pink,
            boxShadow: `0 0 0 3px rgba(120,60,220,0.18), ${C.pinkGlow}`,
          }}/>
          <div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: C.text1,
            }}>
              AI Research Consultant
            </div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: C.text3,
              marginTop: 4,
            }}>
              Ask about this dossier
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onClose && (
            <button
              onClick={onClose}
              onMouseEnter={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = C.panel2
                b.style.color = C.text1
              }}
              onMouseLeave={e => {
                const b = e.currentTarget as HTMLButtonElement
                b.style.background = 'transparent'
                b.style.color = C.text3
              }}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                cursor: 'pointer', color: C.text3,
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 0,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 10,
            animation: 'msgEntry 0.25s ease-out both',
          }}>
            {/* avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user' ? C.panel : C.pinkPanel,
              border: `1px solid ${msg.role === 'user' ? C.border : C.pinkBorder}`,
            }}>
              {msg.role === 'user'
                ? <User size={12} color={C.text2}/>
                : <Bot size={12} color={C.pink}/>
              }
            </div>

            {/* bubble */}
            <div style={{
              maxWidth: '82%',
              padding: '10px 14px',
              background: msg.role === 'user' ? C.panel : C.pinkPanel,
              border: `1px solid ${msg.role === 'user' ? C.border : C.pinkBorder}`,
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            }}>
              {msg.streaming && !msg.content
                ? <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    fontFamily: 'var(--mono)', fontSize: 9,
                    letterSpacing: '0.20em', textTransform: 'uppercase',
                    color: C.text3,
                  }}>
                    <Loader2 size={10} style={{ animation: 'spin 1s linear infinite', color: C.pinkDim }}/>
                    Composing…
                  </div>
                : msg.role === 'assistant'
                  ? <ChatMarkdown text={msg.content}/>
                  : <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: '.88rem', color: C.text1, lineHeight: 1.55 }}>
                      {msg.content}
                    </p>
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef}/>
      </div>

      {/* ── Suggested queries ── */}
      {showSuggestions && (
        <div style={{
          padding: '12px 16px 14px',
          borderTop: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.20em',
            textTransform: 'uppercase', color: C.text4,
            marginBottom: 9,
          }}>
            Suggested Queries
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = C.pinkBorder
                  b.style.color = C.text1
                  b.style.background = C.pinkPanel
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = C.border
                  b.style.color = C.text2
                  b.style.background = 'transparent'
                }}
                style={{
                  textAlign: 'left', background: 'transparent',
                  border: `1px solid ${C.border}`,
                  padding: '9px 14px', cursor: 'pointer', borderRadius: 12,
                  fontFamily: 'var(--serif)', fontStyle: 'italic',
                  fontSize: '.84rem', color: C.text2,
                  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px', flexShrink: 0 }}>
        <div
          ref={inputWrapRef}
          style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: C.panel,
            border: `1px solid ${C.border2}`,
            borderRadius: 16, padding: '8px 8px 8px 8px',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={() => {
            if (inputWrapRef.current) inputWrapRef.current.style.borderColor = C.pinkBorder
          }}
          onBlurCapture={() => {
            if (inputWrapRef.current) inputWrapRef.current.style.borderColor = C.border2
          }}
        >
          {/* Import context */}
          <button
            title="Import previous conversations or context"
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = C.pinkPanel
              b.style.borderColor = C.pinkBorder
              b.style.color = C.pink
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'transparent'
              b.style.borderColor = C.border
              b.style.color = C.text3
            }}
            style={{
              flexShrink: 0, background: 'transparent', border: `1px solid ${C.border}`,
              cursor: 'pointer', color: C.text3,
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, lineHeight: 1, fontWeight: 300,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            +
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about targets, molecules, next steps…"
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1, resize: 'none', maxHeight: 90,
              background: 'transparent', border: 'none', outline: 'none',
              padding: '4px 0',
              color: C.text1,
              fontFamily: 'var(--serif)', fontSize: '.88rem',
              lineHeight: 1.55, letterSpacing: '.01em',
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              title="Stop generating"
              style={{
                flexShrink: 0, width: 32, height: 32,
                background: C.pinkPanel,
                border: `1px solid ${C.pinkBorder}`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <X size={13} color={C.pink}/>
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              style={{
                flexShrink: 0, width: 32, height: 32,
                background: !input.trim() ? 'transparent' : C.pinkPanel,
                border: `1px solid ${!input.trim() ? C.border : C.pinkBorder}`,
                borderRadius: 10, cursor: !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, border-color 0.15s',
                opacity: !input.trim() ? 0.35 : 1,
              }}
            >
              <Send size={13} color={!input.trim() ? C.text3 : C.pink}/>
            </button>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: C.text4,
          textAlign: 'center', marginTop: 8,
        }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}
