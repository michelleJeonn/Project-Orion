const { useState: useStateHome } = React;

const EXAMPLE_QUERIES = [
  "Parkinson's disease",
  "Alzheimer's disease",
  "Triple-negative breast cancer",
  "Type 2 diabetes",
  "Rheumatoid arthritis",
];

const PIPELINE_STAGES = [
  { n:'I',   label:'Disease Analysis',    src:'Claude Â· PubMed' },
  { n:'II',  label:'Target Discovery',    src:'DisGeNET Â· UniProt Â· RCSB PDB' },
  { n:'III', label:'Molecule Generation', src:'RDKit Â· ChEMBL' },
  { n:'IV',  label:'Docking Simulation',  src:'AutoDock Vina' },
  { n:'V',   label:'Insight Synthesis',   src:'Claude' },
];

function Home({ onBack, onSubmit }){
  const [q, setQ] = useStateHome('');
  const [loading, setLoading] = useStateHome(false);

  const submit = (val) => {
    const v = (val ?? q).trim();
    if(!v) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onSubmit(v); }, 900);
  };

  return (
    <div style={{
      minHeight:'100vh', position:'relative',
      padding:'clamp(2rem, 5vw, 4rem) clamp(1.5rem, 6vw, 6rem)',
      animation:'fadeIn 1.2s ease-out both',
    }}>
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none',
        background:'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.72) 0%, transparent 75%)',
      }}/>

      <header style={{
        position:'relative', display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:'clamp(3rem, 8vh, 6rem)',
      }}>
        <button onClick={onBack} style={topBtn}>
          <span style={{fontFamily:'var(--mono)', marginRight:8}}>â</span> BACK
        </button>

        <div style={{display:'flex', alignItems:'center', gap:'.7rem'}}>
          <span style={{width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,.7)',
                        boxShadow:'0 0 10px rgba(255,255,255,.5)'}}/>
          <span className="mono" style={{fontSize:'0.60rem', color:'var(--ink-3)', letterSpacing:'0.30em'}}>
            GENESIS Â· SESSION LIVE
          </span>
        </div>

        <span className="mono" style={{fontSize:'0.60rem', color:'var(--ink-3)', letterSpacing:'0.28em'}}>
          v0.1 / 2026
        </span>
      </header>

      <section style={{position:'relative', maxWidth:1100, margin:'0 auto', textAlign:'center'}}>
        <p className="eyebrow" style={{marginBottom:'1.5rem'}}>An Inquiry</p>

        <h2 style={{
          margin:0, fontFamily:'var(--serif)', fontWeight:300, fontStyle:'italic',
          fontSize:'clamp(2rem, 4.2vw, 3.4rem)', lineHeight:1.25, letterSpacing:'0.01em',
          color:'rgba(255,255,255,0.92)', textWrap:'pretty',
          textShadow:'0 2px 40px rgba(0,0,0,0.9)',
        }}>
          Name the malady.<br/>
          <span style={{color:'rgba(255,255,255,0.55)'}}>
            We shall find what binds it.
          </span>
        </h2>

        <div className="rule" style={{margin:'2.2rem auto'}}/>

        <p style={{
          fontSize:'0.95rem', color:'var(--ink-2)',
          maxWidth:620, margin:'0 auto 3.2rem',
          lineHeight:1.7, letterSpacing:'0.01em',
        }}>
          Four autonomous agents will parse its literature, identify druggable proteins,
          synthesise candidate molecules <em>in silico</em>, and simulate their binding
          â returning a structured dossier within minutes.
        </p>

        <QueryField value={q} onChange={setQ} onSubmit={() => submit()} loading={loading}/>

        <div style={{marginTop:'2rem', display:'flex', justifyContent:'center',
                     flexWrap:'wrap', gap:'.6rem', alignItems:'center'}}>
          <span className="mono" style={{fontSize:'0.60rem', color:'var(--ink-3)',
                letterSpacing:'0.28em', marginRight:'.4rem'}}>
            PRIOR INQUIRIES â
          </span>
          {EXAMPLE_QUERIES.map((ex) => (
            <button key={ex} onClick={() => { setQ(ex); submit(ex); }} style={exampleChip}>{ex}</button>
          ))}
        </div>
      </section>

      <section style={{position:'relative', maxWidth:1200, margin:'7rem auto 0'}}>
        <div style={{display:'flex', alignItems:'center', gap:'1rem',
                     marginBottom:'2rem', justifyContent:'center'}}>
          <div style={{flex:1, height:1, background:'var(--hair)'}}/>
          <span className="eyebrow">The Apparatus</span>
          <div style={{flex:1, height:1, background:'var(--hair)'}}/>
        </div>

        <div style={{
          display:'grid', gridTemplateColumns:'repeat(5, 1fr)',
          gap:'1px', background:'var(--hair)', border:'1px solid var(--hair)',
        }}>
          {PIPELINE_STAGES.map((s) => (
            <div key={s.n} style={{
              background:'rgba(12,12,14,0.55)',
              padding:'2rem 1.4rem', minHeight:180,
              display:'flex', flexDirection:'column', justifyContent:'space-between',
              backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)',
            }}>
              <span className="mono" style={{fontSize:'0.62rem', letterSpacing:'0.30em', color:'var(--ink-3)'}}>
                STAGE Â· {s.n}
              </span>
              <div>
                <h3 style={{margin:'0 0 .5rem', fontFamily:'var(--serif)',
                          fontWeight:400, fontSize:'1.15rem',
                          letterSpacing:'0.05em', color:'var(--ink-1)'}}>
                  {s.label}
                </h3>
                <p className="mono" style={{margin:0, fontSize:'0.60rem',
                          color:'var(--ink-3)', letterSpacing:'0.15em',
                          textTransform:'uppercase'}}>
                  {s.src}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{
        position:'relative', marginTop:'6rem', paddingBottom:'2rem',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        borderTop:'1px solid var(--hair)', paddingTop:'1.5rem',
      }}>
        <span className="mono" style={{fontSize:'0.58rem', color:'var(--ink-3)', letterSpacing:'0.30em'}}>
          EST Â· MMXXVI
        </span>
        <span style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:'0.82rem', color:'var(--ink-3)'}}>
          âEvery medicine was once a molecule imagined.â
        </span>
        <span className="mono" style={{fontSize:'0.58rem', color:'var(--ink-3)', letterSpacing:'0.30em'}}>
          INSTRUMENT Â· GENESIS
        </span>
      </footer>
    </div>
  );
}

function QueryField({ value, onChange, onSubmit, loading }){
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit();}}
      style={{
        position:'relative', maxWidth:720, margin:'0 auto',
        display:'flex', alignItems:'stretch',
        border:'1px solid rgba(255,255,255,0.22)',
        background:'rgba(8,8,10,0.55)',
        backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)',
      }}>
      <div style={{display:'flex', flexDirection:'column', justifyContent:'center',
        padding:'0 1.2rem', borderRight:'1px solid var(--hair)'}}>
        <span className="mono" style={{fontSize:'0.55rem', letterSpacing:'0.3em', color:'var(--ink-3)'}}>
          SPECIMEN
        </span>
        <span style={{fontFamily:'var(--serif)', fontStyle:'italic', fontSize:'0.9rem', color:'var(--ink-2)'}}>
          Disease
        </span>
      </div>

      <input type="text" value={value} onChange={(e)=>onChange(e.target.value)}
        disabled={loading}
        placeholder="e.g. Parkinsonâs disease"
        style={{
          flex:1, background:'transparent', border:'none', outline:'none',
          color:'var(--ink-1)', fontFamily:'var(--serif)', fontSize:'1.15rem',
          padding:'1.25rem 1.1rem', letterSpacing:'0.02em',
        }}/>

      <button type="submit" disabled={loading || !value.trim()}
        style={{
          background:'rgba(255,255,255,0.05)',
          border:'none', borderLeft:'1px solid var(--hair)',
          color:'var(--ink-1)', padding:'0 2.2rem',
          fontFamily:'var(--serif)', fontWeight:400,
          fontSize:'0.75rem', letterSpacing:'0.4em',
          textTransform:'uppercase', cursor:'pointer',
          opacity: (loading || !value.trim()) ? 0.35 : 1,
          transition:'background .3s, letter-spacing .3s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)';
                          e.currentTarget.style.letterSpacing='0.46em';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';
                          e.currentTarget.style.letterSpacing='0.4em';}}>
        {loading ? 'Startingâ¦' : 'Commence'}
      </button>
    </form>
  );
}

const topBtn = {
  background:'transparent', border:'none',
  color:'var(--ink-2)', cursor:'pointer',
  fontFamily:'var(--serif)',
  fontSize:'0.72rem', letterSpacing:'0.38em',
  textTransform:'uppercase',
};
const exampleChip = {
  background:'transparent',
  border:'1px solid var(--hair)',
  color:'var(--ink-2)',
  padding:'.4rem .9rem',
  fontFamily:'var(--serif)', fontStyle:'italic',
  fontSize:'.78rem', letterSpacing:'0.02em',
  cursor:'pointer',
  transition:'border-color .2s, color .2s',
};

window.Home = Home;
