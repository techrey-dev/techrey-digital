import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Link, NavLink } from "react-router"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, LogIn, LogOut, Menu, MessageCircle, ShieldCheck, X } from "lucide-react"
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

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const session = authClient.useSession()
  const publicConfig = usePublicConfig()
  const { orders } = useOrderData()

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  const user = session.data?.user
  const attentionOrders = orders.filter((o) =>
    ["menunggu-persetujuan", "hasil-dikirim", "menunggu-pembayaran", "perlu-informasi"].includes(o.status)
  )
  const notificationCount = user ? attentionOrders.length : 0

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <div className="public-shell">
      <header className="site-header shell-width">
        <Brand />
        <nav className={open ? "nav-open" : ""} aria-label="Navigasi utama" onClick={() => setOpen(false)}>
          <Link to="/#layanan">Layanan</Link>
          <Link to="/#karya">Contoh karya</Link>
          <Link to="/#faq">FAQ</Link>
          <Link to="/akun/pesanan" className="nav-link-with-badge">
            Pesanan Saya
            {notificationCount > 0 && (
              <span className="nav-notification-badge" title={`${notificationCount} pesanan ada pembaruan`}>
                {notificationCount}
              </span>
            )}
          </Link>
          {user && (
            <div className="nav-mobile-user">
              <span className="nav-mobile-user-name">Masuk sebagai: <strong>{user.name || user.email}</strong></span>
              <button type="button" className="button button-small button-ghost nav-mobile-logout" onClick={() => void handleSignOut()}>
                Keluar <LogOut />
              </button>
            </div>
          )}
        </nav>
        {!user && <Link className="mobile-login" to="/masuk" aria-label="Masuk ke akun"><LogIn /><span>Masuk</span></Link>}
        {user && (
          <Link className="mobile-login mobile-account-link" to="/akun/pesanan" aria-label="Buka Pesanan Saya">
            <span className="user-avatar-initial">{(user.name || user.email || "U")[0].toUpperCase()}</span>
            {notificationCount > 0 && <span className="mobile-badge-indicator">{notificationCount}</span>}
          </Link>
        )}
        <div className="header-actions">
          {user ? (
            <div className="header-user-menu">
              <Link to="/akun/pesanan" className="header-user-badge" title={`Akun: ${user.name || user.email}`}>
                <span className="user-avatar-initial">{(user.name || user.email || "U")[0].toUpperCase()}</span>
                <span className="user-display-name">{user.name || user.email}</span>
                {notificationCount > 0 && (
                  <span className="header-user-badge-dot" title={`${notificationCount} pesanan ada pembaruan`} />
                )}
              </Link>
              <Link className="button button-small header-cta" to="/pesan">
                Ajukan kebutuhan <ArrowUpRight />
              </Link>
              <button
                type="button"
                className="button button-small button-ghost header-logout"
                title="Keluar dari akun"
                onClick={() => void handleSignOut()}
              >
                Keluar <LogOut />
              </button>
            </div>
          ) : (
            <Link className="button button-small header-cta" to="/masuk">
              Masuk <LogIn />
            </Link>
          )}
        </div>
        <button ref={menuButtonRef} className="menu-button" aria-expanded={open} aria-label={open ? "Tutup menu" : "Buka menu"} onClick={() => setOpen((value) => !value)}>
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {children}
      <footer className="site-footer shell-width">
        <Brand compact />
        <p>Dokumen, presentasi, coding, website, dan review tugas.</p>
        <span>© 2026 Techrey Digital · WITA</span>
        <Link className="admin-entry" to="/admin/masuk"><ShieldCheck /> Akses admin</Link>
        {publicConfig.whatsapp.configured && publicConfig.whatsapp.href ? (
          <a className="whatsapp-footer-link" href={publicConfig.whatsapp.href} target="_blank" rel="noreferrer" aria-label="Chat Techrey melalui WhatsApp">
            <MessageCircle /> Chat WhatsApp
          </a>
        ) : null}
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
