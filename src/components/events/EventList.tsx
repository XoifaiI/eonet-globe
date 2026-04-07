import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEventStore } from "@/store/event-store"
import { Flame, CloudLightning, Mountain, Waves, Loader2 } from "lucide-react"
import type { EONETEvent } from "@/types"

const CATEGORY_ICONS: Record<string, typeof Flame> = {
  wildfires: Flame,
  severeStorms: CloudLightning,
  volcanoes: Mountain,
  floods: Waves,
}

function getCategoryIcon(event: EONETEvent) {
  const id = event.categories[0]?.id || ""
  return CATEGORY_ICONS[id] || Flame
}

export default function EventList() {
  const { events, selectedEvent, setSelectedEvent, loading } = useEventStore()

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading events...
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {events.map((event) => {
          const Icon = getCategoryIcon(event)
          const isSelected = selectedEvent?.id === event.id
          return (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(isSelected ? null : event)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{event.title}</span>
              <Badge variant={isSelected ? "outline" : "secondary"} className="text-xs shrink-0">
                {event.categories[0]?.title || "Event"}
              </Badge>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
