import { extname } from "node:path"
import { DomainRuleError } from "./domain.mjs"

const mimeTypes = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".zip": ["application/zip", "application/x-zip-compressed"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "application/vnd.ms-excel", "text/plain"],
}

export function validateUpload(originalName, mimeType, bytes) {
  let name
  try { name = decodeURIComponent(originalName) } catch { throw new DomainRuleError("Nama file tidak valid.") }
  // eslint-disable-next-line no-control-regex -- Reject control characters in filenames.
  // eslint-disable-next-line no-control-regex -- Reject control characters in filenames.
  if (typeof originalName !== "string" || !name.trim() || name.length > 200 || /[\\/\x00-\x1f\x7f]/.test(name)) throw new DomainRuleError("Nama file tidak valid atau terlalu panjang.")
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new DomainRuleError("File kosong atau isi upload tidak valid.")
  if (bytes.length > 10 * 1024 * 1024) throw new DomainRuleError("File maksimal 10 MB.", 413)
  const extension = extname(name).toLowerCase()
  const allowed = mimeTypes[extension]
  if (!allowed) throw new DomainRuleError("Jenis file tidak diizinkan. Gunakan PDF, DOC/DOCX, PPT/PPTX, ZIP, JPG, PNG, WEBP, TXT, atau CSV.")
  if (typeof mimeType !== "string" || (!allowed.includes(mimeType.toLowerCase()) && mimeType !== "application/octet-stream")) throw new DomainRuleError("Tipe file tidak cocok dengan ekstensi.")

  const starts = (hex) => bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, "hex"))
  let valid = false
  switch (extension) {
    case ".pdf": valid = starts("255044462d"); break
    case ".doc": case ".ppt": valid = starts("d0cf11e0a1b11ae1"); break
    case ".docx": case ".pptx": case ".zip":
      valid = starts("504b0304") || (extension === ".zip" && starts("504b0506"))
      break
    case ".jpg": case ".jpeg": valid = starts("ffd8ff"); break
    case ".png": valid = starts("89504e470d0a1a0a"); break
    case ".webp": valid = starts("52494646") && bytes.subarray(8, 12).toString("ascii") === "WEBP"; break
    case ".txt": case ".csv":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        // eslint-disable-next-line no-control-regex -- Reject binary control bytes while allowing tabs and newlines.
        // eslint-disable-next-line no-control-regex -- Reject binary control bytes while allowing tabs and newlines.
        valid = !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)
      } catch { valid = false }
      break
  }
  if (!valid) throw new DomainRuleError("Isi file tidak cocok dengan formatnya. TXT dan CSV harus menggunakan UTF-8.")
  return { originalName: name, mimeType: allowed[0], size: bytes.length }
}
