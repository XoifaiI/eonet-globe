const PERSPECTIVE_API_KEY = process.env.PERSPECTIVE_API_KEY || ""
const TOXICITY_THRESHOLD = 0.7

interface PerspectiveScore {
  value: number
}

interface PerspectiveResponse {
  attributeScores: {
    TOXICITY?: { summaryScore: PerspectiveScore }
    SEVERE_TOXICITY?: { summaryScore: PerspectiveScore }
    INSULT?: { summaryScore: PerspectiveScore }
    PROFANITY?: { summaryScore: PerspectiveScore }
    THREAT?: { summaryScore: PerspectiveScore }
    IDENTITY_ATTACK?: { summaryScore: PerspectiveScore }
  }
}

export interface ModerationResult {
  safe: boolean
  toxicityScore: number
  flags: string[]
}

export async function moderateText(text: string): Promise<ModerationResult> {
  if (!PERSPECTIVE_API_KEY) {
    return { safe: true, toxicityScore: 0, flags: [] }
  }

  if (!text.trim() || text.trim().length < 3) {
    return { safe: true, toxicityScore: 0, flags: [] }
  }

  try {
    const res = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${PERSPECTIVE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: { text: text.slice(0, 3000) },
          languages: ["en"],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
            IDENTITY_ATTACK: {},
          },
        }),
      }
    )

    if (!res.ok) {
      console.error("Perspective API error:", res.status)
      return { safe: false, toxicityScore: 1, flags: ["moderation_error"] }
    }

    const data: PerspectiveResponse = await res.json()
    const scores = data.attributeScores
    const flags: string[] = []

    const checks = {
      toxicity: scores.TOXICITY?.summaryScore.value || 0,
      severe_toxicity: scores.SEVERE_TOXICITY?.summaryScore.value || 0,
      insult: scores.INSULT?.summaryScore.value || 0,
      profanity: scores.PROFANITY?.summaryScore.value || 0,
      threat: scores.THREAT?.summaryScore.value || 0,
      identity_attack: scores.IDENTITY_ATTACK?.summaryScore.value || 0,
    }

    const maxScore = Math.max(...Object.values(checks))

    for (const [category, score] of Object.entries(checks)) {
      if (score >= TOXICITY_THRESHOLD) flags.push(category)
    }

    return { safe: flags.length === 0, toxicityScore: maxScore, flags }
  } catch (err) {
    console.error("Perspective API error:", err)
    return { safe: false, toxicityScore: 1, flags: ["moderation_error"] }
  }
}

const DANGEROUS_TAG = /<\/?(?!(?:p|br|b|i|em|strong|ul|ol|li|h[1-6]|blockquote|code|pre|a)\b)[a-z][^>]*>/gi

export function sanitizeWikiContent(input: string): string {
  return input
    .slice(0, 10_000)
    .replace(DANGEROUS_TAG, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/on\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/vbscript\s*:/gi, "")
    .replace(/data\s{0,10}:\s{0,10}text\/html/gi, "")
    .replace(/expression\s{0,10}\(/gi, "")
    .replace(/url\s{0,10}\(\s{0,10}['"]?\s{0,10}javascript/gi, "")
    .trim()
}

export function sanitizeWikiTitle(input: string): string {
  return input
    .slice(0, 200)
    .replace(/<[^>]*>/g, "")
    .replace(/[<>&"']/g, "")
    .trim()
}
