import type { OrderSnapshot, OfferDraft, Order, OrderDraft, PaymentInstructions, WhatsAppNotificationInfo } from "./types"

export class RepositoryError extends Error {
  status?: number
  constructor(message: string, status?: number) { super(message); this.status = status }
}

type CustomerAction = "accept-offer" | "mark-payment-attempt" | "request-revision" | "reply-information" | "cancel-order" | "accept-result"
type AdminAction = "mark-reviewed" | "request-information" | "save-offer" | "revise-offer" | "verify-payment" | "update-progress" | "close-order"

function normalizeOrder(order: Order): Order {
  if (!order) return order
  return {
    ...order,
    files: Array.isArray(order.files) ? order.files : [],
    offers: Array.isArray(order.offers) ? order.offers : [],
    payments: Array.isArray(order.payments) ? order.payments : [],
    revisions: Array.isArray(order.revisions) ? order.revisions : [],
    messages: Array.isArray(order.messages) ? order.messages : [],
    events: Array.isArray(order.events) ? order.events : [],
  }
}

export class OrderRepository {
  private snapshot: OrderSnapshot = { orders: [], loading: false }
  private listeners = new Set<() => void>()
  private messageId = 0
  private loadedKey = ""
  private loadSequence = 0
  private scopeSequence = 0

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private publish(update: Partial<OrderSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update }
    this.listeners.forEach((listener) => listener())
  }

  private message(text: string, tone: "success" | "error" | "info" = "success") {
    this.publish({ lastMessage: { id: ++this.messageId, tone, text } })
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new RepositoryError(body.error || "Server tidak dapat memproses aksi.", response.status)
    return body as T
  }

  private upsert(order: Order) {
    ++this.loadSequence
    const normalized = normalizeOrder(order)
    const orders = [normalized, ...this.snapshot.orders.filter((item) => item.id !== normalized.id)]
    this.publish({ orders, loading: false, error: undefined })
  }

  prepareEmpty() {
    if (this.loadedKey === "empty") return
    this.loadedKey = "empty"
    ++this.loadSequence
    ++this.scopeSequence
    this.publish({ orders: [], loading: false, error: undefined, lastMessage: undefined })
  }

  async loadAdmin(userId = "", force = false) {
    return this.loadOrders(`admin:${userId}`, "/api/admin/orders", force)
  }

  async loadAccountOrders(userId = "", force = false, silent = false) {
    return this.loadOrders(`account:${userId}`, "/api/customer/orders", force, silent)
  }

  private async loadOrders(key: string, url: string, force = false, silent = false) {
    if (!force && this.loadedKey === key) return
    const changedScope = this.loadedKey !== key
    this.loadedKey = key
    const sequence = ++this.loadSequence
    if (changedScope) {
      ++this.scopeSequence
      this.publish({ orders: [], loading: true, error: undefined, lastMessage: undefined })
    } else if (!silent) {
      this.publish({ loading: this.snapshot.orders.length === 0, error: undefined })
    }
    try {
      const result = await this.request<{ orders: Order[] }>(url)
      if (this.loadedKey === key && sequence === this.loadSequence) {
        const orders = (result.orders || []).map(normalizeOrder)
        this.publish({ orders, loading: false, error: undefined })
      }
    } catch (error) {
      if (this.loadedKey === key && sequence === this.loadSequence) this.publish({ loading: false, error: silent ? this.snapshot.error : this.errorMessage(error) })
    }
  }

  async refreshAccountOrders(userId = "") {
    if (!userId || this.loadedKey !== `account:${userId}`) return
    return this.loadAccountOrders(userId, true, true)
  }

  async refreshAdminOrders(userId: string) {
    if (!userId || this.loadedKey !== `admin:${userId}`) return
    return this.loadOrders(`admin:${userId}`, "/api/admin/orders", true, true)
  }

  errorMessage(error: unknown) {
    return error instanceof RepositoryError ? error.message : "Aksi gagal. Coba lagi."
  }

  async createOrder(draft: OrderDraft) {
    const scope = this.scopeSequence
    const result = await this.request<{ order: Order }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(draft),
    })
    if (scope === this.scopeSequence) {
      this.upsert(result.order)
      this.message("Kebutuhan tersimpan dan terhubung ke akunmu.")
    }
    return { id: result.order.id }
  }

  private async adminAction(id: string, action: AdminAction, payload?: unknown, message?: string) {
    const scope = this.scopeSequence
    const result = await this.request<{ order: Order; whatsappNotification?: WhatsAppNotificationInfo }>("/api/admin/orders/" + encodeURIComponent(id) + "/actions", {
      method: "POST", body: JSON.stringify({ action, payload }),
    })
    if (scope !== this.scopeSequence) return
    this.upsert(result.order)
    this.publish({ lastWhatsAppNotification: result.whatsappNotification })
    this.message(message ?? "Perubahan disimpan.")
  }

  clearWhatsAppNotification = () => {
    this.publish({ lastWhatsAppNotification: undefined })
  }

  private async customerAction(id: string, action: CustomerAction, payload?: unknown, message?: string) {
    const scope = this.scopeSequence
    const base = "/api/customer/orders/" + encodeURIComponent(id) + "/actions"
    const result = await this.request<{ order: Order }>(base, { method: "POST", body: JSON.stringify({ action, payload }) })
    if (scope !== this.scopeSequence) return
    this.upsert(result.order)
    this.message(message ?? "Perubahan disimpan.")
  }

  markReviewed(id: string) { return this.adminAction(id, "mark-reviewed", undefined, "Brief ditandai sudah ditinjau.") }
  requestInformation(id: string, question: string) { return this.adminAction(id, "request-information", { question }, "Permintaan informasi dikirim.") }
  saveOffer(id: string, draft: OfferDraft) { return this.adminAction(id, "save-offer", draft, "Penawaran tersedia di tautan pelanggan.") }
  reviseOffer(id: string, draft: OfferDraft) { return this.adminAction(id, "revise-offer", draft, "Versi penawaran baru dibuat.") }
  verifyPayment(id: string, merchantReference: string) { return this.adminAction(id, "verify-payment", { merchantReference }, "Pembayaran diverifikasi.") }
  updateProgress(id: string, status: Order["status"]) {
    return this.adminAction(id, "update-progress", { status }, "Progres diperbarui.")
  }
  closeOrder(id: string, status: "ditolak" | "dibatalkan", reason: string, refundReference?: string) {
    return this.adminAction(id, "close-order", { status, reason, refundReference }, status === "ditolak" ? "Pesanan ditolak." : "Pesanan dibatalkan.")
  }
  acceptOffer(id: string) { return this.customerAction(id, "accept-offer", undefined, "Penawaran disetujui.") }
  markPaymentAttempt(id: string) { return this.customerAction(id, "mark-payment-attempt", undefined, "Pembayaran menunggu verifikasi admin.") }
  requestRevision(id: string, notes: string) { return this.customerAction(id, "request-revision", { notes }, "Catatan revisi tersimpan.") }
  replyInformation(id: string, message: string) { return this.customerAction(id, "reply-information", { message }, "Informasi tambahan dikirim.") }
  cancelOrder(id: string, reason: string) { return this.customerAction(id, "cancel-order", { reason }, "Pesanan dibatalkan.") }
  acceptResult(id: string) { return this.customerAction(id, "accept-result", undefined, "Hasil diterima.") }

  private async uploadFile(url: string, file: File) {
    const scope = this.scopeSequence
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    const fallbackMime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".zip": "application/zip",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".txt": "text/plain",
      ".csv": "text/csv",
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-File-Type": file.type || fallbackMime[extension] || "application/octet-stream" },
      body: file,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new RepositoryError(body.error || "File tidak dapat diunggah.")
    if (scope !== this.scopeSequence) return false
    this.upsert(body.order as Order)
    return true
  }

  async uploadReferenceFile(id: string, file: File) {
    if (await this.uploadFile(`/api/customer/orders/${encodeURIComponent(id)}/files`, file)) this.message("Lampiran tersimpan pada penyimpanan privat.")
  }

  async uploadResultFile(id: string, file: File) {
    if (await this.uploadFile(`/api/admin/orders/${encodeURIComponent(id)}/files`, file)) this.message("File hasil tersimpan pada penyimpanan privat.")
  }

  getPaymentInstructions(id: string) {
    return this.request<PaymentInstructions>(`/api/customer/orders/${encodeURIComponent(id)}/payment-instructions`)
  }

}

export const orderRepository = new OrderRepository()
