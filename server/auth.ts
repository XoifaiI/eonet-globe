import { Router, type Request, type Response, type NextFunction } from "express"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { read, write } from "./db.js"

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

const JWT_SECRET: string = process.env.JWT_SECRET ?? ""
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters")
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID must be set")
}

const JWT_ISSUER = "eonet-globe"
const JWT_AUDIENCE = "eonet-globe-client"

const googleJWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
)

async function getUsers(): Promise<StoredUser[]> {
  return read<StoredUser[]>("users", [])
}

async function verifyGoogleJwt(credential: string): Promise<{
  sub: string
  email: string
  name: string
  picture: string
}> {
  const { payload } = await jwtVerify(credential, googleJWKS, {
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    audience: GOOGLE_CLIENT_ID,
    clockTolerance: 60,
  })

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Missing subject")
  }

  const email = payload.email as string | undefined
  if (!email || typeof email !== "string") {
    throw new Error("Missing email")
  }

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

  if (credential.length > 4096) {
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

    const jti = crypto.randomBytes(16).toString("hex")

    const token = jwt.sign(
      { userId: user.id, username: user.name },
      JWT_SECRET,
      {
        expiresIn: "7d",
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        jwtid: jti,
        subject: user.id,
      }
    )

    res.json({
      id: user.id,
      username: user.name,
      email: user.email,
      picture: user.picture,
      token,
    })
  } catch (err) {
    if (err instanceof Error) console.error("Google auth failed:", err.message)
    res.status(401).json({ error: "Invalid Google credential" })
  }
})

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  const token = header.slice(7)
  if (token.length > 2048) {
    res.status(401).json({ error: "Token too large" })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
      maxAge: "7d",
    }) as unknown as { userId: string; username: string; sub: string }

    if (!payload.userId || !payload.sub) {
      res.status(401).json({ error: "Malformed token" })
      return
    }

    req.userId = payload.userId
    req.username = payload.username
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export default router
