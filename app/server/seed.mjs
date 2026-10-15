const event = (id, action, timestamp, actor = "admin") => ({ id, action, timestamp, actor })

export const seedOrders = [
  {
    id: "TD-026", customerName: "Nadia Putri", whatsapp: "0812 0000 0026", service: "PPT & Presentasi", purpose: "Organisasi",
    title: "PPT proposal kegiatan kampus", brief: "Buat 15 slide dari materi yang sudah disiapkan. Gaya bersih dengan nuansa biru untuk presentasi organisasi.",
    deadline: "2026-09-10T16:00:00+08:00", timezone: "Asia/Makassar", status: "diajukan", createdAt: "2026-09-08T09:20:00+08:00", budget: 200000,
    files: [{ id: "file-026", category: "reference", originalName: "materi-proposal.pdf", size: 840000, createdAt: "2026-09-08T09:20:00+08:00" }],
    offers: [], payments: [], revisions: [], events: [event("ev-026", "Kebutuhan diajukan pada demo.", "2026-09-08T09:20:00+08:00", "pelanggan")],
  },
  {
    id: "TD-025", customerName: "Raka Pratama", whatsapp: "0812 0000 0025", service: "Coding & Website", purpose: "Pribadi",
    title: "Website portofolio fotografi", brief: "Website portofolio dengan galeri, profil, dan kontak. Materi foto sudah tersedia.",
    deadline: "2026-09-14T18:00:00+08:00", timezone: "Asia/Makassar", status: "menunggu-pembayaran", createdAt: "2026-09-07T14:10:00+08:00",
    files: [], offers: [{ id: "offer-025-v1", version: 1, amount: 750000, scope: "Website portofolio responsif dengan galeri, profil, dan formulir kontak.", deliverables: ["Source code website", "Panduan menjalankan"], revisionLimit: 2, revisionDeadline: "2026-09-18T18:00:00+08:00", dueAt: "2026-09-14T18:00:00+08:00", createdAt: "2026-09-07T16:00:00+08:00", acceptedAt: "2026-09-07T18:20:00+08:00" }],
    payments: [{ id: "pay-025", offerId: "offer-025-v1", amount: 750000, status: "belum-dibayar" }], revisions: [],
    events: [event("ev-025-2", "Penawaran versi 1 disetujui pelanggan.", "2026-09-07T18:20:00+08:00", "pelanggan")],
  },
  {
    id: "TD-024", customerName: "Alya Safitri", whatsapp: "0812 0000 0024", service: "Dokumen & Penulisan", purpose: "Kuliah",
    title: "Format laporan & daftar pustaka", brief: "Rapikan format 25 halaman, daftar isi, dan sitasi dari draft milik pelanggan.",
    deadline: "2026-09-09T12:00:00+08:00", timezone: "Asia/Makassar", status: "dikerjakan", createdAt: "2026-09-05T11:00:00+08:00", files: [],
    offers: [{ id: "offer-024-v1", version: 1, amount: 125000, scope: "Perapian 25 halaman dan daftar pustaka.", deliverables: ["DOCX rapi", "PDF final"], revisionLimit: 1, revisionDeadline: "2026-09-11T12:00:00+08:00", dueAt: "2026-09-09T12:00:00+08:00", createdAt: "2026-09-05T12:00:00+08:00", acceptedAt: "2026-09-05T13:00:00+08:00" }],
    payments: [{ id: "pay-024", offerId: "offer-024-v1", amount: 125000, status: "dibayar", verifiedAt: "2026-09-05T14:00:00+08:00", verifiedBy: "Admin demo" }], revisions: [],
    events: [event("ev-024", "Pengerjaan dimulai setelah pembayaran diverifikasi.", "2026-09-05T14:15:00+08:00")],
  },
  {
    id: "TD-023", customerName: "Dimas Saputra", whatsapp: "0812 0000 0023", service: "PPT & Presentasi", purpose: "Kuliah",
    title: "Revisi desain slide presentasi", brief: "Sesuaikan warna diagram pada slide 4 dan 7. Ini putaran revisi pertama.",
    deadline: "2026-09-09T19:00:00+08:00", timezone: "Asia/Makassar", status: "revisi", createdAt: "2026-09-04T08:00:00+08:00",
    files: [{ id: "result-023", category: "result", originalName: "presentasi-v1.pptx", size: 2300000, createdAt: "2026-09-08T08:30:00+08:00" }],
    offers: [{ id: "offer-023-v1", version: 1, amount: 180000, scope: "Desain ulang 12 slide dari materi pelanggan.", deliverables: ["PPTX yang dapat diedit", "PDF pratinjau"], revisionLimit: 2, revisionDeadline: "2026-09-11T19:00:00+08:00", dueAt: "2026-09-09T19:00:00+08:00", createdAt: "2026-09-04T10:00:00+08:00", acceptedAt: "2026-09-04T11:00:00+08:00" }],
    payments: [{ id: "pay-023", offerId: "offer-023-v1", amount: 180000, status: "dibayar", verifiedAt: "2026-09-04T12:00:00+08:00", verifiedBy: "Admin demo" }],
    revisions: [{ id: "rev-023-1", notes: "Warna diagram slide 4 dan 7 disamakan dengan identitas organisasi.", round: 1, status: "dikerjakan", createdAt: "2026-09-08T10:10:00+08:00" }],
    events: [event("ev-023", "Revisi putaran 1 diajukan pelanggan.", "2026-09-08T10:10:00+08:00", "pelanggan")],
  },
  {
    id: "TD-022", customerName: "Salsa Anindya", whatsapp: "0812 0000 0022", service: "Bantuan & Review Tugas", purpose: "Sekolah",
    title: "Review kode latihan JavaScript", brief: "Review dan penjelasan alur fungsi pada kode latihan pelanggan.", deadline: "2026-09-08T10:00:00+08:00",
    timezone: "Asia/Makassar", status: "selesai", createdAt: "2026-09-03T13:00:00+08:00",
    files: [{ id: "result-022", category: "result", originalName: "review-javascript.pdf", size: 620000, createdAt: "2026-09-07T17:00:00+08:00" }],
    offers: [{ id: "offer-022-v1", version: 1, amount: 85000, scope: "Review kode dan catatan penjelasan; pelanggan tetap penulis tugas.", deliverables: ["PDF catatan review"], revisionLimit: 1, revisionDeadline: "2026-09-09T10:00:00+08:00", dueAt: "2026-09-08T10:00:00+08:00", createdAt: "2026-09-03T14:00:00+08:00", acceptedAt: "2026-09-03T15:00:00+08:00" }],
    payments: [{ id: "pay-022", offerId: "offer-022-v1", amount: 85000, status: "dibayar", verifiedAt: "2026-09-03T16:00:00+08:00", verifiedBy: "Admin demo" }], revisions: [],
    events: [event("ev-022", "Hasil diterima dan pesanan ditandai selesai.", "2026-09-08T09:00:00+08:00", "pelanggan")],
  },
]
