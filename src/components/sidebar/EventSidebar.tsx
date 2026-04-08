import { useMemo, useRef, memo, useCallback, startTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useEventStore } from "@/store/event-store"
import { useIsMobile } from "@/hooks/use-mobile"
import { useFuzzySearch } from "@/hooks/use-fuzzy-search"
import { useVirtualizer } from "@tanstack/react-virtual"
import { getCategoryIcon, formatEventDate, CATEGORY_COLORS } from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants"
import AuthFooter from "@/components/sidebar/AuthFooter"
import { Globe, Search, X, AlertCircle, List } from "lucide-react"
import type { EONETEvent } from "@/types"

const ITEM_HEIGHT = 40

const SidebarItem = memo(function SidebarItem({
  event, isSelected, onSelect,
}: {
  event: EONETEvent; isSelected: boolean; onSelect: () => void
}) {
  const Icon = getCategoryIcon(event)
  const color = CATEGORY_COLORS[event.categories[0]?.id || ""] || DEFAULT_CATEGORY_COLOR

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      onClick={onSelect}
      className={`w-full justify-start px-2 py-1.5 h-auto text-xs gap-2 ${
        isSelected ? "shadow-sm" : "hover:bg-muted/60"
      }`}
    >
      <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : `${color}15` }}>
        <Icon className="h-3 w-3" style={{ color: isSelected ? "currentColor" : color }} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <span className="truncate block leading-tight">{event.title}</span>
        <span className={`text-[10px] ${isSelected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{formatEventDate(event)}</span>
      </div>
    </Button>
  )
})

function VirtualEventList({ events, selectedId, onSelect }: { events: EONETEvent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: events.length, getScrollElement: () => parentRef.current, estimateSize: () => ITEM_HEIGHT, overscan: 10 })

  return (
    <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const event = events[row.index]
          return (
            <div key={event.id} className="absolute left-0 right-0 pr-1" style={{ height: row.size, transform: `translateY(${row.start}px)` }}>
              <SidebarItem event={event} isSelected={event.id === selectedId} onSelect={() => onSelect(event.id)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SidebarContent({ onSelectEvent }: { onSelectEvent?: () => void }) {
  const events = useEventStore((s) => s.events)
  const selectedId = useEventStore((s) => s.selectedEvent?.id ?? null)
  const setSelectedEvent = useEventStore((s) => s.setSelectedEvent)
  const loading = useEventStore((s) => s.loading)
  const error = useEventStore((s) => s.error)
  const categoryFilter = useEventStore((s) => s.categoryFilter)
  const setCategoryFilter = useEventStore((s) => s.setCategoryFilter)
  const searchQuery = useEventStore((s) => s.searchQuery)
  const setSearchQuery = useEventStore((s) => s.setSearchQuery)

  const categoryCounts = useMemo(
    () => events.reduce<Record<string, number>>((acc, event) => {
      const cat = event.categories[0]?.title || "Other"
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {}),
    [events]
  )

  const filteredEvents = useFuzzySearch(events, searchQuery, categoryFilter)

  const handleSelect = useCallback(
    (eventId: string) => {
      startTransition(() => {
        const state = useEventStore.getState()
        const current = state.selectedEvent?.id
        const next = current === eventId ? null : state.eventsById.get(eventId) ?? null
        setSelectedEvent(next)
        if (next && onSelectEvent) onSelectEvent()
      })
    },
    [setSelectedEvent, onSelectEvent]
  )

  return (
    <>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search events..." value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} className="h-8 text-xs pl-8 pr-8" />
          {searchQuery && (
            <Button variant="ghost" size="icon" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {loading && (
          <div className="space-y-2 py-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2">
                <Skeleton className="h-6 w-6 rounded-md shrink-0" />
                <div className="flex-1 space-y-1"><Skeleton className="h-3 w-full" /><Skeleton className="h-2 w-16" /></div>
              </div>
            ))}
          </div>
        )}

        {error && <Alert variant="destructive" className="text-xs"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        {!loading && !error && (
          <>
            <div className="flex flex-wrap gap-1">
              {categoryFilter && (
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-muted-foreground" onClick={() => setCategoryFilter(null)}>
                  <X className="h-2.5 w-2.5 mr-0.5" />Clear
                </Button>
              )}
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const isActive = categoryFilter === cat
                return (
                  <Badge key={cat} variant={isActive ? "default" : "secondary"} className="text-[10px] gap-1 cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => setCategoryFilter(isActive ? null : cat)}>
                    {cat}<span className={isActive ? "text-primary-foreground/70" : "text-muted-foreground"}>{count}</span>
                  </Badge>
                )
              })}
            </div>
            <Separator />
            {filteredEvents.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No events match your filters</p>}
            <VirtualEventList events={filteredEvents} selectedId={selectedId} onSelect={handleSelect} />
          </>
        )}
      </CardContent>

      <AuthFooter />
    </>
  )
}

export default function EventSidebar() {
  const isMobile = useIsMobile()
  const events = useEventStore((s) => s.events)
  const loading = useEventStore((s) => s.loading)
  const selectedEvent = useEventStore((s) => s.selectedEvent)
  const mobileOpen = useEventStore((s) => s.sidebarOpen)
  const setSidebarOpen = useEventStore((s) => s.setSidebarOpen)

  useEffect(() => {
    if (isMobile && selectedEvent) {
      setSidebarOpen(false)
    }
  }, [isMobile, selectedEvent, setSidebarOpen])

  if (isMobile) {
    return (
      <>
        {!selectedEvent && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 left-4 z-10 h-10 w-10 bg-background/95 backdrop-blur-md shadow-2xl"
            onClick={() => setSidebarOpen(true)}
          >
            <List className="h-4 w-4" />
          </Button>
        )}
        <Drawer direction="left" open={mobileOpen} onOpenChange={setSidebarOpen}>
          <DrawerContent className="h-full w-[85vw] max-w-80 flex flex-col">
            <DrawerHeader className="pb-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DrawerTitle className="text-sm">EONET Live</DrawerTitle>
                  <p className="text-[10px] text-muted-foreground">NASA Earth Observatory Natural Events</p>
                </div>
                {!loading && (
                  <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums ml-auto">{events.length}</Badge>
                )}
              </div>
            </DrawerHeader>
            <SidebarContent onSelectEvent={() => setSidebarOpen(false)} />
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Card size="sm" className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-2rem)] flex flex-col bg-background/95 backdrop-blur-md shadow-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle>EONET Live</CardTitle>
            <CardDescription className="text-[10px]">NASA Earth Observatory Natural Events</CardDescription>
          </div>
        </div>
        {!loading && (
          <CardAction>
            <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">{events.length}</Badge>
          </CardAction>
        )}
      </CardHeader>

      <SidebarContent />
    </Card>
  )
}
