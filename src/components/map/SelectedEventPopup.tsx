import { Fragment } from "react"
import {
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  MapPopup,
  MapRoute,
} from "@/components/ui/map"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useEventStore } from "@/store/event-store"
import { useAuthStore } from "@/store/auth-store"
import { useStyleReady } from "@/components/BasemapController"
import {
  getCategoryColor,
  getCategoryEmoji,
  getCategoryIcon,
  getLatestCoordinates,
  formatEventDate,
  getCategoryIllustration,
  timeAgo,
  getEventDuration,
} from "@/lib/eonet"
import { Globe, ExternalLink } from "lucide-react"

export default function SelectedEventPopup() {
  const selectedEvent = useEventStore((s) => s.selectedEvent)
  const setSelectedEvent = useEventStore((s) => s.setSelectedEvent)
  const styleReady = useStyleReady((s) => s.ready)
  const styleVersion = useStyleReady((s) => s.version)
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

  const hasTrajectory = selectedEvent.geometry.length > 1
  const trajectoryCoords = hasTrajectory
    ? selectedEvent.geometry
        .filter((g) => g.type === "Point" && g.coordinates)
        .map((g) => g.coordinates as [number, number])
    : []

  return (
    <>
      {hasTrajectory && styleReady && (
        <Fragment key={`trajectory-${selectedEvent.id}-${styleVersion}`}>
          <MapRoute coordinates={trajectoryCoords} color={color} width={3} opacity={0.6} interactive={false} />
          <MapRoute coordinates={trajectoryCoords} color={color} width={1} opacity={0.9} interactive={false} />
          {selectedEvent.geometry
            .filter((g) => g.type === "Point" && g.coordinates)
            .slice(0, -1)
            .map((g, i) => {
              const time = new Date(g.date).toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })
              const mag = g.magnitudeValue ? `${g.magnitudeValue} ${g.magnitudeUnit || ""}` : null

              return (
                <MapMarker key={`${selectedEvent.id}-wp-${i}`} longitude={g.coordinates[0]} latitude={g.coordinates[1]}>
                  <MarkerContent>
                    <div className="h-2.5 w-2.5 rounded-full border border-white/60 transition-transform hover:scale-150" style={{ backgroundColor: color }} />
                  </MarkerContent>
                  <MarkerTooltip className="text-xs">
                    <div className="font-medium">{time}</div>
                    {mag && <div className="text-muted-foreground">{mag}</div>}
                    <div className="text-muted-foreground text-[10px]">{g.coordinates[1].toFixed(2)}, {g.coordinates[0].toFixed(2)}</div>
                  </MarkerTooltip>
                </MapMarker>
              )
            })}
        </Fragment>
      )}

      <MapMarker longitude={coords[0]} latitude={coords[1]}>
        <MarkerContent>
          <div
            className="flex items-center justify-center h-9 w-9 rounded-full shadow-lg border-2"
            style={{ backgroundColor: `${color}20`, borderColor: color, boxShadow: `0 0 12px ${color}60` }}
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
        anchor="bottom"
        offset={hasTrajectory ? [0, -30] as [number, number] : [0, -15] as [number, number]}
      >
        <Card size="sm" className="overflow-hidden">
          {illustration && (
            <div className="relative h-24 -mb-3">
              <img src={illustration} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-card" />
              <div className="absolute top-2 left-2 flex gap-1">
                <Badge className="text-[9px] h-5 backdrop-blur-sm" style={{ backgroundColor: `${color}cc`, color: "#fff" }}>
                  <Icon className="h-2.5 w-2.5 mr-0.5" />
                  {selectedEvent.categories[0]?.title}
                </Badge>
                <Badge className={`text-[9px] h-5 backdrop-blur-sm ${isOpen ? "bg-green-600/90 text-white" : "bg-muted/80 text-muted-foreground"}`}>
                  {isOpen ? "Active" : "Closed"}
                </Badge>
              </div>
            </div>
          )}
          <CardHeader className="relative">
            <CardTitle className="text-xs leading-tight">{selectedEvent.title}</CardTitle>
            <CardDescription className="text-[10px] flex items-center gap-1.5">
              {formatEventDate(selectedEvent)}
              {latestGeo && <span className="text-muted-foreground/60">({timeAgo(latestGeo.date)})</span>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!illustration && (
              <div className="flex flex-wrap gap-1">
                <Badge className="text-[10px] h-5" style={{ backgroundColor: `${color}20`, color, borderColor: `${color}30` }}>
                  <Icon className="h-2.5 w-2.5 mr-0.5" />{selectedEvent.categories[0]?.title}
                </Badge>
                <Badge className={`text-[10px] h-5 ${isOpen ? "bg-green-500/10 text-green-500 border-green-500/20" : ""}`} variant={isOpen ? undefined : "secondary"}>
                  {isOpen ? "Active" : "Closed"}
                </Badge>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {latestGeo?.magnitudeValue && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Magnitude</p>
                  <p className="text-xs font-medium tabular-nums">{latestGeo.magnitudeValue} <span className="text-[9px] text-muted-foreground font-normal">{latestGeo.magnitudeUnit}</span></p>
                </div>
              )}
              <div className="rounded-md bg-muted/50 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground">Coordinates</p>
                <p className="text-xs font-medium font-mono tabular-nums">{coords[1].toFixed(2)}, {coords[0].toFixed(2)}</p>
              </div>
              {duration !== null && duration > 0 && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Duration</p>
                  <p className="text-xs font-medium tabular-nums">{duration} <span className="text-[9px] text-muted-foreground font-normal">{duration === 1 ? "day" : "days"}</span></p>
                </div>
              )}
              {observationCount > 1 && (
                <div className="rounded-md bg-muted/50 px-2 py-1.5">
                  <p className="text-[9px] text-muted-foreground">Observations</p>
                  <p className="text-xs font-medium tabular-nums">{observationCount} <span className="text-[9px] text-muted-foreground font-normal">points</span></p>
                </div>
              )}
            </div>
            {selectedEvent.sources.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">Sources:</span>
                  {selectedEvent.sources.map((source) => (
                    <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                      <ExternalLink className="h-2.5 w-2.5" />{source.id}
                    </a>
                  ))}
                </div>
              </>
            )}
            {selectedEvent.link && (
              <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline transition-colors">
                <Globe className="h-2.5 w-2.5" />View on EONET
              </a>
            )}
          </CardContent>
          <CardFooter>
            <Button size="sm" className="w-full text-[10px] h-7" onClick={() => useEventStore.getState().setDetailOpen(true)}>
              {user ? "View Details & Upload Photos" : "View Full Details"}
            </Button>
          </CardFooter>
        </Card>
      </MapPopup>
    </>
  )
}
