import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useAuthStore } from "@/store/auth-store"
import { timeAgo } from "@/lib/eonet"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  History,
  RotateCcw,
  Clock,
  FileText,
  X,
} from "lucide-react"

interface WikiSection {
  id: string
  eventId: string
  title: string
  content: string
  authorName: string
  updatedAt: string
}

interface WikiRevision {
  id: string
  sectionId: string
  content: string
  authorName: string
  status: string
  createdAt: string
  action: string
  revertedFrom: string | null
}

export default function WikiTab({ eventId }: { eventId: string }) {
  const user = useAuthStore((s) => s.user)
  const [sections, setSections] = useState<WikiSection[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [historySection, setHistorySection] = useState<string | null>(null)
  const [revisions, setRevisions] = useState<WikiRevision[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(eventId)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setSections(data)
      }
    } catch { /* */ }
    finally { setLoading(false) }
  }, [eventId])

  useEffect(() => {
    setLoading(true)
    fetchSections()
  }, [fetchSections])

  const handleCreateSection = useCallback(async () => {
    if (!user || !newTitle.trim() || !newContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      })
      if (res.ok) {
        toast.info("Section submitted", { description: "Your edit is being reviewed" })
        setNewTitle("")
        setNewContent("")
        setNewSectionOpen(false)
        setTimeout(fetchSections, 3000)
      } else {
        const data = await res.json()
        toast.error("Failed", { description: data.error })
      }
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }, [user, eventId, newTitle, newContent, fetchSections])

  const handleEditSection = useCallback(async (sectionId: string) => {
    if (!user || !editContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(eventId)}/${encodeURIComponent(sectionId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ content: editContent }),
      })
      if (res.ok) {
        toast.info("Edit submitted", { description: "Your changes are being reviewed" })
        setEditingSection(null)
        setEditContent("")
        setTimeout(fetchSections, 3000)
      } else {
        const data = await res.json()
        toast.error("Failed", { description: data.error })
      }
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }, [user, eventId, editContent, fetchSections])

  const handleRevert = useCallback(async (sectionId: string, revisionId: string) => {
    if (!user) return
    try {
      const res = await fetch(
        `/api/wiki/${encodeURIComponent(eventId)}/${encodeURIComponent(sectionId)}/revert/${encodeURIComponent(revisionId)}`,
        { method: "POST", headers: { Authorization: `Bearer ${user.token}` } }
      )
      if (res.ok) {
        toast.info("Revert submitted", { description: "Reverting to previous version" })
        setTimeout(fetchSections, 3000)
      }
    } catch { toast.error("Network error") }
  }, [user, eventId, fetchSections])

  const loadHistory = useCallback(async (sectionId: string) => {
    setHistorySection(sectionId)
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/wiki/${encodeURIComponent(eventId)}/${encodeURIComponent(sectionId)}/history`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setRevisions(data)
      }
    } catch { /* */ }
    finally { setLoadingHistory(false) }
  }, [eventId])

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <ScrollArea className="max-h-[40vh]">
      <div className="space-y-3 pb-2">
        {sections.length === 0 && !newSectionOpen && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No wiki content yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user ? "Be the first to document this event" : "Sign in to contribute"}
              </p>
            </div>
          </div>
        )}

        {sections.map((section) => (
          <Card key={section.id} size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{section.title}</CardTitle>
              <CardAction>
                <div className="flex items-center gap-1">
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1"
                      onClick={() => {
                        setEditingSection(section.id)
                        setEditContent(section.content)
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() =>
                      historySection === section.id
                        ? setHistorySection(null)
                        : loadHistory(section.id)
                    }
                  >
                    <History className="h-3 w-3" />
                    History
                  </Button>
                </div>
              </CardAction>
            </CardHeader>

            <CardContent>
              {editingSection === section.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                    placeholder="Write your edit..."
                    className="min-h-[100px] text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={saving || editContent.length < 10}
                      onClick={() => handleEditSection(section.id)}
                    >
                      {saving ? "Saving..." : "Save Edit"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {section.content ? (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {section.content}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Content pending review...
                    </p>
                  )}
                  {section.authorName && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Last edited by {section.authorName} &middot; {timeAgo(section.updatedAt)}
                    </p>
                  )}
                </>
              )}
            </CardContent>

            {historySection === section.id && (
              <CardFooter className="flex-col items-stretch gap-0 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                  <span className="text-xs font-medium flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Revision History
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => setHistorySection(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {loadingHistory ? (
                  <div className="p-3">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : revisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No approved revisions yet
                  </p>
                ) : (
                  <div className="divide-y divide-border/30">
                    {revisions.map((rev, i) => (
                      <HoverCard key={rev.id}>
                        <HoverCardTrigger>
                          <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20 cursor-pointer">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px]">
                                {rev.authorName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px]">
                                <span className="font-medium">{rev.authorName}</span>
                                {" "}
                                <span className="text-muted-foreground">
                                  {rev.action === "create" && "created this section"}
                                  {rev.action === "edit" && "edited"}
                                  {rev.action === "revert" && "reverted"}
                                </span>
                              </p>
                              <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {timeAgo(rev.createdAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-[8px] h-4 px-1">
                                {rev.action}
                              </Badge>
                              {user && i < revisions.length - 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    handleRevert(section.id, rev.id)
                                  }}
                                  title="Restore this version"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="left" className="w-80 text-xs">
                          <p className="font-medium mb-1">Preview</p>
                          <p className="text-muted-foreground whitespace-pre-wrap line-clamp-6 leading-relaxed">
                            {rev.content}
                          </p>
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
                )}
              </CardFooter>
            )}
          </Card>
        ))}

        {newSectionOpen && (
          <Card size="sm">
            <CardContent className="space-y-2">
              <Input
                placeholder="Section title..."
                value={newTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
                className="text-sm"
              />
              <Textarea
                value={newContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                placeholder="Write content for this section..."
                className="min-h-[120px] text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setNewSectionOpen(false); setNewTitle(""); setNewContent("") }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={saving || newTitle.length < 2 || newContent.length < 10}
                  onClick={handleCreateSection}
                >
                  {saving ? "Submitting..." : "Submit Section"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {user && !newSectionOpen && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => setNewSectionOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Section
          </Button>
        )}

        {!user && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Sign in to contribute to the wiki
          </p>
        )}
      </div>
    </ScrollArea>
  )
}
