export const MS_PER_SECOND = 1000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000
export const MS_PER_WEEK = 7 * MS_PER_DAY

export const DEFAULT_CATEGORY_COLOR = "#f97316"

export const DEFAULT_MAP_CENTER: [number, number] = [10, 20]
export const DEFAULT_MAP_ZOOM = 2

export const MIN_FLY_TO_ZOOM = 6
export const FLY_TO_DURATION_MS = 1400

export const SEARCH_DEBOUNCE_MS = 150
export const MIN_SEARCH_QUERY_LENGTH = 2

export const VIRTUALIZER_OVERSCAN = 10
export const ITEM_HEIGHT = 40

export const IMAGE_VALIDATION = {
  maxFileSize: 10 * 1024 * 1024,
  minFileSize: 1024,
  maxDimension: 8192,
  minDimension: 10,
  maxPixelBudget: 25_000_000,
  maxAspectRatio: 10,
} as const

export const COORD_COPY_PRECISION = 5
export const COORD_DISPLAY_PRECISION = 3
export const COORD_POPUP_PRECISION = 2

export const UPLOAD_SUCCESS_DISPLAY_MS = 3000
export const IMAGE_POLL_INTERVAL_MS = 2000
export const MAX_IMAGE_POLLS = 15

export const WIKI_POLL_INTERVAL_MS = 2000
export const MAX_WIKI_POLLS = 10

export const GOOGLE_GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client"
export const GOOGLE_BUTTON_WIDTH = 240
export const IDLE_CALLBACK_TIMEOUT_MS = 3000
export const SCRIPT_LOAD_FALLBACK_DELAY_MS = 1000

export const POPUP_OFFSET_WITH_TRAJECTORY: [number, number] = [0, -30]
export const POPUP_OFFSET_DEFAULT: [number, number] = [0, -15]

export const TRAJECTORY_WIDTH = 3
export const TRAJECTORY_OPACITY = 0.6
export const TRAJECTORY_OVERLAY_WIDTH = 1
export const TRAJECTORY_OVERLAY_OPACITY = 0.9
