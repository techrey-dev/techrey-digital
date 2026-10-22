import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, LogIn, LogOut, Menu, MessageCircle, X } from "lucide-react"
import { useOrderData } from "../data/OrderContext"
import type { PaymentStatus, WorkStatus } from "../data/types"
import { paymentLabels, statusTone, workLabels } from "../lib/format"
import { authClient } from "../lib/authClient"
import { usePublicConfig } from "../lib/publicConfig"
import techreyLogo from "../assets/techrey-logo.webp"
import techreyLogoWhite from "../assets/techrey-logo-white.webp"

export function Brand({ compact = false, variant = "default" }: { compact?: boolean; variant?: "default" | "light" }) {
  return (
    <Link className={`brand${compact ? " brand-compact" : ""}${variant === "light" ? " brand-light" : ""}`} to="/" aria-label="Techrey Digital, beranda">
      <img src={variant === "light" ? techreyLogoWhite : techreyLogo} alt="" aria-hidden="true" />
    </Link>
  )
}

const NAV_LINKS = [
  { id: "layanan", label: "Layanan" },
  { id: "hasil", label: "Hasil kerja" },
  { id: "alur", label: "Alur" },
  { id: "faq", label: "FAQ" },
]

const SECTION_IDS = NAV_LINKS.map((link) => link.id)

// Tracks which homepage section is in the middle of the viewport, so the nav blob can rest on it.
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: "-45% 0px -50% 0px" })
    for (const id of SECTION_IDS) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    const clearAtTop = () => { if (window.scrollY < 300) setActive(null) }
    window.addEventListener("scroll", clearAtTop, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", clearAtTop)
    }
  }, [enabled])

  return enabled ? active : null
}

// Liquid pill that slides between nav links with a jelly spring and keeps wobbling while it rests.
function NavBlob() {
  return <motion.span layoutId="nav-blob" className="nav-blob" transition={{ type: "spring", stiffness: 420, damping: 15, mass: 0.7 }} />
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const session = authClient.useSession()
  const publicConfig = usePublicConfig()
  const { orders } = useOrderData()
  const activeSection = useActiveSection(pathname === "/")

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  const user = session.data?.user
  const initial = (user?.name || user?.email || "U")[0].toUpperCase()
  const attentionOrders = orders.filter((o) =>
    ["menunggu-persetujuan", "hasil-dikirim", "menunggu-pembayaran", "perlu-informasi"].includes(o.status)
  )
  const notificationCount = user ? attentionOrders.length : 0
  const blobTarget = hovered ?? (pathname.startsWith("/akun/pesanan") ? "pesanan" : activeSection)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    // Close the mobile menu when the viewport grows past the mobile breakpoint.
    const media = window.matchMedia("(min-width: 961px)")
    const closeOnDesktop = () => { if (media.matches) setOpen(false) }
    window.addEventListener("keydown", closeOnEscape)
    media.addEventListener("change", closeOnDesktop)
    return () => {
      window.removeEventListener("keydown", closeOnEscape)
      media.removeEventListener("change", closeOnDesktop)
    }
  }, [open])

  const navLinkProps = (id: string) => ({
    className: blobTarget === id ? "is-lit" : undefined,
    onMouseEnter: () => setHovered(id),
    onFocus: () => setHovered(id),
    onBlur: () => setHovered(null),
  })

  return (
    <div className="public-shell">
      <motion.div
        className={`site-nav-wrap${scrolled || open ? " is-scrolled" : ""}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <header className="site-nav">
          <Brand compact />

          <nav className="site-nav-links" aria-label="Navigasi utama" onMouseLeave={() => setHovered(null)}>
            {NAV_LINKS.map((link) => (
              <Link key={link.id} to={`/#${link.id}`} aria-current={activeSection === link.id ? "location" : undefined} {...navLinkProps(link.id)}>
                {blobTarget === link.id && <NavBlob />}
                <span className="nav-label">{link.label}</span>
              </Link>
            ))}
            <Link to="/akun/pesanan" {...navLinkProps("pesanan")}>
              {blobTarget === "pesanan" && <NavBlob />}
              <span className="nav-label">Pesanan saya</span>
              {notificationCount > 0 && <span className="nav-badge" title={`${notificationCount} pesanan ada pembaruan`}>{notificationCount}</span>}
            </Link>
          </nav>

          <div className="site-nav-actions">
            {user ? (
              <>
                <Link to="/akun/pesanan" className="site-nav-user" title={`Akun: ${user.name || user.email}`}>
                  <span className="avatar-initial">{initial}</span>
                  <span className="site-nav-user-name">{user.name || user.email}</span>
                  {notificationCount > 0 && <span className="nav-badge" title={`${notificationCount} pesanan ada pembaruan`}>{notificationCount}</span>}
                </Link>
                <button type="button" className="site-nav-icon" title="Keluar dari akun" aria-label="Keluar dari akun" onClick={() => void handleSignOut()}>
                  <LogOut />
                </button>
              </>
            ) : (
              <Link className="site-nav-login" to="/masuk" aria-label="Masuk ke akun"><LogIn /> <span>Masuk</span></Link>
            )}
            <Link className="btn-wave site-nav-cta" to="/pesan">
              <span className="btn-wave-water" aria-hidden="true" />
              <span className="btn-wave-label">Ajukan kebutuhan <ArrowUpRight /></span>
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="site-nav-burger"
              aria-expanded={open}
              aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
              onClick={() => setOpen((value) => !value)}
            >
              <span /><span />
            </button>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                className="site-nav-sheet"
                initial={{ clipPath: "circle(0% at calc(100% - 34px) -30px)" }}
                animate={{ clipPath: "circle(150% at calc(100% - 34px) -30px)" }}
                exit={{ clipPath: "circle(0% at calc(100% - 34px) -30px)" }}
                transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
                onClick={() => setOpen(false)}
              >
                <nav aria-label="Navigasi mobile">
                  {[...NAV_LINKS.map((link) => ({ to: `/#${link.id}`, label: link.label })), { to: "/akun/pesanan", label: "Pesanan saya" }].map((link, index) => (
                    <motion.div key={link.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + 0.05 * index, type: "spring", stiffness: 300, damping: 20 }}>
                      <Link to={link.to} className="site-nav-sheet-link">
                        <span><small>0{index + 1}</small>{link.label}</span>
                        {link.to === "/akun/pesanan" && notificationCount > 0 ? <span className="nav-badge">{notificationCount}</span> : <ArrowUpRight />}
                      </Link>
                    </motion.div>
                  ))}
                </nav>
                <div className="site-nav-sheet-foot">
                  {user ? (
                    <>
                      <div className="site-nav-sheet-user">
                        <span className="avatar-initial">{initial}</span>
                        <div><strong>{user.name || "Pelanggan"}</strong><small>{user.email}</small></div>
                      </div>
                      <Link to="/pesan" className="btn-brand">Ajukan kebutuhan <ArrowUpRight /></Link>
                      <button type="button" className="btn-outline-dark" onClick={() => void handleSignOut()}>Keluar <LogOut /></button>
                    </>
                  ) : (
                    <>
                      <Link to="/pesan" className="btn-brand">Ajukan kebutuhan <ArrowUpRight /></Link>
                      <Link to="/masuk" className="btn-outline-dark"><LogIn /> Masuk ke akun</Link>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      </motion.div>
      {children}
      <footer className="site-foot">
        <div className="shell-width">
          <div className="site-foot-top">
            <div className="site-foot-brand">
              <Brand compact variant="light" />
              <p>Bantu rapikan dokumen, presentasi, coding, dan website usaha. Harga dan tenggat jelas sejak awal.</p>
            </div>
            <div className="site-foot-col">
              <span>Jelajahi</span>
              <ul>
                {NAV_LINKS.map((link) => <li key={link.id}><Link to={`/#${link.id}`}>{link.label}</Link></li>)}
              </ul>
            </div>
            <div className="site-foot-col">
              <span>Akun</span>
              <ul>
                <li><Link to="/pesan">Ajukan kebutuhan</Link></li>
                <li><Link to="/masuk">Masuk</Link></li>
                <li><Link to="/akun/pesanan">Pesanan saya</Link></li>
              </ul>
            </div>
            <div className="site-foot-col">
              <span>Konsultasi</span>
              <p>Ragu mulai dari mana? Tanya dulu, gratis.</p>
              {publicConfig.whatsapp.configured && publicConfig.whatsapp.href ? (
                <a className="button button-small button-whatsapp" href={publicConfig.whatsapp.href} target="_blank" rel="noreferrer" aria-label="Chat Techrey melalui WhatsApp">
                  <MessageCircle /> Chat WhatsApp
                </a>
              ) : null}
            </div>
          </div>
          <div className="site-foot-bottom">
            <span>© {new Date().getFullYear()} Techrey Digital</span>
            <span>Kendari</span>
          </div>
        </div>
        <div className="site-foot-word" aria-hidden="true">techrey</div>
      </footer>
    </div>
  )
}

export function StatusPill({ status, payment }: { status?: WorkStatus; payment?: PaymentStatus }) {
  const value = status ?? payment
  if (!value) return null
  const label = status ? workLabels[status] : paymentLabels[payment!]
  return <span className={`status-pill status-${statusTone(value)}`}>{label}</span>
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement
      dialog.showModal()
      requestAnimationFrame(() => dialog.querySelector<HTMLElement>("button, input, select, textarea, a")?.focus())
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const close = () => {
    onClose()
    requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === dialogRef.current) close() }}>
      <div className="dialog-panel">
        <div className="dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="Tutup dialog" onClick={close}><X /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function ToastRegion() {
  const { lastMessage } = useOrderData()
  const [externalError, setExternalError] = useState<{ id: number; tone: "error"; text: string } | null>(null)
  const [dismissedMessageId, setDismissedMessageId] = useState<number>()

  useEffect(() => {
    const handler = (event: Event) => {
      if (lastMessage) setDismissedMessageId(lastMessage.id)
      setExternalError({ id: Date.now(), tone: "error", text: (event as CustomEvent<string>).detail })
    }
    window.addEventListener("techrey-error", handler)
    return () => window.removeEventListener("techrey-error", handler)
  }, [lastMessage])

  const message = externalError ?? (lastMessage?.id === dismissedMessageId ? null : lastMessage)
  const dismiss = () => {
    if (!message) return
    if (externalError?.id === message.id) setExternalError(null)
    else setDismissedMessageId(message.id)
  }

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => {
      if (externalError?.id === message.id) setExternalError(null)
      else setDismissedMessageId(message.id)
    }, 4200)
    return () => window.clearTimeout(timer)
  }, [message, externalError])

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {message && (
          <motion.div key={message.id} className={`toast toast-${message.tone}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <span>{message.text}</span>
            <button type="button" aria-label="Tutup notifikasi" onClick={dismiss}><X /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AdminNav() {
  const [open, setOpen] = useState(false)
  const session = authClient.useSession()
  const user = session.data?.user

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  return (
    <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
      <div className="admin-brand-row"><Brand variant="light" /><button className="menu-button admin-menu" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Buka menu admin"><Menu /></button></div>
      <span className="admin-kicker">WORKSPACE ADMIN</span>
      <nav aria-label="Menu admin">
        <NavLink to="/admin" end>Ringkasan</NavLink>
        <NavLink to="/admin/pesanan">Pesanan</NavLink>
        <NavLink to="/admin/pembayaran">Pembayaran</NavLink>
      </nav>
      <div className="admin-sidebar-bottom">
        {user && (
          <div className="admin-user-card">
            <span className="admin-user-avatar">{(user.name || user.email || "A")[0].toUpperCase()}</span>
            <div className="admin-user-details">
              <strong>{user.name || "Admin"}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
            <button
              type="button"
              className="admin-logout-btn"
              title="Keluar dari akun admin"
              onClick={() => void handleSignOut()}
            >
              <LogOut />
            </button>
          </div>
        )}
        <div className="sandbox-note"><strong>Data operasional</strong><p>Setiap perubahan status tersimpan di server dan tercatat pada riwayat pesanan.</p></div>
        <Link to="/">Lihat website <ArrowUpRight /></Link>
      </div>
    </aside>
  )
}
