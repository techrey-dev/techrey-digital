export const SERVICES = [
  "Dokumen & Penulisan",
  "PPT & Presentasi",
  "Coding & Website",
  "Bantuan & Review Tugas",
] as const

export const PURPOSES = ["Pribadi", "Sekolah", "Kuliah", "Organisasi", "Usaha"] as const

export type ServiceName = (typeof SERVICES)[number]
export type Purpose = (typeof PURPOSES)[number]

export type WorkStatus =
  | "diajukan"
  | "perlu-informasi"
  | "ditinjau"
  | "menunggu-persetujuan"
  | "menunggu-pembayaran"
  | "antrean"
  | "dikerjakan"
  | "revisi"
  | "hasil-dikirim"
  | "selesai"
  | "ditolak"
  | "dibatalkan"

export type PaymentStatus =
  | "belum-ditagih"
  | "belum-dibayar"
  | "menunggu-verifikasi"
  | "dibayar"
  | "dibatalkan"
  | "dikembalikan"

export type FileMeta = {
  id: string
  category: "reference" | "result"
  originalName: string
  mimeType?: string
  size: number
  createdAt: string
  offerId?: string
  revisionId?: string
  publishedAt?: string
}

export type Offer = {
  id: string
  version: number
  amount: number
  scope: string
  deliverables: string[]
  revisionLimit: number
  revisionDeadline: string
  dueAt: string
  createdAt: string
  acceptedAt?: string
}

export type Payment = {
  id: string
  offerId: string
  amount: number
  status: PaymentStatus
  markedAt?: string
  verifiedAt?: string
  verifiedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectionReason?: string
  merchantReference?: string
  cancelledAt?: string
  refundReference?: string
  refundedAt?: string
  refundedBy?: string
}

export type Revision = {
  id: string
  offerId: string
  notes: string
  round: number
  status: "diajukan" | "dikerjakan" | "selesai"
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export type OrderMessage = {
  id: string
  actor: "pelanggan" | "admin"
  actorId?: string
  text: string
  createdAt: string
}

export type OrderEvent = {
  id: string
  version?: number
  actor: "pelanggan" | "admin" | "sistem"
  actorId?: string
  action: string
  timestamp: string
}

export type Order = {
  id: string
  ownerUserId?: string
  customerName: string
  whatsapp: string
  service: ServiceName
  purpose: Purpose
  title: string
  brief: string
  deadline: string
  timezone: "Asia/Makassar"
  budget?: number
  status: WorkStatus
  createdAt: string
  files: FileMeta[]
  offers: Offer[]
  payments: Payment[]
  revisions: Revision[]
  messages: OrderMessage[]
  events: OrderEvent[]
  closedReason?: string
}

export type OrderDraft = Pick<
  Order,
  "customerName" | "whatsapp" | "service" | "purpose" | "title" | "brief" | "deadline"
> & { budget?: number }

export type PaymentInstructions = {
  merchantName: string
  amount: number
  qrUrl: string
}

export type OfferDraft = Pick<
  Offer,
  "amount" | "scope" | "deliverables" | "revisionLimit" | "revisionDeadline" | "dueAt"
>

export type WhatsAppNotificationInfo = {
  phone: string
  message: string
  href: string
  sentAutomatically: boolean
}

export type OrderSnapshot = {
  orders: Order[]
  loading: boolean
  error?: string
  lastMessage?: { id: number; tone: "success" | "error" | "info"; text: string }
  lastWhatsAppNotification?: WhatsAppNotificationInfo
}
