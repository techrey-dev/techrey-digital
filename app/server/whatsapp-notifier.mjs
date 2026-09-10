/**
 * WhatsApp Notifier for Techrey Digital
 * - Builds friendly WhatsApp notification messages for customers on order updates
 * - Sends automated HTTP POST webhook if WHATSAPP_GATEWAY_URL is configured
 * - Provides wa.me 1-click URL fallback for admin
 */

const appBaseUrl = (process.env.BETTER_AUTH_URL || "https://techrey-digital.vercel.app").replace(/\/$/, "")

function formatRupiah(amount) {
  if (typeof amount !== "number" || isNaN(amount)) return "0"
  return new Intl.NumberFormat("id-ID").format(amount)
}

function cleanPhone(raw) {
  if (!raw) return ""
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("0")) digits = "62" + digits.slice(1)
  return digits
}

export function buildWhatsAppNotificationMessage(order, action, payload = {}) {
  const customerName = order.customerName || "Pelanggan"
  const orderUrl = `${appBaseUrl}/akun/pesanan/${encodeURIComponent(order.id)}`
  const latestOffer = order.offers?.at(-1)

  switch (action) {
    case "save-offer":
    case "revise-offer": {
      const amount = payload?.amount ?? latestOffer?.amount ?? 0
      const revisionLimit = payload?.revisionLimit ?? latestOffer?.revisionLimit ?? 1
      return `Halo Kak *${customerName}*! 👋

Admin Techrey Digital telah menerbitkan *Draf Penawaran Resmi* untuk pesanan Anda:

📌 *#${order.id} - ${order.title}*
🛠️ Layanan: *${order.service}*
💰 Biaya: *Rp ${formatRupiah(amount)}*
🔄 Kuota Revisi: *${revisionLimit} putaran*

Silakan buka tautan berikut untuk memeriksa rincian lingkup kerja dan menyetujui penawaran:
👉 ${orderUrl}

Terima kasih,
*Techrey Digital*`
    }

    case "verify-payment": {
      return `Halo Kak *${customerName}*! 🎉

Pembayaran untuk pesanan Anda telah *berhasil diverifikasi*:

📌 *#${order.id} - ${order.title}*
Status: *Dikerjakan oleh Tim Techrey*

Tim kami sedang memproses pesanan Anda sesuai brief dan batas waktu yang disepakati. Anda dapat memantau progresnya di:
👉 ${orderUrl}

Terima kasih!
*Techrey Digital*`
    }

    case "request-information": {
      const question = payload?.question || "Mohon lengkapi informasi pesanan."
      return `Halo Kak *${customerName}*! 💬

Ada informasi tambahan yang dibutuhkan oleh Tim Techrey untuk pesanan Anda:

📌 *#${order.id} - ${order.title}*
Pertanyaan Tim:
_"${question}"_

Mohon tanggapi langsung melalui halaman pesanan Anda berikut:
👉 ${orderUrl}

Terima kasih!
*Techrey Digital*`
    }

    case "update-progress": {
      const status = payload?.status || order.status
      if (status === "hasil-dikirim") {
        return `Halo Kak *${customerName}*! 🚀

Pekerjaan Anda *telah selesai dan hasil sudah dikirimkan*:

📌 *#${order.id} - ${order.title}*
Status: *Hasil Dikirim (Siap Diunduh)*

Silakan periksa dan unduh file hasil akhir pesanan Anda di:
👉 ${orderUrl}

Jika ada bagian yang perlu disesuaikan, Kakak bisa mengajukan revisi langsung di halaman tersebut ya.

Terima kasih!
*Techrey Digital*`
      }

      if (status === "dikerjakan") {
        return `Halo Kak *${customerName}*! ⚡

Pembaruan pesanan Anda di Techrey Digital:

📌 *#${order.id} - {order.title}*
Status: *Sedang Dikerjakan oleh Tim*

Progres pesanan dapat Anda pantau kapan saja di:
👉 ${orderUrl}

*Techrey Digital*`
      }

      return `Halo Kak *${customerName}*! 📌

Ada pembaruan status pada pesanan Anda di Techrey Digital:
*#${order.id} - ${order.title}* (Status: *${status}*)

Lihat detail lengkapnya di:
👉 ${orderUrl}

*Techrey Digital*`
    }

    case "close-order": {
      const status = payload?.status || order.status
      const label = status === "selesai" ? "Selesai" : status === "dibatalkan" ? "Dibatalkan" : "Ditolak"
      const reason = payload?.reason ? `\nCatatan: ${payload.reason}` : ""
      return `Halo Kak *${customerName}*!

Status akhir untuk pesanan *#${order.id} - ${order.title}*:
Status: *${label}*${reason}

Ringkasan pesanan dapat dilihat di:
👉 ${orderUrl}

Terima kasih telah mempercayakan kebutuhan Anda pada *Techrey Digital*.`
    }

    default:
      return `Halo Kak *${customerName}*! Ada pembaruan terkini pada pesanan Anda *#${order.id}* di Techrey Digital.\n\nCek di: ${orderUrl}`
  }
}

/**
 * Trigger WhatsApp notification for customer.
 * - Sends via WHATSAPP_GATEWAY_URL if set
 * - Always returns wa.me href for instant 1-click sending by admin
 */
export async function notifyCustomerOnWhatsApp(order, action, payload = {}) {
  const phone = cleanPhone(order.whatsapp)
  if (!phone || phone.length < 9) {
    return { phone: "", message: "", href: "", sentAutomatically: false }
  }

  const message = buildWhatsAppNotificationMessage(order, action, payload)
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  let sentAutomatically = false
  const gatewayUrl = (process.env.WHATSAPP_GATEWAY_URL || "").trim()

  if (gatewayUrl) {
    try {
      const headers = { "Content-Type": "application/json" }
      if (process.env.WHATSAPP_GATEWAY_KEY) {
        headers["Authorization"] = `Bearer ${process.env.WHATSAPP_GATEWAY_KEY}`
        headers["X-API-Key"] = process.env.WHATSAPP_GATEWAY_KEY
      }

      const res = await fetch(gatewayUrl, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers,
        body: JSON.stringify({
          to: phone,
          phone,
          message,
          orderId: order.id,
          action,
          status: order.status,
        }),
      })

      if (res.ok) {
        sentAutomatically = true
        console.log(`[WhatsApp Notifier] Pesan otomatis berhasil dikirim ke ${phone} untuk order ${order.id}`)
      } else {
        console.warn(`[WhatsApp Notifier] Gateway gagal (${res.status}):`, await res.text().catch(() => ""))
      }
    } catch (err) {
      console.warn(`[WhatsApp Notifier] Gateway error:`, err?.message || err)
    }
  }

  return {
    phone,
    message,
    href,
    sentAutomatically,
  }
}
