import { useEffect } from "react"
import { Link, useLocation } from "react-router"
import { motion } from "motion/react"
import { ArrowDownRight, ArrowUpRight, Braces, Check, FileText, MessageCircle, Presentation, Sparkles } from "lucide-react"
import { HeroExperience } from "../components/HeroExperience"
import { PublicLayout } from "../components/ui"
import { SERVICES, type ServiceName } from "../data/types"
import { usePublicConfig } from "../lib/publicConfig"

const serviceContent: Record<ServiceName, { icon: typeof FileText; title: string; body: string; note: string; price: string }> = {
  "Dokumen & Penulisan": { icon: FileText, title: "Dokumen & Penulisan", body: "Ketik ulang, edit bahasa, rapikan makalah atau laporan, sampai daftar pustaka.", note: "Biar enak dibaca", price: "Mulai Rp25rb" },
  "PPT & Presentasi": { icon: Presentation, title: "PPT & Presentasi", body: "Ubah materi yang kamu punya menjadi slide yang runtut, jelas, dan nyaman dipresentasikan.", note: "Biar ceritanya nyambung", price: "Mulai Rp50rb" },
  "Coding & Website": { icon: Braces, title: "Coding & Website", body: "Website usaha atau portofolio, perbaikan error, fitur tambahan, dan penjelasan kode.", note: "Biar idenya jalan", price: "Menyesuaikan fitur" },
  "Bantuan & Review Tugas": { icon: Check, title: "Bantuan & Review Tugas", body: "Bahas soal, periksa jawaban, dan pahami materi atau kode tanpa mengambil alih tanggung jawabmu.", note: "Biar makin paham", price: "Mulai Rp30rb" },
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
            <div className="hero-status-pill">
              <span className="pulse-dot" /> PARTNER KEBUTUHAN DIGITAL · WITA
            </div>
            <h1>Yang masih berantakan,<br /><span className="hero-highlight">kita rapikan.</span></h1>
            <p>Dokumen akademis, presentasi teknis, perbaikan coding, sampai website usaha—ceritakan kebutuhanmu. Spesifikasi dan harga disepakati dulu sebelum pengerjaan dimulai.</p>
            <div className="hero-actions">
              <Link className="button button-glow" to="/pesan">Ceritakan kebutuhanmu <ArrowUpRight /></Link>
              <a className="button-pill-secondary" href="#portofolio">Lihat studi kasus <ArrowDownRight /></a>
            </div>
            <div className="hero-notes">
              <span><Check /> 100% Harga disepakati di awal</span>
              <span><Check /> {config.qris.configured ? "QRIS merchant resmi" : "Pembayaran aman via QRIS"}</span>
              <span><Check /> Privasi berkas terjamin</span>
            </div>
          </motion.div>
          <motion.div className="hero-stage" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.12 }}>
            <div className="os-window-bar">
              <div className="os-dots"><i /><i /><i /></div>
              <span>workspace-3d.app</span>
              <span className="os-badge-live">INTERACTIVE</span>
            </div>
            <span className="stage-note">geser kursor / sentuh</span>
            <HeroExperience />
            <span className="stage-caption"><Sparkles /> DIGITAL Techrey</span>
          </motion.div>
        </section>

        {/* ─── STUDIO MANIFESTO (PETTA DESAIN STYLE) ───────────────────── */}
        <section className="intro-manifesto shell-width">
          <div className="manifesto-grid">
            <div className="manifesto-left">
              <span className="eyebrow">TECHREY DIGITAL · WITA</span>
              <p className="manifesto-sub">Presisi Teknis · Kerahasiaan Terjamin · Akuntabel</p>
            </div>
            <div className="manifesto-right">
              <h2>Studio pengerjaan dan perapian digital terpercaya untuk kebutuhan akademis, materi presentasi profesional, serta website usaha.</h2>
              <div className="manifesto-cols">
                <p>
                  Setiap pekerjaan diawali dengan penelaahan brief yang teliti. Ruang lingkup, tenggat waktu WITA, dan nominal biaya disepakati di awal secara transparan tanpa biaya tersembunyi.
                </p>
                <p>
                  Menerapkan standar penyusunan rapi, tata bahasa baku, susunan kode bersih, serta visual presentasi yang komunikatif untuk hasil siap pakai.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-label="Daftar layanan"><div>{["DOKUMEN", "PRESENTASI", "CODING", "WEBSITE", "REVIEW TUGAS"].map((item) => <span key={item}>{item}<Sparkles /></span>)}</div></div>

        <section className="content-section shell-width" id="layanan">
          <motion.div className="section-heading" {...reveal}>
            <div><span className="eyebrow">01 / YANG BISA DIBANTU</span><h2>Satu pintu untuk empat jenis kebutuhan.</h2></div>
            <p>Pilih yang paling dekat dengan kebutuhanmu. Rincian penawaran dibuat setelah materi brief kamu periksa bersama.</p>
          </motion.div>
          <div className="service-grid">
            {SERVICES.map((service, index) => {
              const item = serviceContent[service]
              const Icon = item.icon
              return (
                <motion.article className={`service-card service-card-${index + 1}`} key={service} {...reveal} transition={{ duration: 0.45, delay: index * 0.06 }}>
                  <div className="card-top"><span>0{index + 1}</span><Icon /></div>
                  <span className="price-badge">{item.price}</span>
                  <h3>{item.title}</h3><p>{item.body}</p>
                  <Link to={`/pesan?layanan=${encodeURIComponent(service)}`}>{item.note} <ArrowUpRight /></Link>
                </motion.article>
              )
            })}
          </div>
          <p className="academic-note">Untuk tugas yang dinilai, bantuan berupa pembahasan, review, dan penyuntingan. Kamu tetap penulis dan penanggung jawab tugasmu.</p>
        </section>

        {/* ─── REAL CLIENT PROJECT PROOF (STUDI KASUS PROYEK NYATA) ─────── */}
        <section className="client-proof-section shell-width" id="portofolio">
          <motion.div className="section-heading" {...reveal}>
            <div>
              <span className="eyebrow eyebrow-verified">02 / STUDI KASUS KLIEN</span>
              <h2>Hasil pengerjaan website klien yang sudah selesai & aktif.</h2>
            </div>
            <p>Studi kasus nyata Techrey Digital: dari brief kebutuhan, pengerjaan tepat waktu, hingga online dan disetujui tanpa biaya tambahan.</p>
          </motion.div>

          <motion.article className="proof-card" {...reveal}>
            <div className="proof-card-grid">
              <div className="proof-info">
                <div className="proof-tag-row">
                  <span className="proof-badge-verified">✓ PROYEK KLIEN SELESAI</span>
                  <span className="proof-category-tag">WEBSITE & KATALOG UMKM</span>
                </div>

                <h3>Aroma Nusa Coffee & Roastery</h3>
                <p className="proof-desc">
                  Klien memerlukan landing page estetik untuk profil kedai, katalog menu digital yang cepat dibuka di HP, serta tombol pesan langsung via WhatsApp tanpa perlu repot komisi aplikasi ojek online.
                </p>

                <div className="proof-metrics-grid">
                  <div className="metric-box">
                    <small>Waktu Pengerjaan</small>
                    <strong>3 Hari Kerja</strong>
                  </div>
                  <div className="metric-box">
                    <small>Status Proyek</small>
                    <strong className="status-success-tag">✓ Rilis & Digunakan</strong>
                  </div>
                  <div className="metric-box">
                    <small>Biaya Kesepakatan</small>
                    <strong>Rp350.000 (Tetap)</strong>
                  </div>
                  <div className="metric-box">
                    <small>Mobile Speed</small>
                    <strong>99 / 100 (Ringan)</strong>
                  </div>
                </div>

                <div className="proof-deliverables">
                  <span><Check /> Desain antarmuka modern responsif (HP & Desktop)</span>
                  <span><Check /> Menu interaktif kategori (Kopi, Non-Kopi, Pastry)</span>
                  <span><Check /> Integrasi direct WhatsApp order dengan format otomatis</span>
                  <span><Check /> Bantuan hosting & panduan update berkala</span>
                </div>

                <div className="proof-testimonial">
                  <div className="testimonial-stars">★★★★★</div>
                  <p>"Hasilnya rapi banget dan cepat. Pelanggan buka link di bio IG langsung gampang milih menu dan pesannya nyambung ke WA. Komunikasi lancar dari awal sampai jadi."</p>
                  <small>— Klien UMKM Kuliner, Balikpapan (WITA)</small>
                </div>
              </div>

              <div className="proof-mockup-wrapper">
                <div className="os-window-frame">
                  <div className="os-window-bar">
                    <div className="os-dots"><i /><i /><i /></div>
                    <div className="browser-url-pill">
                      <span>🔒</span> aromanusa-coffee.id
                    </div>
                    <span className="os-live-pill">● LIVE PREVIEW</span>
                  </div>
                  
                  {/* Visual preview of the completed client web */}
                  <div className="mockup-screen">
                    <div className="mockup-nav">
                      <b>AROMA NUSA.</b>
                      <div className="mockup-nav-links">
                        <span>Menu</span>
                        <span>Lokasi</span>
                        <span className="mockup-wa-btn">Order WA</span>
                      </div>
                    </div>
                    <div className="mockup-hero">
                      <span className="mockup-pill">ARTISAN COFFEE ROAST</span>
                      <h4>Secangkir Kopi Jujur, Teman Cerita Setiap Hari.</h4>
                      <p>Dipanggang segar setiap minggu di Balikpapan untuk rasa otentik yang membumi.</p>
                    </div>
                    <div className="mockup-menu">
                      <div className="mockup-menu-heading">
                        <span>MENU ANDALAN KEDAI</span>
                        <small>Freshly Brewed</small>
                      </div>
                      <div className="mockup-items">
                        <div className="mockup-item">
                          <span className="mockup-item-tag">FAVORIT</span>
                          <strong>Aren Cream Latte</strong>
                          <div className="mockup-item-foot">
                            <span>Rp22.000</span>
                            <span className="mockup-order-badge">+ Pesan</span>
                          </div>
                        </div>
                        <div className="mockup-item">
                          <strong>Kyoto Matcha Cloud</strong>
                          <div className="mockup-item-foot">
                            <span>Rp25.000</span>
                            <span className="mockup-order-badge">+ Pesan</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mockup-footer">
                      <span>📍 Jl. MT Haryono, Balikpapan · Buka Setiap Hari</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.article>
        </section>

        {/* ─── EXPLORATION & CAPABILITY SAMPLES ─────────────────────────── */}
        <section className="work-section" id="karya">
          <div className="content-section shell-width">
            <motion.div className="section-heading section-heading-light" {...reveal}>
              <div><span className="eyebrow">03 / CONTOH EKSPLORASI FORMAT LAIN</span><h2>Presentasi, dokumen terstruktur, dan review kode.</h2></div>
              <p>Selain website, ini contoh kerapian teknis untuk pengerjaan materi kuliah dan tugas akademis.</p>
            </motion.div>
            <div className="work-grid work-grid-4">
              <motion.article className="work-sample sample-slides" {...reveal}>
                <div className="os-window-bar"><div className="os-dots"><i /><i /><i /></div><span>presentasi.pptx</span></div>
                <div className="sample-badge">CONTOH PPT</div>
                <div className="slide-sheet"><small>RUANG TUMBUH / 2026</small><h3>Small steps.<br />Big impact.</h3><span>STRATEGI KOMUNIKASI <b>01—12</b></span></div>
                <footer><strong>Presentasi yang punya alur</strong><span>Materi → narasi → visual</span></footer>
              </motion.article>
              <motion.article className="work-sample sample-site" {...reveal}>
                <div className="os-window-bar"><div className="os-dots"><i /><i /><i /></div><span>index.html</span></div>
                <div className="sample-badge">CONTOH WEB MINIMALIS</div>
                <div className="site-sheet"><nav><b>forma.</b><span>Studio&nbsp;&nbsp; Work&nbsp;&nbsp; Contact</span></nav><small>INDEPENDENT DESIGN STUDIO</small><h3>Spaces for<br />better living.</h3><span>Explore the studio <ArrowUpRight /></span></div>
                <footer><strong>Website dengan karakter</strong><span>Rapi di layar besar dan HP</span></footer>
              </motion.article>
              <motion.article className="work-sample sample-doc" {...reveal}>
                <div className="os-window-bar"><div className="os-dots"><i /><i /><i /></div><span>laporan.docx</span></div>
                <div className="sample-badge">CONTOH DOKUMEN</div>
                <div className="doc-sheet">
                  <div className="doc-header"><strong>BAB III — METODOLOGI</strong></div>
                  <div className="doc-line doc-line-full" />
                  <div className="doc-line doc-line-full" />
                  <div className="doc-line doc-line-mid" />
                  <div className="doc-spacer" />
                  <div className="doc-line doc-line-full" />
                  <div className="doc-line doc-line-full" />
                  <div className="doc-line doc-line-short" />
                  <div className="doc-spacer" />
                  <div className="doc-ref-header"><strong>Daftar Pustaka</strong></div>
                  <div className="doc-ref-item"><span>[1]</span><div className="doc-line doc-line-full" /></div>
                  <div className="doc-ref-item"><span>[2]</span><div className="doc-line doc-line-mid" /></div>
                </div>
                <footer><strong>Format presisi</strong><span>Margin → Sitasi → Daftar Pustaka</span></footer>
              </motion.article>
              <motion.article className="work-sample sample-code" {...reveal}>
                <div className="os-window-bar"><div className="os-dots"><i /><i /><i /></div><span>review.jsx</span></div>
                <div className="sample-badge">CONTOH REVIEW & CODING</div>
                <div className="code-sheet">
                  <code>
                    <span className="code-kw">function</span> <span className="code-fn">hitungTotal</span>(items) {"{"}<br />
                    &nbsp;&nbsp;<span className="code-kw">let</span> total = <span className="code-num">0</span>;<br />
                    &nbsp;&nbsp;<span className="code-kw">for</span> (<span className="code-kw">let</span> i <span className="code-kw">of</span> items) {"{"}<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;total += i.harga * i.qty;<br />
                    &nbsp;&nbsp;{"}"}<br />
                    &nbsp;&nbsp;<span className="code-kw">return</span> total;<br />
                    {"}"}
                  </code>
                </div>
                <div className="code-review-note">
                  <strong>✓ Review</strong>
                  <span>Fungsi sudah benar. Tambahkan validasi <code>items</code> agar tidak error saat array kosong.</span>
                </div>
                <footer><strong>Kode & pembahasan jelas</strong><span>Bug fix → Penjelasan alur</span></footer>
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
              ["Bayarnya pakai apa?", config.qris.configured ? "Pembayaran melalui QRIS merchant. QR hanya muncul pada akun pelanggan setelah penawaran disetujui." : "Pembayaran dilakukan melalui QRIS atau transfer resmi yang otomatis muncul di halaman pesananmu setelah penawaran harga kamu setujui."],
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
