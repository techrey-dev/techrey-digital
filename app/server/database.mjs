import { createClient } from "@libsql/client"
import { loadEnvFile } from "node:process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
try { loadEnvFile(join(root, ".env")) } catch (error) { if (error?.code !== "ENOENT") throw error }

import { existsSync, mkdirSync } from "node:fs"

function getDatabaseUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL
  if (process.env.TECHREY_DATA_DIR) {
    return `file:${join(process.env.TECHREY_DATA_DIR, "techrey.sqlite").replaceAll("\\", "/")}`
  }
  return `file:${join(root, "data", "techrey.sqlite").replaceAll("\\", "/")}`
}

const dbUrl = getDatabaseUrl()
if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.slice(5)
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

const client = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
})

export class DatabaseConflictError extends Error {
  constructor(message = "Data pesanan berubah di request lain. Muat ulang lalu coba lagi.") {
    super(message)
    this.status = 409
  }
}

export async function initializeDatabase() {
  await client.batch([
    "PRAGMA journal_mode = WAL",
    "PRAGMA foreign_keys = ON",
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      owner_user_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )`,
  ], "write")

  // Check and add columns if needed
  const columns = await client.execute("PRAGMA table_info(orders)")
  const columnNames = columns.rows.map((row) => row.name)
  if (!columnNames.includes("owner_user_id")) {
    await client.execute("ALTER TABLE orders ADD COLUMN owner_user_id TEXT")
  }
  if (!columnNames.includes("version")) {
    await client.execute("ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
  }
  await client.execute("CREATE INDEX IF NOT EXISTS orders_owner_user_id ON orders(owner_user_id)")

  // Sync counter
  const existingOrders = await client.execute("SELECT id FROM orders WHERE id LIKE 'TD-%'")
  const maximumOrderNumber = existingOrders.rows.reduce(
    (max, row) => Math.max(max, Number(String(row.id).split("-")[1]) || 0), 0
  )
  await client.execute({
    sql: "INSERT INTO counters (name, value) VALUES ('order', ?) ON CONFLICT(name) DO UPDATE SET value = MAX(value, excluded.value)",
    args: [maximumOrderNumber],
  })
}

function parseOrder(row) {
  if (!row) return undefined
  const order = JSON.parse(row.data_json)
  order.version = row.version
  order.messages ??= []
  order.files ??= []
  order.offers ??= []
  order.payments ??= []
  order.revisions ??= []
  order.events ??= []
  const activeOffer = order.offers.at(-1)
  for (const revision of order.revisions) revision.offerId ??= activeOffer?.id
  for (const file of order.files) {
    if (file.category !== "result") continue
    const legacyResult = !file.offerId
    file.offerId ??= activeOffer?.id
    if (legacyResult && !file.publishedAt && ["hasil-dikirim", "selesai", "revisi"].includes(order.status)) file.publishedAt = file.createdAt
  }
  return order
}

export async function listOrders() {
  const result = await client.execute("SELECT data_json, version FROM orders ORDER BY created_at DESC")
  return result.rows.map(parseOrder)
}

export async function getOrder(id) {
  const result = await client.execute({ sql: "SELECT data_json, version FROM orders WHERE id = ?", args: [id] })
  return parseOrder(result.rows[0])
}

export async function listOrdersByOwner(ownerUserId) {
  const result = await client.execute({ sql: "SELECT data_json, version FROM orders WHERE owner_user_id = ? ORDER BY created_at DESC", args: [ownerUserId] })
  return result.rows.map(parseOrder)
}

export async function getOrderForOwner(id, ownerUserId) {
  const result = await client.execute({ sql: "SELECT data_json, version FROM orders WHERE id = ? AND owner_user_id = ?", args: [id, ownerUserId] })
  return parseOrder(result.rows[0])
}

export async function saveOrder(order) {
  const updatedAt = new Date().toISOString()
  const expectedVersion = Number.isInteger(order.version) ? order.version : undefined
  const next = structuredClone(order)
  next.version = (expectedVersion ?? 0) + 1
  if (expectedVersion === undefined) {
    try {
      await client.execute({
        sql: "INSERT INTO orders (id, data_json, owner_user_id, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [next.id, JSON.stringify(next), next.ownerUserId ?? null, next.version, next.createdAt, updatedAt],
      })
    } catch (error) {
      if (error?.message?.includes("UNIQUE constraint") || error?.code?.startsWith?.("ERR_SQLITE_CONSTRAINT")) throw new DatabaseConflictError()
      throw error
    }
    return next
  }
  const result = await client.execute({
    sql: "UPDATE orders SET data_json = ?, owner_user_id = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?",
    args: [JSON.stringify(next), next.ownerUserId ?? null, next.version, updatedAt, next.id, expectedVersion],
  })
  if (result.rowsAffected !== 1) throw new DatabaseConflictError()
  return next
}

export async function nextOrderId() {
  const result = await client.execute("UPDATE counters SET value = value + 1 WHERE name = 'order' RETURNING value")
  return "TD-" + String(result.rows[0].value).padStart(3, "0")
}

export function closeDatabase() {
  try {
    client.close()
  } catch {}
}

export { client as dbClient }
