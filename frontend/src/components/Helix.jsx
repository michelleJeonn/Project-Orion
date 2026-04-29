const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;

/**
 * Realistic 3D double-helix rendered in 2D via projected SVG.
 * We project (x, y, z) with a perspective camera, render all strand
 * segments + rungs, and z-sort so front pieces overlap back pieces.
 * Lighting is computed per segment (Fresnel-ish + dot with light dir)
 * to get the silvery, luminous metallic look of the reference.
 */
function Helix({
  segments = 420,
  turns    = 4.6,
  height   = 10,
  radius   = 1.25,
  rungs    = 26,
  strandR  = 0.14,
  rungR    = 0.055,
  speed    = 0.22,        // radians / sec
  fov      = 44,
  camZ     = 9.5,
}){
  const wrapRef = useRefH(null);
  const [dims, setDims] = useStateH({ w: 800, h: 900 });
  const [rot, setRot]   = useStateH(0);

  // size to parent
  useEffectH(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    return () => ro.disconnect();
  }, []);

  // animation loop
  useEffectH(() => {
    let raf, prev = performance.now();
    const tick = (now) => {
      const dt = (now - prev) / 1000; prev = now;
      setRot((r) => r + speed * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  // camera / projection
  const { w, h } = dims;
  const f = (0.5 * Math.min(w, h)) / Math.tan((fov * Math.PI / 180) / 2);
  const project = (x, y, z) => {
    const zc = camZ - z;
    const s  = f / zc;
    return { x: w / 2 + x * s, y: h / 2 - y * s, z: zc, s };
  };

  // light direction (camera space; unit vector) â from upper-left front
  const L = (() => { const v = [-0.45, 0.60, 0.80];
    const m = Math.hypot(v[0], v[1], v[2]); return [v[0]/m, v[1]/m, v[2]/m]; })();

  // Build segments with depth for z-sort
  const items = [];

  // STRANDS: sample points; draw each pair of consecutive projected points
  // as a short line. Line width and opacity scale with projected `s`
  // and lighting.
  for (let strand = 0; strand < 2; strand++) {
    const phase = strand === 0 ? 0 : Math.PI;
    let prev3 = null, prevProj = null;
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const t = u * turns * Math.PI * 2;
      const y = u * height - height / 2;
      // rotate around y-axis by `rot`
      const a = t + phase + rot;
      const x = radius * Math.cos(a);
      const z = radius * Math.sin(a);
      const p = project(x, y, z);

      if (prev3) {
        // surface normal â outward radial (rotate back)
        const nx = Math.cos(a), nz = Math.sin(a);
        // Dot with light (camera space uses +z toward viewer)
        const ndl = Math.max(0, nx*L[0] + 0*L[1] + nz*L[2]);
        // Fresnel-ish edge glow (normal away from view â rim)
        const view = 1 - Math.abs(nz);      // view vec is ~(0,0,1); nzÂ·v
        const rim  = Math.pow(view, 2.2);
        const lum  = 0.25 + 0.55 * ndl + 0.95 * rim;
        const depth = prev3.z;              // smaller zc = closer
        const width = Math.max(0.9, strandR * p.s * 1.6);
        const op = Math.min(1, 0.35 + lum * 0.75);
        const gray = Math.min(255, Math.round(140 + lum * 115));
        items.push({
          kind:'strand',
          z: (prev3.zc + p.z) / 2,
          x1: prevProj.x, y1: prevProj.y,
          x2: p.x,        y2: p.y,
          width, op, gray,
        });
      }
      prev3 = { zc: p.z, z };
      prevProj = p;
    }
  }

  // RUNGS
  for (let i = 0; i < rungs; i++) {
    const u = (i + 0.5) / rungs;
    const t = u * turns * Math.PI * 2;
    const y = u * height - height / 2;
    const a = t + rot;
    const xA = radius * Math.cos(a),         zA = radius * Math.sin(a);
    const xB = radius * Math.cos(a+Math.PI), zB = radius * Math.sin(a+Math.PI);
    const pa = project(xA, y, zA);
    const pb = project(xB, y, zB);
    // midpoint z for sort
    const mz = (pa.z + pb.z) / 2;
    // light along rung (dir ~ x-axis rotated by a)
    const ndl = Math.max(0, Math.cos(a)*L[0] + Math.sin(a)*L[2]);
    const rim = Math.pow(1 - Math.abs((zA + zB)/2 / radius), 1.6);
    const lum = 0.18 + 0.45 * ndl + 0.55 * rim;
    const width = Math.max(0.6, rungR * ((pa.s + pb.s)/2) * 1.4);
    const op = Math.min(0.9, 0.28 + lum * 0.65);
    const gray = Math.min(255, Math.round(130 + lum * 110));
    items.push({
      kind:'rung', z: mz,
      x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y,
      width, op, gray,
    });
    // little nucleobase beads where rung meets strand
    items.push({
      kind:'bead', z: pa.z - 0.001,
      cx: pa.x, cy: pa.y, r: Math.max(1.0, width*0.9),
      op: Math.min(0.95, op + 0.15), gray: Math.min(255, gray + 20),
    });
    items.push({
      kind:'bead', z: pb.z - 0.001,
      cx: pb.x, cy: pb.y, r: Math.max(1.0, width*0.9),
      op: Math.min(0.95, op + 0.15), gray: Math.min(255, gray + 20),
    });
  }

  // z-sort back-to-front (larger zc = farther)
  items.sort((a, b) => b.z - a.z);

  return (
    <div ref={wrapRef} style={{
      position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden',
    }}>
      <svg width={w} height={h} style={{display:'block'}}>
        <defs>
          <filter id="helixGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="b"/>
            <feMerge>
              <feMergeNode in="b"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="helixSoftGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6"/>
          </filter>
        </defs>

        {/* soft outer bloom pass â same items, wider blur, low opacity */}
        <g filter="url(#helixSoftGlow)" opacity="0.45">
          {items.map((it, i) => it.kind === 'bead'
            ? <circle key={'b'+i} cx={it.cx} cy={it.cy} r={it.r*1.6}
                fill={`rgba(${it.gray},${it.gray},${it.gray},${it.op*0.6})`}/>
            : <line key={'l'+i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2}
                strokeWidth={it.width*1.6} strokeLinecap="round"
                stroke={`rgba(${it.gray},${it.gray},${it.gray},${it.op*0.5})`}/>
          )}
        </g>

        {/* crisp pass */}
        <g filter="url(#helixGlow)">
          {items.map((it, i) => it.kind === 'bead'
            ? <circle key={'b'+i} cx={it.cx} cy={it.cy} r={it.r}
                fill={`rgba(${it.gray},${it.gray},${it.gray},${it.op})`}/>
            : <line key={'l'+i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2}
                strokeWidth={it.width} strokeLinecap="round"
                stroke={`rgba(${it.gray},${it.gray},${it.gray},${it.op})`}/>
          )}
        </g>
      </svg>
    </div>
  );
}

window.Helix = Helix;
