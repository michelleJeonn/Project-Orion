const { useState: useStateJob, useEffect: useEffectJob, useRef: useRefJob } = React;

const STAGES = [
  { key:'disease_analysis',     n:'I',   label:'Disease Analysis',     desc:'Parsing query Â· surveying literature', src:'CLAUDE Â· PUBMED',
    lines:[
      'Resolving ICD ontology Â· mapping synonyms',
      'Fetching PubMed abstracts (1,248 hits)',
      'Cross-referencing OMIM Â· DisGeNET',
    ]},
  { key:'target_discovery',     n:'II',  label:'Target Discovery',     desc:'Finding druggable proteins',           src:'DISGENET Â· UNIPROT Â· RCSB',
    lines:[
      'Ranking 1,248 candidate proteins',
      'Scoring druggability Â· clinical relevance',
      'Retrieving structural coordinates',
    ]},
  { key:'molecular_generation', n:'III', label:'Molecule Generation',  desc:'Synthesising drug-like candidates',    src:'RDKIT Â· CHEMBL',
    lines:[
      'Seeding scaffolds Â· diversifying',
      'Lipinski Â· PAINS Â· SA filters',
      '247 drug-like molecules emitted',
    ]},
  { key:'docking',              n:'IV',  label:'Docking Simulation',   desc:'Predicting ligand binding',            src:'AUTODOCK VINA',
    lines:[
      'Preparing receptor grid',
      'Scheduling 120 docking runs',
      'Aggregating ÎG Â· interaction maps',
    ]},
  { key:'insight_synthesis',    n:'V',   label:'Insight Synthesis',    desc:'Composing the dossier',                src:'CLAUDE',
    lines:[
      'Weighting evidence Â· triangulating',
      'Drafting mechanistic narrative',
      'Assembling dossier Â· final pass',
    ]},
];

const MOCK = {
  disease:"Parkinson's disease",
  description:"A progressive neurodegenerative disorder marked by the loss of dopaminergic neurons in the substantia nigra, producing motor symptoms â tremor, rigidity, bradykinesia â and a widening array of non-motor manifestations.",
  duration_min: 4.3,
  counts:{targets:3, generated:247, docked:120, top:6},
  targets:[
    { gene:'LRRK2', protein:'Leucine-rich repeat kinase 2', uniprot:'Q5S007', pdb:'7LHW',
      drug:0.88, clin:0.92, over:0.90,
      pathways:['Autophagy','Kinase signalling','Vesicle trafficking'],
      summary:'Kinase whose hyperactive variants cause autosomal-dominant PD; tractable ATP-competitive pocket.' },
    { gene:'GBA1', protein:'Glucosylceramidase Beta 1', uniprot:'P04062', pdb:'2V3E',
      drug:0.74, clin:0.86, over:0.80,
      pathways:['Sphingolipid metabolism','Lysosomal function'],
      summary:'Heterozygous mutations are the commonest genetic risk factor for PD; chaperone therapy precedent.' },
    { gene:'SNCA', protein:'Alpha-synuclein', uniprot:'P37840', pdb:'6H6B',
      drug:0.52, clin:0.95, over:0.74,
      pathways:['Synaptic vesicle cycle','Protein aggregation'],
      summary:'Pathological aggregates define Lewy pathology; intrinsically disordered â difficult but central.' },
  ],
  candidates:[
    { rank:1, smiles:'Cc1ccc(C(=O)Nc2nc(-c3ccncc3)cs2)cc1', target:'LRRK2', dG:-9.8, lipinski:true, qed:0.78,
      interactions:['M1947 (H-bond 2.1Ã)','A1950 (Hydrophobic)','F1883 (Pi-stacking 3.6Ã)'],
      rationale:'Thiazole hinge binder with pyridine vector into the kinase back pocket; ÎG below â9 suggests nM range affinity.' },
    { rank:2, smiles:'O=C(Nc1ccc(F)cc1)C1CCN(c2ncnc3[nH]ccc23)CC1', target:'LRRK2', dG:-9.4, lipinski:true, qed:0.71,
      interactions:['M1947 (H-bond)','L1949 (Hydrophobic)'],
      rationale:'Pyrrolopyrimidine scaffold mimics adenine; fluoroanilide amide offers metabolic stability.' },
    { rank:3, smiles:'COc1cc(CNC(=O)c2ccc(Cl)cn2)ccc1O', target:'GBA1', dG:-8.7, lipinski:true, qed:0.74,
      interactions:['E235 (Ionic)','W381 (Pi-stacking)'],
      rationale:'Non-inhibitory chaperone; stabilises the folded form and promotes lysosomal delivery.' },
    { rank:4, smiles:'Fc1ccc(-c2nc3ccccc3n2CC(=O)N2CCOCC2)cc1', target:'LRRK2', dG:-8.5, lipinski:true, qed:0.69,
      interactions:['M1947 (H-bond)','F1883 (Pi-stacking)'],
      rationale:'Benzimidazole hinge â modest affinity but good drug-likeness and clean PAINS.' },
    { rank:5, smiles:'CC(C)N1CCN(Cc2cc(C(F)(F)F)ccc2-n2cnc3ccccc32)CC1', target:'SNCA', dG:-7.6, lipinski:true, qed:0.62,
      interactions:['V49 (Hydrophobic)','K45 (Ionic)'],
      rationale:'Binds disordered NAC region; reduces oligomer propensity in molecular-dynamics ensemble.' },
    { rank:6, smiles:'O=C(NCc1ccco1)c1cc2cc(O)ccc2[nH]1', target:'GBA1', dG:-7.3, lipinski:true, qed:0.81,
      interactions:['W381 (Pi-stacking)','D127 (H-bond)'],
      rationale:'Furan-amide scaffold â modest ÎG but excellent synthetic accessibility.' },
  ],
  safety:[
    'LRRK2 inhibition associated with pulmonary alveolar-macrophage vacuolation â pharmacokinetic tuning required.',
    'GBA1 chaperones must be non-inhibitory below IC50 of endogenous activity to avoid substrate accumulation.',
  ],
  limits:[
    'In-silico predictions; experimental validation (SPR, cellular IC50, efficacy models) required.',
    'Docking does not model protein conformational dynamics or allosteric coupling.',
    'ADMET estimates based on 2-D properties; in-vivo PK unknown.',
  ],
  summary:`Across the literature corpus (PubMed, DisGeNET, UniProt) three high-priority targets emerge for Parkinson's disease: LRRK2, GBA1, and alpha-synuclein (SNCA). The pipeline generated 247 drug-like molecules, of which 120 passed Lipinski/PAINS filters and proceeded to docking. Top candidates converge on the LRRK2 ATP site, with ÎG values reaching â9.8 kcal/mol â predictive of sub-micromolar affinity. GBA1 chaperones offer a complementary mechanism targeting the second-most genetically implicated protein. Findings should be treated as hypotheses prioritising experimental validation.`
};

window.__GENESIS_MOCK = MOCK;

function Job({ query, onBack }){
  // Per-agent progress 0..100. Agents ramp up in a cascade, slightly staggered.
  const [tick, setTick] = useStateJob(0);
  const [plate] = useStateJob(() => String(100 + Math.floor(Math.random()*900)));
  const t0 = useRefJob(performance.now());

  useEffectJob(() => {
    const timer = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(timer);
  }, []);

  // derive progress per stage
  const elapsed = (performance.now() - t0.current) / 1000;
  const fast = window.__GENESIS_FAST || localStorage.getItem('__GENESIS_FAST');
  const totalDur = fast ? 4 : 14; // seconds
  const stageDur = totalDur / STAGES.length;
  const stagger  = stageDur * 0.45;

  const stageProgress = STAGES.map((_, i) => {
    const start = i * stagger;
    const dur = stageDur;
    const p = (elapsed - start) / dur;
    return Math.max(0, Math.min(1, p));
  });
  const complete = stageProgress.every(p => p >= 1);
  const overall = Math.round(stageProgress.reduce((a,b)=>a+b,0) / STAGES.length * 100);

  if(complete){
    const R = window.ReportPanel;
    return R
      ? <R query={query || MOCK.disease} onBack={onBack} MOCK={MOCK}/>
      : null;
  }

  return (
    <div style={{
      position:'relative', height:'100vh', width:'100vw', overflow:'hidden',
      padding:'clamp(1rem, 2.2vh, 1.8rem) clamp(2rem, 3.5vw, 3rem) clamp(1rem, 2vh, 1.5rem) clamp(2rem, 3.5vw, 3rem)',
      display:'flex', flexDirection:'column',
    }}>
      <div className="hud-dots"/>

      {/* accent spine */}
      <div className="accent-spine"/>
      <div className="accent-label">GENESIS Â· RUNTIME</div>

      {/* ââ header strip ââ */}
      <header style={{
        position:'relative',
        display:'grid', gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center', gap:'2rem',
        paddingBottom:'1rem', borderBottom:'1px solid var(--hair)',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'1.6rem'}}>
          <button onClick={onBack} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--ink-2)', fontFamily:'var(--mono)',
            fontSize:'.60rem', letterSpacing:'.30em',
            textTransform:'uppercase', padding:0,
          }}>â ABORT Â· NEW INQUIRY</button>
          <span className="hud-micro">PLATE {plate}</span>
          <span className="hud-micro" style={{color:'var(--ink-2)'}}>
            T+{String(Math.floor(elapsed)).padStart(2,'0')}.{String(Math.floor((elapsed*100)%100)).padStart(2,'0')}s
          </span>
        </div>

        <div style={{textAlign:'center'}}>
          <p className="hud-micro" style={{margin:0}}>INQUIRY Â· 01 OF 01</p>
          <p style={{
            margin:'.2rem 0 0', fontFamily:'var(--serif)',
            fontStyle:'italic', fontSize:'1.15rem',
            color:'var(--ink-1)', letterSpacing:'.01em',
          }}>{query || MOCK.disease}</p>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'1.2rem'}}>
          <span className="hud-micro" style={{color:'var(--accent)'}}>â RUNNING</span>
          <span className="hud-num">{String(overall).padStart(3,'0')}.00%</span>
        </div>
      </header>

      {/* ââ headline ââ */}
      <div style={{
        position:'relative',
        margin:'clamp(.8rem, 1.8vh, 1.5rem) 0 clamp(.8rem, 2vh, 1.6rem)',
        display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:'2rem',
      }}>
        <div>
          <p className="hud-label" style={{margin:0}}>THE APPARATUS Â· FIVE AGENTS IN DELIBERATION</p>
          <h2 style={{
            margin:'.35rem 0 0', fontFamily:'var(--serif)', fontWeight:300,
            fontStyle:'italic', fontSize:'clamp(1.4rem, 2.6vw, 2rem)',
            color:'var(--ink-1)', letterSpacing:'.01em',
          }}>Pipeline Â· {query || MOCK.disease}</h2>
        </div>
        <div style={{display:'flex', gap:'2.5rem', alignItems:'baseline'}}>
          <Readout label="AGENTS" value="05"/>
          <Readout label="SOURCES" value="09"/>
          <Readout label="CORPUS" value="1,248"/>
          <Readout label="SHORTLIST" value="06"/>
        </div>
      </div>

      {/* ââ all 5 agent panels at once ââ */}
      <div style={{
        flex:1, minHeight:0,
        display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:'clamp(.6rem, 1vw, 1rem)',
      }}>
        {STAGES.map((s, i) => (
          <AgentPanel key={s.key} stage={s} index={i}
            p={stageProgress[i]} plate={plate} tick={tick}/>
        ))}
      </div>

      {/* ââ footer tape ââ */}
      <footer style={{
        position:'relative', marginTop:'clamp(.8rem, 1.8vh, 1.4rem)',
        paddingTop:'.7rem', borderTop:'1px solid var(--hair)',
        display:'flex', justifyContent:'space-between',
        alignItems:'center', gap:'2rem',
      }}>
        <span className="hud-micro">GENESIS Â· AUTONOMOUS DRUG DISCOVERY</span>
        <GlobalProgress overall={overall}/>
        <span className="hud-micro">MMXXVI Â· IN-SILICO</span>
      </footer>
    </div>
  );
}

function Readout({ label, value }){
  return (
    <div style={{textAlign:'right'}}>
      <div className="hud-micro">{label}</div>
      <div className="hud-num" style={{color:'var(--ink-1)', fontSize:'.85rem', marginTop:'.1rem'}}>{value}</div>
    </div>
  );
}

function GlobalProgress({ overall }){
  return (
    <div style={{flex:1, maxWidth:520, display:'flex', alignItems:'center', gap:'.8rem'}}>
      <span className="hud-micro">GLOBAL</span>
      <div style={{flex:1, position:'relative', height:1, background:'var(--hair)'}}>
        <div style={{
          position:'absolute', left:0, top:-1, height:3,
          width:`${overall}%`, background:'rgba(255,255,255,.95)',
          boxShadow:'0 0 8px rgba(255,255,255,0.35)',
          transition:'width .15s linear',
        }}/>
      </div>
      <span className="hud-num" style={{color:'var(--ink-1)'}}>{String(overall).padStart(3,'0')}.00</span>
    </div>
  );
}

function AgentPanel({ stage, index, p, plate, tick }){
  const status = p >= 1 ? 'complete' : p > 0 ? 'running' : 'queued';
  const pct = (p*100);
  const active = status === 'running';
  const done = status === 'complete';

  const tickChars = 'â®â¯â®â¯â®â¯â®â¯â®â¯â®â¯â®â¯â®â¯';
  const filled = Math.floor(p * tickChars.length);

  // which live-line is currently being printed
  const lineIdx = Math.min(stage.lines.length-1, Math.floor(p * stage.lines.length));

  return (
    <article style={{
      position:'relative',
      border:'1px solid var(--hair)',
      background:'rgba(8,8,10,0.55)',
      padding:'.9rem .9rem .7rem',
      display:'flex', flexDirection:'column',
      minHeight:0, minWidth:0, overflow:'hidden',
      opacity: status === 'queued' ? 0.55 : 1,
      transition:'opacity .5s',
    }}>
      {/* corner brackets */}
      <span className="corner tl"/><span className="corner tr"/>
      <span className="corner bl"/><span className="corner br"/>

      {/* header strip */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        paddingBottom:'.55rem', borderBottom:'1px solid var(--hair)',
      }}>
        <span className="hud-label">âº PANEL {plate}Â·{String(index+1).padStart(2,'0')}</span>
        <span className="hud-micro" style={{
          color: done ? 'var(--ink-1)' : active ? 'var(--accent)' : 'var(--ink-3)',
        }}>
          {done ? 'â  DONE' : active ? 'â RUN' : 'â¡ WAIT'}
        </span>
      </div>

      {/* roman numeral + title */}
      <div style={{padding:'.9rem 0 .4rem', display:'flex', alignItems:'baseline', gap:'.6rem'}}>
        <span className="mono" style={{
          fontSize:'.82rem', letterSpacing:'.22em',
          color: active ? 'var(--accent)' : done ? 'var(--ink-1)' : 'var(--ink-3)',
        }}>{stage.n}</span>
        <span style={{
          fontFamily:'var(--serif)', fontStyle: active?'italic':'normal',
          fontSize:'1.02rem', color:'var(--ink-1)', lineHeight:1.2,
        }}>{stage.label}</span>
      </div>

      <p className="hud-micro" style={{
        margin:0, color:'var(--ink-2)',
        letterSpacing:'.14em',
      }}>{stage.src}</p>

      {/* big plate schematic â unique little visualization per stage */}
      <div style={{
        position:'relative', marginTop:'.9rem',
        height:'clamp(140px, 22vh, 200px)',
        border:'1px solid var(--hair)',
        background:'rgba(0,0,0,0.35)',
        overflow:'hidden',
      }}>
        <div style={{
          position:'absolute', top:6, left:8,
        }} className="hud-micro">FIG {String(index+1).padStart(2,'0')}Â·{String(Math.floor(pct)).padStart(3,'0')}</div>
        <div style={{
          position:'absolute', top:6, right:8,
        }} className="hud-micro">{(1543.67 + index*17.03).toFixed(2)}%</div>

        <PlateViz stage={stage.key} p={p} tick={tick}/>

        <div style={{
          position:'absolute', bottom:6, left:8, right:8,
          display:'flex', justifyContent:'space-between',
        }}>
          <span className="hud-micro">X {String(Math.floor(100+p*240)).padStart(3,'0')}</span>
          <span className="hud-micro">Y {String(Math.floor(220+(1-p)*180)).padStart(3,'0')}</span>
        </div>
      </div>

      {/* percent + ticks */}
      <div style={{marginTop:'.7rem'}}>
        <div style={{
          display:'flex', justifyContent:'space-between',
          alignItems:'baseline', marginBottom:'.25rem',
        }}>
          <span className="hud-label">PROGRESS</span>
          <span className="hud-num" style={{color: active?'var(--ink-1)':done?'var(--ink-1)':'var(--ink-3)'}}>
            {pct.toFixed(2)}%
          </span>
        </div>
        <div style={{position:'relative', height:1, background:'var(--hair)'}}>
          <div style={{
            position:'absolute', left:0, top:-1, height:3,
            width:`${pct}%`,
            background: active ? 'rgba(255,255,255,.95)' : done ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.30)',
            boxShadow: active ? '0 0 8px rgba(255,255,255,0.35)' : 'none',
            transition:'width .2s linear',
          }}/>
        </div>
        <div style={{
          display:'flex', gap:2, marginTop:'.35rem',
        }}>
          {Array.from({length:20}).map((_,i)=>(
            <i key={i} style={{
              flex:1, height:6,
              background: i < Math.round(p*20)
                ? (active ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.6)')
                : 'rgba(255,255,255,.08)',
            }}/>
          ))}
        </div>
      </div>

      {/* live line */}
      <div style={{
        marginTop:'.7rem', paddingTop:'.55rem',
        borderTop:'1px solid var(--hair)',
        minHeight:'2.6em',
      }}>
        {stage.lines.slice(0, lineIdx+1).map((line, j) => {
          const isLast = j === lineIdx && active;
          return (
            <div key={j} className="mono" style={{
              fontSize:'.58rem', letterSpacing:'.06em',
              color: j === lineIdx ? 'var(--ink-2)' : 'var(--ink-3)',
              lineHeight:1.55, whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis',
            }}>
              <span style={{color: j === lineIdx && active ? 'var(--accent)' : 'var(--ink-3)'}}>
                {j < lineIdx ? 'â¸ ' : isLast ? (tick%2 ? 'â¸ ' : 'â¹ ') : 'â¸ '}
              </span>
              {line}
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   Per-agent micro-visualization â each looks like a different
   scientific readout in its own panel
   ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */
function PlateViz({ stage, p, tick }){
  if(stage === 'disease_analysis')     return <VizLit p={p} tick={tick}/>;
  if(stage === 'target_discovery')     return <VizProteins p={p}/>;
  if(stage === 'molecular_generation') return <VizMolecules p={p} tick={tick}/>;
  if(stage === 'docking')              return <VizDocking p={p}/>;
  if(stage === 'insight_synthesis')    return <VizInsight p={p}/>;
  return null;
}

function VizLit({ p, tick }){
  // a scrolling stream of citation bars
  const rows = 14;
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none">
      {Array.from({length:rows}).map((_,i)=>{
        const y = 10 + i*9;
        const w = 40 + ((i*37 + tick*2) % 130);
        const o = 0.2 + ((i*13) % 60)/100;
        const revealed = i < Math.ceil(p * rows);
        return (
          <g key={i} opacity={revealed ? o : 0.08}>
            <text x={6} y={y+3} fontFamily="monospace" fontSize="4"
                  fill="rgba(255,255,255,.45)">{String(i+1).padStart(3,'0')}</text>
            <rect x={24} y={y} width={w} height={2.5} fill="rgba(255,255,255,.7)"/>
            <text x={24+w+4} y={y+2.5} fontFamily="monospace" fontSize="4"
                  fill="rgba(255,255,255,.35)">{1990+((i*7+tick)%35)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function VizProteins({ p }){
  // 3 ribbons representing proteins, reveal as p grows
  const proteins = [
    { y:36,  w:0.85, label:'LRRK2' },
    { y:72,  w:0.70, label:'GBA1' },
    { y:108, w:0.55, label:'SNCA' },
  ];
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none">
      {proteins.map((pr, i) => {
        const reveal = Math.max(0, Math.min(1, p*3 - i));
        return (
          <g key={i} opacity={reveal}>
            <text x={6} y={pr.y-4} fontFamily="monospace" fontSize="4.5"
                  fill="rgba(255,255,255,.8)" letterSpacing="0.4">{pr.label}</text>
            <path d={buildRibbon(18, pr.y, 170, pr.w)}
              stroke="rgba(255,255,255,.85)" strokeWidth="1.1" fill="none"/>
            <text x={190} y={pr.y+2} fontFamily="monospace" fontSize="4"
                  fill="rgba(255,255,255,.55)" textAnchor="end">{(pr.w*100).toFixed(0)}</text>
          </g>
        );
      })}
    </svg>
  );
}
function buildRibbon(x, y, w, amp){
  let d = `M ${x} ${y}`;
  for(let i=0;i<=40;i++){
    const t = i/40;
    const xx = x + t*w;
    const yy = y + Math.sin(t*Math.PI*3)*10*amp + Math.sin(t*Math.PI*7)*3*amp;
    d += ` L ${xx.toFixed(2)} ${yy.toFixed(2)}`;
  }
  return d;
}

function VizMolecules({ p, tick }){
  // scatter of dots accumulating
  const N = 120;
  const reveal = Math.floor(p * N);
  const dots = [];
  for(let i=0;i<N;i++){
    const seed = i*97.3;
    const x = (Math.sin(seed)*0.5 + 0.5) * 186 + 7;
    const y = (Math.cos(seed*1.7)*0.5 + 0.5) * 128 + 6;
    dots.push({x,y,i});
  }
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none">
      {/* axes */}
      <line x1="14" y1="130" x2="192" y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4"/>
      <line x1="14" y1="8"   x2="14"  y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="0.4"/>
      {[0.25,0.5,0.75].map((t,i)=>(
        <line key={i} x1={14+t*178} y1={128} x2={14+t*178} y2={132}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.4"/>
      ))}
      {dots.map((d,i)=>{
        if(i >= reveal) return null;
        const isTop = i%19 === 0;
        return <circle key={i} cx={d.x} cy={d.y} r={isTop?1.4:0.7}
                 fill={isTop ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.45)'}/>;
      })}
      <text x={16} y={14} fontFamily="monospace" fontSize="4"
            fill="rgba(255,255,255,.45)">n = {reveal}</text>
    </svg>
  );
}

function VizDocking({ p }){
  // double helix partial reveal
  const N = 80;
  const reveal = Math.floor(p * N);
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none">
      {Array.from({length:N}).map((_,i)=>{
        if(i >= reveal) return null;
        const u = i/N;
        const x = 10 + u*180;
        const ph = u*Math.PI*5;
        const yA = 70 + Math.sin(ph)*28;
        const yB = 70 + Math.sin(ph+Math.PI)*28;
        const zA = Math.cos(ph);
        const zB = Math.cos(ph+Math.PI);
        return (
          <g key={i}>
            <circle cx={x} cy={yA} r={1.1 + Math.abs(zA)*0.7}
              fill="rgba(255,255,255,.9)" opacity={0.3 + Math.abs(zA)*0.5}/>
            <circle cx={x} cy={yB} r={1.1 + Math.abs(zB)*0.7}
              fill="rgba(255,255,255,.9)" opacity={0.3 + Math.abs(zB)*0.5}/>
            {i%3===0 && <line x1={x} y1={yA} x2={x} y2={yB}
              stroke="rgba(255,255,255,.18)" strokeWidth="0.4"/>}
          </g>
        );
      })}
      <text x={10} y={12} fontFamily="monospace" fontSize="4"
            fill="rgba(255,255,255,.45)">ÎG â â9.8</text>
    </svg>
  );
}

function VizInsight({ p }){
  // concentric arcs converging
  return (
    <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="none">
      {[0,1,2,3,4].map(i=>{
        const r = 10 + i*12;
        const op = Math.max(0, Math.min(1, p*3 - i*0.4));
        return (
          <circle key={i} cx={100} cy={70} r={r} fill="none"
            stroke="rgba(255,255,255,.7)" strokeWidth="0.5"
            strokeDasharray={`${2+i} ${3+i}`} opacity={op}/>
        );
      })}
      {/* cross hair */}
      <line x1={100} y1={30} x2={100} y2={110} stroke="rgba(255,255,255,.35)" strokeWidth="0.4"/>
      <line x1={60} y1={70} x2={140} y2={70} stroke="rgba(255,255,255,.35)" strokeWidth="0.4"/>
      <circle cx={100} cy={70} r={2.2} fill="rgba(255,91,42,.95)" opacity={p}/>
      <text x={104} y={68} fontFamily="monospace" fontSize="4"
            fill="rgba(255,255,255,.55)">LRRK2 Â· ATP</text>
    </svg>
  );
}

window.Job = Job;
