import { describe, expect, it } from "vitest"
import { orderDeadline, toWitaInput } from "./datetime"
import { safeNextPath } from "./navigation"
import { buildWhatsAppLink } from "./whatsapp"

describe("tanggal WITA", () => {
  it("mempertahankan waktu saat penawaran UTC dibuka dan disimpan lagi", () => {
    const original = "2026-10-01T10:30:00.000Z"
    const input = toWitaInput(original)
    expect(input).toBe("2026-10-01T18:30")
    expect(new Date(`${input}:00+08:00`).toISOString()).toBe(original)
    expect(toWitaInput("2026-10-01T18:30:00+08:00")).toBe(input)
  })

  it("menggunakan hari WITA saat tanggal UTC masih hari sebelumnya", () => {
    const now = Date.parse("2026-09-10T17:00:00Z")
    expect(orderDeadline("1-2-days", "", now)).toBe("2026-09-13T18:00:00+08:00")
    expect(orderDeadline("3-5-days", "", now)).toBe("2026-09-15T18:00:00+08:00")
    expect(orderDeadline("custom", "2026-10-01T12:00", now)).toBe("2026-10-01T12:00:00+08:00")
  })
})

describe("tautan", () => {
  it("mengubah nomor lokal menjadi format internasional untuk wa.me", () => {
    expect(buildWhatsAppLink("Halo & terima kasih", "0812 3456-7890")).toBe("https://wa.me/6281234567890?text=Halo%20%26%20terima%20kasih")
    expect(buildWhatsAppLink("Halo", "+62 81234567890")).toContain("wa.me/6281234567890?")
  })

  it("mempertahankan tujuan internal dan menolak pengalihan lintas origin", () => {
    expect(safeNextPath("/pesan?layanan=PPT", "/akun/pesanan")).toBe("/pesan?layanan=PPT")
    for (const path of ["//example.com", "/\\example.com", "https://example.com", "/\n/example.com", null]) {
      expect(safeNextPath(path, "/akun/pesanan")).toBe("/akun/pesanan")
    }
  })
})
