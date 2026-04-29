'use client';

import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 4;
const TRAIL_LENGTH = 55;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

type TrailPoint = { x: number; y: number; z: number };

type Particle = {
  angle: number;
  speed: number;
  radius: number;
  size: number;
  inclination: number; // tilt of orbital plane from equator
  longitude: number;   // rotation of orbital plane around vertical axis
  trail: TrailPoint[];
};

function get3D(p: Particle, angle: number): TrailPoint {
  const { radius, inclination, longitude } = p;
  // Position in orbital plane
  const ox = radius * Math.cos(angle);
  const oy = radius * Math.sin(angle);
  // Rotate by inclination around x-axis → creates tilted ellipse
  const x1 = ox;
  const y1 = oy * Math.cos(inclination);
  const z1 = oy * Math.sin(inclination);
  // Rotate by longitude around z-axis → spins orbital plane orientation
  const x2 = x1 * Math.cos(longitude) - y1 * Math.sin(longitude);
  const y2 = x1 * Math.sin(longitude) + y1 * Math.cos(longitude);
  return { x: x2, y: y2, z: z1 };
}

export function OrbitalParticles({ centerSize = 260 }: { centerSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: rand(0, Math.PI * 2),
      speed: rand(0.006, 0.016) * (Math.random() > 0.5 ? 1 : -1),
      radius: rand(centerSize * 0.85, centerSize * 1.35),
      size: rand(1.4, 2.8),
      inclination: rand(0.1, Math.PI - 0.1),
      longitude: rand(0, Math.PI * 2),
      trail: [],
    }));

    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      type RenderItem = {
        kind: 'glow' | 'dot';
        x: number; y: number; z: number;
        r: number;
        alpha: number;
      };

      const items: RenderItem[] = [];

      for (const p of particles) {
        p.angle += p.speed;

        const pos = get3D(p, p.angle);
        p.trail.unshift({ x: pos.x, y: pos.y, z: pos.z });
        if (p.trail.length > TRAIL_LENGTH) p.trail.pop();

        // Depth factor: z ranges roughly -radius..+radius; map to 0..1
        const depthOf = (z: number) => (z / p.radius + 1) * 0.5;

        // Trail dots
        for (let i = 0; i < p.trail.length; i++) {
          const t = p.trail[i];
          const ageFade = 1 - i / TRAIL_LENGTH;           // newest=1, oldest=0
          const depth = depthOf(t.z);
          const alpha = ageFade * ageFade * (0.15 + 0.55 * depth);
          const r = Math.max(0.3, p.size * 0.65 * ageFade * (0.5 + 0.5 * depth));
          items.push({ kind: 'dot', x: t.x + cx, y: t.y + cy, z: t.z, r, alpha });
        }

        // Particle head glow + core
        const depth = depthOf(pos.z);
        const alpha = 0.45 + 0.55 * depth;
        const r = p.size * (0.55 + 0.45 * depth);
        items.push({ kind: 'glow', x: pos.x + cx, y: pos.y + cy, z: pos.z, r, alpha });
      }

      // Depth-sort everything back→front so near particles draw over far ones
      items.sort((a, b) => a.z - b.z);

      for (const item of items) {
        if (item.kind === 'dot') {
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${item.alpha.toFixed(3)})`;
          ctx.fill();
        } else {
          // Soft glow halo
          const glowR = item.r * 6;
          const g = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, glowR);
          g.addColorStop(0,   `rgba(255,255,255,${(item.alpha * 0.9).toFixed(3)})`);
          g.addColorStop(0.25,`rgba(230,240,255,${(item.alpha * 0.45).toFixed(3)})`);
          g.addColorStop(1,   'rgba(200,220,255,0)');
          ctx.beginPath();
          ctx.arc(item.x, item.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();

          // Hard core
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${item.alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [centerSize]);

  const dim = centerSize * 3.2;
  return (
    <canvas
      ref={canvasRef}
      width={dim}
      height={dim}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  );
}
