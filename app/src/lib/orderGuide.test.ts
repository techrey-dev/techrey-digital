import { describe, expect, it } from "vitest"
import type { Order } from "../data/types"
import { orderGuide } from "./orderGuide"

const offer = { id: "of1", version: 1, amount: 150000, scope: "", deliverables: [], revisionLimit: 2, revisionDeadline: "2026-11-01T00:00:00Z", dueAt: "2026-10-30T00:00:00Z", createdAt: "2026-10-20T00:00:00Z" }

const order = (patch: Partial<Order>): Order => ({
  id: "TD-1", customerName: "Rina", whatsapp: "62812", service: "PPT & Presentasi", purpose: "Kuliah", title: "Slide",
  brief: "", deadline: "2026-10-30T00:00:00Z", timezone: "Asia/Makassar", status: "diajukan", createdAt: "2026-10-20T00:00:00Z",
  files: [], offers: [], payments: [], revisions: [], messages: [], events: [], ...patch,
})

describe("panduan langkah pesanan", () => {
  it("menandai giliran pelanggan untuk membayar dan mengarah ke bagian QRIS", () => {
    const guide = orderGuide(order({ status: "menunggu-pembayaran", offers: [offer], payments: [{ id: "p1", offerId: "of1", amount: 150000, status: "belum-dibayar" }] }))
    expect(guide).toMatchObject({ turn: "kamu", step: 2, target: "langkah-bayar" })
    expect(guide.headline).toContain("150.000")
  })

  it("mengembalikan giliran ke admin setelah pelanggan menandai sudah bayar", () => {
    const guide = orderGuide(order({ status: "menunggu-pembayaran", offers: [offer], payments: [{ id: "p1", offerId: "of1", amount: 150000, status: "menunggu-verifikasi" }] }))
    expect(guide).toMatchObject({ turn: "kami", step: 2 })
    expect(guide.action).toBeUndefined()
  })

  it("menampilkan alasan saat pesanan ditutup", () => {
    expect(orderGuide(order({ status: "ditolak", closedReason: "Di luar layanan" }))).toMatchObject({ turn: "tutup", step: -1, detail: "Di luar layanan" })
  })

  it("mengarahkan pelanggan ke file hasil saat hasil dikirim", () => {
    expect(orderGuide(order({ status: "hasil-dikirim", offers: [offer] }))).toMatchObject({ turn: "kamu", step: 4, target: "langkah-hasil" })
  })
})
