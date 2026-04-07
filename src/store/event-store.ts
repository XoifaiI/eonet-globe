import { create } from "zustand"
import type { EONETEvent } from "@/types"

interface EventState {
  events: EONETEvent[]
  selectedEvent: EONETEvent | null
  loading: boolean
  error: string | null
  setEvents: (events: EONETEvent[]) => void
  setSelectedEvent: (event: EONETEvent | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  selectedEvent: null,
  loading: false,
  error: null,
  setEvents: (events) => set({ events }),
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
