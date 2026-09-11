import { useEffect, useState } from "react"
import { ArrowRight, Code2, LogIn, LogOut, PackageSearch, Sparkles } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { PublicLayout, StatusPill } from "../components/ui"
import { useOrderData } from "../data/OrderContext"
import { authClient } from "../lib/authClient"
import { rupiah, witaDate } from "../lib/format"
import { safeNextPath } from "../lib/navigation"

type ProviderConfig = { google: boolean; github: boolean }

export function LoginPage({ admin = false }: { admin?: boolean }) {
  const [params] = useSearchParams()
  const session = authClient.useSession()
  const [providers, setProviders] = useState<ProviderConfig>({ google: false, github: false })
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [error, setError] = useState("")
  const [signingIn, setSigningIn] = useState(false)
  const defaultNext = admin ? "/admin" : "/akun/pesanan"
  const callbackURL = safeNextPath(params.get("next"), defaultNext)

  useEffect(() => {
    fetch("/api/auth-config")
      .then((response) => {
        if (!response.ok) throw new Error("Konfigurasi login tidak tersedia.")
        return response.json()
      })
      .then((result) => {
        if (!result?.providers) throw new Error("Konfigurasi login tidak valid.")
        setProviders({ google: result.providers.google === true, github: result.providers.github === true })
      })
      .catch(() => setError("Konfigurasi login belum dapat diperiksa."))
      .finally(() => setLoadingConfig(false))
  }, [])

  const signIn = async (provider: "google" | "github") => {
    if (signingIn) return
    setError("")
    setSigningIn(true)
    try {
      const errorCallbackURL = `${admin ? "/admin/masuk" : "/masuk"}?error=oauth&next=${encodeURIComponent(callbackURL)}`
      const result = await authClient.signIn.social({ provider, callbackURL, errorCallbackURL })
      if (result.error) setError(result.error.message || "Login tidak dapat dimulai.")
    } catch {
      setError("Login belum dapat dimulai. Periksa koneksi lalu coba lagi.")
    } finally { setSigningIn(false) }
  }

  if (session.isPending) return <main className="app-state" aria-busy="true"><span className="state-spinner" /><p>Memeriksa sesi akun…</p></main>

  return (
    <PublicLayout>
      <main className="login-page shell-width">
        <section className="login-card">
          <span className="state-symbol"><LogIn /></span>
          <span className="eyebrow">{admin ? "AKSES ADMIN" : "AKUN PELANGGAN"}</span>
          {session.data?.user ? (
            <>
              <h1>Kamu sudah masuk.</h1>
              <p>{admin ? `Lanjutkan ke workspace menggunakan ${session.data.user.email}. Server tetap memeriksa allowlist admin.` : `Pesanan yang dibuat dengan akun ini (${session.data.user.email}) tersedia di menu Pesanan Saya.`}</p>
              <div className="login-actions">
                <Link className="button" to={callbackURL}>{admin ? "Buka workspace admin" : callbackURL === defaultNext ? "Buka Pesanan Saya" : "Lanjutkan"} <ArrowRight /></Link>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={async () => {
                    await authClient.signOut()
                    window.location.href = admin ? "/admin/masuk" : "/masuk"
                  }}
                >
                  Keluar <LogOut />
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>{admin ? "Masuk ke workspace Techrey." : "Masuk untuk menyimpan riwayat pesanan."}</h1>
              <p>{admin ? "Gunakan akun Google atau GitHub yang emailnya tercantum di ADMIN_EMAILS. Pelanggan tidak dapat membuka workspace ini." : "Pilih akun Google atau GitHub. Techrey hanya meminta identitas dasar untuk menghubungkan pesanan dengan akunmu."}</p>
              {(error || params.has("error")) && <div className="form-error" role="alert">{error || "Login belum berhasil. Coba masuk kembali dengan akun Google atau GitHub."}</div>}
              <div className="login-actions social-actions">
                <button className="button social-button" disabled={signingIn || loadingConfig || !providers.google} onClick={() => void signIn("google")}><span className="google-mark">G</span> Masuk dengan Google</button>
                <button className="button button-dark social-button" disabled={signingIn || loadingConfig || !providers.github} onClick={() => void signIn("github")}><Code2 /> Masuk dengan GitHub</button>
              </div>
              {!loadingConfig && !providers.google && !providers.github && <div className="info-notice"><LogIn /><p><strong>OAuth belum dikonfigurasi.</strong> Isi kredensial Google atau GitHub pada <code>app/.env</code>, lalu mulai ulang server. Login tidak akan tersedia sebelum konfigurasi valid.</p></div>}
              <p className="auth-footnote">Tidak ada login email/password. Akses menggunakan identitas Google atau GitHub.</p>
              {!admin && <Link className="separate-admin-link" to="/admin/masuk">Masuk sebagai admin</Link>}
            </>
          )}
        </section>
      </main>
    </PublicLayout>
  )
}

export function AdminLoginPage() {
  return <LoginPage admin />
}

export function AccountOrdersPage() {
  const session = authClient.useSession()
  const { orders } = useOrderData()

  const handleSignOut = async () => {
    await authClient.signOut()
    window.location.href = "/"
  }

  if (session.isPending) return <main className="app-state" aria-busy="true"><span className="state-spinner" /><p>Memuat akun…</p></main>
  if (!session.data?.user) return <PublicLayout><main className="empty-page shell-width"><span className="state-symbol"><LogIn /></span><h1>Masuk untuk melihat pesananmu.</h1><p>Setiap akun hanya dapat mengambil pesanan yang terhubung dengannya.</p><Link className="button" to="/masuk?next=/akun/pesanan">Masuk dengan Google atau GitHub</Link></main></PublicLayout>

  return (
    <PublicLayout>
      <main className="account-orders shell-width">
        <header className="account-heading">
          <div>
            <span className="eyebrow">PESANAN SAYA</span>
            <h1>Halo, {session.data.user.name || session.data.user.email?.split("@")[0] || "Pelanggan"}.</h1>
            <p>Semua kebutuhan yang diajukan dengan akun ini ({session.data.user.email}) tersimpan di sini.</p>
          </div>
          <div className="account-heading-actions">
            <Link className="button" to="/pesan">Buat pesanan <ArrowRight /></Link>
            <button type="button" className="button button-ghost" onClick={() => void handleSignOut()}>
              Keluar <LogOut />
            </button>
          </div>
        </header>
        {orders.length ? (
          <div className="account-order-grid">
            {orders.map((order) => {
              const needsAttention = ["menunggu-persetujuan", "hasil-dikirim", "menunggu-pembayaran", "perlu-informasi"].includes(order.status)
              return (
                <Link className={`account-order-card${needsAttention ? " has-notification" : ""}`} to={`/akun/pesanan/${order.id}`} key={order.id}>
                  <div>
                    <small>{order.id} · {order.service}</small>
                    <h2>{order.title}</h2>
                    <p>Tenggat {witaDate(order.deadline)}</p>
                    {needsAttention && (
                      <span className="order-notification-badge">
                        <Sparkles style={{ width: 12, height: 12 }} />
                        {order.status === "menunggu-persetujuan"
                          ? "Penawaran Masuk — Periksa Sekarang"
                          : order.status === "hasil-dikirim"
                          ? "Hasil Selesai — Siap Diunduh"
                          : order.status === "menunggu-pembayaran"
                          ? "Menunggu Pembayaran"
                          : "Perlu Tanggapan Info"}
                      </span>
                    )}
                  </div>
                  <div>
                    <StatusPill status={order.status} />
                    <strong>{rupiah(order.offers.at(-1)?.amount)}</strong>
                    <ArrowRight />
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <section className="panel account-empty">
            <PackageSearch />
            <h2>Belum ada pesanan.</h2>
            <p>Setelah kebutuhan diajukan, status dan penawarannya akan muncul di halaman ini.</p>
            <Link className="button" to="/pesan">Ajukan kebutuhan pertama</Link>
          </section>
        )}
      </main>
    </PublicLayout>
  )
}
