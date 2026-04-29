import { useEffect, useRef } from 'react'

// ── Vertex shader ─────────────────────────────────────────────────────────────
const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// ── Fragment shader – FBM domain-warping smoke ─────────────────────────────
const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;

/* ---- gradient noise (Perlin-style) ---- */
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);          /* smoothstep */
  float a = dot(hash2(i),               f);
  float b = dot(hash2(i+vec2(1,0)),     f-vec2(1,0));
  float c = dot(hash2(i+vec2(0,1)),     f-vec2(0,1));
  float d = dot(hash2(i+vec2(1,1)),     f-vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

/* ---- FBM: 8 octaves with rotation ---- */
const mat2 ROT = mat2(0.8660, 0.5000, -0.5000, 0.8660); /* 30-deg rotate */

float fbm(vec2 p) {
  float v = 0.0, a = 0.52;
  for (int i = 0; i < 8; i++) {
    v += a * gnoise(p);
    p  = ROT * p * 2.02 + vec2(31.4, 17.8);
    a *= 0.50;
  }
  return v;
}

/* ---- domain-warped smoke ---- */
float smoke(vec2 uv, float t) {
  /* first warp layer */
  vec2 q = vec2(fbm(uv                    + t*0.22),
                fbm(uv + vec2(5.2, 1.3)   + t*0.18));

  /* second warp layer */
  vec2 r = vec2(fbm(uv + 4.0*q + vec2(1.7,  9.2) + t*0.13),
                fbm(uv + 4.0*q + vec2(8.3,  2.8)  + t*0.10));

  return fbm(uv + 4.0*r + t*0.06);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.x   *= u_res.x / u_res.y;   /* preserve aspect ratio */
  uv      = uv * 2.8;             /* zoom – more detail */

  float t = u_time * 0.038;       /* very slow drift */
  float f = smoke(uv, t);

  /* map [-~0.9..+~0.9] → [0,1] */
  f = f * 0.5 + 0.5;

  /* high-contrast curve: crush blacks, lift whites */
  f = smoothstep(0.30, 0.78, f);
  f = f * f * (3.0 - 2.0 * f);   /* second smoothstep for velvety depth */
  f = pow(f, 1.15);

  /* very subtle warm/cool tint so it reads as "smoke not flat grey" */
  vec3 dark  = vec3(0.04, 0.04, 0.045);
  vec3 light = vec3(0.88, 0.87, 0.86);
  vec3 col   = mix(dark, light, f);

  gl_FragColor = vec4(col, 1.0);
}
`

// ── WebGL helpers ─────────────────────────────────────────────────────────────
function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error')
  return s
}

function buildProgram(gl: WebGLRenderingContext) {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link error')
  return prog
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SmokeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return   // graceful fallback – CSS background covers it

    const prog = buildProgram(gl)
    gl.useProgram(prog)

    // full-screen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes  = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')

    // resize handler
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    // render loop
    let rafId: number
    const start = performance.now()
    const frame = () => {
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      gl.deleteProgram(prog)
      gl.deleteBuffer(buf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        display: 'block',
        background: '#070707',   /* shown before WebGL initialises */
      }}
    />
  )
}
