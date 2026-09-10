import { useEffect } from "react"
import { useNavigate } from "react-router"
import { SERVICES, type ServiceName } from "../data/types"

type ToolRegistration = {
  name: string
  title: string
  description: string
  inputSchema: object
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }
  execute: (input: unknown) => unknown
}

type ModelContext = {
  registerTool: (tool: ToolRegistration, options?: { signal?: AbortSignal }) => void | Promise<void>
}

declare global {
  interface Document { readonly modelContext?: ModelContext }
}

export function WebMcpTools() {
  const navigate = useNavigate()

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()

    const registration = context.registerTool({
      name: "start_techrey_order",
      title: "Mulai formulir pesanan Techrey",
      description: "Membuka langkah pertama formulir pesanan untuk layanan yang dipilih. Belum membuat pesanan, mengirim data, atau melakukan pembayaran.",
      inputSchema: {
        type: "object",
        properties: { service: { type: "string", enum: SERVICES } },
        required: ["service"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const service = (input as { service?: unknown } | null)?.service
        if (typeof service !== "string" || !SERVICES.includes(service as ServiceName)) {
          throw new Error("Layanan tidak tersedia.")
        }
        navigate(`/pesan?layanan=${encodeURIComponent(service)}`)
        return { view: "order-draft", service, submitted: false }
      },
    }, { signal: lifecycle.signal })

    void Promise.resolve(registration).catch(() => undefined)
    return () => lifecycle.abort()
  }, [navigate])

  return null
}
