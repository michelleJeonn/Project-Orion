function Landing({ onEnter }){
  return (
    <div style={{
      minHeight:'100vh', width:'100%',
      display:'flex', position:'relative',
    }}>
      {/* LEFT â 42% */}
      <div style={{
        width:'42%',
        display:'flex', alignItems:'center',
        position:'relative',
        padding:'0 0 0 clamp(2rem, 6vw, 6rem)',
        animation:'fadeLeft 1.8s ease-out 0.3s both',
      }}>
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(ellipse 100% 80% at 10% 50%, rgba(0,0,0,0.78) 0%, transparent 100%)',
        }}/>

        <div style={{position:'relative', zIndex:1}}>
          <p style={{
            margin:'0 0 1rem',
            fontFamily:'Georgia, serif', fontWeight:300,
            fontSize:'clamp(0.55rem, 1.2vw, 0.68rem)',
            letterSpacing:'0.40em',
            color:'rgba(255,255,255,0.35)',
            textTransform:'uppercase',
          }}>
            AI Â· Drug Discovery
          </p>

          <h1 style={{
            margin:0,
            fontFamily:'Georgia, "Times New Roman", serif',
            fontWeight:300,
            fontSize:'clamp(3rem, 6.5vw, 5.5rem)',
            letterSpacing:'0.46em',
            lineHeight:1,
            color:'rgba(255,255,255,0.93)',
            textTransform:'uppercase',
            textShadow:'0 0 60px rgba(255,255,255,0.10), 0 2px 30px rgba(0,0,0,0.95)',
          }}>
            Genesis
          </h1>

          <div style={{
            width:'2.8rem', height:'1px',
            background:'rgba(255,255,255,0.22)',
            margin:'1.5rem 0',
          }}/>

          <p style={{
            margin:'0 0 2.8rem',
            fontFamily:'Georgia, serif', fontWeight:300,
            fontSize:'clamp(0.56rem, 1.2vw, 0.70rem)',
            letterSpacing:'0.34em',
            color:'rgba(255,255,255,0.34)',
            textTransform:'uppercase',
            lineHeight:2,
          }}>
            Autonomous Drug Discovery
          </p>

          <button className="enter-btn" onClick={onEnter}>Enter</button>
        </div>
      </div>

      {/* RIGHT â 58% : DNA helix */}
      <div style={{
        width:'58%', position:'relative',
        animation:'fadeRight 2s ease-out 0.5s both',
      }}>
        <Helix />
      </div>

      <style>{`
        .enter-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.22);
          color: rgba(255,255,255,0.60);
          padding: 0.72rem 2.6rem;
          font-family: Georgia, serif;
          font-weight: 300;
          font-size: 0.65rem;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.35s, border-color 0.35s,
                      color 0.35s, letter-spacing 0.35s;
          animation: borderPulse 4s ease-in-out infinite;
        }
        .enter-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.58);
          color: rgba(255,255,255,0.92);
          letter-spacing: 0.44em;
        }
      `}</style>
    </div>
  );
}

window.Landing = Landing;
