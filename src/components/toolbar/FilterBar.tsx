import { useMemo, useCallback, memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useEventStore } from "@/store/event-store"
import { useIsMobile } from "@/hooks/use-mobile"
import { CATEGORY_COLORS } from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants"
import { Layers, MapPin, Flame, Moon, Satellite as SatelliteIcon, Mountain, X, SlidersHorizontal } from "lucide-react"

function useFilterState() {
  const events = useEventStore((s) => s.events)
  const categoryFilter = useEventStore((s) => s.categoryFilter)
  const setCategoryFilter = useEventStore((s) => s.setCategoryFilter)
  const viewMode = useEventStore((s) => s.viewMode)
  const setViewMode = useEventStore((s) => s.setViewMode)
  const basemap = useEventStore((s) => s.basemap)
  const setBasemap = useEventStore((s) => s.setBasemap)

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
    (title: string) => setCategoryFilter(categoryFilter === title ? null : title),
    [categoryFilter, setCategoryFilter]
  )

  return { activeCategories, categoryFilter, setCategoryFilter, viewMode, setViewMode, basemap, setBasemap, handleToggle }
}

function FilterControls({ vertical }: { vertical?: boolean }) {
  const { activeCategories, categoryFilter, setCategoryFilter, viewMode, setViewMode, basemap, setBasemap, handleToggle } = useFilterState()

  if (activeCategories.length === 0) return null

  if (vertical) {
    return (
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">View Mode</span>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v: string) => v && setViewMode(v as "points" | "heatmap")} className="w-full">
            <ToggleGroupItem value="points" className="flex-1 h-8 gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />Points
            </ToggleGroupItem>
            <ToggleGroupItem value="heatmap" className="flex-1 h-8 gap-1.5 text-xs">
              <Flame className="h-3.5 w-3.5" />Heatmap
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator />

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Basemap</span>
          <ToggleGroup type="single" value={basemap} onValueChange={(v: string) => v && setBasemap(v as "dark" | "satellite" | "terrain")} className="w-full">
            <ToggleGroupItem value="dark" className="flex-1 h-8 gap-1.5 text-xs">
              <Moon className="h-3.5 w-3.5" />Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="satellite" className="flex-1 h-8 gap-1.5 text-xs">
              <SatelliteIcon className="h-3.5 w-3.5" />Satellite
            </ToggleGroupItem>
            <ToggleGroupItem value="terrain" className="flex-1 h-8 gap-1.5 text-xs">
              <Mountain className="h-3.5 w-3.5" />3D
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
            {categoryFilter && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={() => setCategoryFilter(null)}>
                <X className="h-3 w-3 mr-0.5" />Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeCategories.map((cat) => {
              const isActive = categoryFilter === cat.title
              const color = CATEGORY_COLORS[cat.id] || DEFAULT_CATEGORY_COLOR
              return (
                <Toggle key={cat.id} pressed={isActive} onPressedChange={() => handleToggle(cat.title)} size="sm" className={`h-7 px-2.5 gap-1.5 text-xs ${categoryFilter && !isActive ? "opacity-40" : ""}`}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: isActive ? `0 0 6px ${color}80` : "none" }} />
                  {cat.title}
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{cat.count}</Badge>
                </Toggle>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <CardContent className="p-2 flex items-center gap-2">
      <div className="flex items-center gap-1.5 shrink-0">
        <Layers className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filter</span>
      </div>
      <Separator orientation="vertical" className="h-5" />

      <ToggleGroup type="single" value={viewMode} onValueChange={(v: string) => v && setViewMode(v as "points" | "heatmap")} className="shrink-0">
        <ToggleGroupItem value="points" size="sm" className="h-6 px-2 gap-1 text-[10px]">
          <MapPin className="h-3 w-3" />Points
        </ToggleGroupItem>
        <ToggleGroupItem value="heatmap" size="sm" className="h-6 px-2 gap-1 text-[10px]">
          <Flame className="h-3 w-3" />Heatmap
        </ToggleGroupItem>
      </ToggleGroup>
      <Separator orientation="vertical" className="h-5" />

      <ToggleGroup type="single" value={basemap} onValueChange={(v: string) => v && setBasemap(v as "dark" | "satellite" | "terrain")} className="shrink-0">
        <ToggleGroupItem value="dark" size="sm" className="h-6 px-2 gap-1 text-[10px]">
          <Moon className="h-3 w-3" />Dark
        </ToggleGroupItem>
        <ToggleGroupItem value="satellite" size="sm" className="h-6 px-2 gap-1 text-[10px]">
          <SatelliteIcon className="h-3 w-3" />Satellite
        </ToggleGroupItem>
        <ToggleGroupItem value="terrain" size="sm" className="h-6 px-2 gap-1 text-[10px]">
          <Mountain className="h-3 w-3" />3D Terrain
        </ToggleGroupItem>
      </ToggleGroup>
      <Separator orientation="vertical" className="h-5" />

      <div className="flex items-center gap-1 flex-wrap">
        {activeCategories.map((cat) => {
          const isActive = categoryFilter === cat.title
          const color = CATEGORY_COLORS[cat.id] || DEFAULT_CATEGORY_COLOR
          return (
            <Toggle key={cat.id} pressed={isActive} onPressedChange={() => handleToggle(cat.title)} size="sm" className={`h-6 px-2 gap-1.5 text-[10px] ${categoryFilter && !isActive ? "opacity-40" : ""}`}>
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: isActive ? `0 0 6px ${color}80` : "none" }} />
              {cat.title}
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{cat.count}</Badge>
            </Toggle>
          )
        })}
        {categoryFilter && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground" onClick={() => setCategoryFilter(null)}>
            <X className="h-3 w-3 mr-0.5" />Clear
          </Button>
        )}
      </div>
    </CardContent>
  )
}

export default memo(function FilterBar() {
  const isMobile = useIsMobile()
  const events = useEventStore((s) => s.events)
  const filterOpen = useEventStore((s) => s.filterOpen)
  const setFilterOpen = useEventStore((s) => s.setFilterOpen)
  const selectedEvent = useEventStore((s) => s.selectedEvent)

  const hasEvents = useMemo(() => {
    const cats = new Set<string>()
    for (const event of events) {
      const cat = event.categories[0]
      if (cat) cats.add(cat.id)
    }
    return cats.size > 0
  }, [events])

  if (!hasEvents) return null

  if (isMobile) {
    return (
      <>
        {!selectedEvent && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-md shadow-2xl gap-1.5"
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </Button>
        )}
        <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-sm">Filters & Map Settings</DrawerTitle>
            </DrawerHeader>
            <FilterControls vertical />
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Card size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-md shadow-2xl max-w-[calc(100vw-22rem)]">
      <FilterControls />
    </Card>
  )
})
