import { randomUUID } from "node:crypto"
import express from "express"
import { fromNodeHeaders, toNodeHandler } from "better-auth/node"
import { auth, configuredProviders, getAdminEmails } from "./server/auth.mjs"
import { applyAdminAction, applyCustomerAction, DomainRuleError } from "./server/domain.mjs"
import { getOrder, getOrderForOwner, initializeDatabase, listOrders, listOrdersByOwner, nextOrderId, saveOrder } from "./server/database.mjs"
import { aiConfig, publicRuntimeConfig, qrisConfig } from "./server/runtime-config.mjs"
import { readPrivateFile, removePrivateFile, storePrivateFile } from "./server/private-files.mjs"
import { analyzeOrderWithAi } from "./server/ai-assistant.mjs"

try {
  await initializeDatabase()
} catch (error) {
  console.warn("Peringatan inisialisasi database:", error?.message || error)
}

const app = express()
app.disable("x-powered-by")

app.use((request, response, next) => {
  request.requestId = request.headers["x-request-id"] || randomUUID()
  response.setHeader("X-Request-ID", request.requestId)
  response.setHeader("X-Content-Type-Options", "nosniff")
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  response.setHeader("X-Frame-Options", "DENY")
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com https://github.com; img-src 'self' data: https://*.public.blob.vercel-storage.com; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'")
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }
  next()
})

app.all("/api/auth/*splat", toNodeHandler(auth))

const writeRequests = new Map()
app.use("/api", (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next()
  const key = request.ip || request.socket?.remoteAddress || "unknown"
  const recent = (writeRequests.get(key) || []).filter((timestamp) => timestamp > Date.now() - 5 * 60_000)
  if (recent.length >= 120) return next(new DomainRuleError("Terlalu banyak request. Coba lagi beberapa menit.", 429))
  recent.push(Date.now())
  writeRequests.set(key, recent)
  next()
})

app.use(express.json({ limit: "128kb" }))

const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response)).catch(next)
const uid = (prefix) => prefix + "-" + randomUUID().slice(0, 8)

async function requireOrder(id) {
  const order = await getOrder(id)
  if (!order) throw new DomainRuleError("Pesanan tidak ditemukan.", 404)
  return order
}

async function requireSession(request) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session?.user) throw new DomainRuleError("Silakan masuk untuk membuka pesanan.", 401)
  return session
}

async function requireAdmin(request) {
  const session = await requireSession(request)
  const allowed = getAdminEmails()
  if (allowed.size === 0) throw new DomainRuleError("ADMIN_EMAILS belum dikonfigurasi pada file .env server.", 503)
  if (!allowed.has(session.user.email.toLowerCase())) {
    throw new DomainRuleError(`Akun (${session.user.email}) tidak memiliki akses admin. Pastikan email ini terdaftar di ADMIN_EMAILS.`, 403)
  }
  return session
}

function isAdminSession(session) {
  return Boolean(session?.user?.email && getAdminEmails().has(session.user.email.toLowerCase()))
}

async function requireOwnedOrder(id, userId) {
  const order = await getOrderForOwner(id, userId)
  if (!order) throw new DomainRuleError("Pesanan tidak ditemukan pada akun ini.", 404)
  return order
}

function customerView(order) {
  const view = structuredClone(order)
  delete view.ownerUserId
  view.files = (view.files ?? []).filter((file) => file.category !== "result" || file.publishedAt)
  view.events = (view.events ?? []).map(({ actorId: _actorId, ...event }) => event)
  view.payments = (view.payments ?? []).map(({ verifiedBy: _verifiedBy, refundedBy: _refundedBy, merchantReference: _merchantReference, refundReference: _refundReference, ...payment }) => payment)
  view.offers ??= []
  view.revisions ??= []
  view.messages ??= []
  return view
}

async function createOrder(draft) {
  const services = ["Dokumen & Penulisan", "PPT & Presentasi", "Coding & Website", "Bantuan & Review Tugas"]
  const purposes = ["Pribadi", "Sekolah", "Kuliah", "Organisasi", "Usaha"]
  if (!services.includes(draft.service) || !purposes.includes(draft.purpose)) throw new DomainRuleError("Layanan atau keperluan tidak valid.")
  if (typeof draft.customerName !== "string" || !draft.customerName.trim() || draft.customerName.length > 100) throw new DomainRuleError("Nama wajib diisi dan maksimal 100 karakter.")
  if (typeof draft.whatsapp !== "string" || !/^[+0-9 ()-]{8,20}$/.test(draft.whatsapp)) throw new DomainRuleError("Nomor WhatsApp tidak valid.")
  if (typeof draft.title !== "string" || !draft.title.trim() || draft.title.length > 150) throw new DomainRuleError("Judul wajib diisi dan maksimal 150 karakter.")
  if (typeof draft.brief !== "string" || draft.brief.trim().length < 15 || draft.brief.length > 5000) throw new DomainRuleError("Brief harus berisi 15–5000 karakter.")
  if (!draft.deadline || Number.isNaN(Date.parse(draft.deadline)) || new Date(draft.deadline) <= new Date()) throw new DomainRuleError("Tenggat harus berada setelah waktu sekarang.")
  if (draft.budget !== undefined && (!Number.isFinite(draft.budget) || draft.budget < 0 || draft.budget > 1_000_000_000)) throw new DomainRuleError("Anggaran tidak valid.")
  const createdAt = new Date().toISOString()
  const id = await nextOrderId()
  return {
    id, customerName: draft.customerName.trim(), whatsapp: draft.whatsapp.trim(), service: draft.service,
    purpose: draft.purpose, title: draft.title.trim(), brief: draft.brief.trim(), deadline: draft.deadline,
    timezone: "Asia/Makassar", budget: Number.isFinite(draft.budget) ? draft.budget : undefined,
    status: "diajukan", createdAt,
    files: [],
    offers: [], payments: [], revisions: [], messages: [],
    events: [{ id: uid("event"), actor: "pelanggan", actorId: draft.ownerUserId, action: "Kebutuhan diajukan.", timestamp: createdAt }],
  }
}

app.get("/api/health", (_request, response) => response.json({ ok: true, storage: "turso", auth: "better-auth" }))
app.get("/api/auth-config", (_request, response) => response.json({ providers: configuredProviders, adminConfigured: getAdminEmails().size > 0 }))
app.get("/api/public-config", (_request, response) => response.json(publicRuntimeConfig()))

app.get("/api/admin/orders", asyncRoute(async (request, response) => {
  await requireAdmin(request)
  response.json({ orders: await listOrders() })
}))

app.post("/api/orders", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = await createOrder({ ...(request.body ?? {}), ownerUserId: session.user.id })
  order.ownerUserId = session.user.id
  order.events[0].actorId = session.user.id
  const saved = await saveOrder(order)
  response.status(201).json({ order: customerView(saved) })
}))

app.get("/api/customer/orders", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const orders = await listOrdersByOwner(session.user.id)
  response.json({ orders: orders.map(customerView) })
}))

const uploadBytes = express.raw({ type: "application/octet-stream", limit: "10mb" })

app.post("/api/customer/orders/:id/files", uploadBytes, asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = await requireOwnedOrder(request.params.id, session.user.id)
  if (!["diajukan", "perlu-informasi", "ditinjau"].includes(order.status)) throw new DomainRuleError("Lampiran referensi tidak dapat ditambah pada tahap ini.")
  if (order.files.filter((file) => file.category === "reference").length >= 10) throw new DomainRuleError("Maksimal 10 lampiran referensi.")
  const file = await storePrivateFile({ orderId: order.id, category: "reference", originalName: request.headers["x-file-name"], mimeType: request.headers["x-file-type"] || "application/octet-stream", bytes: request.body })
  try {
    const next = structuredClone(order)
    next.files.push(file)
    next.events.unshift({ id: uid("event"), actor: "pelanggan", actorId: session.user.id, action: `Lampiran ${file.originalName} diunggah.`, timestamp: new Date().toISOString() })
    response.status(201).json({ order: customerView(await saveOrder(next)) })
  } catch (error) {
    await removePrivateFile(order.id, file.id, file.blobUrl)
    throw error
  }
}))

app.post("/api/admin/orders/:id/files", uploadBytes, asyncRoute(async (request, response) => {
  const session = await requireAdmin(request)
  const order = await requireOrder(request.params.id)
  const offer = order.offers.at(-1)
  const payment = offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined
  if (payment?.status !== "dibayar" || !["antrean", "dikerjakan", "revisi"].includes(order.status)) throw new DomainRuleError("File hasil hanya dapat diunggah setelah pembayaran terverifikasi dan pengerjaan dimulai.")
  if (order.files.filter((file) => file.category === "result").length >= 20) throw new DomainRuleError("Maksimal 20 file hasil.")
  const activeRevision = order.revisions.findLast((item) => item.offerId === offer.id && item.status !== "selesai")
  const file = {
    ...(await storePrivateFile({ orderId: order.id, category: "result", originalName: request.headers["x-file-name"], mimeType: request.headers["x-file-type"] || "application/octet-stream", bytes: request.body })),
    offerId: offer.id,
    ...(activeRevision ? { revisionId: activeRevision.id } : {}),
  }
  try {
    const next = structuredClone(order)
    next.files.push(file)
    next.events.unshift({ id: uid("event"), actor: "admin", actorId: session.user.email, action: `File hasil ${file.originalName} diunggah.`, timestamp: new Date().toISOString() })
    response.status(201).json({ order: await saveOrder(next) })
  } catch (error) {
    await removePrivateFile(order.id, file.id, file.blobUrl)
    throw error
  }
}))

app.get("/api/orders/:id/files/:fileId", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = await requireOrder(request.params.id)
  const admin = isAdminSession(session)
  if (order.ownerUserId !== session.user.id && !admin) throw new DomainRuleError("File tidak ditemukan.", 404)
  const file = order.files.find((item) => item.id === request.params.fileId)
  if (!file) throw new DomainRuleError("File tidak ditemukan.", 404)
  if (!admin && file.category === "result" && !file.publishedAt) throw new DomainRuleError("File tidak ditemukan.", 404)
  const bytes = await readPrivateFile(order.id, file.id, file.blobUrl)
  if (!bytes) throw new DomainRuleError("Isi file tidak ditemukan pada penyimpanan.", 404)
  response.setHeader("Content-Type", file.mimeType || "application/octet-stream")
  response.setHeader("Content-Length", bytes.length)
  response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`)
  response.setHeader("Cache-Control", "private, no-store")
  response.send(bytes)
}))

app.get("/api/customer/orders/:id/payment-instructions", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = isAdminSession(session) ? await requireOrder(request.params.id) : await requireOwnedOrder(request.params.id, session.user.id)
  const offer = order.offers.at(-1)
  const payment = offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined
  if (!qrisConfig.configured && !qrisConfig.blobUrl) throw new DomainRuleError("QRIS merchant belum dikonfigurasi.", 503)
  if (!offer?.acceptedAt || !payment || !["belum-dibayar", "menunggu-verifikasi"].includes(payment.status)) throw new DomainRuleError("Instruksi pembayaran belum tersedia untuk pesanan ini.")
  response.json({ merchantName: qrisConfig.merchantName, amount: payment.amount, qrUrl: `/api/customer/orders/${encodeURIComponent(order.id)}/qris` })
}))

app.get("/api/customer/orders/:id/qris", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = isAdminSession(session) ? await requireOrder(request.params.id) : await requireOwnedOrder(request.params.id, session.user.id)
  const offer = order.offers.at(-1)
  const payment = offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined
  if ((!qrisConfig.configured && !qrisConfig.blobUrl) || !offer?.acceptedAt || !payment || !["belum-dibayar", "menunggu-verifikasi"].includes(payment.status)) throw new DomainRuleError("QRIS merchant belum tersedia untuk status ini.", 404)

  if (qrisConfig.blobUrl) {
    // Proxy from Vercel Blob
    const blobResponse = await fetch(qrisConfig.blobUrl)
    if (!blobResponse.ok) throw new DomainRuleError("QRIS merchant tidak ditemukan.", 404)
    response.setHeader("Content-Type", blobResponse.headers.get("content-type") || "image/png")
    response.setHeader("Cache-Control", "private, no-store")
    const buffer = Buffer.from(await blobResponse.arrayBuffer())
    response.send(buffer)
  } else {
    response.setHeader("Content-Type", qrisConfig.contentType)
    response.setHeader("Cache-Control", "private, no-store")
    response.sendFile(qrisConfig.imagePath)
  }
}))

app.get("/api/admin/qris", asyncRoute(async (request, response) => {
  await requireAdmin(request)
  if (qrisConfig.blobUrl) {
    const blobResponse = await fetch(qrisConfig.blobUrl)
    if (!blobResponse.ok) throw new DomainRuleError("QRIS merchant tidak ditemukan.", 404)
    response.setHeader("Content-Type", blobResponse.headers.get("content-type") || "image/png")
    response.setHeader("Cache-Control", "private, no-store")
    response.send(Buffer.from(await blobResponse.arrayBuffer()))
  } else if (qrisConfig.configured) {
    response.setHeader("Content-Type", qrisConfig.contentType)
    response.setHeader("Cache-Control", "private, no-store")
    response.sendFile(qrisConfig.imagePath)
  } else {
    throw new DomainRuleError("QRIS merchant belum dikonfigurasi.", 404)
  }
}))

app.post("/api/customer/orders/:id/actions", asyncRoute(async (request, response) => {
  const session = await requireSession(request)
  const order = await requireOwnedOrder(request.params.id, session.user.id)
  if (request.body?.action === "mark-payment-attempt" && !qrisConfig.configured && !qrisConfig.blobUrl) throw new DomainRuleError("Konfirmasi pembayaran belum tersedia karena QRIS merchant belum dikonfigurasi.", 503)
  response.json({ order: customerView(await saveOrder(applyCustomerAction(order, request.body?.action, request.body?.payload, session.user))) })
}))

app.post("/api/admin/orders/:id/actions", asyncRoute(async (request, response) => {
  const session = await requireAdmin(request)
  const order = await requireOrder(request.params.id)
  response.json({ order: await saveOrder(applyAdminAction(order, request.body?.action, request.body?.payload, session.user)) })
}))

const aiRequests = new Map()
app.post("/api/admin/orders/:id/assistant", asyncRoute(async (request, response) => {
  const session = await requireAdmin(request)
  const order = await requireOrder(request.params.id)
  const key = session.user.id
  const recent = (aiRequests.get(key) || []).filter((timestamp) => timestamp > Date.now() - 5 * 60_000)
  if (recent.length >= 10) throw new DomainRuleError("Batas analisis AI tercapai. Coba lagi beberapa menit.", 429)
  recent.push(Date.now())
  aiRequests.set(key, recent)
  response.json({ draft: await analyzeOrderWithAi(order), model: aiConfig.model })
}))

app.use("/api", (_request, response) => response.status(404).json({ error: "Endpoint API tidak ditemukan." }))

// Error handler
app.use((error, _request, response, _next) => {
  const suggestedStatus = Number(error?.status || error?.statusCode)
  const status = error instanceof DomainRuleError || (suggestedStatus >= 400 && suggestedStatus < 500) ? (error.status || suggestedStatus) : 500
  if (status === 500) console.error(error)
  const message = status === 500
    ? (error?.message || "Server mengalami kendala.")
    : error?.type === "entity.parse.failed"
      ? "JSON request tidak valid."
      : status === 413
        ? "Ukuran request melebihi batas yang diizinkan."
        : error.message
  response.status(status).json({ error: message })
})

export default app
