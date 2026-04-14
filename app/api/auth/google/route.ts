import crypto from "crypto";
import {
  getUsers,
  writeUsers,
  verifyGoogleJwt,
  signSessionToken,
} from "@/lib/server/auth";
import { JWT_CONFIG } from "@/lib/server/constants";
import { checkContentLength, JSON_BODY_MAX } from "@/lib/server/body-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const sizeError = checkContentLength(request, JSON_BODY_MAX);
  if (sizeError) return sizeError;

  let body: { credential?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { credential } = body;

  if (!credential || typeof credential !== "string") {
    return Response.json(
      { error: "Missing Google credential" },
      { status: 400 },
    );
  }

  if (credential.length > JWT_CONFIG.maxCredentialLength) {
    return Response.json({ error: "Credential too large" }, { status: 400 });
  }

  try {
    const {
      sub: googleId,
      email,
      name,
      picture,
    } = await verifyGoogleJwt(credential);

    const users = await getUsers();
    let user = users.find((u) => u.googleId === googleId);

    if (!user) {
      user = { id: crypto.randomUUID(), email, name, picture, googleId };
      users.push(user);
      await writeUsers(users);
    } else {
      user.name = name;
      user.picture = picture;
      user.email = email;
      await writeUsers(users);
    }

    const token = await signSessionToken(user.id, user.name);

    return Response.json({
      id: user.id,
      username: user.name,
      email: user.email,
      picture: user.picture,
      token,
    });
  } catch (err) {
    if (err instanceof Error) console.error("Google auth failed:", err.message);
    return Response.json(
      { error: "Invalid Google credential" },
      { status: 401 },
    );
  }
}
