import { useEffect } from "react"
import { useEventStore } from "@/store/event-store"
import type { EONETResponse } from "@/types"

const EONET_API = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50"

export function useEONET() {
  const { setEvents, setLoading, setError } = useEventStore()

  useEffect(() => {
    let cancelled = false

    async function fetchEvents() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(EONET_API)
        if (!response.ok) throw new Error(`EONET API returned ${response.status}`)

        const data: EONETResponse = await response.json()
        if (!cancelled) {
          setEvents(data.events)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch events")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvents()
    return () => {
      cancelled = true
    }
  }, [setEvents, setLoading, setError])
}
