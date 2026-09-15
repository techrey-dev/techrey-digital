import { describe, expect, it } from "vitest"
import { applyAdminAction, applyCustomerAction, DomainRuleError } from "./domain.mjs"
import { seedOrders } from "./seed.mjs"

const future = (days) => new Date(Date.now() + days * 86400000).toISOString()
const offer = {
  amount: 250000,
  scope: "Pembuatan presentasi 12 slide dari materi pelanggan.",
  deliverables: ["PPTX yang dapat diedit", "PDF pratinjau"],
  revisionLimit: 2,
  dueAt: future(5),
  revisionDeadline: future(7),
}

describe("aturan alur pesanan di server", () => {
  it("menolak persetujuan harga atau lingkup yang sudah berubah", () => {
    const reviewed = applyAdminAction(structuredClone(seedOrders[0]), "mark-reviewed")
    const shown = applyAdminAction(reviewed, "save-offer", offer)
    const consent = { offerId: shown.offers[0].id, offerVersion: shown.offers[0].version }
    for (const changes of [{ amount: offer.amount + 100000 }, { scope: "Lingkup baru yang perlu disetujui kembali." }]) {
      const changed = applyAdminAction(shown, "save-offer", { ...offer, ...changes })
      expect(() => applyCustomerAction(changed, "accept-offer", consent)).toThrow("Penawaran berubah")
      expect(changed.payments).toHaveLength(0)
      expect(changed.offers[0].version).toBe(consent.offerVersion + 1)
    }
    expect(() => applyCustomerAction(shown, "accept-offer")).toThrow("Penawaran berubah")
    expect(() => applyCustomerAction(shown, "accept-offer", { ...consent, offerId: "other" })).toThrow("Penawaran berubah")
  })

  it("memblokir pembatalan sampai transaksi diperiksa, termasuk jika referensi refund dikirim", () => {
    const pending = structuredClone(seedOrders[1])
    pending.payments[0].status = "menunggu-verifikasi"
    expect(() => applyAdminAction(pending, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan.", refundReference: "REFUND-001" })).toThrow("Periksa pembayaran")
    const paid = applyAdminAction(pending, "verify-payment", { merchantReference: "QRIS-001" })
    expect(() => applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan." })).toThrow("Referensi pengembalian dana")
    const closed = applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan.", refundReference: "REFUND-001" })
    expect(closed.payments[0].status).toBe("dikembalikan")
  })

  it("mencatat transaksi tidak ditemukan sebelum mengizinkan pembatalan atau konfirmasi ulang", () => {
    const pending = structuredClone(seedOrders[1])
    pending.payments[0].status = "menunggu-verifikasi"
    expect(() => applyAdminAction(pending, "reject-payment", { reason: "" })).toThrow("Hasil pemeriksaan")
    const rejected = applyAdminAction(pending, "reject-payment", { reason: "Transaksi tidak ada di riwayat merchant." }, { email: "admin@example.com" })
    expect(rejected.payments[0]).toMatchObject({ status: "belum-dibayar", rejectedBy: "admin@example.com", rejectionReason: "Transaksi tidak ada di riwayat merchant." })
    expect(rejected.payments[0].rejectedAt).toBeTruthy()
    expect(applyCustomerAction(rejected, "mark-payment-attempt").payments[0].status).toBe("menunggu-verifikasi")
    expect(applyAdminAction(rejected, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan." }).status).toBe("dibatalkan")
    expect(() => applyAdminAction(structuredClone(seedOrders[2]), "reject-payment", { reason: "Transaksi tidak ditemukan." })).toThrow("Tidak ada pembayaran")
  })

  it("menjalankan alur utama sampai revisi", () => {
    let order = structuredClone(seedOrders[0])
    order = applyAdminAction(order, "mark-reviewed")
    order = applyAdminAction(order, "save-offer", offer)
    order = applyCustomerAction(order, "accept-offer", { offerId: order.offers.at(-1).id, offerVersion: order.offers.at(-1).version })
    order = applyCustomerAction(order, "mark-payment-attempt")
    order = applyAdminAction(order, "verify-payment", { merchantReference: "QRIS-TEST-001" }, { email: "admin@example.com" })
    order = applyAdminAction(order, "update-progress", { status: "dikerjakan" })
    order.files.push({ id: "file-test", category: "result", offerId: order.offers.at(-1).id, originalName: "hasil.pptx", size: 12000, createdAt: new Date().toISOString() })
    order = applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })
    order = applyCustomerAction(order, "request-revision", { notes: "Mohon rapikan diagram pada slide tujuh." })

    expect(order.status).toBe("revisi")
    expect(order.payments.at(-1).status).toBe("dibayar")
    expect(order.revisions).toHaveLength(1)
    expect(order.revisions[0].offerId).toBe(order.offers.at(-1).id)
    expect(order.files.find((file) => file.id === "file-test").publishedAt).toBeTruthy()
    expect(order.payments.at(-1).verifiedBy).toBe("admin@example.com")
  })

  it("menolak pengerjaan sebelum pembayaran terverifikasi", () => {
    let order = applyAdminAction(structuredClone(seedOrders[0]), "mark-reviewed")
    order = applyAdminAction(order, "save-offer", offer)
    order = applyCustomerAction(order, "accept-offer", { offerId: order.offers.at(-1).id, offerVersion: order.offers.at(-1).version })
    expect(() => applyAdminAction(order, "update-progress", { status: "dikerjakan" })).toThrow(DomainRuleError)
  })

  it("menolak status hasil ketika file hasil belum dipilih", () => {
    const order = structuredClone(seedOrders[2])
    expect(() => applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })).toThrow("Unggah file hasil")
  })

  it("tidak menggandakan pembayaran saat persetujuan diulang", () => {
    let order = applyAdminAction(structuredClone(seedOrders[0]), "mark-reviewed")
    order = applyAdminAction(order, "save-offer", offer)
    order = applyCustomerAction(order, "accept-offer", { offerId: order.offers.at(-1).id, offerVersion: order.offers.at(-1).version })
    order = applyCustomerAction(order, "accept-offer", { offerId: order.offers.at(-1).id, offerVersion: order.offers.at(-1).version })
    expect(order.payments).toHaveLength(1)
    expect(order.payments[0].amount).toBe(offer.amount)
    expect(order.payments[0].offerId).toBe(order.offers[0].id)
  })

  it("menolak status acak dan lompatan alur", () => {
    expect(() => applyAdminAction(structuredClone(seedOrders[0]), "update-progress", { status: "status-palsu" })).toThrow("Status pekerjaan tidak valid")
    expect(() => applyAdminAction(structuredClone(seedOrders[0]), "update-progress", { status: "dikerjakan" })).toThrow("tidak diizinkan")
  })

  it("menolak penerimaan hasil sebelum hasil benar-benar dikirim", () => {
    const order = structuredClone(seedOrders[3])
    expect(() => applyCustomerAction(order, "accept-result")).toThrow("Belum ada hasil terkirim")
  })

  it("menjaga draft hasil tetap belum dipublikasikan dan menyelesaikan lifecycle revisi", () => {
    let order = structuredClone(seedOrders[3])
    const activeOffer = order.offers.at(-1)
    order.revisions[0].offerId = activeOffer.id
    order.files[0].offerId = activeOffer.id
    order.files[0].publishedAt = order.files[0].createdAt
    order = applyAdminAction(order, "update-progress", { status: "dikerjakan" })
    expect(order.revisions[0].status).toBe("dikerjakan")
    order.files.push({ id: "file-revision", category: "result", offerId: activeOffer.id, revisionId: order.revisions[0].id, originalName: "hasil-v2.pptx", size: 100, createdAt: new Date().toISOString() })
    order = applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })
    expect(order.files.at(-1).publishedAt).toBeTruthy()
    expect(order.revisions[0].status).toBe("selesai")
    expect(order.revisions[0].completedAt).toBeTruthy()
  })

  it("menghitung batas revisi per versi penawaran", () => {
    const order = structuredClone(seedOrders[3])
    const oldOffer = order.offers[0]
    oldOffer.revisionDeadline = future(7)
    oldOffer.revisionLimit = 1
    order.revisions[0].offerId = "offer-lama"
    order.files[0].offerId = oldOffer.id
    order.files[0].publishedAt = order.files[0].createdAt
    const next = applyCustomerAction({ ...order, status: "hasil-dikirim" }, "request-revision", { notes: "Mohon revisi versi penawaran aktif ini." })
    expect(next.revisions.filter((item) => item.offerId === oldOffer.id)).toHaveLength(1)
  })

  it("mewajibkan dan mencatat refund ketika pesanan berbayar dibatalkan", () => {
    const paid = structuredClone(seedOrders[2])
    expect(() => applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Pekerjaan tidak dapat dilanjutkan." })).toThrow("Referensi pengembalian dana")
    const closed = applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Pekerjaan tidak dapat dilanjutkan.", refundReference: "REFUND-001" }, { email: "admin@example.com" })
    expect(closed.status).toBe("dibatalkan")
    expect(closed.payments[0].status).toBe("dikembalikan")
    expect(closed.payments[0].refundedBy).toBe("admin@example.com")
  })

  it("menyimpan pertanyaan dan jawaban informasi tambahan", () => {
    let order = structuredClone(seedOrders[0])
    order = applyAdminAction(order, "request-information", { question: "Berapa jumlah halaman final?" })
    expect(order.messages.at(-1).actor).toBe("admin")
    order = applyCustomerAction(order, "reply-information", { message: "Jumlah finalnya dua puluh halaman." })
    expect(order.status).toBe("ditinjau")
    expect(order.messages.at(-1).actor).toBe("pelanggan")
  })

  it("mengubah payload null menjadi domain error, bukan TypeError", () => {
    expect(() => applyAdminAction(structuredClone(seedOrders[0]), "request-information", null)).toThrow(DomainRuleError)
    expect(() => applyCustomerAction(structuredClone(seedOrders[3]), "request-revision", null)).toThrow(DomainRuleError)
  })

  it("tidak mengirim ulang hasil lama sebagai hasil revisi baru", () => {
    const order = structuredClone(seedOrders[3])
    order.revisions[0].offerId = order.offers[0].id
    order.files[0].offerId = order.offers[0].id
    order.files[0].publishedAt = order.files[0].createdAt
    expect(() => applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })).toThrow("Unggah file hasil baru")
  })

  it("hanya mempublikasikan file untuk putaran dan penawaran aktif", () => {
    const order = structuredClone(seedOrders[3])
    const offerId = order.offers[0].id
    order.revisions[0].offerId = offerId
    order.files = [
      { id: "old-offer", category: "result", offerId: "offer-lama" },
      { id: "old-round", category: "result", offerId, revisionId: "revision-lama" },
    ]
    expect(() => applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })).toThrow("Unggah file hasil baru")
    order.files.push({ id: "current", category: "result", offerId, revisionId: order.revisions[0].id })
    const next = applyAdminAction(order, "update-progress", { status: "hasil-dikirim" })
    expect(next.files.map((file) => Boolean(file.publishedAt))).toEqual([false, false, true])
  })

  it("pembayaran versi lama tidak mengizinkan pengerjaan versi aktif", () => {
    const order = structuredClone(seedOrders[2])
    order.status = "antrean"
    order.offers.push({ ...order.offers[0], id: "offer-baru", version: 2 })
    expect(() => applyAdminAction(order, "update-progress", { status: "dikerjakan" })).toThrow("Verifikasi pembayaran")
  })

  it("tidak melewati pencatatan refund melalui endpoint progres", () => {
    expect(() => applyAdminAction(structuredClone(seedOrders[2]), "update-progress", { status: "dibatalkan" })).toThrow("aksi khusus")
  })

  it("penawaran baru tidak menghapus kewajiban rekonsiliasi pembayaran lama", () => {
    const paid = applyAdminAction(structuredClone(seedOrders[2]), "revise-offer", offer)
    expect(() => applyCustomerAction(paid, "cancel-order", { reason: "Tidak jadi melanjutkan pesanan." })).toThrow("direkonsiliasi")
    expect(() => applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan pesanan." })).toThrow("Referensi pengembalian dana")
    const closed = applyAdminAction(paid, "close-order", { status: "dibatalkan", reason: "Tidak jadi melanjutkan pesanan.", refundReference: "REFUND-OLD-001" })
    expect(closed.payments[0].status).toBe("dikembalikan")
  })

  it("menunggu verifikasi transaksi sebelum mengganti penawaran", () => {
    const pending = structuredClone(seedOrders[1])
    pending.payments[0].status = "menunggu-verifikasi"
    expect(() => applyAdminAction(pending, "revise-offer", offer)).toThrow("Periksa pembayaran")
    pending.payments[0].status = "belum-dibayar"
    expect(applyAdminAction(pending, "revise-offer", offer).payments[0].status).toBe("dibatalkan")
  })

  it.each(["accept-result", "request-revision"])("%s menolak file draft atau file penawaran lama", (action) => {
    const order = structuredClone(seedOrders[2])
    order.status = "hasil-dikirim"
    order.files = [{ id: "draft", category: "result", offerId: order.offers[0].id }]
    expect(() => applyCustomerAction(order, action, { notes: "Mohon perbaiki hasil ini." })).toThrow("Belum ada hasil terkirim")
    order.files = [{ id: "old", category: "result", offerId: "offer-lama", publishedAt: future(-1) }]
    expect(() => applyCustomerAction(order, action, { notes: "Mohon perbaiki hasil ini." })).toThrow("Belum ada hasil terkirim")
  })
})
