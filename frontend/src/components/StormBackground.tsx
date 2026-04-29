import { useEffect, useRef } from 'react'

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i),                  f);
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}


const mat2 ROT = mat2(0.8660, 0.5000, -0.5000, 0.8660);

float fbm(vec2 p) {
  float v = 0.0, a = 0.52;
  for (int i = 0; i < 8; i++) {
    v += a * gnoise(p);
    p  = ROT * p * 2.02 + vec2(31.4, 17.8);
    a *= 0.50;
  }
  return v;
}


void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  uv.x   *= u_res.x / u_res.y;
  uv      = uv * 2.4;

  float t = u_time * 0.06;

  vec2 q = vec2(
    fbm(uv + vec2(cos(t * 0.7) * 0.40,  sin(t * 0.5) * 0.40)),
    fbm(uv + vec2(5.2, 1.3) + vec2(sin(t * 0.6) * 0.40, cos(t * 0.8) * 0.40))
  );
  vec2 r = vec2(
    fbm(uv + 5.0*q + vec2(1.7, 9.2) + vec2(cos(t * 0.4) * 0.28, sin(t * 0.9) * 0.28)),
    fbm(uv + 5.0*q + vec2(8.3, 2.8) + vec2(sin(t * 0.8) * 0.28, cos(t * 0.3) * 0.28))
  );

  float f = fbm(uv + 5.0*r + vec2(sin(t * 0.5) * 0.20, cos(t * 0.6) * 0.20));

  f = f * 0.5 + 0.5;

  f = smoothstep(0.30, 0.72, f);
  f = f * f * (3.0 - 2.0 * f);
  f = pow(f, 1.4);
  f *= 0.18;

  vec3 dark  = vec3(0.072, 0.072, 0.082);
  vec3 light = vec3(0.68,  0.67,  0.65);
  vec3 col   = mix(dark, light, f);

  gl_FragColor = vec4(col, 1.0);
}
`

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
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link error')
  return prog
}

export function StormBackground({ sharedTime }: { sharedTime?: number } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return

    const prog = buildProgram(gl)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes  = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let rafId: number
    const start = sharedTime ?? performance.now()
    const frame = () => {
      const elapsed = sharedTime !== undefined 
        ? sharedTime / 1000
        : (performance.now() - start) / 1000
      gl.uniform1f(uTime, elapsed)
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
  }, [sharedTime])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        display: 'block',
        background: '#131318',
      }}
    />
  )
}
