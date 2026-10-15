import { expect, it } from "vitest"
import { buildWhatsAppNotificationMessage } from "./whatsapp-notifier.mjs"

it("menyertakan judul pesanan pada notifikasi pengerjaan", () => {
  const message = buildWhatsAppNotificationMessage({ id: "TD-TEST", title: "Website toko", customerName: "Pelanggan", status: "dikerjakan" }, "update-progress", { status: "dikerjakan" })
  expect(message).toContain("TD-TEST - Website toko")
  expect(message).not.toContain("{order.title}")
})
