import { Suspense } from "react"
import Globe from "@/components/globe/Globe"
import Header from "@/components/Header"
import EventPanel from "@/components/events/EventPanel"
import EventList from "@/components/events/EventList"
import { useEONET } from "@/hooks/use-eonet"
import { Loader2 } from "lucide-react"

function LoadingFallback() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading globe...</p>
      </div>
    </div>
  )
}

export default function App() {
  useEONET()

  return (
    <div className="h-screen w-screen dark">
      <Header />
      <div className="absolute left-0 top-14 bottom-0 w-72 z-10 bg-background/80 backdrop-blur border-r">
        <EventList />
      </div>
      <div className="absolute inset-0 pt-14">
        <Suspense fallback={<LoadingFallback />}>
          <Globe />
        </Suspense>
      </div>
      <EventPanel />
    </div>
  )
}
