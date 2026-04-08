import { create } from "zustand"
import type { EONETEvent } from "@/types"

type CategoryFilter = string | null
type ViewMode = "points" | "heatmap"
type BasemapStyle = "dark" | "satellite" | "terrain"

interface EventState {
  events: EONETEvent[]
  eventsById: globalThis.Map<string, EONETEvent>
  selectedEvent: EONETEvent | null
  loading: boolean
  error: string | null
  categoryFilter: CategoryFilter
  searchQuery: string
  detailOpen: boolean
  viewMode: ViewMode
  basemap: BasemapStyle
  sidebarOpen: boolean
  filterOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setFilterOpen: (open: boolean) => void
  setEvents: (events: EONETEvent[]) => void
  setSelectedEvent: (event: EONETEvent | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCategoryFilter: (filter: CategoryFilter) => void
  setSearchQuery: (query: string) => void
  setDetailOpen: (open: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setBasemap: (style: BasemapStyle) => void
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  eventsById: new globalThis.Map(),
  selectedEvent: null,
  loading: false,
  error: null,
  categoryFilter: null,
  searchQuery: "",
  detailOpen: false,
  viewMode: "points" as ViewMode,
  basemap: "dark" as BasemapStyle,
  sidebarOpen: false,
  filterOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setFilterOpen: (filterOpen) => set({ filterOpen }),
  setEvents: (events) => {
    const eventsById = new globalThis.Map<string, EONETEvent>()
    for (const e of events) eventsById.set(e.id, e)
    set({ events, eventsById })
  },
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
  setBasemap: (basemap) => set({ basemap }),
}))
