import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useParams } from "react-router"
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Check,
  Clock3,
  Copy,
  Download,
  FileText,
  Loader2,
  LogIn,
  MessageCircle,
  RefreshCcw,
  Upload,
  WalletCards,
} from "lucide-react"
import { Dialog, PublicLayout, StatusPill } from "../components/ui"
import { useOrderData } from "../data/OrderContext"
import type { PaymentInstructions } from "../data/types"
import { fileSize, paymentLabels, rupiah, witaDate, workLabels } from "../lib/format"
import { authClient } from "../lib/authClient"
import { usePublicConfig } from "../lib/publicConfig"
import { buildWhatsAppLink } from "../lib/whatsapp"

const track = [
  "diajukan",
  "menunggu-persetujuan",
  "menunggu-pembayaran",
  "dikerjakan",
  "hasil-dikirim",
  "selesai",
] as const

export function CustomerOrderPage() {
  const { accountId, id } = useParams()
  return <CustomerOrderDetail key={accountId || id} />
}

function CustomerOrderDetail() {
  const { accountId, id } = useParams()
  const orderId = accountId || id || ""
  const location = useLocation()
  const session = authClient.useSession()
  const publicConfig = usePublicConfig()
  const { orders, repository, runAction, loading } = useOrderData()
  const order = orders.find((item) => item.id === orderId)

  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState("")
  const [submittingRevision, setSubmittingRevision] = useState(false)

  const [acceptResultOpen, setAcceptResultOpen] = useState(false)
  const [actionPending, setActionPending] = useState<string | null>(null)

  const [paymentInstructions, setPaymentInstructions] = useState<{ paymentId: string; value: PaymentInstructions }>()
  const [paymentInstructionError, setPaymentInstructionError] = useState<{ paymentId: string; message: string }>()
  const [retryNonce, setRetryNonce] = useState(0)

  const [informationReply, setInformationReply] = useState("")
  const [informationFile, setInformationFile] = useState<File>()
  const [informationFileError, setInformationFileError] = useState("")
  const [sendingInformation, setSendingInformation] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [submittingCancellation, setSubmittingCancellation] = useState(false)

  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [copiedAmount, setCopiedAmount] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const orderOffers = order?.offers ?? []
  const orderPayments = order?.payments ?? []
  const orderRevisions = order?.revisions ?? []
  const orderFiles = order?.files ?? []
  const orderMessages = order?.messages ?? []
  const orderEvents = order?.events ?? []

  const offer = orderOffers.at(-1)
  const payment = offer ? orderPayments.findLast((item) => item.offerId === offer.id) : undefined
  const usedRevisions = offer ? orderRevisions.filter((item) => item.offerId === offer.id).length : 0
  const canRequestRevision = Boolean(
    offer &&
    usedRevisions < offer.revisionLimit &&
    Date.parse(offer.revisionDeadline) >= currentTime
  )

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const userId = session.data?.user?.id
  const paymentId = payment?.id
  const paymentStatus = payment?.status
  useEffect(() => {
    if (!paymentId || !paymentStatus || !["belum-dibayar", "menunggu-verifikasi"].includes(paymentStatus)) return

    let active = true
    void repository
      .getPaymentInstructions(orderId)
      .then((value) => {
        if (active) {
          setPaymentInstructions({ paymentId, value })
          setPaymentInstructionError(undefined)
        }
      })
      .catch((error) => {
        if (active) {
          setPaymentInstructionError({ paymentId, message: repository.errorMessage(error) })
        }
      })

    return () => {
      active = false
    }
  }, [orderId, paymentId, paymentStatus, repository, retryNonce])

  if (session.isPending || (loading && !order)) {
    return (
      <PublicLayout>
        <main className="app-state" aria-busy="true">
          <span className="state-spinner" />
          <p>Memuat data pesanan…</p>
        </main>
      </PublicLayout>
    )
  }

  if (!session.data?.user) {
    return (
      <PublicLayout>
        <main className="empty-page shell-width">
          <span className="state-symbol"><LogIn /></span>
          <h1>Masuk untuk melihat pesananmu.</h1>
          <p>Pesanan ini terhubung dengan akun terdaftar. Masuk untuk melanjutkan ke pesanan ini.</p>
          <Link className="button" to={`/masuk?next=${encodeURIComponent(location.pathname)}`}>
            Masuk ke Akun
          </Link>
        </main>
      </PublicLayout>
    )
  }

  if (!order) {
    return (
      <PublicLayout>
        <main className="empty-page shell-width">
          <span className="state-symbol">?</span>
          <h1>Pesanan tidak ditemukan.</h1>
          <p>Pesanan ini tidak ada atau tidak terhubung dengan akun yang sedang digunakan ({session.data.user.email}).</p>
          <Link className="button" to="/akun/pesanan">Buka Pesanan Saya</Link>
        </main>
      </PublicLayout>
    )
  }

  const handleManualRefresh = async () => {
    if (!userId || refreshing) return
    setRefreshing(true)
    try {
      await repository.refreshAccountOrders(userId)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAcceptOffer = async () => {
    if (!offer) return
    setActionPending("accept-offer")
    try {
      await runAction(() => repository.acceptOffer(order.id, offer))
    } finally {
      setActionPending(null)
    }
  }

  const handleMarkPayment = async () => {
    setActionPending("mark-payment")
    try {
      await runAction(() => repository.markPaymentAttempt(order.id))
    } finally {
      setActionPending(null)
    }
  }

  const handleAcceptResult = async () => {
    setActionPending("accept-result")
    try {
      if (await runAction(() => repository.acceptResult(order.id))) {
        setAcceptResultOpen(false)
      }
    } finally {
      setActionPending(null)
    }
  }

  const submitRevision = async (event: FormEvent) => {
    event.preventDefault()
    if (revisionNotes.trim().length < 10 || submittingRevision) return
    setSubmittingRevision(true)
    try {
      if (await runAction(() => repository.requestRevision(order.id, revisionNotes.trim()))) {
        setRevisionOpen(false)
        setRevisionNotes("")
      }
    } finally {
      setSubmittingRevision(false)
    }
  }

  const submitInformation = async (event: FormEvent) => {
    event.preventDefault()
    if (informationReply.trim().length < 5 || sendingInformation) return
    setSendingInformation(true)
    try {
      let fileOk = true
      if (informationFile) {
        fileOk = await runAction(() => repository.uploadReferenceFile(order.id, informationFile))
        if (fileOk) {
          setInformationFile(undefined)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }
      }
      if (fileOk) {
        const replyOk = await runAction(() => repository.replyInformation(order.id, informationReply.trim()))
        if (replyOk) {
          setInformationReply("")
          setInformationFileError("")
        }
      }
    } finally {
      setSendingInformation(false)
    }
  }

  const submitCancellation = async (event: FormEvent) => {
    event.preventDefault()
    if (cancelReason.trim().length < 5 || submittingCancellation) return
    setSubmittingCancellation(true)
    try {
      if (await runAction(() => repository.cancelOrder(order.id, cancelReason.trim()))) {
        setCancelOpen(false)
        setCancelReason("")
      }
    } finally {
      setSubmittingCancellation(false)
    }
  }

  const copyAmount = () => {
    if (!payment) return
    void navigator.clipboard.writeText(String(payment.amount))
    setCopiedAmount(true)
    setTimeout(() => setCopiedAmount(false), 2000)
  }

  const results = orderFiles.filter((file) => file.category === "result")
  const references = orderFiles.filter((file) => file.category === "reference")

  const needsInstructions = Boolean(
    payment && ["belum-dibayar", "menunggu-verifikasi"].includes(payment.status)
  )
  const currentPaymentInstructions =
    needsInstructions && payment && paymentInstructions && paymentInstructions.paymentId === payment.id
      ? paymentInstructions.value
      : undefined
  const currentPaymentInstructionError =
    needsInstructions && payment && paymentInstructionError && paymentInstructionError.paymentId === payment.id
      ? paymentInstructionError.message
      : ""
  const isPaymentInstructionsLoading =
    needsInstructions && !currentPaymentInstructions && !currentPaymentInstructionError

  const normalizedStatus =
    order.status === "perlu-informasi" || order.status === "ditinjau"
      ? "diajukan"
      : order.status === "antrean" || order.status === "revisi"
        ? "dikerjakan"
        : order.status
  const progressIndex = track.indexOf(normalizedStatus as (typeof track)[number])
  const isClosed = order.status === "ditolak" || order.status === "dibatalkan"

  return (
    <PublicLayout>
      <main className="customer-page shell-width">
        <div className="page-kicker-row">
          <Link className="back-link" to="/akun/pesanan">
            <ArrowLeft /> Pesanan Saya
          </Link>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <a
              className="button button-small button-ghost"
              href={buildWhatsAppLink(
                `Halo Techrey Digital, saya ingin menanyakan pesanan #${order.id} (${order.title})`,
                publicConfig.whatsapp.number
              )}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Hubungi admin via WhatsApp"
            >
              <MessageCircle style={{ width: "15px", height: "15px", color: "#25d366" }} /> Chat WhatsApp Admin
            </a>
            <button
              type="button"
              className="button button-small button-ghost"
              onClick={() => void handleManualRefresh()}
              disabled={refreshing}
              title="Perbarui data status pesanan terkini"
            >
              <RefreshCcw style={{ width: "14px", height: "14px" }} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Memperbarui…" : "Perbarui"}
            </button>
          </div>
        </div>

        <section className="customer-heading">
          <div>
            <span className="eyebrow">PESANAN / {order.id}</span>
            <h1>{order.title}</h1>
            <p>{order.service} · tenggat {witaDate(order.deadline)}</p>
          </div>
          <div className="status-stack">
            <span>STATUS PEKERJAAN</span>
            <StatusPill status={order.status} />
          </div>
        </section>

        <div className="customer-grid">
          <div className="customer-main-stack">
            <section className="panel progress-panel">
              <div className="panel-heading">
                <div>
                  <span>PROGRES</span>
                  <h2>Posisi pekerjaanmu</h2>
                </div>
                <Clock3 />
              </div>
              <ol className="timeline">
                {track.map((status, index) => {
                  const active = !isClosed && status === normalizedStatus
                  const done = !isClosed && (index < progressIndex || order.status === "selesai")
                  return (
                    <li key={status}>
                      <span className={done ? "done" : active ? "active" : ""}>
                        {done ? <Check /> : index + 1}
                      </span>
                      <div>
                        <strong>{workLabels[status]}</strong>
                        <small>
                          {[
                            "Brief masuk",
                            "Harga dan lingkup",
                            "QRIS & verifikasi",
                            "Antrean dan pengerjaan",
                            "File tersedia",
                            "Diterima pelanggan",
                          ][index]}
                        </small>
                      </div>
                    </li>
                  )
                })}
              </ol>

              {order.status === "dibatalkan" && (
                <div className="inline-alert warning">
                  <Ban />
                  <p>
                    <strong>Pesanan Dibatalkan</strong>
                    <span>{order.closedReason ? `Alasan: ${order.closedReason}` : "Pesanan ini telah dibatalkan."}</span>
                  </p>
                </div>
              )}

              {order.status === "ditolak" && (
                <div className="inline-alert warning">
                  <Ban />
                  <p>
                    <strong>Pesanan Ditolak</strong>
                    <span>{order.closedReason ? `Alasan: ${order.closedReason}` : "Admin belum dapat menerima pesanan ini."}</span>
                  </p>
                </div>
              )}

              {(order.status === "perlu-informasi" || order.status === "revisi") && (
                <div className="inline-alert warning">
                  <AlertCircle />
                  <p>
                    <strong>{order.status === "revisi" ? "Catatan revisi sudah masuk." : "Admin membutuhkan informasi tambahan."}</strong>
                    <span>{order.status === "revisi" ? "Status akan diperbarui setelah admin menangani catatan." : "Baca pertanyaan admin dan kirim jawaban melalui formulir di bawah."}</span>
                  </p>
                </div>
              )}
            </section>

            {orderMessages.length > 0 && (
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span>INFORMASI TAMBAHAN</span>
                    <h2>Percakapan pesanan</h2>
                  </div>
                </div>
                <ul className="revision-list">
                  {orderMessages.map((message) => (
                    <li key={message.id}>
                      <strong>{message.actor === "admin" ? "Admin Techrey" : "Kamu"}</strong>
                      <p>{message.text}</p>
                      <small>{witaDate(message.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {order.status === "perlu-informasi" && (
              <form className="panel dialog-form" onSubmit={(event) => void submitInformation(event)}>
                <div className="panel-heading">
                  <div>
                    <span>BALAS ADMIN</span>
                    <h2>Lengkapi informasi</h2>
                  </div>
                  <Upload />
                </div>
                <label htmlFor="informationReply">Jawaban</label>
                <textarea
                  id="informationReply"
                  rows={5}
                  minLength={5}
                  maxLength={3000}
                  required
                  value={informationReply}
                  onChange={(event) => setInformationReply(event.target.value)}
                  placeholder="Tuliskan penjelasan tambahan sesuai pertanyaan admin…"
                />
                <label htmlFor="informationFile">
                  Lampiran tambahan <span>opsional, maksimal 10 MB</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="informationFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.webp,.txt,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file && file.size > 10 * 1024 * 1024) {
                      setInformationFile(undefined)
                      setInformationFileError("Lampiran maksimal 10 MB.")
                      event.target.value = ""
                    } else {
                      setInformationFile(file)
                      setInformationFileError("")
                    }
                  }}
                />
                {informationFileError && <p className="form-error" role="alert">{informationFileError}</p>}
                <button className="button" disabled={sendingInformation || informationReply.trim().length < 5}>
                  {sendingInformation ? "Mengirim…" : "Kirim informasi"}
                </button>
              </form>
            )}

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span>RINGKASAN BRIEF</span>
                  <h2>Yang kami catat</h2>
                </div>
                <FileText />
              </div>
              <dl className="detail-list">
                <div>
                  <dt>Keperluan</dt>
                  <dd>{order.purpose}</dd>
                </div>
                <div>
                  <dt>Brief</dt>
                  <dd>{order.brief}</dd>
                </div>
                <div>
                  <dt>Lampiran Referensi</dt>
                  <dd>
                    {references.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                        {references.map((file) => (
                          <a
                            key={file.id}
                            href={`/api/orders/${encodeURIComponent(order.id)}/files/${encodeURIComponent(file.id)}`}
                            download={file.originalName}
                            className="text-link"
                            style={{ fontSize: "0.84rem", textDecoration: "underline" }}
                            title="Unduh file lampiran"
                          >
                            <FileText style={{ width: "14px", height: "14px" }} /> {file.originalName} ({fileSize(file.size)})
                          </a>
                        ))}
                      </div>
                    ) : (
                      "Tidak ada"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Anggaran awal</dt>
                  <dd>{rupiah(order.budget)}</dd>
                </div>
              </dl>
            </section>

            <section className="panel result-panel">
              <div className="panel-heading">
                <div>
                  <span>HASIL & REVISI</span>
                  <h2>{results.length ? "Hasil tercatat" : "Belum ada file hasil"}</h2>
                </div>
                <Download />
              </div>
              {results.length ? (
                <div className="result-list">
                  {results.map((file) => (
                    <a
                      key={file.id}
                      className="result-file"
                      href={`/api/orders/${encodeURIComponent(order.id)}/files/${encodeURIComponent(file.id)}`}
                      download={file.originalName}
                    >
                      <FileText />
                      <span>
                        <strong>{file.originalName}</strong>
                        <small>{fileSize(file.size)} · unduh privat</small>
                      </span>
                      <Download />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">
                  <p>Belum ada file hasil yang dikirim admin.</p>
                </div>
              )}

              {orderRevisions.length > 0 && (
                <div style={{ marginTop: "20px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
                  <h3 style={{ fontSize: "0.95rem", margin: "0 0 10px", color: "var(--navy)" }}>
                    Riwayat Putaran Revisi ({orderRevisions.length})
                  </h3>
                  <ul className="revision-list">
                    {orderRevisions.map((rev) => (
                      <li key={rev.id}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <strong>Putaran {rev.round}</strong>
                          <span className={`status-pill status-${rev.status === "selesai" ? "positive" : "warning"}`}>
                            {rev.status === "diajukan" ? "Diajukan" : rev.status === "dikerjakan" ? "Sedang dikerjakan" : "Selesai"}
                          </span>
                        </div>
                        <p>{rev.notes}</p>
                        <small>{witaDate(rev.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {results.length > 0 && order.status === "hasil-dikirim" && (
                <div className="result-actions" style={{ marginTop: "18px" }}>
                  <div>
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={!canRequestRevision || actionPending !== null}
                      onClick={() => setRevisionOpen(true)}
                    >
                      <RefreshCcw /> {canRequestRevision ? "Ajukan revisi" : "Revisi tidak tersedia"}
                    </button>
                    {!canRequestRevision && offer && (
                      <small style={{ display: "block", marginTop: "4px", color: "var(--muted)", fontSize: "0.72rem" }}>
                        {usedRevisions >= offer.revisionLimit
                          ? `Batas kuota revisi telah tercapai (${offer.revisionLimit} putaran).`
                          : Date.parse(offer.revisionDeadline) < currentTime
                            ? `Batas waktu pengajuan revisi telah berakhir (${witaDate(offer.revisionDeadline)}).`
                            : "Revisi belum tersedia."}
                      </small>
                    )}
                    {canRequestRevision && offer && (
                      <small style={{ display: "block", marginTop: "4px", color: "var(--muted)", fontSize: "0.72rem" }}>
                        Sisa {offer.revisionLimit - usedRevisions} dari {offer.revisionLimit} putaran revisi (hingga {witaDate(offer.revisionDeadline)}).
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className="button"
                    disabled={actionPending !== null}
                    onClick={() => setAcceptResultOpen(true)}
                  >
                    Terima hasil <Check />
                  </button>
                </div>
              )}

              {order.status === "selesai" && (
                <div className="accepted-label" style={{ marginTop: "16px" }}>
                  <Check /> Pekerjaan telah selesai dan hasil telah diterima.
                </div>
              )}
            </section>
          </div>

          <aside className="customer-side-stack">
            <section className="panel offer-panel">
              <div className="panel-heading">
                <div>
                  <span>PENAWARAN</span>
                  <h2>{offer ? `Versi ${offer.version}` : "Belum tersedia"}</h2>
                </div>
                {offer?.acceptedAt && <Check />}
              </div>
              {!offer ? (
                <div className="empty-inline">
                  <p>Admin masih memeriksa brief. Belum ada harga yang perlu disetujui.</p>
                </div>
              ) : (
                <>
                  <strong className="offer-price">{rupiah(offer.amount)}</strong>
                  <p>{offer.scope}</p>
                  <ul>
                    {offer.deliverables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="offer-meta">
                    <span>
                      {offer.revisionLimit} putaran revisi {usedRevisions > 0 ? `(terpakai ${usedRevisions})` : ""}
                    </span>
                    <span>Selesai {witaDate(offer.dueAt)}</span>
                  </div>
                  {offer.acceptedAt ? (
                    <div className="accepted-label">
                      <Check /> Disetujui {witaDate(offer.acceptedAt)}
                    </div>
                  ) : order.status === "menunggu-persetujuan" ? (
                    <button
                      className="button button-wide"
                      disabled={actionPending === "accept-offer"}
                      onClick={() => void handleAcceptOffer()}
                    >
                      {actionPending === "accept-offer" ? "Menyetujui…" : "Setujui penawaran"} <Check />
                    </button>
                  ) : (
                    <div className="empty-inline">
                      <p>Penawaran ini tidak aktif untuk status saat ini.</p>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="panel payment-card">
              <div className="panel-heading">
                <div>
                  <span>PEMBAYARAN QRIS</span>
                  <h2>{payment ? paymentLabels[payment.status] : "Belum ditagih"}</h2>
                </div>
              </div>

              {isPaymentInstructionsLoading ? (
                <div className="qris-placeholder" aria-label="Memuat instruksi QRIS">
                  <div>
                    <Loader2 className="animate-spin" style={{ width: "24px", height: "24px", margin: "0 auto 8px" }} />
                    <strong>MEMUAT QRIS…</strong>
                    <small>Menyiapkan kode QR pembayaran resmi</small>
                  </div>
                </div>
              ) : currentPaymentInstructions ? (
                <div className="qris-active">
                  <img src={currentPaymentInstructions.qrUrl} alt={`QRIS merchant ${currentPaymentInstructions.merchantName}`} />
                  <strong>{currentPaymentInstructions.merchantName}</strong>
                  <small>Pindai dengan aplikasi pembayaran (BCA, GoPay, OVO, Dana, ShopeePay) dan cocokkan nominal.</small>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                    <a
                      href={currentPaymentInstructions.qrUrl}
                      download={`qris-techrey-${order.id}.png`}
                      className="button button-small button-ghost"
                      title="Unduh gambar QRIS untuk diimpor ke aplikasi pembayaran di HP"
                    >
                      <Download /> Unduh QRIS
                    </a>
                  </div>
                </div>
              ) : (
                <div className="qris-placeholder" aria-label="Tidak ada QR pembayaran aktif">
                  <div>
                    <XMark />
                    <strong>TIDAK ADA QR AKTIF</strong>
                    <small>{currentPaymentInstructionError || "menunggu penawaran disetujui"}</small>
                    {currentPaymentInstructionError && payment && ["belum-dibayar", "menunggu-verifikasi"].includes(payment.status) && (
                      <button
                        type="button"
                        className="button button-small button-ghost"
                        style={{ marginTop: "10px" }}
                        onClick={() => setRetryNonce((n) => n + 1)}
                      >
                        <RefreshCcw /> Coba muat ulang
                      </button>
                    )}
                  </div>
                </div>
              )}

              {payment ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", margin: "10px 0" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block" }}>Total Tagihan</span>
                    <strong style={{ fontSize: "1.25rem" }}>{rupiah(payment.amount)}</strong>
                  </div>
                  <button type="button" className="button button-small button-ghost" onClick={copyAmount} title="Salin nominal angka">
                    {copiedAmount ? <><Check /> Tersalin</> : <><Copy /> Salin</>}
                  </button>
                </div>
              ) : (
                <p>Tagihan baru dibuat setelah penawaran disetujui.</p>
              )}

              {payment?.status === "belum-dibayar" && payment.rejectionReason && (
                <div className="inline-alert warning"><AlertCircle /><p><strong>Konfirmasi pembayaran belum cocok</strong><span>{payment.rejectionReason}</span></p></div>
              )}
              {payment?.status === "belum-dibayar" && currentPaymentInstructions && (
                <>
                  <div className="inline-alert warning">
                    <AlertCircle />
                    <p>
                      <strong>Konfirmasi setelah transaksi selesai.</strong>
                      <span>Status belum dibayar tidak berubah otomatis; admin akan mencocokkan transaksi di akun merchant.</span>
                    </p>
                  </div>
                  <button
                    className="button button-wide"
                    disabled={actionPending === "mark-payment"}
                    onClick={() => void handleMarkPayment()}
                  >
                    {actionPending === "mark-payment" ? "Mengirim konfirmasi…" : "Saya sudah membayar"} <Check />
                  </button>
                </>
              )}
              {payment?.status === "belum-dibayar" && !isPaymentInstructionsLoading && !currentPaymentInstructions && (
                <div className="inline-alert warning">
                  <AlertCircle />
                  <p>
                    <strong>Jangan melakukan pembayaran.</strong>
                    <span>QRIS merchant resmi belum tersedia pada pesanan ini. Hubungi admin bila perlu bantuan.</span>
                  </p>
                </div>
              )}
              {payment?.status === "menunggu-verifikasi" && (
                <div className="inline-alert warning">
                  <Clock3 />
                  <p>
                    <strong>Menunggu pemeriksaan admin</strong>
                    <span>Konfirmasi telah dikirim. Admin akan segera memverifikasi transaksi merchant sebelum pengerjaan dimulai.</span>
                  </p>
                </div>
              )}
              {payment?.status === "dibayar" && (
                <div className="inline-alert positive">
                  <Check />
                  <p>
                    <strong>Pembayaran terverifikasi</strong>
                    <span>
                      {order.status === "revisi"
                        ? "Pembayaran lunas. Revisi yang sedang diajukan tidak memerlukan biaya tambahan."
                        : "Transaksi telah dikonfirmasi oleh admin."}
                    </span>
                  </p>
                </div>
              )}
              {payment?.status === "dikembalikan" && (
                <div className="inline-alert positive">
                  <Check />
                  <p>
                    <strong>Dana dikembalikan</strong>
                    <span>Admin telah mencatat pengembalian dana untuk pesanan ini.</span>
                  </p>
                </div>
              )}
              {payment?.status === "dibatalkan" && (
                <div className="inline-alert">
                  <Ban />
                  <p>
                    <strong>Tagihan dibatalkan</strong>
                    <span>Tidak ada pembayaran aktif.</span>
                  </p>
                </div>
              )}
            </section>

            <section className="panel whatsapp-card">
              <div className="panel-heading">
                <div>
                  <span style={{ color: "#128c7e", fontWeight: 700, letterSpacing: "0.05em" }}>WHATSAPP RESMI</span>
                  <h2>Bantuan & Diskusi Cepat</h2>
                </div>
                <MessageCircle style={{ width: "22px", height: "22px", color: "#25d366" }} />
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 12px", lineHeight: "1.45" }}>
                Lebih nyaman komunikasi lewat WhatsApp? Tim Techrey siap menjawab pertanyaan dan konsultasi seputar pesananmu.
              </p>
              <div className="wa-quick-actions">
                <a
                  href={buildWhatsAppLink(
                    `Halo Techrey Digital, saya ingin tanya progres pengerjaan pesanan #${order.id} ("${order.title}"). Status saat ini: ${workLabels[order.status]}.`,
                    publicConfig.whatsapp.number
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="wa-action-btn"
                >
                  <Clock3 style={{ width: "15px", height: "15px" }} />
                  <span>Tanya Progres Pengerjaan</span>
                </a>
                {["revisi", "hasil-dikirim", "dikerjakan"].includes(order.status) && (
                  <a
                    href={buildWhatsAppLink(
                      `Halo Techrey Digital, saya ingin diskusi revisi untuk pesanan #${order.id} ("${order.title}").`,
                      publicConfig.whatsapp.number
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="wa-action-btn"
                  >
                    <RefreshCcw style={{ width: "15px", height: "15px" }} />
                    <span>Diskusi Revisi di WhatsApp</span>
                  </a>
                )}
                {payment && ["belum-dibayar", "menunggu-verifikasi"].includes(payment.status) && (
                  <a
                    href={buildWhatsAppLink(
                      `Halo Techrey Digital, saya ingin konfirmasi atau ada kendala pembayaran pesanan #${order.id} (Total: ${rupiah(payment.amount)}).`,
                      publicConfig.whatsapp.number
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="wa-action-btn"
                  >
                    <WalletCards style={{ width: "15px", height: "15px" }} />
                    <span>Konfirmasi / Bantuan QRIS</span>
                  </a>
                )}
                <a
                  href={buildWhatsAppLink(
                    `Halo Techrey Digital, saya ingin chat mengenai pesanan #${order.id} ("${order.title}").`,
                    publicConfig.whatsapp.number
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="wa-action-btn wa-action-btn-main"
                >
                  <MessageCircle style={{ width: "16px", height: "16px" }} />
                  <span>Chat WhatsApp Langsung</span>
                </a>
              </div>
            </section>

            <section className="panel event-panel">
              <div className="panel-heading">
                <div>
                  <span>RIWAYAT</span>
                  <h2>Perubahan terbaru</h2>
                </div>
              </div>
              <ul>
                {orderEvents.slice(0, 6).map((event) => (
                  <li key={event.id}>
                    <i />
                    <div>
                      <strong>{event.action}</strong>
                      <small>{event.actor} · {witaDate(event.timestamp)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        {["diajukan", "perlu-informasi", "ditinjau", "menunggu-persetujuan", "menunggu-pembayaran"].includes(order.status) &&
          !["menunggu-verifikasi", "dibayar"].includes(payment?.status ?? "") && (
            <div className="customer-cancel">
              <button type="button" className="button button-ghost" onClick={() => setCancelOpen(true)}>
                <Ban /> Batalkan pesanan
              </button>
            </div>
          )}
      </main>

      <Dialog open={revisionOpen} onClose={() => setRevisionOpen(false)} title="Ajukan revisi">
        <form className="dialog-form" onSubmit={submitRevision}>
          <div className="inline-alert positive" style={{ margin: "0 0 12px" }}>
            <Check />
            <p>
              <strong>Revisi Termasuk Kuota (Tanpa Biaya Tambahan)</strong>
              <span>
                Kamu tidak perlu membayar lagi untuk putaran revisi ini. Sisa {offer ? offer.revisionLimit - usedRevisions : 0} putaran kuota.
              </span>
            </p>
          </div>
          <p>Tulis perubahan yang masih berada dalam lingkup penawaran. Minimum 10 karakter.</p>
          <label htmlFor="revisionNotes">Catatan revisi</label>
          <textarea
            id="revisionNotes"
            rows={5}
            minLength={10}
            maxLength={3000}
            required
            value={revisionNotes}
            onChange={(event) => setRevisionNotes(event.target.value)}
            placeholder="Contoh: samakan warna diagram pada slide 4 dan 7…"
          />
          <div style={{ margin: "10px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Ingin diskusi catatan revisi langsung via chat?</span>
            <a
              href={buildWhatsAppLink(
                `Halo Techrey Digital, saya mau konsultasi revisi pesanan #${order.id} (${order.title})${revisionNotes.trim() ? `:\n"${revisionNotes.trim()}"` : "."}`,
                publicConfig.whatsapp.number
              )}
              target="_blank"
              rel="noreferrer"
              className="text-link"
              style={{ fontSize: "0.84rem", display: "inline-flex", alignItems: "center", gap: "4px", color: "#128c7e", fontWeight: 600 }}
            >
              <MessageCircle style={{ width: "14px", height: "14px" }} /> Diskusi di WhatsApp
            </a>
          </div>
          <div className="dialog-actions">
            <button type="button" className="button button-ghost" onClick={() => setRevisionOpen(false)} disabled={submittingRevision}>
              Batal
            </button>
            <button className="button" disabled={revisionNotes.trim().length < 10 || submittingRevision}>
              {submittingRevision ? "Mengajukan…" : "Ajukan revisi"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={acceptResultOpen} onClose={() => setAcceptResultOpen(false)} title="Konfirmasi Terima Hasil">
        <div className="dialog-form">
          <p>
            Apakah kamu sudah memeriksa seluruh file hasil pekerjaan dan puas dengan hasilnya?
          </p>
          <div className="inline-alert warning">
            <AlertCircle />
            <p>
              <strong>Perhatian</strong>
              <span>
                Setelah hasil diterima, status pesanan akan menjadi <strong>Selesai</strong> dan kamu tidak dapat lagi mengajukan putaran revisi.
              </span>
            </p>
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setAcceptResultOpen(false)}
              disabled={actionPending === "accept-result"}
            >
              Periksa Lagi
            </button>
            <button
              type="button"
              className="button"
              disabled={actionPending === "accept-result"}
              onClick={() => void handleAcceptResult()}
            >
              {actionPending === "accept-result" ? "Memproses…" : "Ya, Terima Hasil"} <Check />
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Batalkan pesanan">
        <form className="dialog-form" onSubmit={submitCancellation}>
          <p>Pembatalan menghentikan pesanan dan tagihan yang belum dibayar. Pembayaran yang sedang diperiksa harus ditangani admin.</p>
          <label htmlFor="cancelReason">Alasan pembatalan</label>
          <textarea
            id="cancelReason"
            rows={4}
            minLength={5}
            maxLength={500}
            required
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Tulis alasan pembatalan pesanan…"
          />
          <div className="dialog-actions">
            <button type="button" className="button button-ghost" onClick={() => setCancelOpen(false)} disabled={submittingCancellation}>
              Kembali
            </button>
            <button className="button" disabled={cancelReason.trim().length < 5 || submittingCancellation}>
              {submittingCancellation ? "Membatalkan…" : "Batalkan pesanan"}
            </button>
          </div>
        </form>
      </Dialog>
    </PublicLayout>
  )
}

function XMark() {
  return <span className="qris-cross">×</span>
}
