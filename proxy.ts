import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS } from "@/lib/server/constants";

const IS_PROD = process.env.NODE_ENV === "production";

function getIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://accounts.google.com ${IS_PROD ? "" : "'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com https://*.googleusercontent.com",
    "connect-src 'self' https://accounts.google.com https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com",
    "worker-src blob:",
    "frame-src https://accounts.google.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
    .filter(Boolean)
    .join("; ");
}

function applyHeaders(res: NextResponse, headers: Record<string, string>) {
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const ip = getIp(req);

    const apiLimit = checkRateLimit(`api:${ip}`, RATE_LIMITS.api);
    if (!apiLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: apiLimit.headers },
      );
    }

    if (pathname.startsWith("/api/auth")) {
      const authLimit = checkRateLimit(`auth:${ip}`, RATE_LIMITS.auth);
      if (!authLimit.allowed) {
        return NextResponse.json(
          { error: "Too many auth attempts" },
          { status: 429, headers: authLimit.headers },
        );
      }
      const res = NextResponse.next();
      applyHeaders(res, authLimit.headers);
      return res;
    }

    const res = NextResponse.next();
    applyHeaders(res, apiLimit.headers);
    return res;
  }

  const nonce = crypto.randomBytes(16).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.svg|icons.svg|.*\\.webp$|.*\\.png$|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
