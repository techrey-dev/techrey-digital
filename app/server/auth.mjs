import { loadEnvFile } from "node:process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { betterAuth } from "better-auth"

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

const authSecret = process.env.BETTER_AUTH_SECRET
if (!authSecret || authSecret.length < 32) throw new Error("BETTER_AUTH_SECRET wajib diisi dengan minimal 32 karakter.")

// Use Turso/libSQL if TURSO_DATABASE_URL is set, otherwise fall back to local SQLite
let databaseConfig
const tursoUrl = process.env.TURSO_DATABASE_URL

if (tursoUrl && !tursoUrl.startsWith("file:")) {
  // Cloud Turso — use libsql via URL
  const { createClient } = await import("@libsql/client")
  const { Kysely } = await import("kysely")
  const { LibsqlDialect } = await import("kysely-libsql")

  const libsqlClient = createClient({
    url: tursoUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const kyselyDb = new Kysely({ dialect: new LibsqlDialect({ client: libsqlClient }) })
  const { kyselyAdapter } = await import("better-auth/adapters/kysely")
  databaseConfig = { database: kyselyAdapter(kyselyDb, { type: "sqlite" }) }
} else {
  // Local SQLite for development
  const { DatabaseSync } = await import("node:sqlite")
  const database = new DatabaseSync(join(root, "data", "techrey-auth.sqlite"))
  databaseConfig = { database }
}

export const auth = betterAuth({
  appName: "Techrey Digital",
  baseURL: authBaseUrl,
  secret: authSecret,
  ...databaseConfig,
  socialProviders,
  trustedOrigins,
  advanced: { database: { joins: true } },
})

// Run migrations
const { getMigrations } = await import("better-auth/db/migration")
const migrations = await getMigrations(auth.options)
await migrations.runMigrations()
