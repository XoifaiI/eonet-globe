import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useEventStore } from "@/store/event-store"
import { useAuthStore } from "@/store/auth-store"
import type { UserImage } from "@/types"
import { X, Upload, Calendar, ExternalLink } from "lucide-react"

export default function EventPanel() {
  const { selectedEvent, setSelectedEvent } = useEventStore()
  const { user } = useAuthStore()
  const [images, setImages] = useState<UserImage[]>([])
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectedEvent) return

    fetch(`/api/images/${selectedEvent.id}`)
      .then((res) => res.json())
      .then(setImages)
      .catch(() => setImages([]))
  }, [selectedEvent])

  async function handleUpload() {
    if (!selectedEvent || !user || !fileInputRef.current?.files?.[0]) return

    setUploading(true)
    const formData = new FormData()
    formData.append("image", fileInputRef.current.files[0])
    formData.append("caption", caption)

    try {
      const res = await fetch(`/api/images/${selectedEvent.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      })

      if (res.ok) {
        const newImage = await res.json()
        setImages((prev) => [...prev, newImage])
        setCaption("")
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    } finally {
      setUploading(false)
    }
  }

  if (!selectedEvent) return null

  const latestGeo = selectedEvent.geometry[selectedEvent.geometry.length - 1]
  const eventDate = latestGeo ? new Date(latestGeo.date).toLocaleDateString() : "Unknown"

  return (
    <div className="absolute right-0 top-0 h-full w-96 z-10">
      <Card className="h-full rounded-none border-l bg-background/95 backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1 pr-4">
            <CardTitle className="text-lg leading-tight">{selectedEvent.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {eventDate}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSelectedEvent(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-6 pb-6">
          <div className="flex flex-wrap gap-2">
            {selectedEvent.categories.map((cat) => (
              <Badge key={cat.id} variant="secondary">
                {cat.title}
              </Badge>
            ))}
            {latestGeo?.magnitudeValue && (
              <Badge variant="outline">
                {latestGeo.magnitudeValue} {latestGeo.magnitudeUnit}
              </Badge>
            )}
          </div>

          {selectedEvent.sources[0] && (
            <a
              href={selectedEvent.sources[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Source
            </a>
          )}

          <Separator />

          <ScrollArea className="flex-1 -mx-6 px-6" style={{ maxHeight: "calc(100vh - 380px)" }}>
            <h4 className="text-sm font-medium mb-3">
              Community Photos ({images.length})
            </h4>

            {images.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No photos yet. Be the first to contribute!
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {images.map((img) => (
                <div key={img.id} className="space-y-1">
                  <img
                    src={`/api/uploads/${img.filename}`}
                    alt={img.caption || "Event photo"}
                    className="w-full aspect-square object-cover rounded-md"
                    loading="lazy"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground truncate">{img.caption}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70">by {img.username}</p>
                </div>
              ))}
            </div>
          </ScrollArea>

          {user && (
            <div className="space-y-2 pt-2 border-t">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                id="image-upload"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Choose
                </Button>
                <Input
                  placeholder="Caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={uploading}
                onClick={handleUpload}
              >
                {uploading ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>
          )}

          {!user && (
            <p className="text-sm text-muted-foreground text-center pt-2 border-t">
              Sign in to upload photos
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
