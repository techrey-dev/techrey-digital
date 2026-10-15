import { put, del, get } from "@vercel/blob"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { validateUpload } from "./file-validation.mjs"
import { DomainRuleError } from "./domain.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const localDir = join(process.env.TECHREY_DATA_DIR || join(root, "data"), "private-files")
const privateToken = () => process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN

/**
 * Store a file. Uses Vercel Blob in production, local disk in development.
 * Returns a FileMeta-like object with id, blobUrl (if Vercel Blob), and metadata.
 */
export async function storePrivateFile({ orderId, category, originalName, mimeType, bytes }) {
  const validated = validateUpload(originalName, mimeType, bytes)
  const decoded = validated.originalName
  const id = "file-" + randomUUID().slice(0, 8)

  if (privateToken()) {
    const blob = await put(`orders/${orderId}/${id}/${decoded}`, bytes, {
      access: "private",
      token: privateToken(),
      contentType: validated.mimeType,
      addRandomSuffix: true,
    })
    return {
      id,
      category,
      originalName: decoded,
      mimeType: validated.mimeType,
      size: bytes.length || bytes.byteLength || 0,
      createdAt: new Date().toISOString(),
      blobUrl: blob.url,
    }
  }

  // Local fallback for development
  if (process.env.VERCEL) throw new DomainRuleError("Penyimpanan file privat belum dikonfigurasi.", 503)
  const dir = join(localDir, orderId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, id), bytes)
  return {
    id,
    category,
    originalName: decoded,
    mimeType: validated.mimeType,
    size: bytes.length || bytes.byteLength || 0,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Fetch a blob buffer from public or private Vercel Blob store.
 * Automatically handles Authorization with BLOB_READ_WRITE_TOKEN and cleans delegation tokens.
 */
export async function fetchBlobBuffer(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com$/.test(parsed.hostname)) return null
    if (parsed.hostname.includes(".private.blob.")) {
      const result = await get(url, { access: "private", token: privateToken(), useCache: false })
      if (!result || result.statusCode !== 200) return null
      return { buffer: Buffer.from(await new Response(result.stream).arrayBuffer()), contentType: result.blob.contentType }
    }
    let response = await fetch(url)
    if (!response.ok && (response.status === 401 || response.status === 403) && process.env.BLOB_READ_WRITE_TOKEN) {
      const cleanUrl = url.split("?")[0]
      response = await fetch(cleanUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      })
    }
    if (!response.ok) return null
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "image/png",
    }
  } catch (err) {
    console.error("fetchBlobBuffer error:", err?.message || err)
    return null
  }
}

/**
 * Read a file. Returns Buffer/Uint8Array or null.
 */
export async function readPrivateFile(orderId, fileId, blobUrl) {
  if (blobUrl) {
    const result = await fetchBlobBuffer(blobUrl)
    return result ? result.buffer : null
  }

  // Local fallback
  const path = join(localDir, orderId, fileId)
  try {
    return readFileSync(path)
  } catch {
    return null
  }
}

/**
 * Remove a file.
 */
export async function removePrivateFile(orderId, fileId, blobUrl) {
  if (blobUrl) {
    const token = new URL(blobUrl).hostname.includes(".private.blob.") ? privateToken() : process.env.BLOB_READ_WRITE_TOKEN
    try { await del(blobUrl, { token }) } catch { /* ignore */ }
    return
  }

  // Local fallback
  const path = join(localDir, orderId, fileId)
  try { unlinkSync(path) } catch { /* ignore */ }
}
