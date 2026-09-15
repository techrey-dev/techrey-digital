import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("@vercel/blob", () => ({ put: vi.fn(), del: vi.fn() }))
vi.mock("../server/database.mjs", () => ({ getOrder: vi.fn(), listOrders: vi.fn(), saveOrder: vi.fn(), closeDatabase: vi.fn() }))
vi.mock("../server/private-files.mjs", () => ({ fetchBlobBuffer: vi.fn() }))
import { put, del } from "@vercel/blob"
import { getOrder, listOrders, saveOrder, closeDatabase } from "../server/database.mjs"
import { fetchBlobBuffer } from "../server/private-files.mjs"

const originalArgv = process.argv
const publicUrl = "https://old.public.blob.vercel-storage.com/file.pdf"
const privateUrl = "https://new.private.blob.vercel-storage.com/file.pdf"
let stored
let operations

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "private-test")
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "public-test")
  process.argv = [process.execPath, "migrate-private-files.mjs", "--apply"]
  stored = { id: "TD-TEST", files: [{ id: "file-test", originalName: "file.pdf", mimeType: "application/pdf", blobUrl: publicUrl }] }
  operations = []
  listOrders.mockImplementation(async () => [structuredClone(stored)])
  getOrder.mockImplementation(async () => structuredClone(stored))
  saveOrder.mockImplementation(async (order) => { operations.push("save"); stored = structuredClone(order); return order })
  fetchBlobBuffer.mockResolvedValue({ buffer: Buffer.from("%PDF-1.7") })
  put.mockImplementation(async () => { operations.push("put"); return { url: privateUrl } })
  del.mockImplementation(async () => { operations.push("delete") })
})

afterEach(() => { process.argv = originalArgv; vi.unstubAllEnvs(); vi.restoreAllMocks() })

it("dry-run tidak mengunggah, mengubah pesanan, atau menghapus file", async () => {
  process.argv = [process.execPath, "migrate-private-files.mjs"]
  await import("./migrate-private-files.mjs")
  expect(operations).toEqual([])
  expect(closeDatabase).toHaveBeenCalled()
})

it("menghapus file publik hanya sesudah URL privat tersimpan", async () => {
  await import("./migrate-private-files.mjs")
  expect(operations).toEqual(["put", "save", "delete", "save"])
  expect(stored.files[0].blobUrl).toBe(privateUrl)
  expect(stored.files[0].legacyPublicBlobUrl).toBeUndefined()
  expect(del).toHaveBeenCalledWith(publicUrl, { token: "public-test" })
})

it("melanjutkan pembersihan jika penghapusan publik sempat gagal", async () => {
  del.mockRejectedValueOnce(new Error("storage unavailable"))
  await expect(import("./migrate-private-files.mjs")).rejects.toThrow("storage unavailable")
  expect(stored.files[0].blobUrl).toBe(privateUrl)
  expect(stored.files[0].legacyPublicBlobUrl).toBe(publicUrl)
  vi.resetModules()
  await import("./migrate-private-files.mjs")
  expect(put).toHaveBeenCalledTimes(1)
  expect(stored.files[0].legacyPublicBlobUrl).toBeUndefined()
})

it("menjaga file publik saat penyimpanan database berkonflik", async () => {
  saveOrder.mockRejectedValueOnce(new Error("version conflict"))
  await expect(import("./migrate-private-files.mjs")).rejects.toThrow("version conflict")
  expect(stored.files[0].blobUrl).toBe(publicUrl)
  expect(del).toHaveBeenCalledWith(privateUrl, { token: "private-test" })
  expect(del).not.toHaveBeenCalledWith(publicUrl, expect.anything())
})
