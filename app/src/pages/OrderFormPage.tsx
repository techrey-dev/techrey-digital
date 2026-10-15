import { useEffect, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"
import { motion } from "motion/react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  MessageCircle,
  Sparkles,
  Upload,
} from "lucide-react"
import { Dialog, PublicLayout } from "../components/ui"
import { useOrderData } from "../data/OrderContext"
import { PURPOSES, SERVICES, type OrderDraft, type Purpose, type ServiceName } from "../data/types"
import { authClient } from "../lib/authClient"
import { usePublicConfig } from "../lib/publicConfig"
import { buildWhatsAppLink } from "../lib/whatsapp"
import { orderDeadline } from "../lib/datetime"

const serviceHints: Record<ServiceName, string> = {
  "Dokumen & Penulisan": "Sebutkan jumlah halaman, materi yang ada, dan pedoman format penulisan.",
  "PPT & Presentasi": "Sebutkan materi sumber, jumlah slide yang diinginkan, dan gaya presentasi.",
  "Coding & Website": "Jelaskan fitur, tampilan, bahasa/framework, dan referensi contoh bila ada.",
  "Bantuan & Review Tugas": "Sebutkan mata kuliah/pelajaran dan topik atau kendala yang ingin dibahas.",
}

type FormState = {
  service: ServiceName | ""
  purpose: Purpose
  customerName: string
  whatsapp: string
  title: string
  brief: string
  deadlineChoice: "1-2-days" | "3-5-days" | "1-week" | "custom"
  customDeadline: string
  budget: string
}

const STORAGE_KEY = "techrey_order_draft"

export function OrderFormPage() {
  const [params] = useSearchParams()
  const initialService = SERVICES.find((service) => service === params.get("layanan")) ?? ""
  const { repository, runAction } = useOrderData()
  const session = authClient.useSession()
  const publicConfig = usePublicConfig()

  const [form, setForm] = useState<FormState>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          service: parsed.service || initialService,
          purpose: parsed.purpose || "Pribadi",
          customerName: parsed.customerName || "",
          whatsapp: parsed.whatsapp || "",
          title: parsed.title || "",
          brief: parsed.brief || "",
          deadlineChoice: parsed.deadlineChoice || "3-5-days",
          customDeadline: parsed.customDeadline || "",
          budget: parsed.budget || "",
        }
      }
    } catch {
      // ignore
    }
    return {
      service: initialService,
      purpose: "Pribadi",
      customerName: "",
      whatsapp: "",
      title: "",
      brief: "",
      deadlineChoice: "3-5-days",
      customDeadline: "",
      budget: "",
    }
  })

  const [referenceFile, setReferenceFile] = useState<File>()
  const [error, setError] = useState("")
  const [createdId, setCreatedId] = useState("")
  const [createdTitle, setCreatedTitle] = useState("")
  const [uploadWarning, setUploadWarning] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)

  const resolvedCustomerName = form.customerName || session.data?.user?.name || ""


  // Simpan draft lokal di sessionStorage agar tidak hilang
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch {
      // ignore
    }
  }, [form])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setError("")
    setForm((current) => ({ ...current, [key]: value }))
  }

  const effectiveDeadlineIso = orderDeadline(form.deadlineChoice, form.customDeadline)

  const validate = () => {
    if (!form.service) {
      setError("Silakan pilih salah satu jenis layanan di atas.")
      return false
    }
    if (!form.title.trim()) {
      setError("Tulis judul atau topik kebutuhanmu.")
      return false
    }
    if (form.brief.trim().length < 15) {
      setError("Jelaskan detail kebutuhan minimal 15 karakter agar kami memahami tugasnya.")
      return false
    }
    if (!resolvedCustomerName.trim()) {
      setError("Tulis nama lengkap kamu.")
      return false
    }
    if (!form.whatsapp.trim() || !/^[+0-9 ()-]{8,20}$/.test(form.whatsapp)) {
      setError("Masukkan nomor WhatsApp yang aktif untuk konfirmasi & update pengerjaan.")
      return false
    }
    if (form.deadlineChoice === "custom") {
      if (!form.customDeadline) {
        setError("Pilih tanggal tenggat kustom yang kamu inginkan.")
        return false
      }
      if (!Number.isFinite(Date.parse(effectiveDeadlineIso)) || new Date(effectiveDeadlineIso) <= new Date()) {
        setError("Tenggat kustom harus berada setelah waktu sekarang.")
        return false
      }
    }
    if (form.budget && (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 0 || Number(form.budget) > 1_000_000_000)) {
      setError("Anggaran harus antara Rp0 dan Rp1.000.000.000.")
      return false
    }
    setError("")
    return true
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || session.isPending) return
    if (!validate()) return

    // Jika belum login, buka dialog pilihan login akun atau langsung WhatsApp
    if (!session.data?.user) {
      setLoginPromptOpen(true)
      return
    }

    await doSubmitOrder()
  }

  const doSubmitOrder = async () => {
    const draft: OrderDraft = {
      customerName: resolvedCustomerName.trim(),
      whatsapp: form.whatsapp.trim(),
      service: form.service as ServiceName,
      purpose: form.purpose,
      title: form.title.trim(),
      brief: form.brief.trim(),
      deadline: effectiveDeadlineIso,
      budget: form.budget ? Number(form.budget) : undefined,
    }

    setSubmitting(true)
    let result: { id: string } | undefined
    const ok = await runAction(async () => {
      result = await repository.createOrder(draft)
    })

    if (ok && result) {
      const orderId = result.id
      setCreatedId(orderId)
      setCreatedTitle(draft.title)
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }

      if (referenceFile) {
        const uploaded = await runAction(() => repository.uploadReferenceFile(orderId, referenceFile))
        if (!uploaded) {
          setUploadWarning(
            "Pesanan tersimpan, namun file lampiran belum berhasil terunggah. Kamu bisa langsung mengirimkannya via WhatsApp.",
          )
        }
      }
    }
    setSubmitting(false)
  }

  // Pesan WhatsApp otomatis dari isi formulir saat ini
  const waOrderMessage = `Halo Techrey Digital, saya ingin konsultasi/memesan layanan:
- Layanan: ${form.service || "(Belum dipilih)"}
- Judul: ${form.title || "-"}
- Detail/Brief: ${form.brief || "-"}
- Tenggat: ${form.deadlineChoice === "1-2-days" ? "1-2 Hari (Kilat)" : form.deadlineChoice === "3-5-days" ? "3-5 Hari (Standar)" : form.deadlineChoice === "1-week" ? "1 Minggu" : form.customDeadline || "Fleksibel"}
- Nama: ${resolvedCustomerName || "-"}
- Anggaran: ${form.budget ? `Rp ${form.budget}` : "Belum ditentukan"}

Mohon dicek dan info penawarannya ya.`

  const waOrderHref = buildWhatsAppLink(waOrderMessage, publicConfig.whatsapp.number)

  if (createdId) {
    const waSuccessMsg = `Halo Techrey Digital, saya sudah mengajukan pesanan #${createdId} ("${createdTitle}"). Mohon dicek dan segera dikabari penawarannya ya.`
    const waSuccessHref = buildWhatsAppLink(waSuccessMsg, publicConfig.whatsapp.number)

    return (
      <PublicLayout>
        <main className="success-page shell-width">
          <motion.div className="success-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="success-icon">
              <Check />
            </span>
            <span className="eyebrow">PENGAJUAN BERHASIL DISIMPAN</span>
            <h1>{createdId} masuk ke akunmu!</h1>
            <p>Kebutuhanmu telah tercatat di server Techrey. Admin akan meninjau dan menyiapkan penawaran resmi.</p>

            {uploadWarning && (
              <div className="inline-alert warning">
                <AlertCircle />
                <p>{uploadWarning}</p>
              </div>
            )}

            <div className="success-wa-callout">
              <div>
                <strong>Ingin respon lebih cepat?</strong>
                <span>Konfirmasi langsung pesananmu ke WhatsApp Techrey sekarang.</span>
              </div>
              <a className="button button-whatsapp" href={waSuccessHref} target="_blank" rel="noreferrer">
                <MessageCircle /> Lanjutkan Chat di WhatsApp
              </a>
            </div>

            <div className="success-actions" style={{ marginTop: "16px" }}>
              <Link className="button" to={`/akun/pesanan/${createdId}`}>
                Buka Halaman Pesanan <ArrowRight />
              </Link>
              <Link className="button button-ghost" to="/akun/pesanan">
                Semua Pesanan Saya
              </Link>
            </div>
          </motion.div>
        </main>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <main className="order-page shell-width">
        <div className="order-nav-top">
          <Link className="back-link" to="/">
            <ArrowLeft /> Kembali ke beranda
          </Link>
          <a
            href={waOrderHref}
            target="_blank"
            rel="noreferrer"
            className="wa-header-pill"
            title="Pesan atau tanya langsung di WhatsApp"
          >
            <MessageCircle />
            <span>Pesan via WhatsApp</span>
          </a>
        </div>

        {/* Banner Pemesanan Cepat via WhatsApp */}
        <div className="order-wa-banner">
          <div className="order-wa-banner-icon">
            <MessageCircle />
          </div>
          <div className="order-wa-banner-copy">
            <strong>Mau lebih cepat & tanpa ribet isi formulir?</strong>
            <p>Konsultasi langsung dengan tim kami via WhatsApp. Kirim materi atau tugas, kami bantu hitungkan harga.</p>
          </div>
          <a
            href={waOrderHref}
            target="_blank"
            rel="noreferrer"
            className="button button-whatsapp order-wa-banner-btn"
          >
            Chat WhatsApp <ArrowRight />
          </a>
        </div>

        <div className="order-single-layout">
          <form className="order-unified-form" onSubmit={submit} noValidate>
            <div className="form-card-heading">
              <div>
                <span className="eyebrow">FORMULIR PENGAJUAN PROYEK</span>
                  <h1>Ceritakan kebutuhanmu</h1>
                <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "0.88rem" }}>
                  Tanpa biaya di muka. Penawaran harga & rincian pengerjaan akan disiapkan setelah brief ditinjau.
                </p>
              </div>
            </div>

            {error && (
              <div className="form-error" role="alert">
                <AlertCircle /> {error}
              </div>
            )}

            {/* Bagian 1: Pilih Layanan */}
            <section className="form-section-block">
              <label className="form-section-title">
                1. Pilih Layanan yang Dibutuhkan <span>*</span>
              </label>
              <div className="service-grid-compact">
                {SERVICES.map((service, idx) => {
                  const isSelected = form.service === service
                  return (
                    <button
                      key={service}
                      type="button"
                      aria-pressed={isSelected}
                      className={`service-card-compact ${isSelected ? "is-selected" : ""}`}
                      onClick={() => set("service", service)}
                    >
                      <span className="service-card-index">0{idx + 1}</span>
                      <div className="service-card-body">
                        <strong>{service}</strong>
                        <small>{serviceHints[service]}</small>
                      </div>
                      {isSelected && <span className="service-check-icon"><Check /></span>}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Bagian 2: Rincian Proyek */}
            <section className="form-section-block">
              <label className="form-section-title">
                2. Detail Kebutuhan <span>*</span>
              </label>

              <div className="form-field-group">
                <label htmlFor="orderTitle">
                  Judul atau Topik Proyek <span>*</span>
                </label>
                <input
                  id="orderTitle"
                  type="text"
                  maxLength={150}
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Contoh: PPT Sidang Skripsi 15 Slide, Perapian Format Makalah, Website Toko Online…"
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="orderBrief">
                  Jelaskan detail yang perlu kami ketahui <span>*</span>
                </label>
                <textarea
                  id="orderBrief"
                  rows={5}
                  maxLength={5000}
                  value={form.brief}
                  onChange={(e) => set("brief", e.target.value)}
                  placeholder={
                    form.service
                      ? `${serviceHints[form.service]} Jelaskan sedetail mungkin…`
                      : "Ceritakan apa yang ingin kamu capai, format yang diminta, referensi, atau instruksi khusus…"
                  }
                />
                <div className="field-hint-row">
                  <span>Minimal 15 karakter</span>
                  <span>{form.brief.length}/5000</span>
                </div>
              </div>

              {/* Tenggat Waktu Cepat */}
              <div className="form-field-group">
                <label>Kapan kamu membutuhkan hasil pekerjaannya? <span>*</span></label>
                <div className="deadline-chips-row">
                  <button
                    type="button"
                    className={`deadline-chip ${form.deadlineChoice === "1-2-days" ? "is-active" : ""}`}
                    onClick={() => set("deadlineChoice", "1-2-days")}
                  >
                    ⚡ 1–2 Hari (Kilat)
                  </button>
                  <button
                    type="button"
                    className={`deadline-chip ${form.deadlineChoice === "3-5-days" ? "is-active" : ""}`}
                    onClick={() => set("deadlineChoice", "3-5-days")}
                  >
                    📅 3–5 Hari (Standar)
                  </button>
                  <button
                    type="button"
                    className={`deadline-chip ${form.deadlineChoice === "1-week" ? "is-active" : ""}`}
                    onClick={() => set("deadlineChoice", "1-week")}
                  >
                    🗓️ 1 Minggu+
                  </button>
                  <button
                    type="button"
                    className={`deadline-chip ${form.deadlineChoice === "custom" ? "is-active" : ""}`}
                    onClick={() => set("deadlineChoice", "custom")}
                  >
                    ⏱️ Pilih Jam & Tanggal
                  </button>
                </div>

                {form.deadlineChoice === "custom" && (
                  <div style={{ marginTop: "12px" }}>
                    <input
                      aria-label="Tenggat tanggal dan jam dalam WITA"
                      type="datetime-local"
                      value={form.customDeadline}
                      onChange={(e) => set("customDeadline", e.target.value)}
                    />
                    <p className="field-hint">Waktu Indonesia Tengah (WITA).</p>
                  </div>
                )}
              </div>

              {/* Lampiran File (Opsional) */}
              <div className="form-field-group">
                <label htmlFor="referenceFileInput">
                  Lampiran Materi / Dokumen / Soal <span>(Opsional, maks 10 MB)</span>
                </label>
                <div className="file-upload-box">
                  <input
                    id="referenceFileInput"
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.webp,.txt,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && file.size > 10 * 1024 * 1024) {
                        setError("Ukuran file maksimal 10 MB.")
                        e.target.value = ""
                        setReferenceFile(undefined)
                        return
                      }
                      setReferenceFile(file)
                    }}
                  />
                  <div className="file-upload-visual">
                    <Upload />
                    {referenceFile ? (
                      <div>
                        <strong>{referenceFile.name}</strong>
                        <small>{(referenceFile.size / 1024).toFixed(0)} KB · Siap diunggah</small>
                      </div>
                    ) : (
                      <div>
                        <strong>Pilih file melalui tombol di atas</strong>
                        <small>PDF, DOCX, PPTX, ZIP, atau Gambar (opsional)</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Bagian 3: Identitas Kontak */}
            <section className="form-section-block">
              <label className="form-section-title">
                3. Kontak Kamu <span>*</span>
              </label>

              <div className="form-row">
                <div className="form-field-group">
                  <label htmlFor="custName">Nama kamu <span>*</span></label>
                  <input
                    id="custName"
                    autoComplete="name"
                    maxLength={100}
                    value={form.customerName || (session.data?.user?.name ?? "")}
                    onChange={(e) => set("customerName", e.target.value)}
                    placeholder={session.data?.user?.name || "Nama panggilan atau lengkap"}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="custWa">Nomor WhatsApp <span>*</span></label>
                  <input
                    id="custWa"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                    value={form.whatsapp}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="Contoh: 0812xxxxxxxx"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field-group">
                  <label htmlFor="purposeSelect">Untuk Keperluan</label>
                  <select
                    id="purposeSelect"
                    value={form.purpose}
                    onChange={(e) => set("purpose", e.target.value as Purpose)}
                  >
                    {PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="orderBudget">Perkiraan Anggaran <span>(Opsional)</span></label>
                  <input
                    id="orderBudget"
                    type="number"
                    min="0"
                    step="1000"
                    value={form.budget}
                    onChange={(e) => set("budget", e.target.value)}
                    placeholder="Rp contoh: 150000"
                  />
                </div>
              </div>
            </section>

            {/* Tombol Aksi Bawah */}
            <div className="order-submit-bar">
              <button
                type="submit"
                className="button button-wide order-main-submit"
                disabled={submitting || session.isPending}
              >
                {submitting ? (
                  "Menyimpan Pengajuan…"
                ) : (
                  <>Ajukan Kebutuhan Sekarang <ArrowRight /></>
                )}
              </button>

              <div className="order-or-divider">
                <span>ATAU</span>
              </div>

              <a
                href={waOrderHref}
                target="_blank"
                rel="noreferrer"
                className="button button-whatsapp button-wide"
              >
                <MessageCircle /> Kirim Detail Ini Langsung ke WhatsApp
              </a>

              <div className="order-guarantee-note">
                <FileText />
                <span>
                  Pengajuan bebas komitmen. Tim Techrey akan memeriksa brief dan memberikan estimasi harga sebelum kamu memutuskan setuju.
                </span>
              </div>
            </div>
          </form>
        </div>

        {/* Dialog Opsi Login vs Kirim WA (Bila user belum login) */}
        <Dialog
          open={loginPromptOpen}
          onClose={() => setLoginPromptOpen(false)}
          title="Kirim Pesanan"
        >
          <div className="login-prompt-content">
            <p style={{ margin: "0 0 16px", color: "var(--navy)" }}>
              Kebutuhanmu sudah siap dikirim! Pilih cara yang paling nyaman untukmu:
            </p>

            <div className="login-choice-card">
              <div className="login-choice-icon"><Sparkles /></div>
              <div className="login-choice-info">
                <strong>Simpan di Akun Web Techrey</strong>
                <small>Bisa melacak progres, riwayat putaran revisi, dan unduh file hasil kapan saja.</small>
              </div>
              <Link className="button button-small" to="/masuk?next=/pesan">
                Masuk Google / GitHub <ArrowRight />
              </Link>
            </div>

            <div className="login-choice-card" style={{ borderColor: "#1b9c4c" }}>
              <div className="login-choice-icon" style={{ background: "#e8f7ee", color: "#168440" }}>
                <MessageCircle />
              </div>
              <div className="login-choice-info">
                <strong>Kirim Langsung ke WhatsApp (Tanpa Login)</strong>
                <small>Kirimkan rincian yang sudah kamu ketik langsung ke chat admin Techrey Digital.</small>
              </div>
              <a
                href={waOrderHref}
                target="_blank"
                rel="noreferrer"
                className="button button-small button-whatsapp"
                onClick={() => setLoginPromptOpen(false)}
              >
                Kirim via WhatsApp <ArrowRight />
              </a>
            </div>

            <button
              type="button"
              className="button button-ghost button-small"
              style={{ marginTop: "12px", width: "100%" }}
              onClick={() => setLoginPromptOpen(false)}
            >
              Kembali ke Formulir
            </button>
          </div>
        </Dialog>
      </main>
    </PublicLayout>
  )
}
