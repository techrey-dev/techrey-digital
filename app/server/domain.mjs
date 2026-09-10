import { randomUUID } from "node:crypto"

export class DomainRuleError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export const workStatuses = [
  "diajukan", "perlu-informasi", "ditinjau", "menunggu-persetujuan", "menunggu-pembayaran",
  "antrean", "dikerjakan", "revisi", "hasil-dikirim", "selesai", "ditolak", "dibatalkan",
]

const transitions = {
  diajukan: new Set(["perlu-informasi", "ditinjau", "ditolak", "dibatalkan"]),
  "perlu-informasi": new Set(["ditinjau", "dibatalkan"]),
  ditinjau: new Set(["perlu-informasi", "menunggu-persetujuan", "ditolak", "dibatalkan"]),
  "menunggu-persetujuan": new Set(["perlu-informasi", "dibatalkan"]),
  "menunggu-pembayaran": new Set(["dibatalkan"]),
  antrean: new Set(["dikerjakan", "dibatalkan"]),
  dikerjakan: new Set(["hasil-dikirim", "dibatalkan"]),
  revisi: new Set(["dikerjakan", "hasil-dikirim", "dibatalkan"]),
  "hasil-dikirim": new Set(["revisi", "selesai"]),
  selesai: new Set(),
  ditolak: new Set(),
  dibatalkan: new Set(),
}

const now = () => new Date().toISOString()
const uid = (prefix) => prefix + "-" + randomUUID().slice(0, 8)
const actorLabel = (actor, fallback) => actor?.email || actor?.id || fallback
const makeEvent = (actor, action, actorId) => ({ id: uid("event"), actor, actorId, action, timestamp: now() })
const activeOfferFor = (order) => order.offers.at(-1)
const paymentForOffer = (order, offer) => offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined
const activeRevisionFor = (order, offer) => offer
  ? order.revisions.findLast((item) => item.offerId === offer.id && item.status !== "selesai")
  : undefined

function requirePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new DomainRuleError("Data aksi tidak valid.")
  return payload
}

function validText(value, label, minimum, maximum) {
  if (typeof value !== "string" || value.trim().length < minimum || value.length > maximum) {
    throw new DomainRuleError(`${label} harus berisi ${minimum}–${maximum} karakter.`)
  }
  return value.trim()
}

function ensureStatus(status) {
  if (!workStatuses.includes(status)) throw new DomainRuleError("Status pekerjaan tidak valid.")
}

function ensureTransition(current, target) {
  ensureStatus(target)
  if (current === target) return false
  if (!transitions[current]?.has(target)) throw new DomainRuleError(`Perubahan status dari ${current} ke ${target} tidak diizinkan.`)
  return true
}

function validFutureDate(value, label) {
  const timestamp = Date.parse(value)
  if (!value || Number.isNaN(timestamp) || timestamp <= Date.now()) throw new DomainRuleError(`${label} harus berupa waktu setelah sekarang.`)
  return timestamp
}

function validateOffer(payload) {
  requirePayload(payload)
  if (!Number.isFinite(payload.amount) || payload.amount < 1000 || payload.amount > 1_000_000_000) throw new DomainRuleError("Harga penawaran tidak valid.")
  if (typeof payload.scope !== "string" || payload.scope.trim().length < 10 || payload.scope.length > 5000) throw new DomainRuleError("Lingkup penawaran tidak valid.")
  if (!Array.isArray(payload.deliverables) || payload.deliverables.length === 0 || payload.deliverables.length > 20 || payload.deliverables.some((item) => typeof item !== "string" || !item.trim() || item.length > 250)) throw new DomainRuleError("Hasil pekerjaan perlu dicantumkan dengan format yang valid.")
  if (!Number.isInteger(payload.revisionLimit) || payload.revisionLimit < 0 || payload.revisionLimit > 10) throw new DomainRuleError("Batas revisi tidak valid.")
  const dueAt = validFutureDate(payload.dueAt, "Tenggat hasil")
  const revisionDeadline = validFutureDate(payload.revisionDeadline, "Batas revisi")
  if (revisionDeadline < dueAt) throw new DomainRuleError("Batas revisi tidak boleh sebelum tenggat hasil.")
}

function normalizeOffer(payload) {
  return {
    amount: payload.amount,
    scope: payload.scope.trim(),
    deliverables: payload.deliverables.map((item) => item.trim()),
    revisionLimit: payload.revisionLimit,
    revisionDeadline: payload.revisionDeadline,
    dueAt: payload.dueAt,
  }
}

export function applyAdminAction(order, action, payload = {}, actor = {}) {
  const next = structuredClone(order)
  const activeOffer = activeOfferFor(next)
  const payment = paymentForOffer(next, activeOffer)
  const adminIdentity = actorLabel(actor, "admin")

  if (action === "mark-reviewed") {
    if (next.status === "ditinjau") return next
    ensureTransition(next.status, "ditinjau")
    next.status = "ditinjau"
    next.events.unshift(makeEvent("admin", "Brief ditandai sudah ditinjau.", adminIdentity))
  } else if (action === "request-information") {
    if (next.status === "perlu-informasi") return next
    ensureTransition(next.status, "perlu-informasi")
    const question = validText(requirePayload(payload).question, "Pertanyaan", 5, 1000)
    next.status = "perlu-informasi"
    next.messages ??= []
    next.messages.push({ id: uid("message"), actor: "admin", actorId: adminIdentity, text: question, createdAt: now() })
    next.events.unshift(makeEvent("admin", "Admin meminta informasi tambahan.", adminIdentity))
  } else if (action === "save-offer") {
    if (activeOffer?.acceptedAt) throw new DomainRuleError("Penawaran yang disetujui tidak dapat ditimpa. Buat versi baru.")
    if (!["ditinjau", "menunggu-persetujuan"].includes(next.status)) throw new DomainRuleError("Tandai brief sudah ditinjau sebelum membuat penawaran.")
    validateOffer(payload)
    const version = activeOffer?.version ?? next.offers.length + 1
    const offer = {
      id: activeOffer?.id ?? uid("offer"),
      version,
      ...normalizeOffer(payload),
      createdAt: activeOffer?.createdAt ?? now(),
    }
    if (activeOffer) next.offers[next.offers.length - 1] = offer
    else next.offers.push(offer)
    next.status = "menunggu-persetujuan"
    next.events.unshift(makeEvent("admin", "Penawaran versi " + version + " disimpan.", adminIdentity))
  } else if (action === "revise-offer") {
    if (!activeOffer?.acceptedAt) throw new DomainRuleError("Versi baru hanya dibuat setelah penawaran sebelumnya disetujui.")
    if (["selesai", "ditolak", "dibatalkan"].includes(next.status)) throw new DomainRuleError("Pesanan yang sudah ditutup tidak dapat diberi penawaran baru.")
    if (payment?.status === "menunggu-verifikasi") throw new DomainRuleError("Periksa pembayaran yang menunggu verifikasi sebelum membuat penawaran baru.")
    validateOffer(payload)
    if (payment?.status === "belum-dibayar") {
      payment.status = "dibatalkan"
      payment.cancelledAt = now()
    }
    const version = activeOffer.version + 1
    next.offers.push({ id: uid("offer"), version, ...normalizeOffer(payload), createdAt: now() })
    next.status = "menunggu-persetujuan"
    next.events.unshift(makeEvent("admin", "Revisi penawaran versi " + version + " dibuat.", adminIdentity))
  } else if (action === "verify-payment") {
    requirePayload(payload)
    if (!payment || payment.status !== "menunggu-verifikasi") throw new DomainRuleError("Tidak ada pembayaran yang menunggu verifikasi.")
    if (next.status !== "menunggu-pembayaran") throw new DomainRuleError("Status pesanan tidak cocok dengan pembayaran yang diperiksa.")
    if (typeof payload.merchantReference !== "string" || payload.merchantReference.trim().length < 4 || payload.merchantReference.length > 120) throw new DomainRuleError("Referensi transaksi merchant wajib dicatat.")
    payment.status = "dibayar"
    payment.merchantReference = payload.merchantReference.trim()
    payment.verifiedAt = now()
    payment.verifiedBy = adminIdentity
    next.status = "antrean"
    next.events.unshift(makeEvent("admin", "Pembayaran dicocokkan dengan transaksi merchant dan pesanan masuk antrean.", adminIdentity))
  } else if (action === "update-progress") {
    requirePayload(payload)
    if (payload.status === "selesai") throw new DomainRuleError("Pesanan diselesaikan oleh pelanggan setelah menerima hasil.")
    if (!ensureTransition(next.status, payload.status)) return next
    if (!["dikerjakan", "hasil-dikirim"].includes(payload.status)) {
      throw new DomainRuleError("Gunakan aksi khusus untuk meninjau, menutup, atau mengubah penawaran pesanan.")
    }
    if (payment?.status !== "dibayar") {
      throw new DomainRuleError("Verifikasi pembayaran untuk penawaran aktif sebelum memulai pengerjaan.")
    }
    const activeRevision = activeRevisionFor(next, activeOffer)
    const unpublishedResults = next.files.filter((file) => file.category === "result" && !file.publishedAt && file.offerId === activeOffer?.id && (activeRevision ? file.revisionId === activeRevision.id : !file.revisionId))
    if (payload.status === "hasil-dikirim" && unpublishedResults.length === 0) {
      throw new DomainRuleError("Unggah file hasil baru untuk penawaran atau revisi aktif terlebih dahulu.")
    }
    if (payload.status === "dikerjakan" && activeRevision?.status === "diajukan") {
      activeRevision.status = "dikerjakan"
      activeRevision.startedAt = now()
    }
    if (payload.status === "hasil-dikirim") {
      const publishedAt = now()
      for (const file of unpublishedResults) file.publishedAt = publishedAt
      if (activeRevision) {
        activeRevision.status = "selesai"
        activeRevision.completedAt = publishedAt
      }
    }
    next.status = payload.status
    next.events.unshift(makeEvent("admin", "Status pekerjaan diubah menjadi " + String(payload.status).replaceAll("-", " ") + ".", adminIdentity))
  } else if (action === "close-order") {
    requirePayload(payload)
    if (!["ditolak", "dibatalkan"].includes(payload.status)) throw new DomainRuleError("Status penutupan tidak valid.")
    if (!ensureTransition(next.status, payload.status)) return next
    const reason = validText(payload.reason, "Alasan", 5, 500)
    const paidPayments = next.payments.filter((item) => item.status === "dibayar")
    if (paidPayments.length) {
      const refundReference = validText(payload.refundReference, "Referensi pengembalian dana", 4, 120)
      for (const paid of paidPayments) {
        paid.status = "dikembalikan"
        paid.refundReference = refundReference
        paid.refundedAt = now()
        paid.refundedBy = adminIdentity
      }
    }
    for (const pending of next.payments.filter((item) => ["belum-dibayar", "menunggu-verifikasi"].includes(item.status))) {
      pending.status = "dibatalkan"
      pending.cancelledAt = now()
    }
    next.status = payload.status
    next.closedReason = reason
    next.events.unshift(makeEvent("admin", `${payload.status === "ditolak" ? "Pesanan ditolak" : "Pesanan dibatalkan"}: ${reason}`, adminIdentity))
  } else {
    throw new DomainRuleError("Aksi admin tidak dikenali.", 404)
  }

  return next
}

export function applyCustomerAction(order, action, payload = {}, actor = {}) {
  const next = structuredClone(order)
  const offer = activeOfferFor(next)
  const payment = paymentForOffer(next, offer)
  const customerIdentity = actorLabel(actor, next.ownerUserId || "pelanggan")

  if (action === "accept-offer") {
    if (!offer) throw new DomainRuleError("Belum ada penawaran yang dapat disetujui.")
    if (offer.acceptedAt) return next
    if (next.status !== "menunggu-persetujuan") throw new DomainRuleError("Penawaran tidak dapat disetujui pada tahap ini.")
    offer.acceptedAt = now()
    next.payments.push({ id: uid("payment"), offerId: offer.id, amount: offer.amount, status: "belum-dibayar" })
    next.status = "menunggu-pembayaran"
    next.events.unshift(makeEvent("pelanggan", "Penawaran versi " + offer.version + " disetujui.", customerIdentity))
  } else if (action === "mark-payment-attempt") {
    if (!payment || next.status !== "menunggu-pembayaran") throw new DomainRuleError("Pembayaran belum dapat dikonfirmasi pada tahap ini.")
    if (payment.status === "menunggu-verifikasi") return next
    if (payment.status !== "belum-dibayar") throw new DomainRuleError("Status pembayaran tidak dapat diubah.")
    payment.status = "menunggu-verifikasi"
    payment.markedAt = now()
    next.events.unshift(makeEvent("pelanggan", "Pelanggan mengonfirmasi pembayaran dan menunggu pemeriksaan admin.", customerIdentity))
  } else if (action === "request-revision") {
    requirePayload(payload)
    if (!offer || next.status !== "hasil-dikirim" || !next.files.some((file) => file.category === "result" && file.offerId === offer.id && file.publishedAt)) throw new DomainRuleError("Belum ada hasil terkirim yang dapat direvisi.")
    if (Date.parse(offer.revisionDeadline) < Date.now()) throw new DomainRuleError("Batas waktu pengajuan revisi sudah berakhir.")
    const offerRevisions = next.revisions.filter((item) => item.offerId === offer.id)
    if (offerRevisions.length >= offer.revisionLimit) throw new DomainRuleError("Batas putaran revisi pada penawaran sudah tercapai.")
    if (typeof payload.notes !== "string" || payload.notes.trim().length < 10 || payload.notes.length > 3000) throw new DomainRuleError("Catatan revisi harus berisi 10–3000 karakter.")
    const round = offerRevisions.length + 1
    next.revisions.push({ id: uid("revision"), offerId: offer.id, notes: payload.notes.trim(), round, status: "diajukan", createdAt: now() })
    next.status = "revisi"
    next.events.unshift(makeEvent("pelanggan", "Revisi putaran " + round + " diajukan.", customerIdentity))
  } else if (action === "reply-information") {
    if (next.status !== "perlu-informasi") throw new DomainRuleError("Tidak ada permintaan informasi yang sedang menunggu jawaban.")
    const message = validText(requirePayload(payload).message, "Jawaban", 5, 3000)
    next.messages ??= []
    next.messages.push({ id: uid("message"), actor: "pelanggan", actorId: customerIdentity, text: message, createdAt: now() })
    next.status = "ditinjau"
    next.events.unshift(makeEvent("pelanggan", "Informasi tambahan dikirim dan menunggu tinjauan admin.", customerIdentity))
  } else if (action === "cancel-order") {
    if (!["diajukan", "perlu-informasi", "ditinjau", "menunggu-persetujuan", "menunggu-pembayaran"].includes(next.status)) throw new DomainRuleError("Pesanan tidak dapat dibatalkan sendiri pada tahap ini.")
    if (next.payments.some((item) => item.status === "menunggu-verifikasi" || item.status === "dibayar")) throw new DomainRuleError("Hubungi admin karena pembayaran perlu direkonsiliasi sebelum pembatalan.")
    const reason = validText(requirePayload(payload).reason, "Alasan", 5, 500)
    ensureTransition(next.status, "dibatalkan")
    if (payment?.status === "belum-dibayar") {
      payment.status = "dibatalkan"
      payment.cancelledAt = now()
    }
    next.status = "dibatalkan"
    next.closedReason = reason
    next.events.unshift(makeEvent("pelanggan", `Pesanan dibatalkan: ${reason}`, customerIdentity))
  } else if (action === "accept-result") {
    if (next.status === "selesai") return next
    if (next.status !== "hasil-dikirim" || !next.files.some((file) => file.category === "result" && file.offerId === offer?.id && file.publishedAt)) throw new DomainRuleError("Belum ada hasil terkirim yang dapat diterima.")
    next.status = "selesai"
    next.events.unshift(makeEvent("pelanggan", "Hasil diterima dan pesanan selesai.", customerIdentity))
  } else {
    throw new DomainRuleError("Aksi pelanggan tidak dikenali.", 404)
  }

  return next
}
