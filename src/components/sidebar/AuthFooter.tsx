import { useRef } from "react"
import { CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/auth-store"
import { useGoogleAuth } from "@/hooks/use-google-auth"
import { LogOut, Camera } from "lucide-react"

export default function AuthFooter() {
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
            <AvatarFallback className="text-[10px]">{user.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium truncate">{user.username}</span>
            <span className="text-[10px] text-muted-foreground truncate">{user.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Camera className="h-3 w-3" />Sign in to upload photos
        </div>
      )}
      <div ref={googleButtonRef} className={user ? "hidden" : ""} />
    </CardFooter>
  )
}
