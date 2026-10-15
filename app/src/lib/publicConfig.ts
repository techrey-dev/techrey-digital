import { useEffect, useState } from "react"

export type PublicConfig = {
  whatsapp: { configured: boolean; href?: string; number?: string }
  qris: { configured: boolean }
  ai: { configured: boolean }
}

const emptyConfig: PublicConfig = {
  whatsapp: { configured: false },
  qris: { configured: false },
  ai: { configured: false },
}

let cached: PublicConfig | undefined
let pending: Promise<PublicConfig> | undefined

async function loadPublicConfig() {
  if (cached) return cached
  if (!pending) {
    pending = fetch("/api/public-config")
      .then(async (response) => {
        if (!response.ok) throw new Error("Konfigurasi publik tidak tersedia.")
        return response.json() as Promise<PublicConfig>
      })
      .then((value) => {
        cached = value
        return value
      })
      .finally(() => { pending = undefined })
  }
  return pending
}

export function usePublicConfig() {
  const [config, setConfig] = useState(cached ?? emptyConfig)

  useEffect(() => {
    let active = true
    void loadPublicConfig().then((value) => { if (active) setConfig(value) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  return config
}
