import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { orderRepository } from "./orderRepository"
import { OrderContext } from "./OrderContext"
import { authClient } from "../lib/authClient"

export function OrderProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const snapshot = useSyncExternalStore(orderRepository.subscribe, orderRepository.getSnapshot)
  const session = authClient.useSession()

  const userId = session.data?.user?.id

  useEffect(() => {
    if (pathname.startsWith("/akun/pesanan") && userId) void orderRepository.loadAccountOrders(userId)
    else if (pathname.startsWith("/akun/pesanan")) orderRepository.prepareEmpty()
    else if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/masuk") && userId) void orderRepository.loadAdmin(userId)
    else if (pathname.startsWith("/admin")) orderRepository.prepareEmpty()
    else orderRepository.prepareEmpty()
  }, [pathname, userId])

  useEffect(() => {
    if (!userId) return
    const isAccount = pathname.startsWith("/akun/pesanan")
    const isAdmin = pathname.startsWith("/admin") && !pathname.startsWith("/admin/masuk")
    if (!isAccount && !isAdmin) return
    let pending = false
    const refresh = async () => {
      if (document.visibilityState === "hidden" || pending) return
      pending = true
      try {
        if (isAccount) await orderRepository.refreshAccountOrders(userId)
        else await orderRepository.refreshAdminOrders(userId)
      } finally { pending = false }
    }
    const timer = window.setInterval(() => void refresh(), 12_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [pathname, userId])

  const runAction = async (action: () => void | Promise<void>) => {
    try {
      await action()
      return true
    } catch (error) {
      window.dispatchEvent(new CustomEvent("techrey-error", { detail: orderRepository.errorMessage(error) }))
      return false
    }
  }

  if (snapshot.loading || (pathname.startsWith("/akun/") && session.isPending)) {
    return <main className="app-state" aria-busy="true"><span className="state-spinner" /><p>Memuat data pesanan…</p></main>
  }

  if (snapshot.error) {
    const retry = () => {
      if (pathname.startsWith("/akun/")) void orderRepository.loadAccountOrders(userId, true)
      else void orderRepository.loadAdmin(userId, true)
    }
    return (
      <main className="app-state">
        <span className="state-symbol">!</span>
        <h1>Data belum bisa dibuka.</h1>
        <p>{snapshot.error}</p>
        <div style={{ display: "flex", gap: "12px", marginTop: "18px", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="button" onClick={retry}>Coba lagi</button>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => void authClient.signOut().then(() => { window.location.href = "/masuk" })}
          >
            Ganti Akun / Keluar
          </button>
          <Link className="button button-ghost" to="/">Kembali ke Beranda</Link>
        </div>
      </main>
    )
  }

  return <OrderContext.Provider value={{ repository: orderRepository, runAction }}>{children}</OrderContext.Provider>
}
