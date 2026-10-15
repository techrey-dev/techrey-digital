import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dataDirectory = mkdtempSync(join(tmpdir(), "techrey-db-test-"))
process.env.TECHREY_DATA_DIR = dataDirectory
const database = await import("./database.mjs")

beforeAll(async () => {
  await database.initializeDatabase()
})

afterAll(async () => {
  database.closeDatabase()
  delete process.env.TECHREY_DATA_DIR
  await new Promise((resolve) => setTimeout(resolve, 100))
  try {
    rmSync(dataDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  } catch {}
})

const order = (id) => ({
  id,
  ownerUserId: "user-test",
  customerName: "Test",
  whatsapp: "081234567890",
  service: "Coding & Website",
  purpose: "Pribadi",
  title: "Test database",
  brief: "Brief untuk pengujian database.",
  deadline: new Date(Date.now() + 86_400_000).toISOString(),
  timezone: "Asia/Makassar",
  status: "diajukan",
  createdAt: new Date().toISOString(),
  files: [], offers: [], payments: [], revisions: [], messages: [], events: [],
})

describe("database pesanan", () => {
  it("menghasilkan nomor pesanan secara atomik", async () => {
    expect(await database.nextOrderId()).toBe("TD-001")
    expect(await database.nextOrderId()).toBe("TD-002")
  })

  it("menolak penyimpanan dari versi yang sudah basi", async () => {
    const saved = await database.saveOrder(order("TD-010"))
    const firstReader = await database.getOrder(saved.id)
    const staleReader = await database.getOrder(saved.id)
    firstReader.title = "Perubahan pertama"
    await database.saveOrder(firstReader)
    staleReader.title = "Perubahan basi"
    await expect(database.saveOrder(staleReader)).rejects.toThrow(database.DatabaseConflictError)
    const current = await database.getOrder(saved.id)
    expect(current.title).toBe("Perubahan pertama")
  })
})
