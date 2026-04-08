import { useRef, lazy, Suspense } from "react";
import { Map, MapControls, type MapRef } from "@/components/ui/map";
import { Toaster } from "@/components/ui/sonner";
import { useEONET } from "@/hooks/use-eonet";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/constants";
import FlyToHandler from "@/components/map/FlyToHandler";
import SelectedEventPopup from "@/components/map/SelectedEventPopup";
import EventClusterLayer from "@/components/EventClusterLayer";
import BasemapController from "@/components/BasemapController";
import EventSidebar from "@/components/sidebar/EventSidebar";
import StatsCard from "@/components/sidebar/StatsCard";
import FilterBar from "@/components/toolbar/FilterBar";

const EventDetailDialog = lazy(
  () => import("@/components/events/EventDetailDialog"),
);

export default function App() {
  useEONET();
  const mapRef = useRef<MapRef>(null);

  return (
    <div className="h-screen w-screen dark">
      <Map
        ref={mapRef}
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        className="h-full w-full"
      >
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showFullscreen
        />
        <BasemapController />
        <FlyToHandler />
        <EventClusterLayer />
        <SelectedEventPopup />
      </Map>

      <EventSidebar />
      <StatsCard />
      <FilterBar />
      <Suspense>
        <EventDetailDialog />
      </Suspense>
      <Toaster position="bottom-center" />
    </div>
  );
}
