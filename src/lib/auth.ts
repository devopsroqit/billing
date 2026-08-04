import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "./constants";

const COOKIE_NAME = "roqit_session";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET is not set (or too short). Add it to your .env file.");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Validate email/password and, on success, set the session cookie. */
export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

export function logout() {
  cookies().delete(COOKIE_NAME);
}

/** Returns the logged-in user, or null. Safe to call in server components. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Editors and admins can add/edit payment rows, mark paid, and upload docs. */
export function canEdit(role: Role): boolean {
  return role === "ADMIN" || role === "EDITOR";
}

/** Only admins can manage team members and their roles. */
export function canManageUsers(role: Role): boolean {
  return role === "ADMIN";
}

/** Throw if the given role may not edit — used to guard server actions. */
export function assertCanEdit(role: Role) {
  if (!canEdit(role)) {
    throw new Error("You don't have permission to make changes. Ask an admin for Editor access.");
  }
}

/** Throw if the given role may not manage users. */
export function assertCanManageUsers(role: Role) {
  if (!canManageUsers(role)) {
    throw new Error("Only admins can manage team members.");
  }
}
