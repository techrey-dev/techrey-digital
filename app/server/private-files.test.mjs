import { afterEach, describe, expect, it, vi } from "vitest"
import { validateUpload } from "./file-validation.mjs"

vi.mock("@vercel/blob", () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))
import { put, get } from "@vercel/blob"
import { storePrivateFile, readPrivateFile, fetchBlobBuffer } from "./private-files.mjs"

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe("validasi dan penyimpanan file privat", () => {
  it.each([
    ["hasil.pdf", "application/pdf", "%PDF-1.7\n"],
    ["catatan.txt", "text/plain", "Catatan pelanggan"],
    ["tabel.csv", "application/vnd.ms-excel", "nama,jumlah\ncontoh,1"],
  ])("menerima format yang diizinkan: %s", (name, mime, body) => {
    expect(validateUpload(name, mime, Buffer.from(body)).originalName).toBe(name)
  })

  it.each([
    ["gambar.png", "image/png", "89504e470d0a1a0a"],
    ["gambar.jpg", "image/jpeg", "ffd8ffe0"],
    ["gambar.webp", "image/webp", "524946460000000057454250"],
    ["dokumen.doc", "application/msword", "d0cf11e0a1b11ae1"],
    ["slide.ppt", "application/vnd.ms-powerpoint", "d0cf11e0a1b11ae1"],
    ["arsip.zip", "application/x-zip-compressed", "504b0304"],
    ["dokumen.docx", "application/octet-stream", "504b0304"],
    ["slide.pptx", "application/octet-stream", "504b0304"],
  ])("memeriksa signature format utama: %s", (name, mime, hex) => {
    expect(validateUpload(name, mime, Buffer.from(hex, "hex")).size).toBe(hex.length / 2)
    expect(() => validateUpload(name, mime, Buffer.from("MZ-program"))).toThrow("Isi file")
  })

  it("menolak ekstensi, MIME, nama, dan isi yang tidak valid", () => {
    const bytes = Buffer.from("%PDF-1.7")
    expect(() => validateUpload("program.exe", "application/octet-stream", bytes)).toThrow("Jenis file")
    expect(() => validateUpload("hasil.pdf", "image/png", bytes)).toThrow("Tipe file")
    for (const name of ["%ZZ.pdf", "../hasil.pdf", "a%0Ab.pdf", undefined]) expect(() => validateUpload(name, "application/pdf", bytes)).toThrow("Nama file")
    expect(() => validateUpload("hasil.pdf", "application/pdf", Buffer.alloc(0))).toThrow("File kosong")
    expect(() => validateUpload("hasil.pdf", "application/pdf", Buffer.alloc(10 * 1024 * 1024 + 1))).toThrow("10 MB")
    expect(() => validateUpload("file.txt", "text/plain", Buffer.from([0, 255]))).toThrow("Isi file")
  })

  it("mengunggah privat dengan token terpisah dan membaca melalui SDK", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "private-test-token")
    const url = "https://test.private.blob.vercel-storage.com/orders/file.pdf"
    put.mockResolvedValue({ url })
    const bytes = Buffer.from("%PDF-1.7\n")
    const file = await storePrivateFile({ orderId: "TD-TEST", category: "reference", originalName: "file.pdf", mimeType: "application/pdf", bytes })
    expect(put).toHaveBeenCalledWith(expect.any(String), bytes, expect.objectContaining({ access: "private", token: "private-test-token", contentType: "application/pdf" }))
    get.mockResolvedValue({ statusCode: 200, stream: new Response(bytes).body, blob: { contentType: "application/pdf" } })
    expect(await readPrivateFile("TD-TEST", file.id, url)).toEqual(bytes)
    expect(get).toHaveBeenCalledWith(url, expect.objectContaining({ access: "private", token: "private-test-token" }))
  })

  it("tidak menyimpan file invalid atau jatuh ke disk sementara Vercel", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "")
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "")
    vi.stubEnv("VERCEL", "1")
    await expect(storePrivateFile({ orderId: "TD-TEST", originalName: "file.exe", mimeType: "application/octet-stream", bytes: Buffer.from("MZ") })).rejects.toThrow("Jenis file")
    await expect(storePrivateFile({ orderId: "TD-TEST", originalName: "file.txt", mimeType: "text/plain", bytes: Buffer.from("test") })).rejects.toThrow("belum dikonfigurasi")
    expect(put).not.toHaveBeenCalled()
  })

  it("tidak mengirim token atau request ke URL di luar Blob", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await fetchBlobBuffer("https://example.com/file")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })
})
