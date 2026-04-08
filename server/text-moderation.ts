import sanitizeHtml from "sanitize-html";

const CONFIDENCE_THRESHOLD = 0.7;

const BLOCKED_CATEGORIES = new Set([
  "Toxic",
  "Derogatory",
  "Violent",
  "Sexual",
  "Insult",
  "Profanity",
  "Death, Harm & Tragedy",
  "Firearms & Weapons",
  "Public Safety",
  "Illicit Drugs",
]);

export interface ModerationResult {
  safe: boolean;
  toxicityScore: number;
  flags: string[];
}

let nlClient: InstanceType<
  typeof import("@google-cloud/language").LanguageServiceClient
> | null = null;

async function getClient() {
  if (!nlClient) {
    const { LanguageServiceClient } = await import("@google-cloud/language");
    nlClient = new LanguageServiceClient();
  }
  return nlClient;
}

export async function moderateText(text: unknown): Promise<ModerationResult> {
  if (typeof text !== "string" || !text.trim() || text.trim().length < 3) {
    return { safe: true, toxicityScore: 0, flags: [] };
  }

  try {
    const client = await getClient();
    const [result] = await client.moderateText({
      document: {
        content: text.slice(0, 10_000),
        type: "PLAIN_TEXT" as const,
      },
    });

    const categories = result.moderationCategories || [];
    const flags: string[] = [];
    let maxScore = 0;

    for (const cat of categories) {
      const name = cat.name || "";
      const confidence = cat.confidence || 0;

      if (confidence > maxScore) maxScore = confidence;
      if (confidence >= CONFIDENCE_THRESHOLD && BLOCKED_CATEGORIES.has(name)) {
        flags.push(name);
      }
    }

    return { safe: flags.length === 0, toxicityScore: maxScore, flags };
  } catch (err) {
    console.error("Cloud NL moderation error:", err);
    return { safe: false, toxicityScore: 1, flags: ["moderation_error"] };
  }
}

const WIKI_CONTENT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "b",
    "i",
    "em",
    "strong",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "a",
  ],
  allowedAttributes: {
    a: ["href"],
  },
  allowedSchemes: ["https", "http"],
  disallowedTagsMode: "discard",
};

const ALLOWED_TEXT = /^[\x20-\x7E\n\r\t\u00A0-\u00FF]*$/;

export function containsDisallowedChars(text: string): boolean {
  return !ALLOWED_TEXT.test(text);
}

export function sanitizeWikiContent(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(
    input.slice(0, 10_000),
    WIKI_CONTENT_SANITIZE_OPTIONS,
  ).trim();
}

export function sanitizeWikiTitle(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input.slice(0, 200), {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}
