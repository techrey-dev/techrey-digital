import { useEffect } from "react"
import { Link, useLocation } from "react-router"
import { motion } from "motion/react"
import { ArrowDownRight, ArrowUpRight, Braces, Check, FileText, MessageCircle, Presentation, Sparkles } from "lucide-react"
import { HeroExperience } from "../components/HeroExperience"
import { PublicLayout } from "../components/ui"
import { SERVICES, type ServiceName } from "../data/types"
import { usePublicConfig } from "../lib/publicConfig"

const serviceContent: Record<ServiceName, { icon: typeof FileText; title: string; body: string; note: string }> = {
  "Dokumen & Penulisan": { icon: FileText, title: "Dokumen & Penulisan", body: "Ketik ulang, edit bahasa, rapikan makalah atau laporan, sampai daftar pustaka.", note: "Biar enak dibaca" },
  "PPT & Presentasi": { icon: Presentation, title: "PPT & Presentasi", body: "Ubah materi yang kamu punya menjadi slide yang runtut, jelas, dan nyaman dipresentasikan.", note: "Biar ceritanya nyambung" },
  "Coding & Website": { icon: Braces, title: "Coding & Website", body: "Website usaha atau portofolio, perbaikan error, fitur tambahan, dan penjelasan kode.", note: "Biar idenya jalan" },
  "Bantuan & Review Tugas": { icon: Check, title: "Bantuan & Review Tugas", body: "Bahas soal, periksa jawaban, dan pahami materi atau kode tanpa mengambil alih tanggung jawabmu.", note: "Biar makin paham" },
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.55 },
}

export function HomePage() {
  const { hash } = useLocation()
  const config = usePublicConfig()
  useEffect(() => {
    if (!hash) return
    let id: string
    try { id = decodeURIComponent(hash.slice(1)) } catch { return }
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    }))
    return () => cancelAnimationFrame(frame)
  }, [hash])

  return (
    <PublicLayout>
      <main>
        <section className="hero shell-width">
          <motion.div className="hero-copy" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <span className="eyebrow"><i /> PARTNER KEBUTUHAN DIGITALMU</span>
            <h1>Yang masih<br />berantakan, <em>kita rapikan.</em></h1>
            <p>Dokumen, presentasi, sampai website—ceritakan yang kamu perlukan. Detail dan harganya dibahas dulu sebelum mulai.</p>
            <div className="hero-actions">
              <Link className="button" to="/pesan">Ceritakan kebutuhanmu <ArrowUpRight /></Link>
              <Link className="text-link" to="/#karya">Lihat contoh <ArrowDownRight /></Link>
            </div>
            <div className="hero-notes"><span><Check /> Harga disepakati di awal</span><span><Check /> {config.qris.configured ? "QRIS merchant setelah setuju" : "Pembayaran menunggu QRIS resmi"}</span></div>
          </motion.div>
          <motion.div className="hero-stage" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.12 }}>
            <span className="stage-note">geser kursor / sentuh</span>
            <HeroExperience />
            <span className="stage-caption"><Sparkles /> DIGITAL WORKBENCH / 01</span>
          </motion.div>
        </section>

        <div className="marquee" aria-label="Daftar layanan"><div>{["DOKUMEN", "PRESENTASI", "CODING", "WEBSITE", "REVIEW TUGAS"].map((item) => <span key={item}>{item}<Sparkles /></span>)}</div></div>

        <section className="content-section shell-width" id="layanan">
          <motion.div className="section-heading" {...reveal}>
            <div><span className="eyebrow">01 / YANG BISA DIBANTU</span><h2>Satu pintu untuk empat jenis pekerjaan.</h2></div>
            <p>Pilih yang paling dekat dengan kebutuhanmu. Rincian harga baru dibuat setelah brief diperiksa.</p>
          </motion.div>
          <div className="service-grid">
            {SERVICES.map((service, index) => {
              const item = serviceContent[service]
              const Icon = item.icon
              return (
                <motion.article className={`service-card service-card-${index + 1}`} key={service} {...reveal} transition={{ duration: 0.45, delay: index * 0.06 }}>
                  <div className="card-top"><span>0{index + 1}</span><Icon /></div>
                  <h3>{item.title}</h3><p>{item.body}</p>
                  <Link to={`/pesan?layanan=${encodeURIComponent(service)}`}>{item.note} <ArrowUpRight /></Link>
                </motion.article>
              )
            })}
          </div>
          <p className="academic-note">Untuk tugas yang dinilai, bantuan berupa pembahasan, review, dan penyuntingan. Kamu tetap penulis dan penanggung jawab tugasmu.</p>
        </section>

        <section className="work-section" id="karya">
          <div className="content-section shell-width">
            <motion.div className="section-heading section-heading-light" {...reveal}>
              <div><span className="eyebrow">02 / CONTOH, BUKAN KARYA KLIEN</span><h2>Dua arah visual, satu tujuan: mudah dipahami.</h2></div>
              <p>Eksplorasi ini hanya menunjukkan jenis hasil yang bisa dibahas bersama.</p>
            </motion.div>
            <div className="work-grid">
              <motion.article className="work-sample sample-slides" {...reveal}>
                <div className="sample-badge">CONTOH PPT</div>
                <div className="slide-sheet"><small>RUANG TUMBUH / 2026</small><h3>Small steps.<br />Big impact.</h3><span>STRATEGI KOMUNIKASI <b>01—12</b></span></div>
                <footer><strong>Presentasi yang punya alur</strong><span>Materi → narasi → visual</span></footer>
              </motion.article>
              <motion.article className="work-sample sample-site" {...reveal}>
                <div className="sample-badge">CONTOH WEB</div>
                <div className="site-sheet"><nav><b>forma.</b><span>Studio&nbsp;&nbsp; Work&nbsp;&nbsp; Contact</span></nav><small>INDEPENDENT DESIGN STUDIO</small><h3>Spaces for<br />better living.</h3><span>Explore the studio <ArrowUpRight /></span></div>
                <footer><strong>Website dengan karakter</strong><span>Rapi di layar besar dan HP</span></footer>
              </motion.article>
            </div>
          </div>
        </section>

        <section className="content-section shell-width process-section">
          <motion.div className="section-heading" {...reveal}><div><span className="eyebrow">03 / DARI BRIEF KE HASIL</span><h2>Langkahnya kelihatan dari awal.</h2></div><p>Tidak langsung dikerjakan. Brief, penawaran, dan pembayaran disepakati lebih dulu.</p></motion.div>
          <div className="process-grid">
            {["Ceritakan kebutuhan", "Periksa & sepakati", "Bayar via QRIS", "Pantau dan terima hasil"].map((item, index) => <motion.article key={item} {...reveal}><span>0{index + 1}</span><h3>{item}</h3><p>{[
              "Pilih layanan, tulis konteks, dan tentukan tenggat WITA.",
              "Techrey memeriksa brief lalu membuat harga, hasil, serta batas revisi.",
              "Pembayaran baru dilakukan setelah penawaran disetujui dan perlu diverifikasi admin.",
              "Status pekerjaan, file hasil, dan revisi berada di halaman pesananmu.",
            ][index]}</p></motion.article>)}
          </div>
        </section>

        <section className="faq-section shell-width" id="faq">
          <motion.div {...reveal}><span className="eyebrow">04 / SEBELUM MULAI</span><h2>Hal yang sering perlu dipastikan.</h2></motion.div>
          <motion.div className="faq-list" {...reveal}>
            {[
              ["Harganya berapa?", "Harga bergantung pada jenis pekerjaan, jumlah halaman atau slide, tingkat kesulitan, dan tenggat. Penawaran dibuat setelah brief diperiksa."],
              ["Bisa untuk deadline dekat?", "Tuliskan tanggal dan jam yang kamu butuhkan. Kapasitas dan waktunya akan dicek sebelum kamu membayar."],
              ["Bayarnya pakai apa?", config.qris.configured ? "Pembayaran melalui QRIS merchant. QR hanya muncul pada akun pelanggan setelah penawaran disetujui." : "QRIS merchant sedang disiapkan. Jangan membayar sebelum kode QR resmi muncul pada halaman pesananmu."],
              ["Kalau perlu revisi?", "Jumlah putaran dan batas waktunya tertulis di penawaran. Perubahan di luar lingkup perlu penawaran baru."],
              ["File saya aman?", "Lampiran dan hasil disimpan di area privat server, tidak berada di folder publik. Aksesnya diperiksa berdasarkan akun pemilik pesanan atau admin."],
            ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
          </motion.div>
        </section>

        <section className="cta-section shell-width">
          <div><span className="eyebrow">PUNYA YANG PERLU DIRAPIKAN?</span><h2>Mulai dari ceritanya dulu.</h2><p>Belum perlu bayar. Brief akan diperiksa sebelum ada penawaran.</p></div>
          <div className="cta-actions"><Link className="button button-light" to="/pesan">Ajukan kebutuhan <ArrowUpRight /></Link>{config.whatsapp.configured && config.whatsapp.href && <a className="button button-whatsapp" href={config.whatsapp.href} target="_blank" rel="noreferrer">Chat dulu <MessageCircle /></a>}</div>
        </section>
      </main>
    </PublicLayout>
  )
}
