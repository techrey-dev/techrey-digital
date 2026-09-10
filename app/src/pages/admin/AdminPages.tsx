import { useMemo, useState, type FormEvent } from "react"
import { Link, Outlet, useParams } from "react-router"
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock3, ExternalLink, Eye, FileText, LogOut, MessageCircle, RefreshCcw, Search, WalletCards } from "lucide-react"
import { AdminNav, StatusPill } from "../../components/ui"
import { AdminAssistantPanel } from "../../components/AdminAssistantPanel"
import { useOrderData } from "../../data/OrderContext"
import type { OfferDraft, Order, WorkStatus } from "../../data/types"
import { fileSize, paymentLabels, rupiah, witaDate, workLabels } from "../../lib/format"
import { authClient } from "../../lib/authClient"
import { usePublicConfig } from "../../lib/publicConfig"
import { buildWhatsAppLink } from "../../lib/whatsapp"
import { toWitaInput } from "../../lib/datetime"
import techreyIcon from "../../assets/techrey-icon.webp"

const currentPayment = (order: Order) => {
  const offer = order.offers.at(-1)
  return offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined
}
const actionable = (order: Order) => order.status === "diajukan" || order.status === "perlu-informasi" || currentPayment(order)?.status === "menunggu-verifikasi" || order.status === "revisi"
const progressTransitions: Record<WorkStatus, WorkStatus[]> = {
  diajukan: ["diajukan"],
  "perlu-informasi": ["perlu-informasi"],
  ditinjau: ["ditinjau"],
  "menunggu-persetujuan": ["menunggu-persetujuan"],
  "menunggu-pembayaran": ["menunggu-pembayaran"],
  antrean: ["antrean", "dikerjakan"],
  dikerjakan: ["dikerjakan", "hasil-dikirim"],
  revisi: ["revisi", "dikerjakan", "hasil-dikirim"],
  "hasil-dikirim": ["hasil-dikirim"],
  selesai: ["selesai"],
  ditolak: ["ditolak"],
  dibatalkan: ["dibatalkan"],
}

export function AdminLayout() {
  const session = authClient.useSession()

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  if (session.isPending) return <main className="app-state" aria-busy="true"><span className="state-spinner" /><p>Memeriksa akses admin…</p></main>
  if (!session.data?.user) return <main className="app-state"><span className="state-symbol">!</span><h1>Login admin diperlukan.</h1><p>Masuk menggunakan akun Google atau GitHub yang tercantum pada ADMIN_EMAILS.</p><Link className="button" to="/admin/masuk">Masuk ke workspace</Link></main>
  return (
    <div className="admin-shell">
      <div className="admin-frame">
        <AdminNav />
        <main className="admin-content">
          <div className="admin-topline">
            <div className="admin-topline-left">
              <img src={techreyIcon} alt="" className="admin-topline-icon" />
              <span>TECHREY DIGITAL / CONTROL ROOM</span>
            </div>
            <div className="admin-topline-right">
              <span className="admin-email-tag">{session.data.user.email}</span>
              <strong>● TERHUBUNG</strong>
              <button
                type="button"
                className="admin-topline-logout"
                title="Keluar dari akun admin"
                onClick={() => void handleSignOut()}
              >
                <LogOut /> Keluar
              </button>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { orders } = useOrderData()
  const verified = orders.flatMap((order) => order.payments).filter((payment) => payment.status === "dibayar").reduce((sum, payment) => sum + payment.amount, 0)
  const active = orders.filter((order) => !["selesai", "dibatalkan", "ditolak"].includes(order.status)).length
  const pendingPayments = orders.filter((order) => currentPayment(order)?.status === "menunggu-verifikasi").length
  const revisions = orders.filter((order) => order.status === "revisi").length
  const priorities = orders.filter(actionable).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 5)

  return (
    <div className="admin-page">
      <header className="admin-page-heading"><div><span className="eyebrow">RINGKASAN HARI INI</span><h1>Yang perlu ditangani.</h1><p>Urutkan perhatian dari tenggat dan status yang menunggu tindakan.</p></div><Link className="button button-small" to="/">Lihat website <ArrowRight /></Link></header>
      <section className="admin-stats">
        <article className="stat-primary"><span>Pembayaran terverifikasi</span><strong>{rupiah(verified)}</strong><small>Akumulasi total</small><WalletCards /></article>
        <article><span>Pesanan aktif</span><strong>{String(active).padStart(2, "0")}</strong><small>Termasuk antrean dan revisi</small></article>
        <article><span>Perlu verifikasi</span><strong>{String(pendingPayments).padStart(2, "0")}</strong><small>Pembayaran QRIS</small></article>
        <article><span>Revisi masuk</span><strong>{String(revisions).padStart(2, "0")}</strong><small>Perlu ditindaklanjuti</small></article>
      </section>
      <section className="attention-banner"><span><ArrowRight /></span><div><strong>Mulai dari yang menunggu keputusan.</strong><p>Tinjau brief, cek pembayaran, lalu tangani revisi sesuai tenggat.</p></div></section>
      <section className="admin-card"><div className="admin-card-heading"><div><span>PRIORITAS</span><h2>Perlu perhatian</h2></div><Link to="/admin/pesanan">Lihat semua <ArrowRight /></Link></div>{priorities.length ? <OrderTable orders={priorities} /> : <AdminEmpty text="Tidak ada pesanan yang menunggu tindakan." />}</section>
      <p className="admin-disclaimer">Data operasional tersimpan di server lokal. Lampiran dan hasil bersifat privat; transaksi QRIS tetap dicocokkan manual melalui akun merchant.</p>
    </div>
  )
}

export function AdminOrdersPage({ paymentsOnly = false }: { paymentsOnly?: boolean }) {
  const { orders } = useOrderData()
  const config = usePublicConfig()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState(paymentsOnly ? "menunggu-verifikasi" : "semua")
  const source = paymentsOnly ? orders.filter((order) => currentPayment(order)) : orders
  const paymentCounts = paymentsOnly ? {
    review: source.filter((order) => currentPayment(order)?.status === "menunggu-verifikasi").length,
    waiting: source.filter((order) => currentPayment(order)?.status === "belum-dibayar").length,
    paid: source.filter((order) => currentPayment(order)?.status === "dibayar").length,
  } : undefined
  const filtered = useMemo(() => source.filter((order) => {
    const payment = currentPayment(order)?.status ?? "belum-ditagih"
    const matchesSearch = `${order.id} ${order.customerName} ${order.title} ${order.service}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = status === "semua" || (paymentsOnly ? payment : order.status) === status
    return matchesSearch && matchesStatus
  }), [paymentsOnly, query, source, status])

  return (
    <div className="admin-page">
      <header className="admin-page-heading"><div><span className="eyebrow">{paymentsOnly ? "REKONSILIASI MANUAL" : "SEMUA PESANAN"}</span><h1>{paymentsOnly ? "Pembayaran QRIS." : "Pesanan dan brief."}</h1><p>{paymentsOnly ? "Cocokkan nominal, status berhasil, dan referensi transaksi di Riwayat DANA Bisnis sebelum memverifikasi." : "Cari proyek, tinjau detail, buat penawaran, dan perbarui hasil."}</p></div></header>
      {paymentsOnly && (
        <section className={`admin-qris-banner${config.qris.configured ? "" : " is-warning"}`}>
          <div className="admin-qris-info">
            <span className="badge-qris-active">{config.qris.configured ? "QRIS STATIS AKTIF" : "QRIS BELUM AKTIF"}</span>
            <strong>{config.qris.configured ? "Nominal masih diperiksa manual" : "Pembayaran belum dapat digunakan"}</strong>
            <p>{config.qris.configured ? "Tagihan mengikuti harga yang disetujui, tetapi QR statis belum mengunci nominal di aplikasi pembayar." : "Atur nama merchant dan gambar QRIS resmi di server sebelum menerima pembayaran."}</p>
          </div>
          {config.qris.configured && <a className="button button-small button-ghost" href="/api/admin/qris" target="_blank" rel="noreferrer">
            Lihat Stiker QRIS <ArrowRight />
          </a>}
        </section>
      )}
      {paymentsOnly && paymentCounts && (
        <section className="payment-queue-summary" aria-label="Ringkasan antrean pembayaran">
          <button type="button" className={status === "menunggu-verifikasi" ? "is-active" : ""} onClick={() => setStatus("menunggu-verifikasi")}><span>Perlu dicek</span><strong>{paymentCounts.review}</strong><small>Buka dan cocokkan transaksi</small></button>
          <button type="button" className={status === "belum-dibayar" ? "is-active" : ""} onClick={() => setStatus("belum-dibayar")}><span>Menunggu pelanggan</span><strong>{paymentCounts.waiting}</strong><small>Belum perlu tindakan admin</small></button>
          <button type="button" className={status === "dibayar" ? "is-active" : ""} onClick={() => setStatus("dibayar")}><span>Sudah diverifikasi</span><strong>{paymentCounts.paid}</strong><small>Otomatis masuk antrean kerja</small></button>
        </section>
      )}
      <section className="admin-card">
        <div className="table-toolbar"><label><Search /><span className="sr-only">Cari pesanan</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, proyek, atau nomor…" /></label><select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}>{paymentsOnly ? ["semua", "belum-dibayar", "menunggu-verifikasi", "dibayar", "dibatalkan", "dikembalikan"].map((value) => <option key={value} value={value}>{value === "semua" ? "Semua pembayaran" : paymentLabels[value as keyof typeof paymentLabels]}</option>) : ["semua", "diajukan", "perlu-informasi", "menunggu-persetujuan", "menunggu-pembayaran", "antrean", "dikerjakan", "revisi", "hasil-dikirim", "selesai", "ditolak", "dibatalkan"].map((value) => <option key={value} value={value}>{value === "semua" ? "Semua status" : workLabels[value as WorkStatus]}</option>)}</select></div>
        {filtered.length ? <OrderTable orders={filtered} paymentColumn={paymentsOnly} /> : <AdminEmpty text={paymentsOnly && status === "menunggu-verifikasi" && !query ? "Tidak ada pembayaran yang perlu diperiksa. Pilih Menunggu pelanggan atau Sudah diverifikasi untuk melihat riwayat lain." : "Tidak ada pesanan yang cocok. Ubah kata kunci atau filternya."} action={() => { setQuery(""); setStatus("semua") }} />}
      </section>
      <p className="admin-disclaimer">Nama, harga, dan status pada halaman ini adalah data operasional.</p>
    </div>
  )
}

function OrderTable({ orders, paymentColumn = false }: { orders: Order[]; paymentColumn?: boolean }) {
  return <div className="table-scroll"><table className="orders-table"><thead><tr><th>Proyek</th><th>Pelanggan</th><th>Tenggat</th><th>{paymentColumn ? "Pembayaran" : "Pekerjaan"}</th><th>Nilai</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{orders.map((order) => { const offer = order.offers.at(-1); const payment = offer ? order.payments.findLast((item) => item.offerId === offer.id) : undefined; return <tr key={order.id}><td data-label="Proyek"><small>{order.id} · {order.service}</small><strong>{order.title}</strong></td><td data-label="Pelanggan">{order.customerName}</td><td data-label="Tenggat">{witaDate(order.deadline, false)}</td><td data-label={paymentColumn ? "Pembayaran" : "Pekerjaan"}>{paymentColumn ? <StatusPill payment={payment?.status ?? "belum-ditagih"} /> : <StatusPill status={order.status} />}</td><td data-label="Nilai">{rupiah(offer?.amount)}</td><td>{paymentColumn ? <Link className={`payment-row-action${payment?.status === "menunggu-verifikasi" ? " is-urgent" : ""}`} aria-label={`Periksa pembayaran ${order.id}`} to={`/admin/pesanan/${order.id}`}>{payment?.status === "menunggu-verifikasi" ? "Periksa" : "Buka"} <ArrowRight /></Link> : <Link className="row-action" aria-label={`Buka detail ${order.id}`} to={`/admin/pesanan/${order.id}`}><Eye /></Link>}</td></tr> })}</tbody></table></div>
}

function AdminEmpty({ text, action }: { text: string; action?: () => void }) {
  return <div className="admin-empty"><Search /><h3>Belum ada yang ditampilkan.</h3><p>{text}</p>{action && <button className="button button-ghost button-small" onClick={action}>Reset pencarian</button>}</div>
}

export function AdminOrderDetailPage() {
  const { id } = useParams()
  return <AdminOrderDetail key={id} />
}

function AdminOrderDetail() {
  const { id = "" } = useParams()
  const { orders, repository, runAction, lastWhatsAppNotification } = useOrderData()
  const order = orders.find((item) => item.id === id)
  const currentOffer = order?.offers.at(-1)
  const payment = currentOffer ? order?.payments.findLast((item) => item.offerId === currentOffer.id) : undefined
  const refundableAmount = order?.payments.filter((item) => item.status === "dibayar").reduce((sum, item) => sum + item.amount, 0) ?? 0
  const [amount, setAmount] = useState(String(currentOffer?.amount ?? ""))
  const [scope, setScope] = useState(currentOffer?.scope ?? "")
  const [deliverables, setDeliverables] = useState(currentOffer?.deliverables.join("\n") ?? "")
  const [revisionLimit, setRevisionLimit] = useState(String(currentOffer?.revisionLimit ?? 2))
  const [revisionDeadline, setRevisionDeadline] = useState(toWitaInput(currentOffer?.revisionDeadline))
  const [dueAt, setDueAt] = useState(toWitaInput(currentOffer?.dueAt))
  const [workStatus, setWorkStatus] = useState<WorkStatus>(order?.status ?? "diajukan")
  const [resultFile, setResultFile] = useState<File>()
  const [merchantReference, setMerchantReference] = useState("")
  const [paymentChecked, setPaymentChecked] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState("")
  const [assistantApplied, setAssistantApplied] = useState(false)
  const [informationQuestion, setInformationQuestion] = useState("")
  const [closeStatus, setCloseStatus] = useState<"ditolak" | "dibatalkan">("dibatalkan")
  const [closeReason, setCloseReason] = useState("")
  const [refundReference, setRefundReference] = useState("")
  const [closing, setClosing] = useState(false)

  if (!order) return <div className="admin-page"><Link className="back-link" to="/admin/pesanan"><ArrowLeft /> Daftar pesanan</Link><AdminEmpty text="Nomor pesanan tidak ditemukan." /></div>
  const selectedWorkStatus = progressTransitions[order.status].includes(workStatus) ? workStatus : order.status
  const activeRevision = currentOffer
    ? (order.revisions ?? []).findLast((item) => item.offerId === currentOffer.id && item.status !== "selesai")
    : undefined
  const waCustomerLink = order.whatsapp
    ? buildWhatsAppLink(
        `Halo ${order.customerName}, saya admin dari Techrey Digital mengenai pesanan #${order.id} (${order.title}).`,
        order.whatsapp
      )
    : undefined

  const offerDraft = (): OfferDraft => ({
    amount: Number(amount),
    scope: scope.trim(),
    deliverables: deliverables.split("\n").map((item) => item.trim()).filter(Boolean),
    revisionLimit: Number(revisionLimit),
    revisionDeadline: `${revisionDeadline}:00+08:00`,
    dueAt: `${dueAt}:00+08:00`,
  })

  const submitOffer = (event: FormEvent) => {
    event.preventDefault()
    if (Number(amount) < 1_000 || scope.trim().length < 10 || !deliverables.trim() || !revisionDeadline || !dueAt) { setLocalError("Lengkapi harga, lingkup, hasil, tenggat, dan batas revisi."); return }
    setLocalError("")
    runAction(() => currentOffer?.acceptedAt ? repository.reviseOffer(order.id, offerDraft()) : repository.saveOffer(order.id, offerDraft()))
  }

  const submitProgress = async (event: FormEvent) => {
    event.preventDefault()
    if (resultFile && resultFile.size > 10 * 1024 * 1024) { setLocalError("File hasil maksimal 10 MB."); return }
    setLocalError("")
    setSaving(true)
    const ok = await runAction(async () => {
      if (resultFile) await repository.uploadResultFile(order.id, resultFile)
      await repository.updateProgress(order.id, selectedWorkStatus)
    })
    setSaving(false)
    if (ok) setResultFile(undefined)
  }

  const verifyPayment = async () => {
    if (!paymentChecked || merchantReference.trim().length < 4) return
    setVerifyingPayment(true)
    const ok = await runAction(() => repository.verifyPayment(order.id, merchantReference.trim()))
    setVerifyingPayment(false)
    if (ok) {
      setMerchantReference("")
      setPaymentChecked(false)
    }
  }

  const requestInformation = async (event: FormEvent) => {
    event.preventDefault()
    if (informationQuestion.trim().length < 5) { setLocalError("Tulis informasi yang dibutuhkan, minimal 5 karakter."); return }
    setLocalError("")
    if (await runAction(() => repository.requestInformation(order.id, informationQuestion.trim()))) setInformationQuestion("")
  }

  const closeOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (closeReason.trim().length < 5) { setLocalError("Alasan penutupan minimal 5 karakter."); return }
    if (refundableAmount > 0 && refundReference.trim().length < 4) { setLocalError("Catat referensi pengembalian dana sebelum membatalkan pesanan berbayar."); return }
    setLocalError("")
    setClosing(true)
    const ok = await runAction(() => repository.closeOrder(order.id, closeStatus, closeReason.trim(), refundReference.trim() || undefined))
    setClosing(false)
    if (ok) { setCloseReason(""); setRefundReference("") }
  }

  return (
    <div className="admin-page detail-page">
      <div className="detail-nav">
        <Link className="back-link" to="/admin/pesanan"><ArrowLeft /> Daftar pesanan</Link>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {order.whatsapp && (
            <a
              href={`https://wa.me/${order.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo Kak *${order.customerName}*! Pembaruan pesanan *#${order.id} - ${order.title}* di Techrey Digital:\nStatus saat ini: *${workLabels[order.status]}*.\n\nCek progres pesanan di:\n👉 https://techrey-digital.vercel.app/akun/pesanan/${order.id}\n\nTerima kasih,\n*Techrey Digital*`)}`}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-whatsapp"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Kirim pesan notifikasi progres ke WhatsApp pelanggan"
            >
              <MessageCircle style={{ width: "15px", height: "15px" }} /> Kirim Update ke WA Pelanggan 💬
            </a>
          )}
          {waCustomerLink && (
            <a
              href={waCustomerLink}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-ghost wa-admin-nav-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <MessageCircle style={{ width: "15px", height: "15px", color: "#25d366" }} /> Chat Biasa ({order.whatsapp})
            </a>
          )}
        </div>
      </div>
      {lastWhatsAppNotification && lastWhatsAppNotification.phone && (
        <div className="admin-wa-notify-toast" role="status">
          <div className="admin-wa-notify-content">
            <MessageCircle style={{ color: "#25d366" }} />
            <div>
              <strong>
                {lastWhatsAppNotification.sentAutomatically
                  ? "Notifikasi otomatis telah dikirim ke WhatsApp pelanggan!"
                  : "Pembaruan berhasil disimpan & siap dikirim ke WhatsApp pelanggan"}
              </strong>
              <small>Pelanggan: {order.customerName} ({lastWhatsAppNotification.phone})</small>
            </div>
          </div>
          <div className="admin-wa-notify-actions">
            <a
              href={lastWhatsAppNotification.href}
              target="_blank"
              rel="noreferrer"
              className="button button-small button-whatsapp"
            >
              {lastWhatsAppNotification.sentAutomatically ? "Buka Chat WhatsApp" : "Kirim WhatsApp Sekarang 💬"} <ExternalLink style={{ width: 14, height: 14 }} />
            </a>
            <button
              type="button"
              className="button button-small button-ghost"
              onClick={() => repository.clearWhatsAppNotification()}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
      <header className="admin-page-heading detail-heading"><div><span className="eyebrow">{order.id} / {order.service}</span><h1>{order.title}</h1><p>{order.customerName} · {witaDate(order.deadline)}</p></div><div className="detail-pills"><StatusPill status={order.status} /><StatusPill payment={payment?.status ?? "belum-ditagih"} /></div></header>
      <nav className="mobile-admin-jump" aria-label="Lompat ke bagian pesanan">
        <a href="#admin-payment">Bayar</a><a href="#admin-brief">Brief</a><a href="#admin-revision">Revisi</a><a href="#admin-assistant">AI</a><a href="#admin-progress">Progres</a>
      </nav>
      {localError && <div className="form-error" role="alert">{localError}</div>}
      <div className="admin-detail-grid">
        <div className="admin-detail-main">
          <section id="admin-brief" className="admin-card detail-section">
            <div className="admin-card-heading"><div><span>01 / BRIEF</span><h2>Kebutuhan pelanggan</h2></div><FileText /></div>
            <p className="brief-copy">{order.brief}</p>
            <dl className="detail-list"><div><dt>Keperluan</dt><dd>{order.purpose}</dd></div><div><dt>Anggaran awal</dt><dd>{rupiah(order.budget)}</dd></div><div><dt>Lampiran</dt><dd>{(order.files ?? []).filter((file) => file.category === "reference").map((file) => `${file.originalName} · ${fileSize(file.size)}`).join(", ") || "Tidak ada"}</dd></div></dl>
            {["diajukan", "perlu-informasi", "ditinjau"].includes(order.status) && <div className="inline-actions"><button className="button button-small" onClick={() => void runAction(() => repository.markReviewed(order.id))}>Tandai ditinjau <Check /></button></div>}
            {["diajukan", "ditinjau", "menunggu-persetujuan"].includes(order.status) && (
              <form className="admin-inline-form" onSubmit={(event) => void requestInformation(event)}>
                <label htmlFor="informationQuestion">Informasi yang perlu dilengkapi</label>
                <textarea id="informationQuestion" rows={3} maxLength={1000} value={informationQuestion} onChange={(event) => setInformationQuestion(event.target.value)} placeholder="Contoh: mohon kirim pedoman format dan jumlah halaman final." />
                <button className="button button-ghost button-small" disabled={informationQuestion.trim().length < 5}>Kirim permintaan informasi</button>
              </form>
            )}
          </section>

          {activeRevision && (order.status === "revisi" || activeRevision.status !== "selesai") && (
            <section id="admin-revision" className="admin-card detail-section revision-action-card">
              <div className="admin-card-heading">
                <div>
                  <span className="badge-revision-active">REVISI PELANGGAN · PUTARAN {activeRevision.round}</span>
                  <h2>Penanganan Revisi Pekerjaan</h2>
                </div>
                <RefreshCcw style={{ color: "var(--teal)" }} />
              </div>

              <div className="inline-alert positive">
                <Check />
                <p>
                  <strong>Revisi Termasuk Kuota (Gratis untuk Pelanggan)</strong>
                  <span>
                    Pelanggan tidak perlu membayar lagi. Kerjakan catatan di bawah, lalu unggah file hasil revisi untuk dikirimkan.
                  </span>
                </p>
              </div>

              <div className="revision-notes-container">
                <span className="revision-notes-label">Catatan Revisi dari Pelanggan:</span>
                <blockquote className="revision-notes-quote">
                  “{activeRevision.notes}”
                </blockquote>
                <small className="revision-time">
                  Diajukan pada {witaDate(activeRevision.createdAt)} · Status: <b>{activeRevision.status.toUpperCase()}</b>
                </small>
              </div>

              <div className="revision-actions-group">
                {order.status === "revisi" && (
                  <button
                    type="button"
                    className="button button-small"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true)
                      await runAction(() => repository.updateProgress(order.id, "dikerjakan"))
                      setSaving(false)
                    }}
                  >
                    {saving ? "Memperbarui…" : "Mulai Kerjakan Revisi (Status: Dikerjakan)"} <ArrowRight />
                  </button>
                )}

                <div className="revision-upload-box">
                  <label htmlFor="revisionResultFile">Unggah & Kirim Hasil Revisi Langsung</label>
                  <div className="revision-upload-row">
                    <input
                      id="revisionResultFile"
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.webp,.txt,.csv"
                      onChange={(event) => setResultFile(event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      className="button button-small button-success"
                      disabled={saving || !resultFile}
                      onClick={async () => {
                        setSaving(true)
                        const ok = await runAction(async () => {
                          if (resultFile) await repository.uploadResultFile(order.id, resultFile)
                          await repository.updateProgress(order.id, "hasil-dikirim")
                        })
                        setSaving(false)
                        if (ok) setResultFile(undefined)
                      }}
                    >
                      {saving ? "Mengirim…" : "Kirim Hasil Revisi"} <Check />
                    </button>
                  </div>
                  <p className="field-hint">
                    Mengirim hasil revisi akan mempublikasikan file hasil baru dan menandai putaran revisi ini selesai.
                  </p>
                </div>

                {waCustomerLink && (
                  <a
                    href={waCustomerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-ghost button-small"
                    style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  >
                    <MessageCircle style={{ width: "15px", height: "15px", color: "#25d366" }} /> Chat WhatsApp Pelanggan terkait Revisi
                  </a>
                )}
              </div>
            </section>
          )}

          <AdminAssistantPanel id="admin-assistant" order={order} onApplyOffer={(draft) => {
            setScope(draft.scopeDraft)
            setDeliverables(draft.deliverablesDraft.join("\n"))
            setAssistantApplied(true)
            requestAnimationFrame(() => document.getElementById("offerScope")?.scrollIntoView({ behavior: "smooth", block: "center" }))
          }} />
          {assistantApplied && <div className="assistant-applied inline-alert positive"><Check /><p><strong>Draf asisten diterapkan ke formulir.</strong><span>Periksa, tentukan harga sendiri, lalu simpan jika sudah sesuai.</span></p></div>}

          <form id="admin-offer" className="admin-card detail-section admin-form" onSubmit={submitOffer}>
            <div className="admin-card-heading">
              <div>
                <span>02 / PENAWARAN</span>
                <h2>
                  {currentOffer?.acceptedAt
                    ? "Penawaran Baru / Biaya Tambahan (Di Luar Kuota Revisi)"
                    : currentOffer
                      ? "Perbarui penawaran"
                      : "Buat penawaran"}
                </h2>
              </div>
              {currentOffer && <b>VERSI {currentOffer.version}</b>}
            </div>
            {currentOffer?.acceptedAt && (
              <div className="inline-alert warning">
                <AlertCircle />
                <p>
                  <strong>Versi {currentOffer.version} sudah disetujui & aktif.</strong>
                  <span>
                    <strong>PERHATIAN:</strong> Bagian ini BUKAN untuk mengerjakan revisi (gunakan panel Penanganan Revisi di atas). Bagian ini hanya jika pelanggan meminta penambahan lingkup baru yang memerlukan biaya ekstra.
                  </span>
                </p>
              </div>
            )}
            <label htmlFor="offerAmount">Harga (Rp)</label>
            <input id="offerAmount" type="number" min="1000" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <label htmlFor="offerScope">Lingkup</label>
            <textarea id="offerScope" rows={4} value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Apa yang dikerjakan dan batas lingkupnya" />
            <label htmlFor="deliverables">Hasil, satu per baris</label>
            <textarea id="deliverables" rows={3} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} placeholder={'File PPTX\nPDF pratinjau'} />
            <div className="form-row form-row-three">
              <div>
                <label htmlFor="revisionLimit">Batas revisi</label>
                <input id="revisionLimit" type="number" min="0" max="10" value={revisionLimit} onChange={(event) => setRevisionLimit(event.target.value)} />
              </div>
              <div>
                <label htmlFor="dueAt">Tenggat hasil (WITA)</label>
                <input id="dueAt" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </div>
              <div>
                <label htmlFor="revisionDeadline">Batas revisi (WITA)</label>
                <input id="revisionDeadline" type="datetime-local" value={revisionDeadline} onChange={(event) => setRevisionDeadline(event.target.value)} />
              </div>
            </div>
            <button className="button button-small">
              {currentOffer?.acceptedAt ? "Buat Tagihan Tambahan / Versi Baru" : "Simpan penawaran"} <ArrowRight />
            </button>
          </form>

          <span id="admin-progress" className="admin-anchor" />

          <form className="admin-card detail-section admin-form" onSubmit={submitProgress}><div className="admin-card-heading"><div><span>04 / PROGRES & HASIL</span><h2>Perbarui pekerjaan</h2></div><Clock3 /></div><label htmlFor="workStatus">Status berikutnya</label><select id="workStatus" value={selectedWorkStatus} onChange={(event) => setWorkStatus(event.target.value as WorkStatus)}>{progressTransitions[order.status].map((status) => <option key={status} value={status}>{workLabels[status]}</option>)}</select><label htmlFor="resultFile">Unggah file hasil <span>opsional, maksimal 10 MB</span></label><input id="resultFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.webp,.txt,.csv" onChange={(event) => setResultFile(event.target.files?.[0])} /><p className="field-hint">File baru tetap menjadi draft privat admin. File baru terlihat pelanggan hanya setelah status “Hasil dikirim” berhasil disimpan.</p>{(order.files ?? []).some((file) => file.category === "result") && <ul className="simple-file-list">{(order.files ?? []).filter((file) => file.category === "result").map((file) => <li key={file.id}><a href={`/api/orders/${encodeURIComponent(order.id)}/files/${encodeURIComponent(file.id)}`}>{file.originalName} · {fileSize(file.size)} · {file.publishedAt ? "terkirim" : "draft admin"}</a></li>)}</ul>}<button className="button button-small" disabled={saving}>{saving ? "Menyimpan…" : "Simpan progres"} <ArrowRight /></button></form>
        </div>

        <aside className="admin-detail-side">
          <section id="admin-payment" className={`admin-card detail-section payment-admin${payment?.status === "menunggu-verifikasi" ? " needs-review" : ""}`}>
            <div className="admin-card-heading"><div><span>03 / PEMBAYARAN</span><h2>{payment ? paymentLabels[payment.status] : "Belum ditagih"}</h2></div><WalletCards /></div>
            <strong className="offer-price">{rupiah(payment?.amount)}</strong>
            {payment?.status === "menunggu-verifikasi" ? <>
              <div className="payment-review-callout"><Clock3 /><div><strong>Pelanggan mengaku sudah membayar.</strong><span>Periksa transaksi merchant sebelum pesanan masuk antrean kerja.</span></div></div>
              <ol className="payment-checklist"><li>Cari transaksi sebesar <strong>{rupiah(payment.amount)}</strong>.</li><li>Pastikan status transaksi <strong>Berhasil</strong>.</li><li>Cocokkan waktu transaksi dengan konfirmasi pelanggan.</li></ol>
              <label htmlFor="merchantReference">Referensi transaksi DANA Bisnis</label>
              <input id="merchantReference" maxLength={120} value={merchantReference} onChange={(event) => setMerchantReference(event.target.value)} placeholder="Salin nomor referensi transaksi" />
              <label className="payment-confirmation"><input type="checkbox" checked={paymentChecked} onChange={(event) => setPaymentChecked(event.target.checked)} /><span>Saya sudah mencocokkan nominal dan status transaksi.</span></label>
              <button type="button" className="button button-wide" disabled={!paymentChecked || merchantReference.trim().length < 4 || verifyingPayment} onClick={() => void verifyPayment()}>{verifyingPayment ? "Memverifikasi…" : "Verifikasi & masukkan ke antrean"} <Check /></button>
              <small className="payment-action-note">Tindakan ini menyimpan referensi transaksi dan mengubah status pekerjaan menjadi Antrean.</small>
            </> : payment?.status === "belum-dibayar" ? <div className="inline-alert warning"><Clock3 /><p><strong>Menunggu pelanggan membayar</strong><span>Belum ada yang perlu dilakukan. Tombol verifikasi muncul setelah pelanggan menekan “Saya sudah membayar”.</span></p></div> : payment?.status === "dibayar" ? <div className="payment-verified"><Check /><div><strong>Sudah dicocokkan</strong><span>Referensi: {payment.merchantReference || "—"}</span><small>{payment.verifiedAt ? witaDate(payment.verifiedAt) : "Waktu verifikasi tidak tersedia"} · {payment.verifiedBy || "Admin"}</small></div></div> : payment?.status === "dikembalikan" ? <div className="inline-alert positive"><Check /><p><strong>Dana sudah dikembalikan</strong><span>Referensi: {payment.refundReference || "tidak tersedia"}</span></p></div> : payment?.status === "dibatalkan" ? <div className="inline-alert"><AlertCircle /><p><strong>Tagihan dibatalkan</strong><span>Tidak ada pembayaran aktif untuk penawaran ini.</span></p></div> : <div className="inline-alert"><AlertCircle /><p><strong>Belum ada tagihan aktif</strong><span>Tagihan dibuat otomatis setelah pelanggan menyetujui penawaran.</span></p></div>}
          </section>
          {(order.messages ?? []).length > 0 && <section className="admin-card detail-section"><div className="admin-card-heading"><div><span>PERCAKAPAN</span><h2>Informasi tambahan</h2></div></div><ul className="revision-list">{(order.messages ?? []).map((message) => <li key={message.id}><strong>{message.actor === "admin" ? "Admin" : "Pelanggan"}</strong><p>{message.text}</p><small>{witaDate(message.createdAt)}</small></li>)}</ul></section>}
          <section className="admin-card detail-section"><div className="admin-card-heading"><div><span>REVISI</span><h2>{(order.revisions ?? []).length} putaran tercatat</h2></div></div>{(order.revisions ?? []).length ? <ul className="revision-list">{(order.revisions ?? []).map((revision) => <li key={revision.id}><strong>Putaran {revision.round} · {revision.status}</strong><p>{revision.notes}</p><small>{witaDate(revision.createdAt)}</small></li>)}</ul> : <AdminEmpty text="Belum ada catatan revisi pelanggan." />}</section>
          {!['selesai', 'ditolak', 'dibatalkan'].includes(order.status) && (
            <form id="admin-close" className="admin-card detail-section admin-form" onSubmit={(event) => void closeOrder(event)}>
              <div className="admin-card-heading"><div><span>PENUTUPAN</span><h2>Tolak atau batalkan</h2></div><AlertCircle /></div>
              <label htmlFor="closeStatus">Tindakan</label>
              <select id="closeStatus" value={closeStatus} onChange={(event) => setCloseStatus(event.target.value as "ditolak" | "dibatalkan")}>
                {['diajukan', 'ditinjau'].includes(order.status) && <option value="ditolak">Tolak pesanan</option>}
                <option value="dibatalkan">Batalkan pesanan</option>
              </select>
              <label htmlFor="closeReason">Alasan yang terlihat pelanggan</label>
              <textarea id="closeReason" rows={3} maxLength={500} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} />
              {refundableAmount > 0 && <><div className="inline-alert warning"><AlertCircle /><p><strong>Pesanan ini sudah dibayar.</strong><span>Kembalikan total {rupiah(refundableAmount)} dari seluruh versi penawaran di akun merchant lebih dulu, lalu catat referensinya.</span></p></div><label htmlFor="refundReference">Referensi pengembalian dana</label><input id="refundReference" maxLength={120} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} /></>}
              <button className="button button-ghost button-small" disabled={closing || closeReason.trim().length < 5 || (refundableAmount > 0 && refundReference.trim().length < 4)}>{closing ? "Menyimpan…" : closeStatus === "ditolak" ? "Tolak pesanan" : "Batalkan pesanan"}</button>
            </form>
          )}
          <section className="admin-card detail-section event-panel"><div className="admin-card-heading"><div><span>RIWAYAT SESI</span><h2>Jejak perubahan</h2></div></div><ul>{(order.events ?? []).map((event) => <li key={event.id}><i /><div><strong>{event.action}</strong><small>{event.actor} · {witaDate(event.timestamp)}</small></div></li>)}</ul></section>
        </aside>
      </div>
    </div>
  )
}
