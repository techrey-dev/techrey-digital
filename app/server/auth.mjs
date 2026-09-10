import { loadEnvFile } from "node:process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { betterAuth } from "better-auth"
import { createClient } from "@libsql/client"
import { Kysely } from "kysely"
import { LibsqlDialect } from "kysely-libsql"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
try {
  loadEnvFile(join(root, ".env"))
} catch (error) {
  if (error?.code !== "ENOENT") throw error
}

export const authBaseUrl = process.env.BETTER_AUTH_URL || "http://127.0.0.1:5173"
export const configuredProviders = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
}
export function getAdminEmails() {
  try {
    loadEnvFile(join(root, ".env"))
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
  return new Set((process.env.ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean))
}

const socialProviders = {}
if (configuredProviders.google) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    prompt: "select_account",
  }
}
if (configuredProviders.github) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }
}

const trustedOrigins = [
  authBaseUrl,
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim()) : []),
]

const authSecret = process.env.BETTER_AUTH_SECRET || "techrey-digital-auth-secret-min-32-chars-key"

function getAuthDbUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL
  if (process.env.TECHREY_DATA_DIR) {
    return `file:${join(process.env.TECHREY_DATA_DIR, "techrey-auth.sqlite").replaceAll("\\", "/")}`
  }
  if (process.env.VERCEL) {
    return `file:${join(tmpdir(), "techrey-auth.sqlite").replaceAll("\\", "/")}`
  }
  return `file:${join(root, "data", "techrey-auth.sqlite").replaceAll("\\", "/")}`
}

const authDbUrl = getAuthDbUrl()
if (authDbUrl.startsWith("file:")) {
  const filePath = authDbUrl.slice(5)
  const dir = dirname(filePath)
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch {}
}

const libsqlClient = createClient({
  url: authDbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
})

const kyselyDb = new Kysely({ dialect: new LibsqlDialect({ client: libsqlClient }) })

export const auth = betterAuth({
  appName: "Techrey Digital",
  baseURL: authBaseUrl,
  secret: authSecret,
  database: {
    db: kyselyDb,
    type: "sqlite",
  },
  socialProviders,
  trustedOrigins,
  advanced: { database: { joins: true } },
})

// Run migrations safely
try {
  const { getMigrations } = await import("better-auth/db/migration")
  const migrations = await getMigrations(auth.options)
  await migrations.runMigrations()
} catch (error) {
  console.warn("Peringatan migrasi auth:", error?.message || error)
}
