import type { EONETEvent } from "@/types"
import { DEFAULT_CATEGORY_COLOR, MS_PER_DAY } from "@/lib/constants"
import type { LucideIcon } from "lucide-react"
import {
  Flame,
  CloudLightning,
  Mountain,
  Waves,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  Factory,
  HelpCircle,
} from "lucide-react"

export const CATEGORY_COLORS: Record<string, string> = {
  wildfires: "#ef4444",
  volcanoes: "#dc2626",
  severeStorms: "#8b5cf6",
  seaLakeIce: "#06b6d4",
  floods: "#3b82f6",
  landslides: "#a16207",
  drought: "#ca8a04",
  dustHaze: "#d4a574",
  snow: "#e2e8f0",
  tempExtremes: "#f97316",
  waterColor: "#14b8a6",
  manmade: "#6b7280",
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wildfires: Flame,
  severeStorms: CloudLightning,
  volcanoes: Mountain,
  floods: Waves,
  seaLakeIce: Snowflake,
  snow: Snowflake,
  dustHaze: Wind,
  drought: Droplets,
  tempExtremes: Thermometer,
  manmade: Factory,
}

export const CATEGORY_EMOJI: Record<string, string> = {
  wildfires: "🔥",
  volcanoes: "🌋",
  severeStorms: "⛈️",
  seaLakeIce: "🧊",
  floods: "🌊",
  landslides: "⛰️",
  drought: "☀️",
  dustHaze: "💨",
  snow: "❄️",
  tempExtremes: "🌡️",
  waterColor: "🟢",
  manmade: "🏭",
  earthquakes: "💥",
}

const CATEGORY_ILLUSTRATIONS: Record<string, string> = {
  wildfires: "/wildfire.avif",
  volcanoes: "/volcano.jpg",
  severeStorms: "/storm.jpg",
  floods: "/flood.jpg",
  drought: "/drought.jpg",
  earthquakes: "/earthquake.jpg",
  landslides: "/landslide.jpg",
  tempExtremes: "/global-warming-illustration.jpg",
  dustHaze: "/dust.avif",
  seaLakeIce: "/sealakeice.jpg",
  snow: "/snow.jpg",
  waterColor: "/dirtywater.jpg",
  manmade: "/mandmade.jpg",
}

export function getCategoryIllustration(event: EONETEvent): string | null {
  return CATEGORY_ILLUSTRATIONS[event.categories[0]?.id || ""] || null
}

export function getCategoryColor(event: EONETEvent): string {
  return CATEGORY_COLORS[event.categories[0]?.id || ""] || DEFAULT_CATEGORY_COLOR
}

export function getCategoryIcon(event: EONETEvent): LucideIcon {
  return CATEGORY_ICONS[event.categories[0]?.id || ""] || HelpCircle
}

export function getCategoryEmoji(event: EONETEvent): string {
  return CATEGORY_EMOJI[event.categories[0]?.id || ""] || "📍"
}

export function getLatestCoordinates(event: EONETEvent): [number, number] | null {
  const geo = event.geometry[event.geometry.length - 1]
  if (!geo?.coordinates) return null
  if (geo.type === "Point") return [geo.coordinates[0], geo.coordinates[1]]
  return null
}

export function getEventDuration(event: EONETEvent): number | null {
  const first = event.geometry[0]
  const last = event.geometry[event.geometry.length - 1]
  if (!first || !last || first === last) return null
  const days = Math.ceil((new Date(last.date).getTime() - new Date(first.date).getTime()) / MS_PER_DAY)
  return days > 0 ? days : null
}

export function formatEventDate(event: EONETEvent): string {
  const geo = event.geometry[event.geometry.length - 1]
  if (!geo?.date) return "Unknown date"
  return new Date(geo.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}
