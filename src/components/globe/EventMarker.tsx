import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { Mesh } from "three"
import type { EONETEvent } from "@/types"

interface EventMarkerProps {
  event: EONETEvent
  position: [number, number, number]
  isSelected: boolean
  onClick: () => void
}

const CATEGORY_COLORS: Record<string, string> = {
  wildfires: "#ff4500",
  volcanoes: "#dc143c",
  severeStorms: "#6a0dad",
  seaLakeIce: "#00bfff",
  earthquakes: "#8b4513",
  floods: "#1e90ff",
  landslides: "#8b6914",
  drought: "#daa520",
  dustHaze: "#c2b280",
  snow: "#fffafa",
  tempExtremes: "#ff6347",
  waterColor: "#20b2aa",
  manmade: "#808080",
}

function getCategoryColor(event: EONETEvent): string {
  const categoryId = event.categories[0]?.id || ""
  return CATEGORY_COLORS[categoryId] || "#ff8c00"
}

export default function EventMarker({ event, position, isSelected, onClick }: EventMarkerProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const color = getCategoryColor(event)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetScale = isSelected ? 2 : hovered ? 1.5 : 1
    meshRef.current.scale.lerp(
      { x: targetScale, y: targetScale, z: targetScale } as THREE.Vector3,
      delta * 5
    )
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = "auto"
      }}
    >
      <sphereGeometry args={[0.02, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 1.5 : hovered ? 1 : 0.5}
      />
    </mesh>
  )
}
