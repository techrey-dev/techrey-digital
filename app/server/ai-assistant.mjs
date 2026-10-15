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

  const systemPrompt = `Anda adalah "Hermes Agent" — Asisten Analis Internal Khusus untuk Techrey Digital (https://techrey-digital.vercel.app/).
Tugas Anda adalah membedah brief pesanan klien dengan sangat cerdas, detail, dan realistis untuk membantu Admin menyiapkan penawaran resmi.

Keahlian Analisis 4 Layanan Techrey Digital:
1. Dokumen & Penulisan: Periksa estimasi halaman, bahan sumber, gaya format penulisan (margin, font, spasi), pedoman institusi, dan gaya sitasi/daftar pustaka (APA/IEEE/Harvard).
2. PPT & Presentasi: Periksa estimasi jumlah slide, tujuan presentasi (sidang skripsi/tugas/bisnis), materi mentah, dan gaya visual.
3. Coding & Website: Periksa bahasa pemrograman/framework (React/HTML/Node/Python/dll), fitur utama, target perangkat (responsif), perbaikan bug atau fitur baru.
4. Bantuan & Review Tugas: Identifikasi topik, materi yang perlu dijelaskan, pastikan prinsip etika bahwa klien tetap pemilik/penulis tugas.

Prinsip Hermes Agent:
- Jangan menentukan harga nominal (keputusan harga final tetap di tangan Admin).
- Jangan mengarang data yang tidak ada di brief. Jika ada hal krusial yang belum jelas, cantumkan di "missingInformation".
- Buat draf balasan WhatsApp yang sangat sopan, ramah, meyakinkan, dan siap dikirimkan Admin ke klien (gunakan sapaan "Kak" dan format WhatsApp *bold*).
- Buat draf lingkup kerja (scopeDraft) yang jelas untuk melindungi tim dari revisi di luar batas kesepakatan.`

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
  const candidateModels = [
    process.env.OPENROUTER_MODEL,
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
    "google/gemini-2.0-flash-exp:free",
  ].filter(Boolean)
  const uniqueModels = [...new Set(candidateModels)]

  let lastError = "Semua model sedang sibuk"
  for (const model of uniqueModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.BETTER_AUTH_URL || "https://techrey-digital.vercel.app",
          "X-Title": "Techrey Digital",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        lastError = body?.error?.message || `HTTP ${response.status}`
        console.warn(`[AI Hermes] Model ${model} gagal: ${lastError}. Mencoba alternatif...`)
        continue
      }

      const text = body?.choices?.[0]?.message?.content || ""
      if (!text.trim()) {
        lastError = "Respons AI kosong"
        continue
      }

      return parseAiResponse(text)
    } catch (err) {
      lastError = err?.message || String(err)
      console.warn(`[AI Hermes] Model ${model} timeout/error: ${lastError}. Mencoba alternatif...`)
    }
  }

  throw new DomainRuleError(`Layanan AI sedang padat: ${lastError}. Silakan coba lagi.`, 502)
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
  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1")
  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: String(parsed.summary || "Ringkasan brief pesanan."),
      missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation.map(String) : [],
      scopeDraft: String(parsed.scopeDraft || "Pengerjaan sesuai brief dan materi yang disepakati."),
      deliverablesDraft: Array.isArray(parsed.deliverablesDraft) && parsed.deliverablesDraft.length ? parsed.deliverablesDraft.map(String) : ["File hasil akhir proyek"],
      replyDraft: String(parsed.replyDraft || "Halo Kak, terima kasih sudah memesan di Techrey Digital. Pesanan sedang kami tinjau."),
      checklist: Array.isArray(parsed.checklist) && parsed.checklist.length ? parsed.checklist.map(String) : ["Periksa kesesuaian hasil dengan brief."],
    }
  } catch {
    throw new DomainRuleError("Respons AI tidak memiliki format yang diharapkan.", 502)
  }
}
