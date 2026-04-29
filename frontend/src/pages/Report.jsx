const { useState: useStateR, useEffect: useEffectR, useMemo: useMemoR } = React;

/* ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   REPORT â cinematic HUD dossier
   5 agents Â· 5 panes Â· viewport-locked, no scroll
   ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */

const AGENTS = [
  { id:'disease',   n:'I',   label:'Disease Intelligence',  src:'CLAUDE Â· PUBMED' },
  { id:'targets',   n:'II',  label:'Target Discovery',      src:'DISGENET Â· UNIPROT Â· PDB' },
  { id:'molecules', n:'III', label:'Molecule Generation',   src:'RDKIT Â· CHEMBL' },
  { id:'docking',   n:'IV',  label:'Docking Â· DNA',         src:'AUTODOCK VINA' },
  { id:'insight',   n:'V',   label:'Insight Synthesis',     src:'CLAUDE' },
];

/* ââââââââ helpers ââââââââ */

function CornerBrackets(){
  return (
    <>
      <span className="corner tl"/><span className="corner tr"/>
      <span className="corner bl"/><span className="corner br"/>
    </>
  );
}

function Rule({ style }){
  return <div style={{height:1, background:'var(--hair)', width:'100%', ...style}}/>;
}

function Stat({ label, value, sub }){
  return (
    <div style={{minWidth:0}}>
      <div className="hud-label">{label}</div>
      <div style={{
        marginTop:'.25rem', fontFamily:'var(--serif)',
        fontSize:'1.3rem', fontWeight:300, color:'var(--ink-1)',
        letterSpacing:'.01em', lineHeight:1.1,
      }}>{value}</div>
      {sub && <div className="hud-micro" style={{marginTop:'.2rem', color:'var(--ink-3)'}}>{sub}</div>}
    </div>
  );
}

function Meter({ v, accent=false }){
  return (
    <div style={{position:'relative', height:1, background:'var(--hair)', width:'100%'}}>
      <div style={{
        position:'absolute', left:0, top:-0.5, height:2,
        width:`${v*100}%`,
        background: accent ? 'var(--accent)' : 'rgba(255,255,255,.85)',
      }}/>
    </div>
  );
}

/* ââââââââ DISEASE pane ââââââââ */

function DiseasePane({ r, plate }){
  return (
    <PaneShell plate={plate} index={1} title="Disease Intelligence" src="CLAUDE Â· PUBMED Â· OMIM Â· DISGENET">
      <div style={{
        display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:'2rem',
        height:'100%', minHeight:0,
      }}>
        {/* left â brief */}
        <div style={{display:'flex', flexDirection:'column', minHeight:0}}>
          <div className="hud-label">Condition Â· Monograph</div>
          <h2 style={{
            margin:'.35rem 0 .8rem', fontFamily:'var(--serif)',
            fontWeight:300, fontStyle:'italic',
            fontSize:'clamp(1.8rem, 3vw, 2.4rem)',
            letterSpacing:'.005em', color:'var(--ink-1)', lineHeight:1.1,
          }}>{r.disease}</h2>
          <p style={{
            margin:0, fontFamily:'var(--serif)', fontSize:'1rem',
            lineHeight:1.55, color:'var(--ink-2)', textWrap:'pretty',
          }}>{r.description}</p>

          <div style={{
            marginTop:'auto', paddingTop:'1.2rem',
            borderTop:'1px solid var(--hair)',
            display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'1rem',
          }}>
            <Stat label="ICD-10"       value="G20"     sub="Code"/>
            <Stat label="Prevalence"   value="~1.0%"   sub="â¥ 60 yr"/>
            <Stat label="Typical onset" value="60 yr"   sub="Median"/>
            <Stat label="Unmet need"   value="High"    sub="Global"/>
          </div>
        </div>

        {/* right â literature chart plate */}
        <PlotFrame title="FIG 01Â·A Â· LITERATURE VOLUME" subtitle="PUBMED Â· 1990 â 2024">
          <LitTimeline/>
          <div style={{
            position:'absolute', bottom:8, left:10, right:10,
            display:'flex', justifyContent:'space-between',
          }}>
            <span className="hud-micro">PUBMED Â· 1,248</span>
            <span className="hud-micro">OMIM Â· 12</span>
            <span className="hud-micro">DISGENET Â· 87</span>
          </div>
        </PlotFrame>
      </div>
    </PaneShell>
  );
}

function LitTimeline(){
  // 35 years, growing exponentially
  const years = Array.from({length:35}, (_,i) => 1990 + i);
  const values = years.map((y,i) => {
    const t = i/34;
    return 8 + Math.pow(t, 2.2)*92 + (Math.sin(i*1.7)*6);
  });
  const max = Math.max(...values);
  return (
    <svg viewBox="0 0 400 200" width="100%" height="100%" preserveAspectRatio="none">
      {/* axes */}
      <line x1="24" y1="178" x2="390" y2="178" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <line x1="24" y1="24" x2="24" y2="178" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      {/* y grid */}
      {[0.25,0.5,0.75].map((t,i)=>(
        <line key={i} x1={24} y1={24 + t*154} x2={390} y2={24 + t*154}
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.4"/>
      ))}
      {/* bars */}
      {values.map((v,i)=>{
        const x = 26 + (i/values.length)*360;
        const h = (v/max)*150;
        const y = 178 - h;
        const w = 360/values.length - 1.2;
        return (
          <rect key={i} x={x} y={y} width={w} height={h}
            fill="rgba(255,255,255,.78)"/>
        );
      })}
      {/* year labels every 5 */}
      {years.map((y,i)=> i%5===0 && (
        <text key={y} x={26 + (i/years.length)*360} y={192}
              fontFamily="monospace" fontSize="6" letterSpacing="0.4"
              fill="rgba(255,255,255,.45)">{y}</text>
      ))}
      {/* annotation leader */}
      <line x1={350} y1={40} x2={380} y2={20}
            stroke="rgba(255,255,255,.55)" strokeWidth="0.4"/>
      <text x={268} y={18} fontFamily="monospace" fontSize="6.5"
            letterSpacing="0.6" fill="rgba(255,255,255,.7)">PEAK Â· 2023</text>
    </svg>
  );
}

/* ââââââââ TARGETS pane ââââââââ */

function TargetsPane({ r, plate }){
  return (
    <PaneShell plate={plate} index={2} title="Target Discovery" src="DISGENET Â· UNIPROT Â· RCSB PDB">
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'1rem',
        height:'100%', minHeight:0,
      }}>
        {r.targets.map((t, i) => (
          <TargetCard key={t.gene} t={t} i={i} plate={plate}/>
        ))}
      </div>
    </PaneShell>
  );
}

function TargetCard({ t, i, plate }){
  return (
    <div style={{
      position:'relative', border:'1px solid var(--hair)',
      background:'rgba(0,0,0,0.35)',
      padding:'1rem 1rem 1rem',
      display:'flex', flexDirection:'column', minHeight:0, minWidth:0,
    }}>
      <CornerBrackets/>
      <div style={{
        display:'flex', justifyContent:'space-between',
        paddingBottom:'.55rem', borderBottom:'1px solid var(--hair)',
      }}>
        <span className="hud-label">âº TGT {plate}Â·{String(i+1).padStart(2,'0')}</span>
        <span className="hud-micro" style={{color:'var(--ink-2)'}}>PDB Â· {t.pdb}</span>
      </div>

      <div style={{padding:'.8rem 0 .4rem'}}>
        <div style={{
          fontFamily:'var(--serif)', fontWeight:400,
          fontSize:'1.6rem', color:'var(--ink-1)',
          letterSpacing:'.02em', lineHeight:1,
        }}>{t.gene}</div>
        <div style={{
          marginTop:'.25rem',
          fontFamily:'var(--serif)', fontStyle:'italic',
          fontSize:'.85rem', color:'var(--ink-2)', lineHeight:1.3,
          letterSpacing:'.005em',
        }}>{t.protein}</div>
      </div>

      {/* ribbon fig */}
      <div style={{
        position:'relative', height:'78px',
        border:'1px solid var(--hair)', background:'rgba(0,0,0,0.35)',
        margin:'.3rem 0 .6rem', overflow:'hidden',
      }}>
        <div style={{
          display:'flex', justifyContent:'space-between',
          padding:'.3rem .5rem',
          borderBottom:'1px solid var(--hair)',
        }}>
          <span className="hud-micro">FIG Â· RIBBON</span>
          <span className="hud-micro">{t.uniprot}</span>
        </div>
        <div style={{position:'absolute', top:22, left:0, right:0, bottom:0}}>
          <ProteinRibbon amp={t.over}/>
        </div>
      </div>

      <p style={{
        margin:'0 0 .6rem', fontFamily:'var(--serif)',
        fontSize:'.82rem', lineHeight:1.45,
        color:'var(--ink-2)', textWrap:'pretty',
      }}>{t.summary}</p>

      {/* scores */}
      <div style={{
        display:'flex', flexDirection:'column', gap:'.35rem',
        marginTop:'auto', paddingTop:'.6rem',
        borderTop:'1px solid var(--hair)',
      }}>
        {[
          ['DRUG', t.drug],
          ['CLIN', t.clin],
          ['OVR',  t.over],
        ].map(([k,v], idx)=>(
          <div key={k} style={{display:'grid', gridTemplateColumns:'2.2rem 1fr 2rem', alignItems:'center', gap:'.6rem'}}>
            <span className="hud-micro">{k}</span>
            <Meter v={v} accent={idx===2}/>
            <span className="hud-num" style={{textAlign:'right', color:'var(--ink-1)'}}>{(v*100).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <div style={{marginTop:'.6rem', display:'flex', gap:'.3rem', flexWrap:'wrap'}}>
        {t.pathways.map(p=>(
          <span key={p} className="hud-micro" style={{
            padding:'.18rem .45rem',
            border:'1px solid var(--hair)',
            letterSpacing:'.15em',
          }}>{p}</span>
        ))}
      </div>
    </div>
  );
}

function ProteinRibbon({ amp }){
  const W = 400, H = 70;
  let d = `M 6 ${H/2}`;
  for(let i=0;i<=60;i++){
    const t = i/60;
    const x = 6 + t*(W-12);
    const y = H/2 + Math.sin(t*Math.PI*4)*18*amp + Math.sin(t*Math.PI*9)*4*amp;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.2"/>
      {/* helix markers */}
      {[0.2,0.4,0.6,0.8].map((t,i)=>{
        const x = 6 + t*(W-12);
        return <circle key={i} cx={x} cy={H/2} r="1.5"
                 fill="rgba(255,91,42,.85)" opacity="0.9"/>;
      })}
    </svg>
  );
}

/* ââââââââ MOLECULES pane ââââââââ */

function MoleculesPane({ r, plate }){
  return (
    <PaneShell plate={plate} index={3} title="Molecule Generation" src="RDKIT Â· CHEMBL Â· 247 MOLECULES">
      <div style={{
        display:'grid', gridTemplateColumns:'1fr 1.2fr', gap:'1.2rem',
        height:'100%', minHeight:0,
      }}>
        {/* left â scatter plot */}
        <PlotFrame title={`FIG 03Â·A Â· QED vs ÎG Â· n=247 â 120 â ${r.counts.top}`} subtitle="LIPINSKI â  Â·  PAINS â">
          <MoleculeScatter candidates={r.candidates}/>
        </PlotFrame>

        {/* right â shortlist table */}
        <div style={{
          position:'relative', border:'1px solid var(--hair)',
          background:'rgba(0,0,0,0.35)',
          padding:'.8rem .9rem', display:'flex', flexDirection:'column',
          minHeight:0, minWidth:0,
        }}>
          <CornerBrackets/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            paddingBottom:'.5rem', borderBottom:'1px solid var(--hair)',
          }}>
            <span className="hud-label">âº SHORTLIST Â· TOP {r.candidates.length}</span>
            <span className="hud-micro">SORTED Â· ÎG â</span>
          </div>

          <div style={{
            display:'grid', gridTemplateColumns:'1.8rem 1fr 2.6rem 2.6rem 2.2rem',
            gap:'.6rem', padding:'.6rem 0 .45rem',
            borderBottom:'1px solid var(--hair)',
          }}>
            {['#','SMILES Â· TARGET','ÎG','QED','RO5'].map((h,i)=>(
              <span key={h} className="hud-label" style={{textAlign:i>=2?'right':'left'}}>{h}</span>
            ))}
          </div>

          <div style={{flex:1, minHeight:0, overflow:'hidden'}}>
            {r.candidates.map((c,idx)=>(
              <div key={c.rank} style={{
                display:'grid', gridTemplateColumns:'1.8rem 1fr 2.6rem 2.6rem 2.2rem',
                gap:'.6rem', alignItems:'center',
                padding:'.55rem 0',
                borderBottom: idx < r.candidates.length-1 ? '1px solid var(--hair)' : 'none',
              }}>
                <span className="hud-num" style={{
                  color: idx===0 ? 'var(--accent)' : 'var(--ink-3)',
                }}>{String(c.rank).padStart(2,'0')}</span>
                <div style={{minWidth:0}}>
                  <div className="mono" style={{
                    fontSize:'.66rem', color:'var(--ink-1)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>{c.smiles}</div>
                  <div className="hud-micro" style={{marginTop:'.1rem'}}>{c.target}</div>
                </div>
                <span className="hud-num" style={{
                  textAlign:'right', color:'var(--ink-1)',
                  fontWeight:c.dG<=-9?500:300,
                }}>{c.dG.toFixed(1)}</span>
                <span className="hud-num" style={{
                  textAlign:'right', color:'var(--ink-2)',
                }}>{c.qed.toFixed(2)}</span>
                <span className="hud-num" style={{
                  textAlign:'right',
                  color: c.lipinski ? 'var(--ink-1)' : 'var(--ink-3)',
                }}>{c.lipinski ? 'â' : 'â'}</span>
              </div>
            ))}
          </div>

          <div style={{
            paddingTop:'.5rem', borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between',
          }}>
            <span className="hud-micro">ÎG Â· kcal/mol</span>
            <span className="hud-micro">QED Â· 0â1</span>
            <span className="hud-micro">RO5 Â· LIPINSKI</span>
          </div>
        </div>
      </div>
    </PaneShell>
  );
}

function MoleculeScatter({ candidates }){
  // axes: x = dG (-10 strongest left, -4 right), y = QED (1 top, 0 bottom)
  // background points â 247 generated
  const N = 247;
  const bg = useMemoR(() => {
    const arr = [];
    for(let i=0;i<N;i++){
      const seed = i*97.3 + 13;
      const dg = -10 + (Math.sin(seed)*0.5+0.5) * 6;
      const qed = 0.2 + (Math.cos(seed*1.7)*0.5+0.5) * 0.7;
      const passed = i < 120;
      arr.push({dg, qed, passed});
    }
    return arr;
  }, []);
  const sx = v => 22 + ((-v - 4) / 6) * 362; // dG -10..-4 â x 22..384
  const sy = v => 186 - (v - 0.2) / 0.7 * 160;

  return (
    <svg viewBox="0 0 400 210" width="100%" height="100%" preserveAspectRatio="none">
      {/* axes */}
      <line x1="22" y1="186" x2="390" y2="186" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      <line x1="22" y1="22" x2="22" y2="186" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
      {/* grid */}
      {[0.25,0.5,0.75].map((t,i)=>(
        <g key={i}>
          <line x1={22+t*362} y1={22} x2={22+t*362} y2={186}
                stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
          <line x1={22} y1={22+t*160} x2={384} y2={22+t*160}
                stroke="rgba(255,255,255,0.06)" strokeWidth="0.4"/>
        </g>
      ))}
      {/* Ro5 threshold line at QED=0.5 */}
      <line x1={22} y1={sy(0.5)} x2={384} y2={sy(0.5)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" strokeDasharray="3 2"/>
      <text x={384} y={sy(0.5)-3} fontFamily="monospace" fontSize="5"
            textAnchor="end" fill="rgba(255,255,255,.45)"
            letterSpacing="0.4">QED = 0.5</text>

      {/* background 247 */}
      {bg.map((d,i)=>(
        <circle key={i} cx={sx(d.dg)} cy={sy(d.qed)}
          r={d.passed ? 1.1 : 0.7}
          fill={d.passed ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.15)'}/>
      ))}
      {/* shortlist */}
      {candidates.map((c,i)=>{
        const x = sx(c.dG), y = sy(c.qed);
        const isTop = i === 0;
        return (
          <g key={c.rank}>
            <circle cx={x} cy={y} r={isTop?3.2:2.4}
              fill={isTop ? 'rgba(255,91,42,.95)' : 'rgba(255,255,255,.95)'}
              stroke={isTop ? 'var(--accent)' : 'rgba(255,255,255,.9)'}
              strokeWidth={0.5}/>
            <text x={x+5} y={y-4} fontFamily="monospace" fontSize="5"
              letterSpacing="0.4" fill={isTop ? 'rgba(255,91,42,1)' : 'rgba(255,255,255,.8)'}>
              {String(c.rank).padStart(2,'0')} Â· {c.target}
            </text>
          </g>
        );
      })}

      {/* axis labels */}
      <text x={384} y={200} fontFamily="monospace" fontSize="6"
        textAnchor="end" fill="rgba(255,255,255,.55)"
        letterSpacing="0.5">ÎG (kcal/mol) â</text>
      <text x={6} y={24} fontFamily="monospace" fontSize="6"
        fill="rgba(255,255,255,.55)" letterSpacing="0.5">â QED</text>
      <text x={22} y={200} fontFamily="monospace" fontSize="5"
        fill="rgba(255,255,255,.35)">â10</text>
      <text x={384} y={200} fontFamily="monospace" fontSize="5"
        textAnchor="end" fill="rgba(255,255,255,.35)">â4</text>
    </svg>
  );
}

/* ââââââââ DOCKING pane ââââââââ */

function DockingPane({ r, plate }){
  const top = r.candidates[0];
  return (
    <PaneShell plate={plate} index={4} title="Docking Â· DNA Topology" src="AUTODOCK VINA Â· 120 RUNS">
      <div style={{
        display:'grid', gridTemplateColumns:'1.15fr 1fr', gap:'1.2rem',
        height:'100%', minHeight:0,
      }}>
        {/* left â big DNA + binding strip */}
        <div style={{display:'flex', flexDirection:'column', gap:'.8rem', minHeight:0}}>
          <PlotFrame title={`FIG 04Â·A Â· DOUBLE HELIX Â· LRRK2 Â· ${top.target} BINDING`} subtitle="Î PHASE Â· 4.2 TURNS" flex>
            <DNAPlate/>
          </PlotFrame>
          <PlotFrame title="FIG 04Â·B Â· ÎG DISTRIBUTION Â· SHORTLIST" subtitle="kcal/mol" small>
            <AffinityStrip candidates={r.candidates}/>
          </PlotFrame>
        </div>

        {/* right â candidate detail */}
        <div style={{
          position:'relative', border:'1px solid var(--hair)',
          background:'rgba(0,0,0,0.35)', padding:'1rem',
          display:'flex', flexDirection:'column', minHeight:0, minWidth:0,
        }}>
          <CornerBrackets/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            paddingBottom:'.55rem', borderBottom:'1px solid var(--hair)',
          }}>
            <span className="hud-label">âº LEADING CANDIDATE</span>
            <span className="hud-micro" style={{color:'var(--accent)'}}>â RANK 01</span>
          </div>

          <div style={{padding:'.9rem 0 .3rem', display:'flex', flexDirection:'column', minWidth:0}}>
            <div style={{display:'flex', alignItems:'baseline', gap:'.8rem', whiteSpace:'nowrap'}}>
              <span style={{
                fontFamily:'var(--serif)', fontWeight:300,
                fontSize:'1.6rem', color:'var(--ink-1)', lineHeight:1,
                letterSpacing:'.01em', whiteSpace:'nowrap',
              }}>â&nbsp;01</span>
              <span style={{
                fontFamily:'var(--serif)', fontStyle:'italic',
                fontSize:'1.05rem', color:'var(--ink-2)',
                overflow:'hidden', textOverflow:'ellipsis',
              }}>â {top.target}</span>
            </div>
            <div className="mono" style={{
              marginTop:'.6rem', fontSize:'.6rem',
              color:'var(--ink-2)', wordBreak:'break-all', lineHeight:1.6,
              letterSpacing:'.04em',
            }}>{top.smiles}</div>
          </div>

          <Rule style={{margin:'.4rem 0'}}/>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(3, 1fr)',
            gap:'.8rem', padding:'.4rem 0',
          }}>
            <Stat label="ÎG" value={top.dG.toFixed(1)} sub="kcal/mol"/>
            <Stat label="QED" value={top.qed.toFixed(2)} sub="drug-like"/>
            <Stat label="RO5" value={top.lipinski?'PASS':'FAIL'} sub="LIPINSKI"/>
          </div>

          <Rule style={{margin:'.4rem 0'}}/>

          <div style={{flex:1, minHeight:0, overflow:'hidden'}}>
            <div className="hud-label" style={{marginTop:'.4rem'}}>Key Interactions</div>
            <ul style={{margin:'.4rem 0', padding:0, listStyle:'none'}}>
              {top.interactions.map(s => (
                <li key={s} style={{
                  display:'flex', gap:'.5rem', alignItems:'center',
                  padding:'.35rem 0',
                  borderBottom:'1px solid var(--hair)',
                  fontFamily:'var(--serif)', fontSize:'.88rem',
                  color:'var(--ink-2)', lineHeight:1.3,
                }}>
                  <span className="hud-micro" style={{color:'var(--accent)'}}>â</span>
                  {s}
                </li>
              ))}
            </ul>

            <div className="hud-label" style={{marginTop:'.6rem'}}>Rationale</div>
            <p style={{
              margin:'.3rem 0 0', fontFamily:'var(--serif)',
              fontSize:'.86rem', lineHeight:1.5,
              color:'var(--ink-2)', textWrap:'pretty',
            }}>{top.rationale}</p>
          </div>
        </div>
      </div>
    </PaneShell>
  );
}

function DNAPlate(){
  const W=900, H=260;
  const { beads } = useMemoR(()=>{
    const cols = 160;
    const turns = 4.2;
    const amp = 80;
    const cy = H/2;
    const bs = [];
    for(let i=0;i<=cols;i++){
      const u = i/cols;
      const x = 30 + u*(W-60);
      const phase = u*turns*Math.PI*2;
      const yA = cy + Math.sin(phase)*amp;
      const yB = cy + Math.sin(phase+Math.PI)*amp;
      const zA = Math.cos(phase);
      const zB = Math.cos(phase+Math.PI);
      const rung = 6;
      for(let k=0;k<=rung;k++){
        const t = k/rung;
        const y = yA + (yB-yA)*t;
        const z = zA + (zB-zA)*t;
        const isEnd = k===0 || k===rung;
        bs.push({x,y, r: isEnd ? 1.6+Math.abs(z)*1.2 : 0.5+Math.abs(z)*0.4,
          op: isEnd ? 0.55+Math.abs(z)*0.35 : 0.12+Math.abs(z)*0.15});
      }
    }
    return { beads: bs };
  },[]);

  // annotation callouts
  const callouts = [
    { x:260, y:60, label:'M1947 Â· H-BOND 2.1Ã', ox:40, oy:-20 },
    { x:520, y:180, label:'F1883 Â· PI-STACK 3.6Ã', ox:60, oy:30 },
    { x:720, y:80, label:'A1950 Â· HYDROPHOBIC', ox:40, oy:-18 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="glowR" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.8"/>
        </filter>
      </defs>
      <g filter="url(#glowR)">
        {beads.map((b,i)=>(
          <circle key={i} cx={b.x} cy={b.y} r={b.r}
            fill="rgba(255,255,255,.95)" opacity={b.op}/>
        ))}
      </g>
      {/* annotation leader lines */}
      {callouts.map((c,i)=>{
        const ex = c.x + c.ox;
        const ey = c.y + c.oy;
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r="3.2" fill="none"
              stroke="rgba(255,91,42,.85)" strokeWidth="0.6"/>
            <line x1={c.x} y1={c.y} x2={ex} y2={ey}
              stroke="rgba(255,91,42,.55)" strokeWidth="0.5"/>
            <line x1={ex} y1={ey} x2={ex + (c.ox>0?70:-70)} y2={ey}
              stroke="rgba(255,255,255,.45)" strokeWidth="0.4"/>
            <text x={ex + (c.ox>0?6:-6)} y={ey-3} fontFamily="monospace"
              fontSize="6" letterSpacing="0.6"
              textAnchor={c.ox>0?'start':'end'}
              fill="rgba(255,255,255,.8)">{c.label}</text>
          </g>
        );
      })}
      {/* plate marker */}
      <text x={10} y={14} fontFamily="monospace" fontSize="6.5"
        letterSpacing="0.5" fill="rgba(255,255,255,.45)">PLATE Â· LRRK2 Â· ATP-POCKET</text>
    </svg>
  );
}

function AffinityStrip({ candidates }){
  // ÎG horizontal bars
  const min = -10, max = -7;
  return (
    <svg viewBox="0 0 400 100" width="100%" height="100%" preserveAspectRatio="none">
      {candidates.map((c,i)=>{
        const y = 8 + i*14;
        const frac = (c.dG - max) / (min - max); // how "strong"
        const w = 12 + frac*340;
        return (
          <g key={c.rank}>
            <text x={4} y={y+5} fontFamily="monospace" fontSize="6"
              letterSpacing="0.4" fill="rgba(255,255,255,.6)">
              {String(c.rank).padStart(2,'0')}
            </text>
            <rect x={20} y={y} width={w} height={3}
              fill={i===0 ? 'rgba(255,91,42,.9)' : 'rgba(255,255,255,.78)'}/>
            <text x={24+w} y={y+4.5} fontFamily="monospace" fontSize="5.5"
              letterSpacing="0.4" fill="rgba(255,255,255,.55)">{c.dG.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ââââââââ INSIGHT pane ââââââââ */

function InsightPane({ r, plate }){
  return (
    <PaneShell plate={plate} index={5} title="Executive Synthesis" src="CLAUDE Â· COMPOSITION">
      <div style={{
        display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:'1.4rem',
        height:'100%', minHeight:0,
      }}>
        {/* left â prose */}
        <div style={{display:'flex', flexDirection:'column', minHeight:0}}>
          <span className="hud-label">Dossier Â· Verdict</span>
          <p style={{
            margin:'.4rem 0 0',
            fontFamily:'var(--serif)', fontSize:'.95rem',
            lineHeight:1.55, color:'var(--ink-1)',
            fontWeight:300, textWrap:'pretty',
            overflow:'hidden',
          }}>{r.summary}</p>

          <div style={{
            marginTop:'auto', paddingTop:'1rem',
            borderTop:'1px solid var(--hair)',
            display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'1rem',
          }}>
            <Stat label="Targets"   value={r.counts.targets}   sub="prioritised"/>
            <Stat label="Generated" value={r.counts.generated} sub="molecules"/>
            <Stat label="Docked"    value={r.counts.docked}    sub="poses"/>
            <Stat label="Shortlist" value={r.counts.top}       sub="candidates"/>
          </div>
        </div>

        {/* right â safety + limits */}
        <div style={{display:'flex', flexDirection:'column', gap:'1rem', minHeight:0, minWidth:0}}>
          <SubPanel title="Safety Considerations" index="05Â·A">
            <ul style={{margin:0, padding:0, listStyle:'none'}}>
              {r.safety.map((s,i)=>(
                <li key={i} style={{
                  display:'flex', gap:'.6rem', alignItems:'flex-start',
                  padding:'.55rem 0',
                  borderBottom: i < r.safety.length-1 ? '1px solid var(--hair)' : 'none',
                  fontFamily:'var(--serif)', fontSize:'.85rem',
                  lineHeight:1.45, color:'var(--ink-2)',
                }}>
                  <span className="hud-micro" style={{color:'var(--accent)', flexShrink:0, paddingTop:'.1rem'}}>!</span>
                  <span style={{textWrap:'pretty'}}>{s}</span>
                </li>
              ))}
            </ul>
          </SubPanel>
          <SubPanel title="Limitations" index="05Â·B" grow>
            <ul style={{margin:0, padding:0, listStyle:'none'}}>
              {r.limits.map((s,i)=>(
                <li key={i} style={{
                  display:'flex', gap:'.6rem', alignItems:'flex-start',
                  padding:'.5rem 0',
                  borderBottom: i < r.limits.length-1 ? '1px solid var(--hair)' : 'none',
                  fontFamily:'var(--serif)', fontSize:'.82rem',
                  lineHeight:1.4, color:'var(--ink-2)',
                }}>
                  <span className="hud-micro" style={{color:'var(--ink-3)', flexShrink:0, paddingTop:'.1rem'}}>
                    {String(i+1).padStart(2,'0')}
                  </span>
                  <span style={{textWrap:'pretty'}}>{s}</span>
                </li>
              ))}
            </ul>
          </SubPanel>
        </div>
      </div>
    </PaneShell>
  );
}

function SubPanel({ title, index, children, grow }){
  return (
    <div style={{
      position:'relative', border:'1px solid var(--hair)',
      background:'rgba(0,0,0,0.35)', padding:'.7rem .9rem',
      display:'flex', flexDirection:'column', minHeight:0,
      flex: grow ? 1 : 'none',
    }}>
      <CornerBrackets/>
      <div style={{
        display:'flex', justifyContent:'space-between',
        paddingBottom:'.4rem', borderBottom:'1px solid var(--hair)',
      }}>
        <span className="hud-label">âº {title}</span>
        <span className="hud-micro">{index}</span>
      </div>
      <div style={{paddingTop:'.4rem', flex:1, minHeight:0}}>{children}</div>
    </div>
  );
}

/* ââââââââ Shared shells ââââââââ */

function PaneShell({ plate, index, title, src, children }){
  return (
    <section style={{
      position:'relative',
      flex:1, minHeight:0, minWidth:0,
      display:'flex', flexDirection:'column',
    }}>
      {/* pane title bar */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'baseline',
        paddingBottom:'.6rem', borderBottom:'1px solid var(--hair)',
        marginBottom:'.9rem',
      }}>
        <div style={{display:'flex', alignItems:'baseline', gap:'1.2rem'}}>
          <span className="hud-label">âº PANEL {plate}Â·{String(index).padStart(2,'0')}</span>
          <span style={{
            fontFamily:'var(--serif)', fontStyle:'italic',
            fontSize:'1.05rem', color:'var(--ink-1)',
            letterSpacing:'.01em',
          }}>{title}</span>
        </div>
        <span className="hud-micro">{src}</span>
      </div>
      <div style={{flex:1, minHeight:0, display:'flex'}}>
        <div style={{flex:1, minHeight:0, minWidth:0}}>
          {children}
        </div>
      </div>
    </section>
  );
}

function PlotFrame({ title, subtitle, children, flex, small }){
  return (
    <div style={{
      position:'relative', border:'1px solid var(--hair)',
      background:'rgba(0,0,0,0.35)', overflow:'hidden',
      display:'flex', flexDirection:'column', minHeight:0, minWidth:0,
      flex: flex ? 1 : small ? 'none' : 1,
      height: small ? '120px' : undefined,
    }}>
      <CornerBrackets/>
      <div style={{
        display:'flex', justifyContent:'space-between',
        padding:'.5rem .7rem', borderBottom:'1px solid var(--hair)',
      }}>
        <span className="hud-label">{title}</span>
        <span className="hud-micro">{subtitle}</span>
      </div>
      <div style={{position:'relative', flex:1, minHeight:0}}>
        {children}
      </div>
    </div>
  );
}

/* ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   MAIN REPORT â top bar Â· left rail Â· active pane Â· bottom tape
   ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */

function ReportPanel({ query, onBack, MOCK }){
  const [agent, setAgent] = useStateR('disease');
  const r = { ...MOCK, disease: query || MOCK.disease };
  const idx = AGENTS.findIndex(a => a.id === agent);
  const plate = useMemoR(() => String(100 + Math.floor(Math.random()*900)), []);

  // arrow-key nav
  useEffectR(()=>{
    const h = (e)=>{
      if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
        const next = Math.min(AGENTS.length-1, idx+1);
        setAgent(AGENTS[next].id);
      } else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
        const next = Math.max(0, idx-1);
        setAgent(AGENTS[next].id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx]);

  return (
    <div style={{
      position:'relative', zIndex:2,
      height:'100vh', width:'100vw', overflow:'hidden',
      padding:'clamp(.9rem, 2vh, 1.4rem) clamp(1.6rem, 3vw, 2.4rem) clamp(.8rem, 1.6vh, 1.2rem) clamp(1.6rem, 3vw, 2.4rem)',
      display:'flex', flexDirection:'column',
      fontFamily:'var(--serif)', color:'var(--ink-1)',
    }}>
      <div className="hud-dots"/>
      <div className="accent-spine"/>
      <div className="accent-label">GENESIS Â· DOSSIER</div>

      {/* ââ top bar ââ */}
      <header style={{
        position:'relative',
        display:'grid', gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center', gap:'1.5rem',
        paddingBottom:'.9rem', borderBottom:'1px solid var(--hair)',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'1.4rem'}}>
          <button onClick={onBack} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--ink-2)', fontFamily:'var(--mono)',
            fontSize:'.60rem', letterSpacing:'.3em',
            textTransform:'uppercase', padding:0,
          }}>â NEW INQUIRY</button>
          <span className="hud-micro">DOSSIER Â· {plate}</span>
          <span className="hud-micro" style={{color:'var(--ink-2)'}}>MMXXVI</span>
        </div>

        <div style={{textAlign:'center'}}>
          <p className="hud-micro" style={{margin:0}}>SUBJECT</p>
          <p style={{
            margin:'.2rem 0 0', fontFamily:'var(--serif)',
            fontStyle:'italic', fontSize:'1.2rem',
            color:'var(--ink-1)', letterSpacing:'.01em',
          }}>{r.disease}</p>
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'1.2rem'}}>
          <span className="hud-micro" style={{color:'var(--accent)'}}>â COMPLETE</span>
          <span className="hud-num">{String(idx+1).padStart(2,'0')} / {String(AGENTS.length).padStart(2,'0')}</span>
        </div>
      </header>

      {/* ââ body: left rail + pane ââ */}
      <div style={{
        position:'relative', flex:1, minHeight:0,
        display:'grid', gridTemplateColumns:'210px 1fr',
        gap:'clamp(1rem, 2.2vw, 1.8rem)',
        marginTop:'clamp(.8rem, 1.8vh, 1.2rem)',
      }}>
        {/* left rail â agent ledger */}
        <nav style={{
          position:'relative', display:'flex', flexDirection:'column',
          minHeight:0, minWidth:0,
          border:'1px solid var(--hair)', padding:'.8rem .8rem',
          background:'rgba(0,0,0,0.35)',
        }}>
          <CornerBrackets/>
          <div style={{
            display:'flex', justifyContent:'space-between',
            paddingBottom:'.55rem', borderBottom:'1px solid var(--hair)',
          }}>
            <span className="hud-label">âº APPARATUS</span>
            <span className="hud-micro">05</span>
          </div>
          <ul style={{margin:'.5rem 0 0', padding:0, listStyle:'none', flex:1, minHeight:0}}>
            {AGENTS.map((a, i)=>{
              const active = a.id === agent;
              return (
                <li key={a.id}>
                  <button
                    onClick={()=>setAgent(a.id)}
                    style={{
                      display:'flex', width:'100%', alignItems:'baseline',
                      gap:'.6rem', textAlign:'left',
                      background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border:'none',
                      borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      padding:'.7rem .55rem', cursor:'pointer',
                      color: active ? 'var(--ink-1)' : 'var(--ink-2)',
                      transition:'background .2s, color .2s',
                    }}
                    onMouseEnter={e => { if(!active) e.currentTarget.style.background='rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent'; }}
                  >
                    <span className="hud-micro" style={{
                      color: active ? 'var(--accent)' : 'var(--ink-3)',
                      width:'1.6rem',
                    }}>{a.n}</span>
                    <span style={{
                      fontFamily:'var(--serif)', fontSize:'.95rem',
                      fontStyle: active ? 'italic' : 'normal',
                      letterSpacing:'.005em', lineHeight:1.2,
                    }}>{a.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{
            paddingTop:'.6rem', borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between',
          }}>
            <span className="hud-micro">PANE</span>
            <span className="hud-num" style={{color:'var(--ink-1)'}}>
              {String(idx+1).padStart(2,'0')}/{String(AGENTS.length).padStart(2,'0')}
            </span>
          </div>
          <div className="hud-micro" style={{marginTop:'.4rem', color:'var(--ink-3)'}}>
            â â¶ Â· KEY NAV
          </div>
        </nav>

        {/* active pane */}
        <main style={{minWidth:0, minHeight:0, display:'flex', flexDirection:'column'}}>
          {agent==='disease'   && <DiseasePane   r={r} plate={plate}/>}
          {agent==='targets'   && <TargetsPane   r={r} plate={plate}/>}
          {agent==='molecules' && <MoleculesPane r={r} plate={plate}/>}
          {agent==='docking'   && <DockingPane   r={r} plate={plate}/>}
          {agent==='insight'   && <InsightPane   r={r} plate={plate}/>}
        </main>
      </div>

      {/* ââ bottom tape ââ */}
      <footer style={{
        position:'relative', marginTop:'clamp(.6rem, 1.4vh, 1rem)',
        paddingTop:'.6rem', borderTop:'1px solid var(--hair)',
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <span className="hud-micro">GENESIS Â· AUTONOMOUS DRUG DISCOVERY</span>
        <span className="hud-micro" style={{color:'var(--ink-2)'}}>IN-SILICO Â· AWAITING VALIDATION</span>
        <span className="hud-micro">COORD Â· X {plate} Â· Y {String(Math.floor(idx*73+100)).padStart(3,'0')}</span>
      </footer>
    </div>
  );
}

window.ReportPanel = ReportPanel;
