import type { Order } from "../data/types"

export type AssistantDraft = {
  summary: string
  missingInformation: string[]
  scopeDraft: string
  deliverablesDraft: string[]
  replyDraft: string
  checklist: string[]
}

export interface AssistantService {
  analyzeOrder(order: Order): Promise<AssistantDraft>
}

export function buildChatGptPrompt(order: Order) {
  const input = {
    service: order.service,
    purpose: order.purpose,
    title: order.title,
    brief: order.brief,
    deadline: order.deadline,
    budget: order.budget ?? null,
    referenceFiles: order.files
      .filter((file) => file.category === "reference")
      .map((file) => ({ name: file.originalName, size: file.size })),
  }
  return `Anda adalah asisten internal Techrey Digital. Analisis brief berikut dalam bahasa Indonesia yang natural. Jangan menentukan harga, jangan mengarang fakta, jangan mengklaim pesan sudah terkirim, dan pertahankan pelanggan sebagai penanggung jawab tugas akademik.

Kembalikan HANYA JSON valid tanpa markdown dengan bentuk:
{"summary":"...","missingInformation":["..."],"scopeDraft":"...","deliverablesDraft":["..."],"replyDraft":"...","checklist":["..."]}

Data pesanan (nama pelanggan, WhatsApp, dan isi file sengaja tidak disertakan):
${JSON.stringify(input, null, 2)}`
}

export function parseAssistantDraft(value: string): AssistantDraft {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const parsed = JSON.parse(cleaned) as Partial<AssistantDraft>
  if (
    typeof parsed.summary !== "string" || typeof parsed.scopeDraft !== "string" || typeof parsed.replyDraft !== "string" ||
    !Array.isArray(parsed.missingInformation) || !Array.isArray(parsed.deliverablesDraft) || !Array.isArray(parsed.checklist) ||
    !parsed.deliverablesDraft.length || !parsed.checklist.length ||
    [...parsed.missingInformation, ...parsed.deliverablesDraft, ...parsed.checklist].some((item) => typeof item !== "string")
  ) throw new Error("Hasil ChatGPT belum sesuai format yang diminta.")
  return parsed as AssistantDraft
}

class ServerAssistant implements AssistantService {
  async analyzeOrder(order: Order): Promise<AssistantDraft> {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || "Analisis AI tidak dapat diproses.")
    return body.draft as AssistantDraft
  }
}

export const assistantService: AssistantService = new ServerAssistant()
