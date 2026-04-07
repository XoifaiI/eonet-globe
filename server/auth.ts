import { Router, type Request, type Response, type NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { v4 as uuid } from "uuid"
import { read, write } from "./db.js"

interface StoredUser {
  id: string
  username: string
  passwordHash: string
}

export interface AuthRequest extends Request {
  userId?: string
  username?: string
}

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret"

function getUsers(): StoredUser[] {
  return read<StoredUser[]>("users", [])
}

function sanitizeUsername(input: string): string {
  return input.trim().slice(0, 50)
}

router.post("/register", async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" })
    return
  }

  const cleanUsername = sanitizeUsername(username)
  if (cleanUsername.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" })
    return
  }

  const users = getUsers()
  if (users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    res.status(409).json({ error: "Username already exists" })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user: StoredUser = { id: uuid(), username: cleanUsername, passwordHash }
  users.push(user)
  write("users", users)

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  })

  res.json({ id: user.id, username: user.username, token })
})

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body

  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" })
    return
  }

  const users = getUsers()
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" })
    return
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  })

  res.json({ id: user.id, username: user.username, token })
})

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      userId: string
      username: string
    }
    req.userId = payload.userId
    req.username = payload.username
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}

export default router
