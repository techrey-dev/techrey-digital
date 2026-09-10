import { useState } from "react"
import { useLocation } from "react-router"
import { MessageCircle, X } from "lucide-react"
import { usePublicConfig } from "../lib/publicConfig"

export function FloatingWhatsApp() {
  const { pathname } = useLocation()
  const publicConfig = usePublicConfig()
  const [closedBadge, setClosedBadge] = useState(false)

  // Halaman admin tidak membutuhkan CTA publik; halaman pemesanan sudah memiliki CTA WhatsApp sendiri.
  if (pathname.startsWith("/admin") || pathname === "/pesan") return null

  const whatsappNumber = publicConfig.whatsapp.number || "6285198262541"
  const defaultHref =
    publicConfig.whatsapp.href ||
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo Techrey Digital, saya ingin bertanya dan konsultasi mengenai kebutuhan digital.")}`

  return (
    <div className="floating-wa-container" aria-label="Kontak WhatsApp Techrey Digital">
      {!closedBadge && (
        <div className="floating-wa-badge">
          <span>Butuh respon cepat atau konsultasi?</span>
          <strong>Chat WhatsApp Kami</strong>
          <button
            type="button"
            className="floating-wa-badge-close"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setClosedBadge(true)
            }}
            aria-label="Tutup pesan bantuan"
          >
            <X />
          </button>
        </div>
      )}
      <a
        href={defaultHref}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-wa-button"
        title="Hubungi Techrey Digital di WhatsApp"
        aria-label="Buka WhatsApp Techrey Digital"
      >
        <span className="floating-wa-pulse" />
        <MessageCircle className="floating-wa-icon" />
        <span className="floating-wa-label">WhatsApp</span>
      </a>
    </div>
  )
}
