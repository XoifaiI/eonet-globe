const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MIN_FILE_SIZE = 1024
const MAX_DIMENSION = 8192
const MIN_DIMENSION = 10
const MAX_PIXEL_BUDGET = 25_000_000
const MAX_ASPECT_RATIO = 10

export interface ClientValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: File): ClientValidationResult {
  const ext = "." + file.name.split(".").pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Only JPG, PNG, and WebP files are accepted` }
  }

  if (file.name.split(".").length > 2) {
    return { valid: false, error: "Filenames with multiple extensions are not allowed" }
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `File type ${file.type || "unknown"} is not accepted` }
  }

  if (file.size < MIN_FILE_SIZE) {
    return { valid: false, error: "File is too small to be a real image" }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }
  }

  return { valid: true }
}

export function validateImageDimensions(
  width: number,
  height: number
): ClientValidationResult {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { valid: false, error: `Image must be at least ${MIN_DIMENSION}x${MIN_DIMENSION}px` }
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { valid: false, error: `Image exceeds ${MAX_DIMENSION}px dimension limit` }
  }

  if (width * height > MAX_PIXEL_BUDGET) {
    return { valid: false, error: "Image has too many pixels" }
  }

  const ratio = Math.max(width / height, height / width)
  if (ratio > MAX_ASPECT_RATIO) {
    return { valid: false, error: "Image has extreme aspect ratio" }
  }

  return { valid: true }
}

export function loadAndValidateImage(file: File): Promise<ClientValidationResult> {
  return new Promise((resolve) => {
    const fileCheck = validateFile(file)
    if (!fileCheck.valid) {
      resolve(fileCheck)
      return
    }

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(validateImageDimensions(img.naturalWidth, img.naturalHeight))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ valid: false, error: "File could not be loaded as an image" })
    }

    img.src = url
  })
}
