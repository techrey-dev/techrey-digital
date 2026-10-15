import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertCircle, ArrowLeft, RefreshCcw } from "lucide-react"
import { PublicLayout } from "./ui"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Techrey unhandled render error:", error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <PublicLayout>
          <main className="empty-page shell-width">
            <span className="state-symbol" style={{ color: "var(--accent)" }}>
              <AlertCircle style={{ width: "40px", height: "40px" }} />
            </span>
            <h1>Terjadi kendala saat memuat halaman.</h1>
            <p>
              {this.state.error?.message || "Halaman tidak dapat ditampilkan dengan benar."}
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" className="button" onClick={this.handleReload}>
                <RefreshCcw /> Muat ulang halaman
              </button>
              <a className="button button-ghost" href="/akun/pesanan">
                <ArrowLeft /> Kembali ke Pesanan Saya
              </a>
              <a className="button button-ghost" href="/">
                Ke Beranda
              </a>
            </div>
          </main>
        </PublicLayout>
      )
    }

    return this.props.children
  }
}
