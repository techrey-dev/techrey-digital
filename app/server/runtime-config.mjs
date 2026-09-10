import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
try {
  loadEnvFile(join(root, ".env"))
} catch (error) {
  if (error?.code !== "ENOENT") throw error
}

const whatsappNumber = (process.env.WHATSAPP_NUMBER || "6285198262541").replace(/\D/g, "")
const qrisImagePath = process.env.QRIS_IMAGE_PATH ? resolve(root, process.env.QRIS_IMAGE_PATH) : ""
const qrisExtension = extname(qrisImagePath).toLowerCase()

export const whatsappConfig = whatsappNumber.length >= 10
  ? {
      configured: true,
      number: whatsappNumber,
      href: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Halo Techrey Digital, saya ingin berkonsultasi mengenai kebutuhan digital.")}`,
    }
  : { configured: false }

export const qrisConfig = {
  configured: Boolean(
    (qrisImagePath && existsSync(qrisImagePath) && (process.env.QRIS_MERCHANT_NAME || "").trim() && [".png", ".jpg", ".jpeg", ".webp"].includes(qrisExtension)) ||
    (Boolean(process.env.QRIS_BLOB_URL) && (process.env.QRIS_MERCHANT_NAME || "").trim())
  ),
  imagePath: qrisImagePath,
  contentType: qrisExtension === ".png" ? "image/png" : qrisExtension === ".webp" ? "image/webp" : "image/jpeg",
  merchantName: (process.env.QRIS_MERCHANT_NAME || "").trim(),
  // Vercel Blob URL for QRIS image (if stored in Blob)
  blobUrl: process.env.QRIS_BLOB_URL || "",
}

// AI config — supports OpenRouter (free Hermes) or OpenAI (paid)
const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY)
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY)

export const aiConfig = {
  configured: hasOpenRouter || hasOpenAI,
  provider: hasOpenRouter ? "openrouter" : "openai",
  model: hasOpenRouter
    ? (process.env.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b:free")
    : (process.env.OPENAI_MODEL || "gpt-4o"),
}

export function publicRuntimeConfig() {
  return {
    whatsapp: whatsappConfig,
    qris: { configured: qrisConfig.configured || Boolean(qrisConfig.blobUrl) },
    ai: { configured: aiConfig.configured },
  }
}
