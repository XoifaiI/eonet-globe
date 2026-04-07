import { useEffect, useId, useCallback, useMemo } from "react"
import { useMap } from "@/components/ui/map"
import { useEventStore } from "@/store/event-store"
import { getLatestCoordinates, formatEventDate, CATEGORY_COLORS } from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants"
import type { EONETEvent } from "@/types"
import type MapLibreGL from "maplibre-gl"

function eventsToGeoJSON(events: EONETEvent[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const event of events) {
    const coords = getLatestCoordinates(event)
    if (!coords) continue
    const geo = event.geometry[event.geometry.length - 1]
    const catId = event.categories[0]?.id || ""
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: {
        eventId: event.id,
        title: event.title,
        categoryId: catId,
        color: CATEGORY_COLORS[catId] || DEFAULT_CATEGORY_COLOR,
        date: geo ? formatEventDate(event) : "",
      },
    })
  }
  return { type: "FeatureCollection", features }
}

export default function EventClusterLayer() {
  const events = useEventStore((s) => s.events)
  const eventsById = useEventStore((s) => s.eventsById)
  const setSelectedEvent = useEventStore((s) => s.setSelectedEvent)
  const categoryFilter = useEventStore((s) => s.categoryFilter)
  const { map, isLoaded } = useMap()
  const id = useId()

  const src = `eonet-s-${id}`
  const pointOuter = `eonet-po-${id}`
  const pointInner = `eonet-pi-${id}`
  const pointDot = `eonet-pd-${id}`

  const filteredEvents = useMemo(() => {
    if (!categoryFilter) return events
    return events.filter((e) => e.categories[0]?.title === categoryFilter)
  }, [events, categoryFilter])

  useEffect(() => {
    if (!isLoaded || !map) return

    const geojson = eventsToGeoJSON(filteredEvents)

    if (map.getSource(src)) {
      (map.getSource(src) as MapLibreGL.GeoJSONSource).setData(geojson)
      return
    }

    if (filteredEvents.length === 0) return

    map.addSource(src, {
      type: "geojson",
      data: geojson,
    })

    map.addLayer({
      id: pointOuter,
      type: "circle",
      source: src,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 12,
        "circle-opacity": 0.15,
      },
    })

    map.addLayer({
      id: pointInner,
      type: "circle",
      source: src,
      paint: {
        "circle-color": "rgba(15, 15, 20, 0.7)",
        "circle-radius": 8,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": ["get", "color"],
      },
    })

    map.addLayer({
      id: pointDot,
      type: "circle",
      source: src,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 3,
      },
    })

    return () => {
      try {
        for (const l of [pointDot, pointInner, pointOuter]) {
          if (map.getLayer(l)) map.removeLayer(l)
        }
        if (map.getSource(src)) map.removeSource(src)
      } catch { /* */ }
    }
  }, [isLoaded, map, filteredEvents, src, pointOuter, pointInner, pointDot])

  const handlePointClick = useCallback(
    (e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return
      const eventId = e.features[0].properties?.eventId as string
      const event = eventsById.get(eventId)
      if (event) setSelectedEvent(event)
    },
    [eventsById, setSelectedEvent]
  )

  useEffect(() => {
    if (!isLoaded || !map) return

    const enter = () => { map.getCanvas().style.cursor = "pointer" }
    const leave = () => { map.getCanvas().style.cursor = "" }

    map.on("click", pointInner, handlePointClick)
    map.on("mouseenter", pointInner, enter)
    map.on("mouseleave", pointInner, leave)

    return () => {
      map.off("click", pointInner, handlePointClick)
      map.off("mouseenter", pointInner, enter)
      map.off("mouseleave", pointInner, leave)
    }
  }, [isLoaded, map, pointInner, handlePointClick])

  return null
}
