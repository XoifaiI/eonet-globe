import { useEffect, useRef } from "react"
import { useMap } from "@/components/ui/map"
import { useEventStore } from "@/store/event-store"
import { getLatestCoordinates } from "@/lib/eonet"

export default function FlyToHandler() {
  const selectedEvent = useEventStore((s) => s.selectedEvent)
  const { map, isLoaded } = useMap()
  const lastFlyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !map || !selectedEvent) {
      lastFlyRef.current = null
      return
    }

    const coords = getLatestCoordinates(selectedEvent)
    if (!coords || lastFlyRef.current === selectedEvent.id) return

    lastFlyRef.current = selectedEvent.id
    const targetZoom = Math.max(map.getZoom(), 6)
    map.flyTo({ center: coords, zoom: targetZoom, duration: 1400, essential: true })
  }, [selectedEvent, map, isLoaded])

  return null
}
