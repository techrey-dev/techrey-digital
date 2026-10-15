import type { PaymentStatus, WorkStatus } from "../data/types"

export const rupiah = (amount?: number) =>
  typeof amount === "number"
    ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)
    : "Belum ditentukan"

export const witaDate = (value?: string | null, detail = true) => {
  if (!value || typeof value !== "string" || Number.isNaN(Date.parse(value))) return "-"
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        day: "2-digit",
        month: "short",
        year: detail ? "numeric" : undefined,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value)).replace(" pukul", " ·") + " WITA"
    )
  } catch {
    return "-"
  }
}

export const fileSize = (bytes: number) => {
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1_000)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

export const workLabels: Record<WorkStatus, string> = {
  diajukan: "Diajukan",
  "perlu-informasi": "Perlu informasi",
  ditinjau: "Ditinjau",
  "menunggu-persetujuan": "Menunggu persetujuan",
  "menunggu-pembayaran": "Menunggu pembayaran",
  antrean: "Antrean",
  dikerjakan: "Dikerjakan",
  revisi: "Revisi",
  "hasil-dikirim": "Hasil dikirim",
  selesai: "Selesai",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
}

export const paymentLabels: Record<PaymentStatus, string> = {
  "belum-ditagih": "Belum ditagih",
  "belum-dibayar": "Belum dibayar",
  "menunggu-verifikasi": "Menunggu verifikasi",
  dibayar: "Dibayar",
  dibatalkan: "Dibatalkan",
  dikembalikan: "Dikembalikan",
}

export const statusTone = (value: WorkStatus | PaymentStatus) => {
  if (value === "dibayar" || value === "selesai") return "positive"
  if (value === "revisi" || value === "menunggu-verifikasi" || value === "perlu-informasi") return "warning"
  if (value === "dikerjakan" || value === "hasil-dikirim" || value === "antrean") return "active"
  return "neutral"
}
