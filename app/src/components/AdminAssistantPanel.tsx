import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { AlertCircle, ArrowRight, Check, Clipboard, ClipboardCheck, ExternalLink, Sparkles, WandSparkles } from "lucide-react"
import type { Order } from "../data/types"
import { assistantService, buildChatGptPrompt, parseAssistantDraft, type AssistantDraft } from "../services/assistantService"
import { usePublicConfig } from "../lib/publicConfig"

type Props = {
  id?: string
  order: Order
  onApplyOffer: (draft: Pick<AssistantDraft, "scopeDraft" | "deliverablesDraft">) => void
}

export function AdminAssistantPanel({ id, order, onApplyOffer }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [draft, setDraft] = useState<AssistantDraft>()
  const [errorMessage, setErrorMessage] = useState("")
  const [manualResult, setManualResult] = useState("")
  const [copied, setCopied] = useState(false)
  const config = usePublicConfig()

  const analyze = async () => {
    setStatus("loading")
    setErrorMessage("")
    try {
      setDraft(await assistantService.analyzeOrder(order))
      setStatus("ready")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Analisis AI tidak berhasil.")
      setStatus("error")
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildChatGptPrompt(order))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setErrorMessage("Prompt belum dapat disalin otomatis. Pilih teks prompt lalu salin manual.")
      setStatus("error")
    }
  }

  const importManualResult = () => {
    try {
      setDraft(parseAssistantDraft(manualResult))
      setStatus("ready")
      setErrorMessage("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Hasil ChatGPT belum dapat dibaca.")
      setStatus("error")
    }
  }

  return (
    <section id={id} className="admin-card assistant-panel">
      <div className="assistant-heading">
        <div className="assistant-mark"><Sparkles /></div>
        <div><span>ASISTEN TECHREY</span><h2>Bantu baca brief, keputusan tetap di Anda.</h2></div>
        {status === "idle" && <button className="button button-small" disabled={!config.ai.configured} onClick={analyze}>Analisis dengan AI <WandSparkles /></button>}
        {status === "ready" && config.ai.configured && <button className="button button-ghost button-small" onClick={analyze}>Buat ulang draf</button>}
      </div>
      <p className="assistant-privacy"><AlertCircle /> {config.ai.configured ? "Brief, judul, tenggat, anggaran, dan metadata lampiran dikirim ke OpenAI saat tombol analisis ditekan. Isi file, nama, dan WhatsApp tidak dikirim." : "Mode otomatis belum aktif. Gunakan mode ChatGPT manual di bawah, atau tambahkan OPENAI_API_KEY pada server."}</p>

      <details className="assistant-manual">
        <summary>Pakai akun ChatGPT secara manual</summary>
        <div className="assistant-manual-body">
          <p>Salin prompt, buka ChatGPT, kirim prompt tersebut, lalu tempel JSON hasilnya kembali di bawah. Nama pelanggan dan WhatsApp tidak ikut disalin.</p>
          <textarea readOnly rows={6} value={buildChatGptPrompt(order)} aria-label="Prompt untuk ChatGPT" />
          <div className="assistant-manual-actions">
            <button type="button" className="button button-small" onClick={() => void copyPrompt()}><Clipboard /> {copied ? "Prompt tersalin" : "Salin prompt"}</button>
            <a className="button button-ghost button-small" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Buka ChatGPT <ExternalLink /></a>
          </div>
          <label htmlFor={`chatgpt-result-${order.id}`}>Tempel JSON hasil ChatGPT</label>
          <textarea id={`chatgpt-result-${order.id}`} rows={6} value={manualResult} onChange={(event) => setManualResult(event.target.value)} placeholder='{"summary":"...","missingInformation":[],...}' />
          <button type="button" className="button button-small" disabled={!manualResult.trim()} onClick={importManualResult}>Gunakan hasil ChatGPT <ArrowRight /></button>
        </div>
      </details>

      {status === "idle" && <div className="assistant-idle"><p>Gunakan untuk mendapat ringkasan, informasi yang kurang, draf lingkup, balasan, dan checklist peninjauan.</p></div>}
      {status === "loading" && <div className="assistant-loading" aria-busy="true"><span className="assistant-pulse"><Sparkles /></span><div><strong>Menganalisis brief…</strong><small>Hasil tetap berupa draf yang wajib diperiksa.</small></div></div>}
      {status === "error" && <div className="inline-alert warning"><AlertCircle /><p><strong>Draf belum berhasil dibuat.</strong><span>{errorMessage || "Coba lagi; data pesanan tidak berubah."}</span></p>{config.ai.configured && <button type="button" onClick={analyze}>Coba lagi</button>}</div>}

      <AnimatePresence>
        {status === "ready" && draft && (
          <motion.div className="assistant-output" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="assistant-block assistant-summary"><span>RINGKASAN</span><p>{draft.summary}</p></div>
            <div className="assistant-columns">
              <div className="assistant-block"><span>PERLU DIPASTIKAN</span>{draft.missingInformation.length ? <ul>{draft.missingInformation.map((item) => <li key={item}><AlertCircle />{item}</li>)}</ul> : <p className="assistant-ok"><Check /> Informasi utama cukup untuk membuat draf penawaran.</p>}</div>
              <div className="assistant-block"><span>CHECKLIST ANDA</span><ul>{draft.checklist.map((item) => <li key={item}><ClipboardCheck />{item}</li>)}</ul></div>
            </div>
            <div className="assistant-block"><span>DRAF BALASAN — BELUM DIKIRIM</span><blockquote>{draft.replyDraft}</blockquote></div>
            <div className="assistant-scope-preview"><div><span>DRAF LINGKUP</span><p>{draft.scopeDraft}</p></div><button className="button button-small" type="button" onClick={() => onApplyOffer(draft)}>Masukkan ke formulir <ArrowRight /></button></div>
            <p className="assistant-review-note">Periksa fakta, lingkup, dan harga sendiri. Tombol di atas hanya mengisi kolom; penawaran tidak tersimpan otomatis.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
