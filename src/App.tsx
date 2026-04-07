import { useMemo, useRef, memo, useCallback, useEffect, startTransition, lazy, Suspense } from "react"
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MapPopup,
  useMap,
  type MapRef,
} from "@/components/ui/map"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Toaster } from "@/components/ui/sonner"
import { Toggle } from "@/components/ui/toggle"
import { Progress } from "@/components/ui/progress"
import { useEONET } from "@/hooks/use-eonet"
import { useEventStore } from "@/store/event-store"
import { useAuthStore } from "@/store/auth-store"
import {
  getCategoryColor,
  getCategoryEmoji,
  getCategoryIcon,
  getLatestCoordinates,
  formatEventDate,
  getCategoryIllustration,
  timeAgo,
  getEventDuration,
  CATEGORY_COLORS,
} from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR, MS_PER_WEEK } from "@/lib/constants"
import { useGoogleAuth } from "@/hooks/use-google-auth"
import { useFuzzySearch } from "@/hooks/use-fuzzy-search"
import { useVirtualizer } from "@tanstack/react-virtual"
const EventDetailDialog = lazy(() => import("@/components/events/EventDetailDialog"))
import EventClusterLayer from "@/components/EventClusterLayer"
import {
  Globe,
  Search,
  X,
  ExternalLink,
  AlertCircle,
  Satellite,
  Layers,
  LogOut,
  Camera,
} from "lucide-react"
import type { EONETEvent } from "@/types"

const ITEM_HEIGHT = 40

function FlyToHandler() {
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

function SelectedEventPopup() {
  const selectedEvent = useEventStore((s) => s.selectedEvent)
  const setSelectedEvent = useEventStore((s) => s.setSelectedEvent)
  const user = useAuthStore((s) => s.user)

  if (!selectedEvent) return null

  const coords = getLatestCoordinates(selectedEvent)
  if (!coords) return null

  const latestGeo = selectedEvent.geometry[selectedEvent.geometry.length - 1]
  const illustration = getCategoryIllustration(selectedEvent)
  const color = getCategoryColor(selectedEvent)
  const Icon = getCategoryIcon(selectedEvent)
  const isOpen = selectedEvent.closed === null
  const observationCount = selectedEvent.geometry.length
  const duration = getEventDuration(selectedEvent)

  return (
    <>
      <MapMarker longitude={coords[0]} latitude={coords[1]}>
        <MarkerContent>
          <div
            className="flex items-center justify-center h-9 w-9 rounded-full shadow-lg border-2"
            style={{
              backgroundColor: `${color}20`,
              borderColor: color,
              boxShadow: `0 0 12px ${color}60`,
            }}
          >
            <span className="text-base leading-none">{getCategoryEmoji(selectedEvent)}</span>
          </div>
        </MarkerContent>
      </MapMarker>
      <MapPopup
        longitude={coords[0]}
        latitude={coords[1]}
        onClose={() => setSelectedEvent(null)}
        className="w-80"
      >
        <Card size="sm" className="overflow-hidden">
          {illustration && (
            <div className="relative h-24 -mb-3">
              <img src={illustration} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-card" />
              <div className="absolute top-2 left-2 flex gap-1">
                <Badge
                  className="text-[9px] h-5 backdrop-blur-sm"
                  style={{ backgroundColor: `${color}cc`, color: "#fff" }}
                >
                  <Icon className="h-2.5 w-2.5 mr-0.5" />
                  {selectedEvent.categories[0]?.title}
                </Badge>
                {isOpen ? (
                  <Badge className="text-[9px] h-5 bg-green-600/90 text-white backdrop-blur-sm">
                    Active
                  </Badge>
                ) : (
                  <Badge className="text-[9px] h-5 bg-muted/80 text-muted-foreground backdrop-blur-sm">
                    Closed
                  </Badge>
                )}
              </div>
            </div>
          )}
          <CardHeader className="relative">
            <CardTitle className="text-xs leading-tight">
              {selectedEvent.title}
            </CardTitle>
            <CardDescription className="text-[10px] flex items-center gap-1.5">
              {formatEventDate(selectedEvent)}
              {latestGeo && (
                <span className="text-muted-foreground/60">
                  ({timeAgo(latestGeo.date)})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!illustration && (
              <div className="flex flex-wrap gap-1">
                <Badge
                  className="text-[10px] h-5"
                  style={{ backgroundColor: `${color}20`, color, borderColor: `${color}30` }}
                >
                  <Icon className="h-2.5 w-2.5 mr-0.5" />
                  {selectedEvent.categories[0]?.title}
                </Badge>
                {isOpen ? (
                  <Badge className="text-[10px] h-5 bg-green-500/10 text-green-500 border-green-500/20">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    Closed
                  </Badge>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {latestGeo?.magnitudeValue && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Magnitude</p>
                  <p className="text-xs font-medium tabular-nums">
                    {latestGeo.magnitudeValue} <span className="text-[9px] text-muted-foreground font-normal">{latestGeo.magnitudeUnit}</span>
                  </p>
                </div>
              )}
              <div className="rounded-md bg-muted/50 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground">Coordinates</p>
                <p className="text-xs font-medium font-mono tabular-nums">
                  {coords[1].toFixed(2)}, {coords[0].toFixed(2)}
                </p>
              </div>
              {duration !== null && duration > 0 && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Duration</p>
                  <p className="text-xs font-medium tabular-nums">
                    {duration} <span className="text-[9px] text-muted-foreground font-normal">{duration === 1 ? "day" : "days"}</span>
                  </p>
                </div>
              )}
              {observationCount > 1 && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Observations</p>
                  <p className="text-xs font-medium tabular-nums">
                    {observationCount} <span className="text-[9px] text-muted-foreground font-normal">points</span>
                  </p>
                </div>
              )}
            </div>

            {selectedEvent.sources.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">Sources:</span>
                  {selectedEvent.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {source.id}
                    </a>
                  ))}
                </div>
              </>
            )}

            {selectedEvent.link && (
              <a
                href={selectedEvent.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline transition-colors"
              >
                <Globe className="h-2.5 w-2.5" />
                View on EONET
              </a>
            )}
          </CardContent>
          <CardFooter>
            <Button
              size="sm"
              className="w-full text-[10px] h-7"
              onClick={() => useEventStore.getState().setDetailOpen(true)}
            >
              {user ? "View Details & Upload Photos" : "View Full Details"}
            </Button>
          </CardFooter>
        </Card>
      </MapPopup>
    </>
  )
}

function AuthFooter() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  useGoogleAuth(googleButtonRef)

  return (
    <CardFooter className={user ? "gap-3" : "flex-col gap-2"}>
      {user ? (
        <>
          <Avatar className="h-7 w-7 ring-1 ring-border">
            <AvatarImage src={user.picture} alt={user.username} />
            <AvatarFallback className="text-[10px]">
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{user.username}</span>
            <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />
          Sign in to upload photos
        </div>
      )}
      <div ref={googleButtonRef} className={user ? "hidden" : ""} />
    </CardFooter>
  )
}

const SidebarItem = memo(function SidebarItem({
  event,
  isSelected,
  onSelect,
}: {
  event: EONETEvent
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = getCategoryIcon(event)
  const color = CATEGORY_COLORS[event.categories[0]?.id || ""] || DEFAULT_CATEGORY_COLOR

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors duration-100 flex items-center gap-2 cursor-pointer ${
        isSelected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-muted/60"
      }`}
    >
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : `${color}15`,
        }}
      >
        <Icon
          className="h-3 w-3"
          style={{ color: isSelected ? "currentColor" : color }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate block leading-tight">{event.title}</span>
        <span
          className={`text-[10px] ${
            isSelected ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {formatEventDate(event)}
        </span>
      </div>
    </button>
  )
})

function VirtualEventList({
  events,
  selectedId,
  onSelect,
}: {
  events: EONETEvent[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="flex-1 overflow-auto scrollbar-thin">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const event = events[row.index]
          return (
            <div
              key={event.id}
              className="absolute left-0 right-0 pr-1"
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <SidebarItem
                event={event}
                isSelected={event.id === selectedId}
                onSelect={() => onSelect(event.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventSidebar() {
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
    () =>
      events.reduce<Record<string, number>>((acc, event) => {
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
      })
    },
    [setSelectedEvent]
  )

  return (
    <Card
      size="sm"
      className="absolute top-4 left-4 z-10 w-80 max-h-[calc(100vh-2rem)] flex flex-col bg-background/95 backdrop-blur-md shadow-2xl"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle>EONET Live</CardTitle>
            <CardDescription className="text-[10px]">
              NASA Earth Observatory Natural Events
            </CardDescription>
          </div>
        </div>
        {!loading && (
          <CardAction>
            <Badge variant="outline" className="text-[10px] h-5 font-mono tabular-nums">
              {events.length}
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className="h-8 text-xs pl-8 pr-8"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {loading && (
          <div className="space-y-2 py-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2">
                <Skeleton className="h-6 w-6 rounded-md shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-wrap gap-1">
              {categoryFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground"
                  onClick={() => setCategoryFilter(null)}
                >
                  <X className="h-2.5 w-2.5 mr-0.5" />
                  Clear
                </Button>
              )}
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const isActive = categoryFilter === cat
                return (
                  <Badge
                    key={cat}
                    variant={isActive ? "default" : "secondary"}
                    className="text-[10px] gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setCategoryFilter(isActive ? null : cat)}
                  >
                    {cat}
                    <span
                      className={
                        isActive
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }
                    >
                      {count}
                    </span>
                  </Badge>
                )
              })}
            </div>

            <Separator />

            {filteredEvents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No events match your filters
              </p>
            )}

            <VirtualEventList
              events={filteredEvents}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </>
        )}
      </CardContent>

      <AuthFooter />
    </Card>
  )
}

const StatsCard = memo(function StatsCard() {
  const events = useEventStore((s) => s.events)
  const loading = useEventStore((s) => s.loading)

  const stats = useMemo(() => {
    const cats = new Set(events.map((e) => e.categories[0]?.id))
    const now = Date.now()
    let recentCount = 0
    let topCategory = ""
    let topCategoryId = ""
    let topCount = 0
    const catCounts = new globalThis.Map<string, { title: string; id: string; count: number }>()

    for (const e of events) {
      const geo = e.geometry[e.geometry.length - 1]
      if (geo && now - new Date(geo.date).getTime() < MS_PER_WEEK) recentCount++
      const cat = e.categories[0]
      if (!cat) continue
      const existing = catCounts.get(cat.id)
      const c = existing ? existing.count + 1 : 1
      catCounts.set(cat.id, { title: cat.title, id: cat.id, count: c })
      if (c > topCount) { topCount = c; topCategory = cat.title; topCategoryId = cat.id }
    }

    return { categories: cats.size, recentCount, topCategory, topCategoryId, topCount }
  }, [events])

  if (loading || events.length === 0) return null

  const topColor = CATEGORY_COLORS[stats.topCategoryId] || DEFAULT_CATEGORY_COLOR
  const TopIcon = getCategoryIcon({ categories: [{ id: stats.topCategoryId, title: stats.topCategory }] } as EONETEvent)

  return (
    <Card
      size="sm"
      className="absolute top-4 right-4 z-10 w-56 bg-background/95 backdrop-blur-md shadow-2xl"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Satellite className="h-3.5 w-3.5 text-green-500" />
          <CardTitle className="text-xs">EONET Monitor</CardTitle>
        </div>
        <CardAction>
          <Badge variant="outline" className="text-[9px] h-5 gap-1 font-normal">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            Live
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-bold tabular-nums tracking-tighter">
            {events.length}
          </span>
          <CardDescription className="text-[10px]">
            events tracked
          </CardDescription>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Categories</span>
            <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">
              {stats.categories}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last 7 days</span>
            <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">
              {stats.recentCount}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Most active</span>
            <Badge className="text-[10px] h-5 gap-1" style={{ backgroundColor: `${topColor}20`, color: topColor, borderColor: `${topColor}30` }}>
              <TopIcon className="h-2.5 w-2.5" />
              {stats.topCategory}
            </Badge>
          </div>
        </div>

        <Progress
          value={stats.topCount}
          max={events.length}
          aria-label={`${stats.topCategory}: ${stats.topCount} of ${events.length} events`}
          className="h-1"
          indicatorClassName="rounded-full"
          style={{ backgroundColor: `${topColor}15` } as React.CSSProperties}
        />
      </CardContent>
    </Card>
  )
})

const LegendCard = memo(function LegendCard() {
  const events = useEventStore((s) => s.events)
  const categoryFilter = useEventStore((s) => s.categoryFilter)
  const setCategoryFilter = useEventStore((s) => s.setCategoryFilter)

  const activeCategories = useMemo(() => {
    const cats = new globalThis.Map<string, { id: string; title: string; count: number }>()
    for (const event of events) {
      const cat = event.categories[0]
      if (!cat) continue
      const existing = cats.get(cat.id)
      if (existing) existing.count++
      else cats.set(cat.id, { id: cat.id, title: cat.title, count: 1 })
    }
    return [...cats.values()].sort((a, b) => b.count - a.count)
  }, [events])

  const handleToggle = useCallback(
    (title: string) => {
      setCategoryFilter(categoryFilter === title ? null : title)
    },
    [categoryFilter, setCategoryFilter]
  )

  if (activeCategories.length === 0) return null

  return (
    <Card size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-md shadow-2xl max-w-[calc(100vw-22rem)]">
      <CardContent className="p-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Filter
          </span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-1 flex-wrap">
          {activeCategories.map((cat) => {
            const isActive = categoryFilter === cat.title
            const color = CATEGORY_COLORS[cat.id] || DEFAULT_CATEGORY_COLOR

            return (
              <Toggle
                key={cat.id}
                pressed={isActive}
                onPressedChange={() => handleToggle(cat.title)}
                size="sm"
                className={`h-6 px-2 gap-1.5 text-[10px] ${
                  categoryFilter && !isActive ? "opacity-40" : ""
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: color,
                    boxShadow: isActive ? `0 0 6px ${color}80` : "none",
                  }}
                />
                {cat.title}
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                  {cat.count}
                </Badge>
              </Toggle>
            )
          })}
          {categoryFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground"
              onClick={() => setCategoryFilter(null)}
            >
              <X className="h-3 w-3 mr-0.5" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

export default function App() {
  useEONET()
  const mapRef = useRef<MapRef>(null)

  return (
    <div className="h-screen w-screen dark">
        <Map ref={mapRef} center={[10, 20]} zoom={2} className="h-full w-full">
          <MapControls position="bottom-right" showZoom showCompass showFullscreen />
          <FlyToHandler />
          <EventClusterLayer />
          <SelectedEventPopup />
        </Map>

        <EventSidebar />
        <StatsCard />
        <LegendCard />
        <Suspense>
          <EventDetailDialog />
        </Suspense>
        <Toaster position="bottom-center" />
      </div>
  )
}
