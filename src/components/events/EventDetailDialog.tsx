import { useEffect, useState, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { useEventStore } from "@/store/event-store"
import { useAuthStore } from "@/store/auth-store"
import {
  getCategoryColor,
  getCategoryIcon,
  formatEventDate,
  timeAgo,
  getCategoryIllustration,
  getLatestCoordinates,
  getEventDuration,
} from "@/lib/eonet"
import { loadAndValidateImage } from "@/lib/image-validation"
import type { UserImage } from "@/types"
import {
  Upload,
  Calendar,
  ExternalLink,
  MapPin,
  ImagePlus,
  CheckCircle,
  AlertCircle,
  Camera,
  Globe,
  Clock,
  Ruler,
  Eye,
  Copy,
  Loader2,
} from "lucide-react"

export default function EventDetailDialog() {
  const selectedEvent = useEventStore((s) => s.selectedEvent)
  const user = useAuthStore((s) => s.user)

  const [images, setImages] = useState<UserImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<UserImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detailOpen = useEventStore((s) => s.detailOpen)
  const setDetailOpen = useEventStore((s) => s.setDetailOpen)

  const eventId = selectedEvent?.id
  const open = detailOpen && !!selectedEvent

  useEffect(() => {
    if (!eventId) return
    setLoadingImages(true)
    setImages([])
    fetch(`/api/images/${encodeURIComponent(eventId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch images")
        return res.json()
      })
      .then((data) => { if (Array.isArray(data)) setImages(data) })
      .catch(() => setImages([]))
      .finally(() => setLoadingImages(false))
  }, [eventId])

  useEffect(() => {
    if (!uploadSuccess) return
    const timer = setTimeout(() => setUploadSuccess(false), 3000)
    return () => clearTimeout(timer)
  }, [uploadSuccess])

  const pollImageStatus = useCallback(
    async (imageEventId: string, imageId: string) => {
      const MAX_POLLS = 15
      const POLL_INTERVAL = 2000

      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL))

        try {
          const res = await fetch(`/api/images/${encodeURIComponent(imageEventId)}`)
          if (!res.ok) continue
          const images = await res.json()
          if (!Array.isArray(images)) continue

          const found = images.find((img: { id: string }) => img.id === imageId)
          if (found) {
            setImages((prev) => {
              const without = prev.filter((p) => p.id !== imageId)
              return [...without, found]
            })
            toast.success("Photo approved", {
              description: "Your photo is now visible to everyone",
            })
            return
          }
        } catch { /* continue polling */ }
      }

      setImages((prev) => prev.filter((p) => p.id !== imageId))
      toast.error("Photo not approved", {
        description: "Your image didn't pass content guidelines and was removed",
      })
    },
    []
  )

  const handleUpload = useCallback(async () => {
    if (!eventId || !user || !selectedFile) return
    setUploading(true)
    setUploadError("")

    const validation = await loadAndValidateImage(selectedFile)
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image")
      setUploading(false)
      return
    }

    const formData = new FormData()
    formData.append("image", selectedFile)
    formData.append("caption", caption)

    try {
      const res = await fetch(`/api/images/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setUploadError(data.error || "Upload failed")
        return
      }

      const newImage = await res.json()
      setImages((prev) => [...prev, { ...newImage, status: "processing" }])
      setCaption("")
      setSelectedFile(null)
      setUploadSuccess(true)
      if (fileInputRef.current) fileInputRef.current.value = ""

      toast.info("Photo uploaded", {
        description: "Your photo is being reviewed and will appear shortly",
      })

      pollImageStatus(eventId, newImage.id)
    } catch {
      setUploadError("Network error during upload")
    } finally {
      setUploading(false)
    }
  }, [eventId, user, selectedFile, caption, pollImageStatus])

  if (!selectedEvent) return null

  const latestGeo = selectedEvent.geometry[selectedEvent.geometry.length - 1]
  const color = getCategoryColor(selectedEvent)
  const Icon = getCategoryIcon(selectedEvent)
  const coords = getLatestCoordinates(selectedEvent)
  const illustration = getCategoryIllustration(selectedEvent)
  const isOpen = selectedEvent.closed === null
  const observationCount = selectedEvent.geometry.length
  const duration = getEventDuration(selectedEvent)

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setDetailOpen(false) }}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
          {illustration && (
            <div className="relative h-44 shrink-0" style={{ marginBottom: "-2px" }}>
              <img
                src={illustration}
                alt=""
                className="absolute inset-0 w-full h-full object-cover rounded-t-xl"
              />
              <div className="absolute inset-0 rounded-t-xl bg-gradient-to-b from-black/30 to-popover" />
              <div className="absolute -bottom-[2px] left-0 right-0 h-[4px] bg-popover" />
              <div className="absolute bottom-3 left-5 flex gap-1.5">
                <Badge
                  className="text-xs h-6 backdrop-blur-sm border-0"
                  style={{ backgroundColor: `${color}cc`, color: "#fff" }}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {selectedEvent.categories[0]?.title}
                </Badge>
                {isOpen ? (
                  <Badge className="text-xs h-6 bg-green-600/90 text-white backdrop-blur-sm border-0">
                    Active
                  </Badge>
                ) : (
                  <Badge className="text-xs h-6 bg-muted/80 text-muted-foreground backdrop-blur-sm border-0">
                    Closed {selectedEvent.closed && `on ${new Date(selectedEvent.closed).toLocaleDateString()}`}
                  </Badge>
                )}
              </div>
            </div>
          )}

          <DialogHeader className="px-5 pt-4 pb-0">
            <DialogTitle className="text-base leading-snug pr-8">
              {selectedEvent.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatEventDate(selectedEvent)}
              </span>
              {latestGeo && (
                <span className="text-muted-foreground/60">
                  {timeAgo(latestGeo.date)}
                </span>
              )}
              {coords && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`
                    )
                  }}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  title="Copy coordinates"
                >
                  <Copy className="h-3 w-3" />
                  {coords[1].toFixed(3)}, {coords[0].toFixed(3)}
                </button>
              )}
            </DialogDescription>
          </DialogHeader>

          {!illustration && (
            <div className="px-5 pt-2 flex gap-1.5">
              <Badge
                className="text-xs h-6"
                style={{ backgroundColor: `${color}20`, color, borderColor: `${color}30` }}
              >
                <Icon className="h-3 w-3 mr-1" />
                {selectedEvent.categories[0]?.title}
              </Badge>
              {isOpen ? (
                <Badge className="text-xs h-6 bg-green-500/10 text-green-500 border-green-500/20">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs h-6">Closed</Badge>
              )}
            </div>
          )}

          <div className="px-5 pt-3">
            <div className="flex flex-wrap gap-2">
              {latestGeo?.magnitudeValue && (
                <Badge variant="outline" className="h-auto py-1.5 px-3 gap-2 text-xs font-normal">
                  <Ruler className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{latestGeo.magnitudeValue}</span>
                  <span className="text-muted-foreground">{latestGeo.magnitudeUnit}</span>
                </Badge>
              )}
              {coords && (
                <Badge variant="outline" className="h-auto py-1.5 px-3 gap-2 text-xs font-normal">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold font-mono tabular-nums">{coords[1].toFixed(3)}, {coords[0].toFixed(3)}</span>
                </Badge>
              )}
              {duration !== null && duration > 0 && (
                <Badge variant="outline" className="h-auto py-1.5 px-3 gap-2 text-xs font-normal">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{duration}</span>
                  <span className="text-muted-foreground">{duration === 1 ? "day" : "days"}</span>
                </Badge>
              )}
              {observationCount > 1 && (
                <Badge variant="outline" className="h-auto py-1.5 px-3 gap-2 text-xs font-normal">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="font-semibold tabular-nums">{observationCount}</span>
                  <span className="text-muted-foreground">observations</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="px-5 pt-3 pb-4 flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue="photos" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start h-9">
                <TabsTrigger value="photos" className="text-xs gap-1.5">
                  <Camera className="h-3 w-3" />
                  Photos
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                    {images.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="sources" className="text-xs gap-1.5">
                  <ExternalLink className="h-3 w-3" />
                  Sources
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                    {selectedEvent.sources.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="photos" className="flex-1 overflow-hidden mt-3">
                {previewImage ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">
                        {previewImage.caption || "Photo preview"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewImage(null)}
                        className="text-xs h-7"
                      >
                        Back to gallery
                      </Button>
                    </div>
                    <div className="flex-1 rounded-lg border border-border overflow-hidden bg-black/20 flex items-center justify-center">
                      <img
                        src={`/api/images/file/${encodeURIComponent(previewImage.filename)}`}
                        alt={previewImage.caption || "Event photo"}
                        className="max-w-full max-h-[45vh] object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>by {previewImage.username}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{new Date(previewImage.createdAt).toLocaleDateString()}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{previewImage.originalName}</span>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-full max-h-[35vh]">
                    {loadingImages && (
                      <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                          <Skeleton key={i} className="w-full aspect-square rounded-lg" />
                        ))}
                      </div>
                    )}

                    {!loadingImages && images.length === 0 && (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                          <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">No photos yet</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {user
                              ? "Upload the first photo of this event"
                              : "Sign in to contribute photos"}
                          </p>
                        </div>
                      </div>
                    )}

                    {!loadingImages && images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {images.map((img) => {
                          const isProcessing = (img as { status?: string }).status === "processing"
                          return (
                            <button
                              key={img.id}
                              onClick={() => !isProcessing && setPreviewImage(img)}
                              className={`group relative rounded-lg overflow-hidden border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary ${
                                isProcessing ? "opacity-60 cursor-wait" : "cursor-pointer"
                              }`}
                            >
                              {isProcessing ? (
                                <div className="w-full aspect-square bg-muted flex flex-col items-center justify-center gap-1.5">
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  <span className="text-[9px] text-muted-foreground">Reviewing...</span>
                                </div>
                              ) : (
                                <>
                                  <img
                                    src={`/api/images/file/${encodeURIComponent(img.filename)}`}
                                    alt={img.caption || "Event photo"}
                                    className="w-full aspect-square object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                    {img.caption && (
                                      <p className="text-[10px] text-white truncate">{img.caption}</p>
                                    )}
                                    <p className="text-[10px] text-white/60">
                                      {img.username} &middot; {timeAgo(img.createdAt)}
                                    </p>
                                  </div>
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="sources" className="mt-3 pb-2">
                <div className="space-y-2">
                  {selectedEvent.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div>
                          <p className="text-sm font-medium">{source.id}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                            {source.url}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Visit
                      </Badge>
                    </a>
                  ))}
                  {selectedEvent.link && (
                    <a
                      href={selectedEvent.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div>
                          <p className="text-sm font-medium">NASA EONET</p>
                          <p className="text-[10px] text-muted-foreground">Official event page</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Visit
                      </Badge>
                    </a>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {user && (
            <DialogFooter className="px-6 py-5 border-t gap-3">
              {uploadSuccess && (
                <Alert className="bg-green-500/10 border-green-500/20 w-full">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-xs text-green-500">
                    Photo uploaded!
                  </AlertDescription>
                </Alert>
              )}
              {uploadError && (
                <Alert variant="destructive" className="w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{uploadError}</AlertDescription>
                </Alert>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null
                  if (file) {
                    const check = await loadAndValidateImage(file)
                    if (!check.valid) {
                      setUploadError(check.error || "Invalid image")
                      return
                    }
                  }
                  setUploadError("")
                  setSelectedFile(file)
                }}
              />
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline"
                  className="gap-2 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {selectedFile ? selectedFile.name : "Choose Photo"}
                </Button>
                <Input
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCaption(e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  disabled={uploading || !selectedFile}
                  onClick={handleUpload}
                >
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogFooter>
          )}

          {!user && (
            <DialogFooter className="px-6 py-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground w-full justify-center">
                <Camera className="h-4 w-4" />
                Sign in to upload photos to this event
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
