import { put, del } from "@vercel/blob"
import { getOrder, listOrders, saveOrder, closeDatabase } from "../server/database.mjs"
import { fetchBlobBuffer } from "../server/private-files.mjs"

const apply = process.argv.includes("--apply")
const publicBlob = (url) => {
  try { return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com") } catch { return false }
}

try {
  const orders = await listOrders()
  const candidates = orders.flatMap((order) => order.files
    .filter((file) => publicBlob(file.blobUrl) || file.legacyPublicBlobUrl)
    .map((file) => ({ orderId: order.id, fileId: file.id })))
  console.log(`${candidates.length} file publik perlu dipindahkan atau dibersihkan. Mode: ${apply ? "apply" : "dry-run"}.`)
  if (apply && (!process.env.PRIVATE_BLOB_READ_WRITE_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN)) throw new Error("Isi PRIVATE_BLOB_READ_WRITE_TOKEN untuk store Private dan BLOB_READ_WRITE_TOKEN untuk store Public lama.")
  for (const { orderId, fileId } of candidates) {
    console.log(`${orderId}/${fileId}`)
    if (!apply) continue
    let order = await getOrder(orderId)
    let file = order.files.find((item) => item.id === fileId)
    if (publicBlob(file.blobUrl)) {
      const sourceUrl = file.blobUrl
      const source = await fetchBlobBuffer(sourceUrl)
      if (!source) throw new Error(`File sumber tidak dapat dibaca: ${orderId}/${fileId}`)
      const uploaded = await put(`orders/${orderId}/${fileId}/${file.originalName}`, source.buffer, {
        access: "private", token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN,
        contentType: file.mimeType || "application/octet-stream", addRandomSuffix: true,
      })
      file.blobUrl = uploaded.url
      // Persist the cleanup marker before deleting the old URL so interrupted runs can resume.
      file.legacyPublicBlobUrl = sourceUrl
      try { await saveOrder(order) } catch (error) {
        await del(uploaded.url, { token: process.env.PRIVATE_BLOB_READ_WRITE_TOKEN })
        throw error
      }
    }
    order = await getOrder(orderId)
    file = order.files.find((item) => item.id === fileId)
    if (file.legacyPublicBlobUrl) {
      await del(file.legacyPublicBlobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
      delete file.legacyPublicBlobUrl
      await saveOrder(order)
    }
  }
} finally {
  closeDatabase()
}
