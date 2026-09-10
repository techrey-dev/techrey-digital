import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react"
import fallbackImage from "../assets/hero.webp"

const LazyHeroScene = lazy(() => import("./HeroScene").then((module) => ({ default: module.HeroSceneCanvas })))

function canRenderWebGL() {
  try {
    const canvas = document.createElement("canvas")
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")))
  } catch {
    return false
  }
}

function Fallback() {
  return <img className="hero-fallback" src={fallbackImage} alt="Ilustrasi perangkat kerja digital untuk dokumen, presentasi, dan coding" />
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Fallback /> : this.props.children }
}

export function HeroExperience() {
  const webgl = useMemo(() => canRenderWebGL(), [])
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 760px)").matches)
  const preferLite = window.matchMedia("(prefers-reduced-motion: reduce)").matches || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)")
    const update = () => setCompact(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  if (!webgl || preferLite) return <Fallback />
  return (
    <SceneErrorBoundary>
      <Suspense fallback={<div className="scene-loading" aria-label="Memuat objek 3D"><span className="state-spinner" /><span>Menyiapkan meja digital…</span></div>}>
        <LazyHeroScene compact={compact} />
      </Suspense>
    </SceneErrorBoundary>
  )
}
