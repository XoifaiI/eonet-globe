import { useRef, useMemo, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Sphere } from "@react-three/drei"
import * as THREE from "three"
import { useEventStore } from "@/store/event-store"
import EventMarker from "./EventMarker"
import type { EONETEvent } from "@/types"

function latLngToVector3(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)
  return [x, y, z]
}

function getLatestCoordinates(event: EONETEvent): [number, number] | null {
  const geo = event.geometry[event.geometry.length - 1]
  if (!geo?.coordinates) return null
  if (geo.type === "Point") return [geo.coordinates[1], geo.coordinates[0]]
  return null
}

function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext("2d")!

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, "#1a1a2e")
  gradient.addColorStop(0.3, "#16213e")
  gradient.addColorStop(0.5, "#0f3460")
  gradient.addColorStop(0.7, "#16213e")
  gradient.addColorStop(1, "#1a1a2e")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = "rgba(30, 80, 50, 0.6)"
  const continents = [
    { x: 450, y: 250, w: 200, h: 300 },
    { x: 500, y: 400, w: 100, h: 200 },
    { x: 700, y: 200, w: 400, h: 250 },
    { x: 750, y: 450, w: 150, h: 100 },
    { x: 1100, y: 150, w: 350, h: 300 },
    { x: 1200, y: 500, w: 200, h: 150 },
    { x: 1500, y: 300, w: 250, h: 200 },
    { x: 1600, y: 500, w: 300, h: 250 },
    { x: 200, y: 200, w: 300, h: 200 },
  ]

  continents.forEach(({ x, y, w, h }) => {
    ctx.beginPath()
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    ctx.fillStyle = `rgba(100, 200, 255, ${Math.random() * 0.03})`
    ctx.fillRect(x, y, 2, 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function Earth() {
  const groupRef = useRef<THREE.Group>(null)
  const texture = useMemo(() => createEarthTexture(), [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      <Sphere args={[1, 64, 64]}>
        <meshStandardMaterial map={texture} />
      </Sphere>
      <Sphere args={[1.003, 64, 64]}>
        <meshStandardMaterial color="#4488ff" transparent opacity={0.06} />
      </Sphere>
    </group>
  )
}

function EventMarkers() {
  const { events, selectedEvent, setSelectedEvent } = useEventStore()

  const markers = useMemo(() => {
    return events
      .map((event) => {
        const coords = getLatestCoordinates(event)
        if (!coords) return null
        const position = latLngToVector3(coords[0], coords[1], 1.02)
        return { event, position }
      })
      .filter(Boolean) as Array<{ event: EONETEvent; position: [number, number, number] }>
  }, [events])

  return (
    <>
      {markers.map(({ event, position }) => (
        <EventMarker
          key={event.id}
          event={event}
          position={position}
          isSelected={selectedEvent?.id === event.id}
          onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
        />
      ))}
    </>
  )
}

function Stars() {
  const starsRef = useRef<THREE.Points>(null)
  const [positions] = useMemo(() => {
    const pos = new Float32Array(3000)
    for (let i = 0; i < 3000; i++) {
      pos[i] = (Math.random() - 0.5) * 20
    }
    return [pos]
  }, [])

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#ffffff" sizeAttenuation />
    </points>
  )
}

function SceneSetup() {
  const { scene } = useThree()
  useEffect(() => {
    scene.background = new THREE.Color("#0a0a0f")
  }, [scene])
  return null
}

export default function Globe() {
  return (
    <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
      <SceneSetup />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <pointLight position={[-5, -3, -5]} intensity={0.4} />
      <Stars />
      <Earth />
      <EventMarkers />
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  )
}
