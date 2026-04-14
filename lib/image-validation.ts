import { IMAGE_VALIDATION } from "@/lib/constants";

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ClientValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): ClientValidationResult {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: "Only JPG, PNG, and WebP files are accepted",
    };
  }

  if (file.name.split(".").length > 2) {
    return {
      valid: false,
      error: "Filenames with multiple extensions are not allowed",
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type || "unknown"} is not accepted`,
    };
  }

  if (file.size < IMAGE_VALIDATION.minFileSize) {
    return { valid: false, error: "File is too small to be a real image" };
  }

  if (file.size > IMAGE_VALIDATION.maxFileSize) {
    return {
      valid: false,
      error: `File exceeds ${IMAGE_VALIDATION.maxFileSize / 1024 / 1024}MB limit`,
    };
  }

  return { valid: true };
}

export function validateImageDimensions(
  width: number,
  height: number,
): ClientValidationResult {
  if (
    width < IMAGE_VALIDATION.minDimension ||
    height < IMAGE_VALIDATION.minDimension
  ) {
    return {
      valid: false,
      error: `Image must be at least ${IMAGE_VALIDATION.minDimension}x${IMAGE_VALIDATION.minDimension}px`,
    };
  }

  if (
    width > IMAGE_VALIDATION.maxDimension ||
    height > IMAGE_VALIDATION.maxDimension
  ) {
    return {
      valid: false,
      error: `Image exceeds ${IMAGE_VALIDATION.maxDimension}px dimension limit`,
    };
  }

  if (width * height > IMAGE_VALIDATION.maxPixelBudget) {
    return { valid: false, error: "Image has too many pixels" };
  }

  const ratio = Math.max(width / height, height / width);
  if (ratio > IMAGE_VALIDATION.maxAspectRatio) {
    return { valid: false, error: "Image has extreme aspect ratio" };
  }

  return { valid: true };
}

export function loadAndValidateImage(
  file: File,
): Promise<ClientValidationResult> {
  return new Promise((resolve) => {
    const fileCheck = validateFile(file);
    if (!fileCheck.valid) {
      resolve(fileCheck);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(validateImageDimensions(img.naturalWidth, img.naturalHeight));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, error: "File could not be loaded as an image" });
    };

    img.src = url;
  });
}
