import { Router, type Request, type Response, type NextFunction } from "express"
import crypto from "crypto"
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose"
import { read, write } from "./db.js"
import { JWT_CONFIG, GOOGLE_JWKS_URL } from "./constants.js"

interface StoredUser {
  id: string
  email: string
  name: string
  picture: string
  googleId: string
}

export interface AuthRequest extends Request {
  userId?: string
  username?: string
}

const router = Router()

const JWT_SECRET_RAW: string = process.env.JWT_SECRET ?? ""
if (JWT_SECRET_RAW.length < JWT_CONFIG.minSecretLength) {
  throw new Error(`JWT_SECRET must be set and at least ${JWT_CONFIG.minSecretLength} characters`)
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID must be set")
}

const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))

async function getUsers(): Promise<StoredUser[]> {
  return read<StoredUser[]>("users", [])
}

async function verifyGoogleJwt(credential: string): Promise<{
  sub: string; email: string; name: string; picture: string
}> {
  const { payload } = await jwtVerify(credential, googleJWKS, {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: GOOGLE_CLIENT_ID,
    clockTolerance: JWT_CONFIG.clockToleranceSeconds,
  })

  if (!payload.sub || typeof payload.sub !== "string") throw new Error("Missing subject")
  const email = payload.email as string | undefined
  if (!email || typeof email !== "string") throw new Error("Missing email")

  return {
    sub: payload.sub,
    email,
    name: (payload.name as string) || email,
    picture: (payload.picture as string) || "",
  }
}

router.post("/google", async (req: Request, res: Response) => {
  const { credential } = req.body

  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "Missing Google credential" })
    return
  }

  if (credential.length > JWT_CONFIG.maxCredentialLength) {
    res.status(400).json({ error: "Credential too large" })
    return
  }

  try {
    const { sub: googleId, email, name, picture } = await verifyGoogleJwt(credential)

    const users = await getUsers()
    let user = users.find((u) => u.googleId === googleId)

    if (!user) {
      user = { id: crypto.randomUUID(), email, name, picture, googleId }
      users.push(user)
      await write("users", users)
    } else {
      user.name = name
      user.picture = picture
      user.email = email
      await write("users", users)
    }

    const jti = crypto.randomBytes(JWT_CONFIG.jtiByteLength).toString("hex")
    const token = await new SignJWT({ userId: user.id, username: user.name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_CONFIG.expiry)
      .setIssuer(JWT_CONFIG.issuer)
      .setAudience(JWT_CONFIG.audience)
      .setSubject(user.id)
      .setJti(jti)
      .sign(JWT_SECRET)

    res.json({ id: user.id, username: user.name, email: user.email, picture: user.picture, token })
  } catch (err) {
    if (err instanceof Error) console.error("Google auth failed:", err.message)
    res.status(401).json({ error: "Invalid Google credential" })
  }
})

const BEARER_PREFIX_LENGTH = "Bearer ".length

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  const token = header.slice(BEARER_PREFIX_LENGTH)
  if (token.length > JWT_CONFIG.maxTokenLength) {
    res.status(401).json({ error: "Token too large" })
    return
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
      algorithms: ["HS256"],
      maxTokenAge: JWT_CONFIG.maxAge,
    })

    const userId = payload.userId as string | undefined
    const username = payload.username as string | undefined

    if (!userId || !payload.sub) {
      res.status(401).json({ error: "Malformed token" })
      return
    }

    req.userId = userId
    req.username = username
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export default router
