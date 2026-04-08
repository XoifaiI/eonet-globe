import { useEffect, useRef } from "react"
import { useMap } from "@/components/ui/map"
import { useEventStore } from "@/store/event-store"
import { getLatestCoordinates } from "@/lib/eonet"
import { MIN_FLY_TO_ZOOM, FLY_TO_DURATION_MS } from "@/lib/constants"

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
    const targetZoom = Math.max(map.getZoom(), MIN_FLY_TO_ZOOM)
    map.flyTo({ center: coords, zoom: targetZoom, duration: FLY_TO_DURATION_MS, essential: true })
  }, [selectedEvent, map, isLoaded])

  return null
}
