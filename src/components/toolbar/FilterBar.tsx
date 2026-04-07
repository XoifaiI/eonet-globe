import { useMemo, useCallback, memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { useEventStore } from "@/store/event-store"
import { CATEGORY_COLORS } from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/constants"
import { Layers, MapPin, Flame, Moon, Satellite as SatelliteIcon, Mountain, X } from "lucide-react"

export default memo(function FilterBar() {
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

  if (activeCategories.length === 0) return null

  return (
    <Card size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-md shadow-2xl max-w-[calc(100vw-22rem)]">
      <CardContent className="p-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filter</span>
        </div>
        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-0.5 shrink-0">
          <Toggle pressed={viewMode === "points"} onPressedChange={() => setViewMode("points")} size="sm" className="h-6 px-2 gap-1 text-[10px]">
            <MapPin className="h-3 w-3" />Points
          </Toggle>
          <Toggle pressed={viewMode === "heatmap"} onPressedChange={() => setViewMode("heatmap")} size="sm" className="h-6 px-2 gap-1 text-[10px]">
            <Flame className="h-3 w-3" />Heatmap
          </Toggle>
        </div>
        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-0.5 shrink-0">
          <Toggle pressed={basemap === "dark"} onPressedChange={() => setBasemap("dark")} size="sm" className="h-6 px-2 gap-1 text-[10px]">
            <Moon className="h-3 w-3" />Dark
          </Toggle>
          <Toggle pressed={basemap === "satellite"} onPressedChange={() => setBasemap("satellite")} size="sm" className="h-6 px-2 gap-1 text-[10px]">
            <SatelliteIcon className="h-3 w-3" />Satellite
          </Toggle>
          <Toggle pressed={basemap === "terrain"} onPressedChange={() => setBasemap("terrain")} size="sm" className="h-6 px-2 gap-1 text-[10px]">
            <Mountain className="h-3 w-3" />3D Terrain
          </Toggle>
        </div>
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
    </Card>
  )
})
