export interface RetryOptions<T> {
  maxAttempts?: number
  pauseBase?: number
  pauseExponent?: number
  handler?: (fn: () => Promise<T>) => Promise<T>
  onFailure?: (attempt: number, maxAttempts: number, error: unknown) => void
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_PAUSE_BASE = 1
const DEFAULT_PAUSE_EXPONENT = 2

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    pauseBase = DEFAULT_PAUSE_BASE,
    pauseExponent = DEFAULT_PAUSE_EXPONENT,
    handler,
    onFailure,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return handler ? await handler(fn) : await fn()
    } catch (error) {
      lastError = error
      onFailure?.(attempt, maxAttempts, error)

      if (attempt < maxAttempts) {
        const delay = (pauseBase + pauseExponent ** attempt) * 1000
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }

  throw lastError
}
