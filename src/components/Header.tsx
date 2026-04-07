import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { useEventStore } from "@/store/event-store"
import AuthDialog from "@/components/auth/AuthDialog"
import { Globe, LogOut } from "lucide-react"

export default function Header() {
  const { user, logout } = useAuthStore()
  const { events, loading } = useEventStore()

  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur border-b">
      <div className="flex items-center gap-3">
        <Globe className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight">EONET Globe</h1>
        {!loading && (
          <span className="text-sm text-muted-foreground">
            {events.length} active events
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-muted-foreground">{user.username}</span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </>
        ) : (
          <AuthDialog />
        )}
      </div>
    </header>
  )
}
