import { useEffect } from "react"
import { useEventStore } from "@/store/event-store"

const EONET_ENDPOINT = "/api/eonet/events"

let cached: Promise<unknown[]> | null = null

function fetchEvents(): Promise<unknown[]> {
  if (cached) return cached

  cached = (async () => {
    const res = await fetch(EONET_ENDPOINT)
    if (!res.ok) {
      cached = null
      throw new Error(`EONET API returned ${res.status}`)
    }
    const data = await res.json()
    return data.events
  })()

  cached.catch(() => { cached = null })
  return cached
}

export function useEONET() {
  const setEvents = useEventStore((s) => s.setEvents)
  const setLoading = useEventStore((s) => s.setLoading)
  const setError = useEventStore((s) => s.setError)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchEvents()
      .then((events) => { if (!cancelled) setEvents(events as ReturnType<typeof useEventStore.getState>["events"]) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [setEvents, setLoading, setError])
}
