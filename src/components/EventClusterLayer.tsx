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
  const viewMode = useEventStore((s) => s.viewMode)
  const { map, isLoaded } = useMap()
  const id = useId()

  const src = `eonet-s-${id}`
  const pointOuter = `eonet-po-${id}`
  const pointInner = `eonet-pi-${id}`
  const pointDot = `eonet-pd-${id}`
  const heatLayer = `eonet-heat-${id}`

  const filteredEvents = useMemo(() => {
    if (!categoryFilter) return events
    return events.filter((e) => e.categories[0]?.title === categoryFilter)
  }, [events, categoryFilter])

  useEffect(() => {
    if (!isLoaded || !map) return

    const geojson = eventsToGeoJSON(filteredEvents)

    if (map.getSource(src)) {
      (map.getSource(src) as MapLibreGL.GeoJSONSource).setData(geojson)
    } else {
      if (filteredEvents.length === 0) return

      map.addSource(src, {
        type: "geojson",
        data: geojson,
      })
    }

    const pointLayers = [pointOuter, pointInner, pointDot]
    const hasPointLayers = map.getLayer(pointOuter)
    const hasHeatLayer = map.getLayer(heatLayer)

    if (viewMode === "heatmap") {
      if (hasPointLayers) {
        pointLayers.forEach((l) => map.setLayoutProperty(l, "visibility", "none"))
      }

      if (!hasHeatLayer) {
        map.addLayer({
          id: heatLayer,
          type: "heatmap",
          source: src,
          paint: {
            "heatmap-weight": 1,
            "heatmap-intensity": [
              "interpolate", ["linear"], ["zoom"],
              0, 0.5,
              5, 1.5,
              10, 3,
            ],
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"],
              0, 8,
              3, 15,
              6, 25,
              10, 40,
            ],
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(0, 0, 0, 0)",
              0.1, "rgba(99, 102, 241, 0.3)",
              0.3, "rgba(139, 92, 246, 0.5)",
              0.5, "rgba(234, 179, 8, 0.6)",
              0.7, "rgba(249, 115, 22, 0.75)",
              0.9, "rgba(239, 68, 68, 0.85)",
              1, "rgba(255, 255, 255, 0.95)",
            ],
            "heatmap-opacity": [
              "interpolate", ["linear"], ["zoom"],
              0, 0.9,
              8, 0.7,
              12, 0.4,
            ],
          },
        })
      } else {
        map.setLayoutProperty(heatLayer, "visibility", "visible")
      }
    } else {
      if (hasHeatLayer) {
        map.setLayoutProperty(heatLayer, "visibility", "none")
      }

      if (!hasPointLayers) {
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
      } else {
        pointLayers.forEach((l) => map.setLayoutProperty(l, "visibility", "visible"))
      }
    }

    return () => {
      try {
        for (const l of [heatLayer, pointDot, pointInner, pointOuter]) {
          if (map.getLayer(l)) map.removeLayer(l)
        }
        if (map.getSource(src)) map.removeSource(src)
      } catch { /* */ }
    }
  }, [isLoaded, map, filteredEvents, viewMode, src, pointOuter, pointInner, pointDot, heatLayer])

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
