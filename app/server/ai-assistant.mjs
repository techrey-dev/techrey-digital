import { aiConfig } from "./runtime-config.mjs"
import { DomainRuleError } from "./domain.mjs"

/**
 * Analyze an order using AI. Supports:
 * - OpenRouter (free Hermes models) when OPENROUTER_API_KEY is set
 * - OpenAI when OPENAI_API_KEY is set (legacy fallback)
 */
export async function analyzeOrderWithAi(order) {
  if (!aiConfig.configured) throw new DomainRuleError("AI belum dikonfigurasi pada server.", 503)

  const input = {
    service: order.service,
    purpose: order.purpose,
    title: order.title,
    brief: order.brief,
    deadline: order.deadline,
    budget: order.budget ?? null,
    referenceFiles: order.files.filter((file) => file.category === "reference").map((file) => ({ name: file.originalName, size: file.size })),
  }

  const systemPrompt = "Anda adalah asisten internal Techrey Digital. Analisis brief dalam bahasa Indonesia yang natural. Jangan menentukan harga, jangan mengarang fakta, jangan mengklaim pesan terkirim, dan pertahankan pelanggan sebagai penanggung jawab tugas akademik. Hasil hanya draf untuk diperiksa admin."

  const userPrompt = `Analisis brief pesanan berikut dan kembalikan HANYA JSON valid (tanpa markdown, tanpa backtick) dengan format:
{"summary":"...","missingInformation":["..."],"scopeDraft":"...","deliverablesDraft":["..."],"replyDraft":"...","checklist":["..."]}

Data pesanan (nama pelanggan, WhatsApp, dan isi file sengaja tidak disertakan):
${JSON.stringify(input, null, 2)}`

  if (aiConfig.provider === "openrouter") {
    return analyzeWithOpenRouter(systemPrompt, userPrompt)
  }
  return analyzeWithOpenAI(systemPrompt, userPrompt)
}

async function analyzeWithOpenRouter(systemPrompt, userPrompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://techrey.com",
      "X-Title": "Techrey Digital",
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = body?.error?.message || "Layanan AI sedang tidak dapat digunakan."
    throw new DomainRuleError(msg, 502)
  }

  const text = body?.choices?.[0]?.message?.content || ""
  return parseAiResponse(text)
}

async function analyzeWithOpenAI(systemPrompt, userPrompt) {
  const outputSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      missingInformation: { type: "array", items: { type: "string" }, maxItems: 8 },
      scopeDraft: { type: "string" },
      deliverablesDraft: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
      replyDraft: { type: "string" },
      checklist: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
    },
    required: ["summary", "missingInformation", "scopeDraft", "deliverablesDraft", "replyDraft", "checklist"],
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(35_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: aiConfig.model,
      store: false,
      instructions: systemPrompt,
      input: userPrompt,
      text: { format: { type: "json_schema", name: "techrey_order_analysis", strict: true, schema: outputSchema } },
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new DomainRuleError("Layanan AI sedang tidak dapat digunakan.", 502)

  let text = ""
  if (typeof body.output_text === "string") text = body.output_text
  else for (const item of body.output || []) {
    for (const content of item.content || []) if (content.type === "output_text" && typeof content.text === "string") { text = content.text; break }
  }

  return parseAiResponse(text)
}

function parseAiResponse(text) {
  let cleaned = text.trim()
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  } else {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0].trim()
    }
  }
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new DomainRuleError("Respons AI tidak memiliki format yang diharapkan.", 502)
  }
}
