import { lazy, Suspense, useEffect } from "react"
import { Route, Routes, useLocation } from "react-router"
import { MotionConfig } from "motion/react"
import { PublicLayout, ToastRegion } from "./components/ui"
import { HomePage } from "./pages/HomePage"
import { OrderFormPage } from "./pages/OrderFormPage"
import { CustomerOrderPage } from "./pages/CustomerOrderPage"
import { AccountOrdersPage, AdminLoginPage, LoginPage } from "./pages/AuthPages"
import { WebMcpTools } from "./components/WebMcpTools"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { FloatingWhatsApp } from "./components/FloatingWhatsApp"

const AdminPages = {
  Layout: lazy(() => import("./pages/admin/AdminPages").then((module) => ({ default: module.AdminLayout }))),
  Dashboard: lazy(() => import("./pages/admin/AdminPages").then((module) => ({ default: module.AdminDashboard }))),
  Orders: lazy(() => import("./pages/admin/AdminPages").then((module) => ({ default: module.AdminOrdersPage }))),
  Detail: lazy(() => import("./pages/admin/AdminPages").then((module) => ({ default: module.AdminOrderDetailPage }))),
}

function RouteEffects() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: "instant" })
    const titles: Record<string, string> = {
      "/": "Techrey Digital — kebutuhan digital yang dirapikan",
      "/pesan": "Ajukan kebutuhan — Techrey Digital",
      "/masuk": "Masuk — Techrey Digital",
      "/admin/masuk": "Masuk admin — Techrey Digital",
      "/akun/pesanan": "Pesanan Saya — Techrey Digital",
      "/admin": "Admin — Techrey Digital",
    }
    document.title = titles[pathname] ?? (pathname.startsWith("/akun/pesanan/") ? "Status pesanan — Techrey Digital" : pathname.startsWith("/admin") ? "Workspace admin — Techrey Digital" : "Techrey Digital")
  }, [hash, pathname])
  return null
}

function AdminFallback() {
  return <main className="app-state admin-loading" aria-busy="true"><span className="state-spinner" /><p>Memuat workspace ringan…</p></main>
}

function NotFound() {
  return <PublicLayout><main className="empty-page shell-width"><span className="state-symbol">404</span><h1>Halaman ini tidak ada.</h1><p>Kembali ke beranda atau buka daftar pesananmu.</p><a className="button" href="/">Kembali ke beranda</a></main></PublicLayout>
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouteEffects />
      <WebMcpTools />
      <ErrorBoundary>
        <Suspense fallback={<AdminFallback />}>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="pesan" element={<OrderFormPage />} />
            <Route path="masuk" element={<LoginPage />} />
            <Route path="admin/masuk" element={<AdminLoginPage />} />
            <Route path="akun/pesanan" element={<AccountOrdersPage />} />
            <Route path="akun/pesanan/:accountId" element={<CustomerOrderPage />} />
            <Route path="admin" element={<AdminPages.Layout />}>
              <Route index element={<AdminPages.Dashboard />} />
              <Route path="pesanan" element={<AdminPages.Orders key="orders" />} />
              <Route path="pesanan/:id" element={<AdminPages.Detail />} />
              <Route path="pembayaran" element={<AdminPages.Orders key="payments" paymentsOnly />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <ToastRegion />
      <FloatingWhatsApp />
    </MotionConfig>
  )
}
