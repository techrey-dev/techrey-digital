import type { Order } from "../data/types"
import { rupiah, witaDate } from "./format"

export const ORDER_STEPS = ["Diajukan", "Penawaran", "Bayar", "Dikerjakan", "Hasil", "Selesai"] as const

export type OrderTurn = "kamu" | "kami" | "selesai" | "tutup"

export type OrderGuide = {
  /** Whose move it is right now, shown as "Giliran kamu" / "Giliran kami". */
  turn: OrderTurn
  /** 0-based index into ORDER_STEPS; -1 when the order is closed. */
  step: number
  headline: string
  detail: string
  /** Label for the button that jumps to the part of the order page where the customer acts. */
  action?: string
  /** Element id on the order detail page that holds that action. */
  target?: string
}

// Translates the internal status into one plain sentence the customer can act on at a glance.
export function orderGuide(order: Order): OrderGuide {
  const offer = order.offers.at(-1)
  const payment = offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined

  switch (order.status) {
    case "diajukan":
    case "ditinjau":
      return { turn: "kami", step: 0, headline: "Brief kamu sedang kami periksa", detail: "Penawaran harga akan muncul di sini. Belum perlu bayar apa pun." }
    case "perlu-informasi":
      return { turn: "kamu", step: 0, headline: "Kami butuh sedikit info tambahan", detail: "Baca pertanyaan admin lalu kirim jawabanmu supaya penawaran bisa dibuat.", action: "Jawab pertanyaan", target: "langkah-info" }
    case "menunggu-persetujuan":
      return { turn: "kamu", step: 1, headline: "Penawaran sudah masuk", detail: `Cek harga${offer ? ` ${rupiah(offer.amount)}` : ""} dan isi pekerjaannya, lalu setujui kalau sudah cocok.`, action: "Lihat penawaran", target: "langkah-penawaran" }
    case "menunggu-pembayaran":
      if (payment?.status === "menunggu-verifikasi") {
        return { turn: "kami", step: 2, headline: "Pembayaranmu sedang dicek", detail: "Admin sedang mencocokkan transaksi. Pengerjaan dimulai setelah terverifikasi." }
      }
      return { turn: "kamu", step: 2, headline: `Bayar ${rupiah(payment?.amount ?? offer?.amount)} lewat QRIS`, detail: "Scan QRIS, lalu tekan \"Saya sudah membayar\" supaya admin bisa mengecek.", action: "Bayar sekarang", target: "langkah-bayar" }
    case "antrean":
      return { turn: "kami", step: 3, headline: "Pembayaran diterima, masuk antrean", detail: offer ? `Target selesai ${witaDate(offer.dueAt)}.` : "Pengerjaan segera dimulai." }
    case "dikerjakan":
      return { turn: "kami", step: 3, headline: "Pesananmu sedang dikerjakan", detail: offer ? `Target selesai ${witaDate(offer.dueAt)}. Kamu akan dikabari saat hasil siap.` : "Kamu akan dikabari saat hasil siap." }
    case "revisi":
      return { turn: "kami", step: 3, headline: "Revisi sedang dikerjakan", detail: "Catatan revisimu sudah kami terima. Hasil baru akan muncul di halaman ini." }
    case "hasil-dikirim":
      return { turn: "kamu", step: 4, headline: "Hasil sudah siap", detail: "Unduh dan cek hasilnya. Terima kalau sudah sesuai, atau minta revisi.", action: "Lihat hasil", target: "langkah-hasil" }
    case "selesai":
      return { turn: "selesai", step: 5, headline: "Pesanan selesai", detail: "Terima kasih! File hasil tetap bisa diunduh dari halaman ini." }
    case "ditolak":
      return { turn: "tutup", step: -1, headline: "Pesanan tidak bisa kami kerjakan", detail: order.closedReason || "Hubungi admin lewat WhatsApp kalau ada pertanyaan." }
    case "dibatalkan":
      return { turn: "tutup", step: -1, headline: "Pesanan dibatalkan", detail: order.closedReason || "Pesanan ini sudah tidak aktif." }
  }
}

export const turnLabels: Record<OrderTurn, string> = {
  kamu: "Giliran kamu",
  kami: "Giliran kami",
  selesai: "Selesai",
  tutup: "Ditutup",
}
