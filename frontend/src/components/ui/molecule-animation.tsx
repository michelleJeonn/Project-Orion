"use client";

import React, { useEffect, useState } from "react";

// Grid — wider + taller for higher resolution
const W = 140;
const H = 70;
const PI = Math.PI;

// ASCII brightness ramp (darkest → brightest)
const ramp = ".,-~:;=!*#$@";

type Vec3 = { x: number; y: number; z: number };

const vadd  = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const vsub  = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });
const vmul  = (v: Vec3, s: number): Vec3 => ({ x: v.x*s, y: v.y*s, z: v.z*s });
const vdot  = (a: Vec3, b: Vec3): number => a.x*b.x + a.y*b.y + a.z*b.z;
const vlen  = (v: Vec3): number => Math.sqrt(vdot(v,v));
const vnorm = (v: Vec3): Vec3 => { const l = vlen(v); return l > 0 ? vmul(v, 1/l) : v; };
const vcross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y*b.z - a.z*b.y,
  y: a.z*b.x - a.x*b.z,
  z: a.x*b.y - a.y*b.x,
});

// ── Molecule: octahedral — up/down + 4 equatorial ────────────────────────
const BOND_R = 0.12;
const D = 3.2; // bond arm length

interface Atom { p: Vec3; r: number; }

const ATOMS: Atom[] = [
  { p: { x:  0,  y:  0,  z:  0 }, r: 1.00 }, // 0 center
  { p: { x:  0,  y:  D,  z:  0 }, r: 0.80 }, // 1 top
  { p: { x:  0,  y: -D,  z:  0 }, r: 0.65 }, // 2 bottom
  { p: { x:  D,  y:  0,  z:  0 }, r: 0.65 }, // 3 right
  { p: { x: -D,  y:  0,  z:  0 }, r: 0.65 }, // 4 left
  { p: { x:  0,  y:  0,  z:  D }, r: 0.65 }, // 5 front
  { p: { x:  0,  y:  0,  z: -D }, r: 0.65 }, // 6 back
];

// 6 bonds: center to each outer atom
const BONDS: [number, number][] = [
  [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
];

// ── Renderer ────────────────────────────────────────────────────────────────
export const MoleculeAnimation = ({
  speedA = 0.018,
  speedB = 0.010,
}: {
  speedA?: number;
  speedB?: number;
}) => {
  const [frame, setFrame] = useState<React.ReactElement[]>([]);
  const [A, setA] = useState(0);
  const [B, setB] = useState(0);

  useEffect(() => {
    const renderFrame = () => {
      const screen = new Uint8Array(W * H);    // 0 = empty; 1-12 = ramp[v-1]
      const zbuf   = new Float32Array(W * H);  // inverse-z buffer
      const rimBuf = new Float32Array(W * H);  // abs(nz2): 0=silhouette, 1=face-on

      const light: Vec3 = vnorm({ x: -1, y: 1.4, z: -0.8 });
      const cA = Math.cos(A), sA = Math.sin(A);
      const cB = Math.cos(B), sB = Math.sin(B);

      // Project + z-buffer a surface sample.
      // p = world-space surface point; n = outward normal (object space)
      const plot = (p: Vec3, n: Vec3, opacity: number = 1) => {
        // Rotate point: X-axis by A, then Y-axis by B
        const y1 = p.y*cA - p.z*sA;
        const z1 = p.y*sA + p.z*cA;
        const x2 = p.x*cB + z1*sB;
        const y2 = y1;
        const z2 = -p.x*sB + z1*cB + 7.5; // push in front of camera
        if (z2 <= 0.1) return;

        const invz = 1.0 / z2;
        const px = (W/2 + 90*x2*invz + 0.5) | 0;
        const py = (H/2 - 45*y2*invz + 0.5) | 0;
        if (px < 0 || px >= W || py < 0 || py >= H) return;

        const idx = px + py*W;
        if (invz <= zbuf[idx]) return;
        zbuf[idx] = invz;

        // Rotate normal the same way (no translation)
        const ny1 = n.y*cA - n.z*sA;
        const nz1 = n.y*sA + n.z*cA;
        const nx2 = n.x*cB + nz1*sB;
        const ny2 = ny1;
        const nz2 = -n.x*sB + nz1*cB;

        const lum = Math.max(0, nx2*light.x + ny2*light.y + nz2*light.z) * opacity;
        screen[idx] = ((lum * (ramp.length - 1)) | 0) + 1;
        rimBuf[idx] = Math.abs(nz2);
      };

      // ── Bonds (rendered first; atoms win the z-buffer) ───────────────────
      for (const [ai, bi] of BONDS) {
        const a0 = ATOMS[ai], b0 = ATOMS[bi];
        const fullAxis = vsub(b0.p, a0.p);
        const dir = vnorm(fullAxis);
        // Trim to atom surfaces so bonds don't poke through spheres
        const start = vadd(a0.p, vmul(dir,  a0.r));
        const end   = vsub(b0.p, vmul(dir,  b0.r));
        const axis  = vsub(end, start);

        const T  = vnorm(axis);
        const up: Vec3 = Math.abs(vdot(T, {x:0,y:1,z:0})) < 0.99
          ? {x:0,y:1,z:0} : {x:1,y:0,z:0};
        const N  = vnorm(vcross(T, up));
        const Bn = vcross(T, N);

        for (let t = 0; t <= 1; t += 0.03) {
          const ctr = vadd(start, vmul(axis, t));
          for (let v = 0; v < 2*PI; v += 0.25) {
            const cv = Math.cos(v), sv = Math.sin(v);
            const off = vadd(vmul(N, cv*BOND_R), vmul(Bn, sv*BOND_R));
            plot(vadd(ctr, off), vnorm(off), 1);
          }
        }
      }

      // ── Atom spheres (higher z-buffer priority over bonds) ───────────────
      for (const atom of ATOMS) {
        const dist = vlen(atom.p);
        const opacity = 0.4 + 0.6 * (dist / D);
        for (let theta = 0; theta < PI; theta += 0.07) {
          const st = Math.sin(theta), ct = Math.cos(theta);
          for (let phi = 0; phi < 2*PI; phi += 0.08) {
            const sp = Math.sin(phi), cp = Math.cos(phi);
            const n: Vec3 = { x: st*cp, y: ct, z: st*sp };
            plot(vadd(atom.p, vmul(n, atom.r)), n, opacity);
          }
        }
      }

      // ── Build JSX — spans grouped by rim tier for edge glow ─────────────
      // tier 1 (|nz2|<0.35): silhouette edge  → bright pink glow
      // tier 2 (|nz2|<0.70): mid-rim          → purple glow
      // tier 3 (|nz2|>=0.70): face-on center  → dim base colour, no shadow
      const lines: React.ReactElement[] = [];
      for (let y = 0; y < H; y++) {
        const spans: React.ReactElement[] = [];
        let curTier = -1, curStr = '', sk = 0;
        const flush = () => {
          if (!curStr) return;
          if (curTier === 1)
            spans.push(<span key={sk++} style={{ color: '#FF99FF', textShadow: '0 0 4px #FF66FF, 0 0 14px #EE22CC, 0 0 28px #BB00AA' }}>{curStr}</span>);
          else if (curTier === 2)
            spans.push(<span key={sk++} style={{ color: '#CC77FF', textShadow: '0 0 3px #DD66FF, 0 0 10px #AA22DD' }}>{curStr}</span>);
          else if (curTier === 3)
            spans.push(<span key={sk++} style={{ color: '#D8B8FF' }}>{curStr}</span>);
          else
            spans.push(<span key={sk++}>{curStr}</span>);
          curStr = '';
        };
        for (let x = 0; x < W; x++) {
          const v    = screen[x + y*W];
          const nzA  = rimBuf[x + y*W];
          const ch   = v === 0 ? ' ' : ramp[v - 1];
          const tier = v === 0 ? 0 : nzA < 0.35 ? 1 : nzA < 0.70 ? 2 : 3;
          if (tier !== curTier) { flush(); curTier = tier; }
          curStr += ch;
        }
        flush();
        lines.push(<div key={y}>{spans}</div>);
      }
      setFrame(lines);
    };

    const interval = setInterval(() => {
      setA(prev => prev + speedA);
      setB(prev => prev + speedB);
      renderFrame();
    }, 30);

    return () => clearInterval(interval);
  }, [A, B, speedA, speedB]);

  return (
    <pre
      className="font-mono whitespace-pre text-center"
      style={{ color: '#D8B8FF', fontSize: '6px', lineHeight: '1' }}
    >
      {frame}
    </pre>
  );
};
