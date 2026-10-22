import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { ArrowDownRight, ArrowUpRight, Braces, Check, FileText, MessageCircle, Plus, Presentation } from "lucide-react"
import { HeroExperience } from "../components/HeroExperience"
import { PublicLayout } from "../components/ui"
import { SERVICES, type ServiceName } from "../data/types"
import { usePublicConfig } from "../lib/publicConfig"
import pettaSite from "../assets/portfolio/petta-site.jpg"

const serviceContent: Record<ServiceName, { icon: typeof FileText; body: string; price: string }> = {
  "Dokumen & Penulisan": { icon: FileText, body: "Ketik ulang, rapikan format makalah atau laporan, perbaiki bahasa, sampai daftar pustaka.", price: "Mulai Rp25rb" },
  "PPT & Presentasi": { icon: Presentation, body: "Materi mentah jadi slide yang runtut, enak dilihat, dan gampang dipresentasikan.", price: "Mulai Rp50rb" },
  "Coding & Website": { icon: Braces, body: "Website usaha atau portofolio, perbaikan error, dan fitur tambahan dengan kode yang rapi.", price: "Sesuai fitur" },
  "Bantuan & Review Tugas": { icon: Check, body: "Bahas soal, cek jawaban, dan pahami materi atau kode tanpa mengambil alih tanggung jawabmu.", price: "Mulai Rp30rb" },
}

const ROTATING_WORDS = ["makalah & laporan", "slide presentasi", "website usaha", "error di kodemu"]

const MARQUEE_ITEMS = ["Dokumen", "Presentasi", "Website", "Coding", "Review tugas", "Bug fix"]

const STEPS = [
  { title: "Ceritakan", body: "Pilih layanan, tulis kebutuhan, lampirkan materi, dan tentukan tenggat." },
  { title: "Sepakati", body: "Brief diperiksa, lalu kamu dapat penawaran: harga tetap, hasil, dan batas revisi." },
  { title: "Bayar", body: "Bayar lewat QRIS hanya setelah kamu setuju dengan penawarannya." },
  { title: "Terima", body: "Pantau progres di halaman pesanan, unduh hasil, ajukan revisi kalau perlu." },
]

const ease = [0.22, 1, 0.36, 1] as const

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease },
}

function RevealLine({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="line-mask">
      <motion.span initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ duration: 0.8, delay, ease }}>
        {children}
      </motion.span>
    </span>
  )
}

// Fixed offsets so "berantakan," looks hand-tossed but renders the same on every load: [rotate deg, y em].
const MESS: [number, number][] = [[-7, 0.03], [5, -0.05], [-3, 0.06], [8, -0.02], [-6, 0.04], [4, -0.06], [-9, 0.01], [6, 0.05], [-2, -0.04], [7, 0.02], [-5, 0]]

function MessyWord({ word }: { word: string }) {
  return (
    <span className="messy-word" aria-hidden="true">
      {word.split("").map((letter, index) => {
        const [rotate, y] = MESS[index % MESS.length]
        return (
          <motion.span
            key={index}
            className="messy-drop"
            initial={{ opacity: 0, y: "-0.6em" }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.035, type: "spring", stiffness: 500, damping: 18 }}
          >
            <span className="messy-letter" style={{ "--r": `${rotate}deg`, "--y": `${y}em` } as CSSProperties}>{letter}</span>
          </motion.span>
        )
      })}
    </span>
  )
}

// Letters fly in from scattered positions and snap into a neat blue block: the "tidying up" moment.
const SCATTER: [number, number, number][] = [[-0.8, -0.9, -40], [0.5, 0.8, 30], [-0.3, -1.1, 55], [0.9, 0.6, -25], [-0.6, 1, 20], [0.4, -0.8, -50], [0.7, 0.9, 35], [-0.9, 0.4, -15]]

function TidyWord({ word }: { word: string }) {
  return (
    <span className="tidy-word" aria-hidden="true">
      <motion.span className="tidy-block" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.45, duration: 0.55, ease }} />
      {word.split("").map((letter, index) => {
        const [x, y, rotate] = SCATTER[index % SCATTER.length]
        return (
          <motion.span
            key={index}
            className="tidy-letter"
            initial={{ opacity: 0, x: `${x}em`, y: `${y}em`, rotate }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
            transition={{ delay: 0.6 + index * 0.05, type: "spring", stiffness: 260, damping: 13 }}
          >
            {letter}
          </motion.span>
        )
      })}
      <motion.span className="tidy-arrow" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.2, type: "spring", stiffness: 400, damping: 12 }}>
        <ArrowUpRight />
      </motion.span>
    </span>
  )
}

function WordRotator() {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % ROTATING_WORDS.length), 2400)
    return () => window.clearInterval(timer)
  }, [reduceMotion])

  return (
    <span className="rotator">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ROTATING_WORDS[index]}
          initial={{ y: "80%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-80%", opacity: 0 }}
          transition={{ duration: 0.35, ease }}
        >
          {ROTATING_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function ShowcaseFrame() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1])
  const y = useTransform(scrollYProgress, [0, 1], [60, 0])

  return (
    <div className="showcase-stage" ref={ref}>
      <motion.a
        className="showcase-frame"
        href="https://pettadesain.id"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buka website pettadesain.id di tab baru"
        style={{ rotateX, scale, y }}
      >
        <div className="showcase-bar">
          <span className="showcase-dots"><i /><i /><i /></span>
          <span className="showcase-url">pettadesain.id</span>
        </div>
        <img src={pettaSite} alt="Tampilan beranda website pettadesain.id" loading="lazy" width={1502} height={803} />
        <span className="showcase-hover">Buka website <ArrowUpRight /></span>
      </motion.a>
    </div>
  )
}

function ProcessSteps() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 60%"] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })

  return (
    <div className="steps" ref={ref}>
      <div className="steps-track" aria-hidden="true"><motion.div className="steps-fill" style={{ scaleX: progress }} /></div>
      <ol>
        {STEPS.map((step, index) => (
          <motion.li key={step.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.1 }}>
            <span className="steps-num">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item${open ? " is-open" : ""}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>{question}</span>
        <Plus />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="faq-answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <p>{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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

  const faqs: [string, string][] = [
    ["Berapa harganya?", "Tergantung jenis pekerjaan, jumlah halaman atau slide, tingkat kesulitan, dan tenggat. Harga pasti diberikan setelah brief diperiksa, dan tidak berubah di tengah jalan."],
    ["Bisa untuk deadline mepet?", "Bisa. Tulis tanggal dan jam yang kamu butuhkan. Ketersediaan waktu dikonfirmasi dulu sebelum kamu membayar."],
    ["Bayarnya pakai apa?", config.qris.configured ? "Lewat QRIS merchant resmi. Kode QR baru muncul di halaman pesananmu setelah penawaran kamu setujui." : "Lewat QRIS yang muncul di halaman pesananmu setelah penawaran kamu setujui."],
    ["Kalau hasilnya perlu revisi?", "Jumlah putaran revisi tertulis di penawaran. Selama masih dalam lingkup brief awal, revisi dikerjakan sampai tuntas."],
    ["File saya aman?", "Lampiran dan hasil disimpan di penyimpanan privat, bukan folder publik. Hanya kamu dan admin yang bisa mengaksesnya."],
  ]

  return (
    <PublicLayout>
      <main className="home">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <section className="home-hero shell-width">
          <div className="home-hero-copy">
            <h1 aria-label="Yang masih berantakan, kita rapikan.">
              <RevealLine delay={0.05}><span aria-hidden="true">Yang masih</span></RevealLine>
              <span className="hero-line"><MessyWord word="berantakan," /></span>
              <span className="hero-line">
                <motion.span aria-hidden="true" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.5, ease }}>kita</motion.span>{" "}
                <TidyWord word="rapikan." />
              </span>
            </h1>
            <motion.p className="hero-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }}>
              Bantu beresin <WordRotator />
            </motion.p>
            <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}>
              Ceritakan kebutuhanmu. Harga dan tenggat disepakati di awal, baru dikerjakan.
            </motion.p>
            <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}>
              <Link className="btn-brand btn-brand-lg" to="/pesan">Ceritakan kebutuhanmu <ArrowUpRight /></Link>
              <a className="btn-quiet" href="#hasil">Lihat hasil kerja <ArrowDownRight /></a>
            </motion.div>
            <motion.ul className="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}>
              <li><Check /> Harga tetap</li>
              <li><Check /> Bayar setelah setuju</li>
              <li><Check /> File privat</li>
            </motion.ul>
          </div>

          <motion.div className="home-hero-visual" initial={{ opacity: 0, scale: 0.92, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.9, delay: 0.1, ease }}>
            <div className="visual-shadow" aria-hidden="true" />
            <div className="visual-panel">
              <HeroExperience />
            </div>
            <motion.span className="visual-chip chip-a" animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              <b>Rp</b> Harga fix di awal
            </motion.span>
            <motion.span className="visual-chip chip-b" animate={{ y: [0, 8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              <b>QR</b> Bayar via QRIS
            </motion.span>
          </motion.div>
        </section>

        {/* ─── Marquee ──────────────────────────────────────────────── */}
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div className="ticker-group" key={copy}>
                {MARQUEE_ITEMS.map((item) => <span key={item}>{item}<ArrowUpRight /></span>)}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Layanan ──────────────────────────────────────────────── */}
        <section className="home-section shell-width" id="layanan">
          <motion.header className="home-heading" {...reveal}>
            <span className="section-tag">01 — Layanan</span>
            <h2>Empat hal yang paling sering bikin pusing.</h2>
          </motion.header>
          <div className="services">
            {SERVICES.map((service, index) => {
              const item = serviceContent[service]
              const Icon = item.icon
              return (
                <motion.article className="service" key={service} {...reveal} transition={{ ...reveal.transition, delay: index * 0.08 }}>
                  <Link to={`/pesan?layanan=${encodeURIComponent(service)}`}>
                    <div className="service-top">
                      <span className="service-icon"><Icon /></span>
                      <span className="service-price">{item.price}</span>
                    </div>
                    <h3>{service}</h3>
                    <p>{item.body}</p>
                    <span className="service-go">Pesan <ArrowUpRight /></span>
                  </Link>
                </motion.article>
              )
            })}
          </div>
          <p className="fine-print">
            Untuk tugas yang dinilai, bantuan berupa pembahasan, review, dan penyuntingan format. Kamu tetap penulis dan penanggung jawab tugasmu.
          </p>
        </section>

        {/* ─── Hasil kerja ──────────────────────────────────────────── */}
        <section className="home-section home-work" id="hasil">
          <div className="shell-width">
            <motion.header className="home-heading" {...reveal}>
              <span className="section-tag">02 — Hasil kerja</span>
              <h2>Website yang sudah live dan dipakai.</h2>
            </motion.header>
            <ShowcaseFrame />
            <motion.div className="showcase-meta" {...reveal}>
              <div>
                <strong>PETTA Desain</strong>
                <span>Website studio arsitektur · Kendari</span>
              </div>
              <a className="btn-brand" href="https://pettadesain.id" target="_blank" rel="noopener noreferrer">
                Kunjungi pettadesain.id <ArrowUpRight />
              </a>
            </motion.div>
          </div>
        </section>

        {/* ─── Alur ─────────────────────────────────────────────────── */}
        <section className="home-section shell-width" id="alur">
          <motion.header className="home-heading" {...reveal}>
            <span className="section-tag">03 — Alur</span>
            <h2>Jelas dari awal sampai selesai.</h2>
          </motion.header>
          <ProcessSteps />
        </section>

        {/* ─── FAQ ──────────────────────────────────────────────────── */}
        <section className="home-section shell-width home-faq" id="faq">
          <motion.header className="home-heading" {...reveal}>
            <span className="section-tag">04 — FAQ</span>
            <h2>Yang biasanya ditanyakan.</h2>
          </motion.header>
          <motion.div className="faq" {...reveal}>
            {faqs.map(([question, answer]) => <FaqItem key={question} question={question} answer={answer} />)}
          </motion.div>
        </section>

        {/* ─── CTA ──────────────────────────────────────────────────── */}
        <section className="shell-width">
          <motion.div className="home-cta" {...reveal}>
            <motion.div className="cta-arrow" aria-hidden="true" animate={{ x: [0, 10, 0], y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <ArrowUpRight />
            </motion.div>
            <h2>Mulai dari ceritanya dulu.</h2>
            <p>Belum perlu bayar. Kirim kebutuhanmu, kami periksa dan kirim penawaran.</p>
            <div className="cta-buttons">
              <Link className="btn-lime" to="/pesan">Ajukan kebutuhan <ArrowUpRight /></Link>
              {config.whatsapp.configured && config.whatsapp.href && (
                <a className="btn-outline-dark" href={config.whatsapp.href} target="_blank" rel="noreferrer">
                  <MessageCircle /> Chat WhatsApp
                </a>
              )}
            </div>
          </motion.div>
        </section>
      </main>
    </PublicLayout>
  )
}
