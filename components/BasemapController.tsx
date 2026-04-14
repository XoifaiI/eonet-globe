import { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";
import { useEventStore } from "@/store/event-store";
import { useStyleReady } from "@/store/style-store";

const TERRAIN_SOURCE = "terrain-dem";
const HILLSHADE_SOURCE = "hillshade-dem";
const HILLSHADE_LAYER = "terrain-hillshade";

const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  satellite: {
    version: 8 as const,
    sources: {
      satellite: {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "satellite-tiles",
        type: "raster" as const,
        source: "satellite",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  },
  terrain: {
    version: 8 as const,
    sources: {
      satellite: {
        type: "raster" as const,
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
      [TERRAIN_SOURCE]: {
        type: "raster-dem" as const,
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium" as const,
      },
      [HILLSHADE_SOURCE]: {
        type: "raster-dem" as const,
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium" as const,
      },
    },
    layers: [
      {
        id: "satellite-tiles",
        type: "raster" as const,
        source: "satellite",
        minzoom: 0,
        maxzoom: 22,
      },
      {
        id: HILLSHADE_LAYER,
        type: "hillshade" as const,
        source: HILLSHADE_SOURCE,
        paint: {
          "hillshade-shadow-color": "#000000",
          "hillshade-illumination-anchor": "viewport" as const,
          "hillshade-exaggeration": 0.3,
        },
      },
    ],
    terrain: {
      source: TERRAIN_SOURCE,
      exaggeration: 1.5,
    },
  },
};

export default function BasemapController() {
  const basemap = useEventStore((s) => s.basemap);
  const { map, isLoaded } = useMap();
  const prevBasemap = useRef(basemap);

  useEffect(() => {
    if (!isLoaded || !map || prevBasemap.current === basemap) return;
    prevBasemap.current = basemap;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    useStyleReady.setState({ ready: false });

    const style = STYLES[basemap];
    if (typeof style === "string") {
      map.setStyle(style);
    } else {
      map.setStyle(style as maplibregl.StyleSpecification);
    }

    let cancelled = false;
    const onIdle = () => {
      if (cancelled) return;
      map.jumpTo({ center, zoom, bearing, pitch });

      if (basemap === "terrain") {
        map.easeTo({ pitch: 60, duration: 1000 });
      } else if (pitch > 0) {
        map.easeTo({ pitch: 0, duration: 500 });
      }

      useStyleReady.setState((s) => ({ ready: true, version: s.version + 1 }));
    };
    map.once("idle", onIdle);

    return () => {
      cancelled = true;
      map.off("idle", onIdle);
    };
  }, [basemap, map, isLoaded]);

  return null;
}
