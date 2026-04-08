import { useMemo, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { useEventStore } from "@/store/event-store"
import { getCategoryIcon, CATEGORY_COLORS } from "@/lib/eonet"
import { DEFAULT_CATEGORY_COLOR, MS_PER_WEEK } from "@/lib/constants"
import { Satellite } from "lucide-react"
import type { EONETEvent } from "@/types"

export default memo(function StatsCard() {
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
    <Card size="sm" className="absolute top-4 right-4 z-10 w-56 bg-background/95 backdrop-blur-md shadow-2xl hidden lg:block">
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
          <span className="text-3xl font-bold tabular-nums tracking-tighter">{events.length}</span>
          <CardDescription className="text-[10px]">events tracked</CardDescription>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Categories</span>
            <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">{stats.categories}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last 7 days</span>
            <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">{stats.recentCount}</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Most active</span>
            <Badge className="text-[10px] h-5 gap-1" style={{ backgroundColor: `${topColor}20`, color: topColor, borderColor: `${topColor}30` }}>
              <TopIcon className="h-2.5 w-2.5" />{stats.topCategory}
            </Badge>
          </div>
        </div>
        <Progress value={stats.topCount} max={events.length} aria-label={`${stats.topCategory}: ${stats.topCount} of ${events.length} events`} className="h-1" indicatorClassName="rounded-full" style={{ backgroundColor: `${topColor}15` } as React.CSSProperties} />
      </CardContent>
    </Card>
  )
})
