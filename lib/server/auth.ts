import "server-only";
import crypto from "crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { read, write } from "./db";
import { JWT_CONFIG, GOOGLE_JWKS_URL } from "./constants";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  googleId: string;
}

export interface AuthContext {
  userId: string;
  username: string;
}

let cachedJwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (cachedJwtSecret) return cachedJwtSecret;
  const raw = process.env.JWT_SECRET ?? "";
  if (raw.length < JWT_CONFIG.minSecretLength) {
    throw new Error(
      `JWT_SECRET must be set and at least ${JWT_CONFIG.minSecretLength} characters`,
    );
  }
  cachedJwtSecret = new TextEncoder().encode(raw);
  return cachedJwtSecret;
}

function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID must be set");
  return id;
}

let cachedGoogleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getGoogleJwks() {
  if (!cachedGoogleJwks) {
    cachedGoogleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return cachedGoogleJwks;
}

export async function getUsers(): Promise<StoredUser[]> {
  return read<StoredUser[]>("users", []);
}

export async function writeUsers(users: StoredUser[]): Promise<void> {
  await write("users", users);
}

export async function verifyGoogleJwt(credential: string): Promise<{
  sub: string;
  email: string;
  name: string;
  picture: string;
}> {
  const { payload } = await jwtVerify(credential, getGoogleJwks(), {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: getGoogleClientId(),
    clockTolerance: JWT_CONFIG.clockToleranceSeconds,
  });

  if (!payload.sub || typeof payload.sub !== "string")
    throw new Error("Missing subject");
  const email = payload.email as string | undefined;
  if (!email || typeof email !== "string") throw new Error("Missing email");

  return {
    sub: payload.sub,
    email,
    name: (payload.name as string) || email,
    picture: (payload.picture as string) || "",
  };
}

export async function signSessionToken(
  userId: string,
  username: string,
): Promise<string> {
  const jti = crypto.randomBytes(JWT_CONFIG.jtiByteLength).toString("hex");
  return await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_CONFIG.expiry)
    .setIssuer(JWT_CONFIG.issuer)
    .setAudience(JWT_CONFIG.audience)
    .setSubject(userId)
    .setJti(jti)
    .sign(getJwtSecret());
}

const BEARER_PREFIX_LENGTH = "Bearer ".length;

export async function authenticate(
  request: Request,
): Promise<AuthContext | Response> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const token = header.slice(BEARER_PREFIX_LENGTH);
  if (token.length > JWT_CONFIG.maxTokenLength) {
    return Response.json({ error: "Token too large" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      algorithms: ["HS256"],
      maxTokenAge: JWT_CONFIG.maxAge,
    });

    const userId = payload.userId as string | undefined;
    const username = payload.username as string | undefined;

    if (!userId || !payload.sub) {
      return Response.json({ error: "Malformed token" }, { status: 401 });
    }

    return { userId, username: username || "" };
  } catch {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }
}

export function isAuthContext(
  value: AuthContext | Response,
): value is AuthContext {
  return !(value instanceof Response);
}
