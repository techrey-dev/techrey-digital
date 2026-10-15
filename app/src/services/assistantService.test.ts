import { describe, expect, it, vi } from "vitest"
import type { Order } from "../data/types"
import { assistantService, buildChatGptPrompt, parseAssistantDraft } from "./assistantService"

const sampleOrder: Order = {
  id: "TRY-001", customerName: "Test User", whatsapp: "081234567890",
  service: "PPT & Presentasi", purpose: "Kuliah", title: "Slide presentasi proposal PKM",
  brief: "Proposal PKM dengan lima bab. Belum ada desain visual, referensi sumber sudah lengkap di dokumen Word.",
  deadline: new Date(Date.now() + 7 * 86400000).toISOString(), timezone: "Asia/Makassar",
  status: "diajukan", createdAt: new Date().toISOString(),
  files: [], offers: [], payments: [], revisions: [], messages: [],
  events: [{ id: "ev-001", actor: "pelanggan", action: "Kebutuhan diajukan.", timestamp: new Date().toISOString() }],
}

describe("assistantService", () => {
  it("memanggil endpoint AI server tanpa mengubah pesanan", async () => {
    const original = structuredClone(sampleOrder)
    const draft = { summary: original.title, missingInformation: [], scopeDraft: "Lingkup pekerjaan", deliverablesDraft: ["PPTX"], replyDraft: "Draf", checklist: ["Periksa"] }
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ draft }), { status: 200, headers: { "Content-Type": "application/json" } }))
    const result = await assistantService.analyzeOrder(original)

    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/orders/${original.id}/assistant`, expect.objectContaining({ method: "POST" }))
    expect(result).toEqual(draft)
    expect(original.offers).toHaveLength(0)
    fetchMock.mockRestore()
  })

  it("membuat prompt ChatGPT tanpa identitas pribadi pelanggan", () => {
    const prompt = buildChatGptPrompt(sampleOrder)
    expect(prompt).toContain(sampleOrder.title)
    expect(prompt).not.toContain(sampleOrder.customerName)
    expect(prompt).not.toContain(sampleOrder.whatsapp)
  })

  it("menerima JSON ChatGPT, termasuk yang dibungkus code fence", () => {
    const draft = { summary: "Ringkas", missingInformation: [], scopeDraft: "Lingkup", deliverablesDraft: ["PPTX"], replyDraft: "Balasan", checklist: ["Periksa brief"] }
    expect(parseAssistantDraft(`\`\`\`json\n${JSON.stringify(draft)}\n\`\`\``)).toEqual(draft)
    expect(() => parseAssistantDraft('{"summary":"kurang"}')).toThrow("belum sesuai format")
  })
})
