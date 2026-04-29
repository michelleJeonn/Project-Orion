import { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface SpacePoint {
  molecule_id: string
  x: number
  y: number
  z: number
  smiles: string
  qed: number
  binding_score: number
  generation_method: string
  target: string
  disease: string
}

interface SimilarMolecule {
  molecule_id: string
  smiles: string
  disease: string
  target: string
  qed: number
  binding_score: number
  generation_method: string
  similarity_score: number
}

const D = {
  panel: 'rgba(8,8,10,0.70)',
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.13)',
  text1: 'rgba(255,255,255,0.88)',
  text2: 'rgba(255,255,255,0.55)',
  text3: 'rgba(255,255,255,0.32)',
  pink: 'rgba(228,147,206,0.90)',
  pinkBorder: 'rgba(228,147,206,0.30)',
  pinkPanel: 'rgba(228,147,206,0.07)',
  purple: 'rgba(140,80,255,0.90)',
  purpleBorder: 'rgba(120,60,220,0.28)',
}

function bindingColorThree(score: number): THREE.Color {
  // -12 = best binder (purple), 0 = worst (pink)
  const t = Math.max(0, Math.min(1, (score + 12) / 12))
  return new THREE.Color(
    (140 + (228 - 140) * t) / 255,
    (80 * (1 - t) + 147 * t) / 255,
    (255 * (1 - t) + 206 * t) / 255,
  )
}

function MoleculePoint({
  point,
  onClick,
  onHover,
  selected,
}: {
  point: SpacePoint
  onClick: (p: SpacePoint) => void
  onHover: (p: SpacePoint | null) => void
  selected: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const size = 0.05 + point.qed * 0.13
  const color = bindingColorThree(point.binding_score)

  return (
    <mesh
      position={[point.x, point.y, point.z]}
      onClick={(e) => { e.stopPropagation(); onClick(point) }}
      onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); onHover(point) }}
      onPointerLeave={() => { setHovered(false); onHover(null) }}
    >
      <sphereGeometry args={[hovered || selected ? size * 1.5 : size, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered || selected ? 0.7 : 0.18}
        roughness={0.3}
        metalness={0.15}
      />
    </mesh>
  )
}

function SceneAxes() {
  return (
    <>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-4, 0, 0, 4, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1a1a2e" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -4, 0, 0, 4, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1a1a2e" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -4, 0, 0, 4]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1a1a2e" />
      </line>
    </>
  )
}

function Scene({
  points,
  onPointClick,
  onHover,
  selectedId,
}: {
  points: SpacePoint[]
  onPointClick: (p: SpacePoint) => void
  onHover: (p: SpacePoint | null) => void
  selectedId: string | null
}) {
  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[8, 8, 8]} intensity={0.7} />
      <pointLight position={[-8, -8, -6]} intensity={0.35} color="#8C50FF" />
      <SceneAxes />
      {points.map((p) => (
        <MoleculePoint
          key={p.molecule_id}
          point={p}
          onClick={onPointClick}
          onHover={onHover}
          selected={p.molecule_id === selectedId}
        />
      ))}
      <OrbitControls enablePan enableZoom enableRotate makeDefault />
    </>
  )
}

export function ChemicalSpace3D({ jobId }: { jobId: string }) {
  const [points, setPoints] = useState<SpacePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<SpacePoint | null>(null)
  const [selected, setSelected] = useState<SpacePoint | null>(null)
  const [similar, setSimilar] = useState<SimilarMolecule[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/snowflake/chemical_space/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPoints(data)
        else setError('no_data')
      })
      .catch(() => setError('fetch_failed'))
      .finally(() => setLoading(false))
  }, [jobId])

  const handleClick = (p: SpacePoint) => {
    setSelected(p)
    setSimilar([])
    setLoadingSimilar(true)
    fetch(`${API_BASE}/api/snowflake/similar_molecules/${jobId}/${encodeURIComponent(p.molecule_id)}`)
      .then((r) => r.json())
      .then((data) => setSimilar(Array.isArray(data) ? data : []))
      .catch(() => setSimilar([]))
      .finally(() => setLoadingSimilar(false))
  }

  if (loading) {
    return (
      <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 10, padding: '3rem', textAlign: 'center', letterSpacing: '0.12em' }}>
        LOADING CHEMICAL SPACE...
      </div>
    )
  }

  if (error || points.length === 0) {
    return (
      <div style={{ color: D.text3, fontFamily: 'var(--mono)', fontSize: 10, padding: '3rem', textAlign: 'center', letterSpacing: '0.10em', lineHeight: 1.8 }}>
        CHEMICAL SPACE UNAVAILABLE<br />
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>
          Configure Snowflake env vars and run a pipeline to populate data
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', height: 440 }}>
      {/* 3D canvas */}
      <div style={{
        flex: 1, position: 'relative',
        background: 'rgba(4,3,10,0.75)',
        borderRadius: 4,
        border: `1px solid ${D.purpleBorder}`,
        overflow: 'hidden',
      }}>
        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            background: 'rgba(8,8,10,0.93)',
            border: `1px solid ${D.pinkBorder}`,
            borderRadius: 4, padding: '.5rem .75rem',
            fontFamily: 'var(--mono)', fontSize: 10,
            color: D.text1, pointerEvents: 'none', maxWidth: 290,
          }}>
            <div style={{ color: D.pink, marginBottom: 4, fontSize: 9 }}>{hovered.molecule_id}</div>
            <div style={{ color: D.text3, marginBottom: 4, fontSize: 8, wordBreak: 'break-all' }}>
              {hovered.smiles.slice(0, 64)}{hovered.smiles.length > 64 ? '…' : ''}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span>QED <span style={{ color: D.pink }}>{hovered.qed.toFixed(3)}</span></span>
              <span>ΔG <span style={{ color: D.purple }}>{hovered.binding_score.toFixed(1)}</span> kcal/mol</span>
            </div>
            <div style={{ color: D.text3, marginTop: 3, fontSize: 9 }}>
              {hovered.generation_method} · {hovered.target}
            </div>
          </div>
        )}

        <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
          <Suspense fallback={null}>
            <Scene
              points={points}
              onPointClick={handleClick}
              onHover={setHovered}
              selectedId={selected?.molecule_id ?? null}
            />
          </Suspense>
        </Canvas>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 10, left: 12,
          display: 'flex', gap: 14, alignItems: 'center',
          fontFamily: 'var(--mono)', fontSize: 8,
          color: 'rgba(255,255,255,0.30)',
        }}>
          <span>SIZE = QED</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            COLOR = ΔG
            <span style={{
              display: 'inline-block', width: 44, height: 5, borderRadius: 3,
              background: 'linear-gradient(to right, #8C50FF, #E493CE)',
            }} />
            low → high
          </span>
          <span>CLICK = find similar</span>
        </div>

        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          fontFamily: 'var(--mono)', fontSize: 8,
          color: 'rgba(255,255,255,0.20)',
        }}>
          {points.length} MOLECULES · DRAG TO ROTATE
        </div>
      </div>

      {/* Similar molecules panel */}
      {selected && (
        <div style={{
          width: 250, overflowY: 'auto', flexShrink: 0,
          background: D.panel,
          border: `1px solid ${D.pinkBorder}`,
          borderRadius: 4, padding: '.75rem',
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.12em', color: 'rgba(228,147,206,0.55)',
            marginBottom: '.4rem',
          }}>
            SIMILAR MOLECULES
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 8,
            color: D.text3, marginBottom: '.7rem',
            wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {selected.molecule_id}
          </div>

          {loadingSimilar && (
            <div style={{ color: D.text3, fontSize: 10, fontFamily: 'var(--mono)', padding: '1.2rem 0', textAlign: 'center', letterSpacing: '0.10em' }}>
              SEARCHING...
            </div>
          )}
          {!loadingSimilar && similar.length === 0 && (
            <div style={{ color: D.text3, fontSize: 9, fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
              No similar molecules found across runs.
            </div>
          )}

          {similar.map((m, i) => (
            <div key={m.molecule_id} style={{
              marginBottom: '.45rem', padding: '.45rem .5rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 3,
              border: `1px solid ${D.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(228,147,206,0.65)' }}>
                  #{i + 1}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: D.purple }}>
                  {(m.similarity_score * 100).toFixed(0)}% match
                </span>
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 7,
                color: D.text3, marginBottom: 4,
                wordBreak: 'break-all', lineHeight: 1.4,
              }}>
                {m.smiles.slice(0, 48)}{m.smiles.length > 48 ? '…' : ''}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 8, color: D.text2 }}>
                <span>QED {m.qed.toFixed(2)}</span>
                <span>ΔG {m.binding_score.toFixed(1)}</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: D.text3, marginTop: 2 }}>
                {m.generation_method} · {m.disease}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
