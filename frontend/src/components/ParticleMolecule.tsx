import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const ROT_X = 0.20   // rad/s — synced to ASCII molecule
const ROT_Y = 0.10
const D     = 4.4    // world-space arm length (matches visual scale at z=12, FOV=60)

export function ParticleMolecule() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 12)

    const getMoleculeX = () => {
      const aspect = window.innerWidth / window.innerHeight
      const halfW  = Math.tan(Math.PI / 6) * 12 * aspect
      return halfW * 0.42
    }

    const nodes: THREE.Vector3[] = [
      new THREE.Vector3( 0,  0,  0),
      new THREE.Vector3( 0,  D,  0),
      new THREE.Vector3( 0, -D,  0),
      new THREE.Vector3( D,  0,  0),
      new THREE.Vector3(-D,  0,  0),
      new THREE.Vector3( 0,  0,  D),
      new THREE.Vector3( 0,  0, -D),
    ]
    const nodeRadii = [1.10, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85]

    const cBright = new THREE.Color('#FFAAFF')
    const cMid    = new THREE.Color('#CC44FF')
    const cDeep   = new THREE.Color('#770099')

    // Add spheres for each node with glowing effect
    const group = new THREE.Group()
    group.rotation.order = 'XYZ'
    group.position.x = getMoleculeX()
    scene.add(group)

    nodes.forEach((node, i) => {
      const r = nodeRadii[i] * 2 // Make spheres larger
      const geometry = new THREE.SphereGeometry(r, 16, 16)
      const material = new THREE.MeshBasicMaterial({
        color: '#333333',
      })
      const sphere = new THREE.Mesh(geometry, material)
      sphere.position.copy(node)
      group.add(sphere)
    })

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      group.position.x = getMoleculeX()
    }
    window.addEventListener('resize', onResize)

    const startMs = Date.now()
    let raf: number

    const animate = () => {
      raf = requestAnimationFrame(animate)

      const elapsed = (Date.now() - startMs) / 1000
      group.rotation.x = elapsed * ROT_X
      group.rotation.y = elapsed * ROT_Y

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      // Dispose of geometries and materials
      group.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }} />
}