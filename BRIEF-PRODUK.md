# Techrey Digital

## Pemilik dan tujuan
Usaha dikelola mahasiswa. Pelanggan membutuhkan dokumen, PPT, coding, website, dan review tugas. Nada bahasa santai, jelas, dan tidak berlebihan. Jangan menyebut layanan sebagai pendampingan formal atau membuat klaim tim besar, testimoni, statistik pelanggan, atau portofolio klien yang tidak ada.

## Layanan
1. Dokumen & Penulisan: ketik ulang, edit bahasa, format makalah/karya ilmiah/laporan, daftar pustaka.
2. PPT & Presentasi: slide dari materi pelanggan, desain ulang, ringkasan.
3. Coding & Website: website usaha/portofolio, error, penambahan fitur, penjelasan kode.
4. Bantuan & Review Tugas: pembahasan soal, review jawaban, penjelasan materi/kode. Untuk tugas yang dinilai, pelanggan tetap penulis dan penanggung jawab tugasnya.

Keperluan formulir: pribadi, sekolah, kuliah, organisasi, usaha. Harga ditentukan setelah brief diperiksa. Pembayaran hanya QRIS; metode transfer bank belum masuk scope.

## Desain dan interaksi
- Identitas biru elektrik #2854ff, navy #111b34, lime #c9f66c, permukaan terang. Hindari desain datar yang seluruhnya berupa kartu putih seragam.
- 3D sungguhan di beranda melalui Three.js/React Three Fiber. Gambar assets/hero.png adalah fallback/referensi, bukan model 3D.
- Laptop/objek digital yang bereaksi terhadap pointer secara terbatas, tanpa gerakan mengganggu pembacaan.
- Motion untuk transisi halaman, stepper, buka/tutup detail, feedback aksi, dan hover ringan.
- Jangan scroll hijacking, animasi berlebihan, efek yang hanya bekerja saat hover, atau kanvas 3D berat di admin.
- Formulir responsif; informasi penting terbaca pada HP; teks utama sekitar 16px; kontrol keyboard dan fokus terlihat.
- Portofolio contoh harus dilabeli contoh, tidak disajikan sebagai pekerjaan klien.

## Halaman aplikasi
- /: beranda dengan hero 3D, layanan, contoh karya, cara pesan, FAQ.
- /pesan: formulir bertahap, validation, ringkasan dan pengajuan demo.
- /pesanan/:id: penawaran, persetujuan, pembayaran simulasi, timeline, hasil dan revisi milik pelanggan.
- /admin: ringkasan dan prioritas.
- /admin/pesanan: pencarian/filter dan detail.
- /admin/pembayaran: daftar tagihan dan verifikasi.

Tahap demo boleh memiliki pemilih sudut pandang pelanggan/admin yang jelas berlabel demo. Tahap produksi wajib menggunakan pemeriksaan peran dan kepemilikan di server.

## Alur
Ajukan kebutuhan → admin periksa → admin kirim penawaran → pelanggan menyetujui → QRIS → admin cocokkan transaksi → antrean → dikerjakan → hasil dikirim → revisi bila perlu → selesai.

Status pekerjaan dan pembayaran terpisah:
- Pekerjaan: diajukan, perlu informasi, ditinjau, menunggu persetujuan, menunggu pembayaran, antrean, dikerjakan, revisi, hasil dikirim, selesai, ditolak, dibatalkan.
- Pembayaran: belum ditagih, belum dibayar, menunggu verifikasi, dibayar, dikembalikan.

Tidak boleh memulai pengerjaan sebelum pembayaran yang dipersyaratkan diverifikasi. Tidak boleh menandai hasil dikirim/selesai tanpa hasil. Setelah disetujui, penawaran menjadi catatan tetap; perubahan lingkup/harga harus menjadi revisi penawaran yang disetujui lagi. Klik berulang tidak boleh menggandakan aksi.

## Data konseptual
- Order: id, customerId, service, purpose, title, brief, deadline, timezone, status, createdAt.
- Offer: id, orderId, version, amount, scope, deliverables, revisionLimit, revisionDeadline, dueAt, acceptedAt.
- Payment: id, orderId, offerId, amount, status, evidenceFileId, merchantReference, verifiedAt, verifiedBy.
- File: id, orderId, category, originalName, privateStorageKey, size, createdAt.
- Revision: id, orderId, notes, round, status.
- Event: id, orderId, actorId, action, timestamp.

Tampilkan WITA dengan jelas. Dalam tahap produksi simpan timestamp yang tidak ambigu. Contoh data lama bertanggal September 2026 adalah data demo, bukan tenggat aktual.

## Formulir
Nama, WhatsApp, layanan, keperluan, judul, brief, tenggat dengan jam, anggaran opsional, file/referensi.
- Dokumen: halaman, draft, pedoman format.
- PPT: materi, slide, gaya.
- Coding: tujuan, fitur, kode, referensi.
- Review: pelajaran/mata kuliah dan bagian yang perlu dibantu.

## Admin
Ringkasan pembayaran terverifikasi (jangan disamakan dengan laba), pesanan aktif, pembayaran perlu dicek, revisi. Prioritas berdasarkan tenggat/perlu tindakan. Detail brief, penawaran, pembayaran, file hasil, catatan revisi, riwayat perubahan. Semua pembaruan demo harus tercermin pada halaman pelanggan yang sama dalam sesi tersebut.

## QRIS
Demo: tidak menggunakan kode bayar aktif. Pengguna dapat mencoba status membayar; hanya aksi verifikasi admin yang mengubahnya menjadi dibayar. Jelaskan simulasi pada UI.
Produksi: QRIS merchant asli dari pemilik, bukti disimpan privat, admin cek transaksi masuk dari penyedia sebelum verifikasi. Jangan menganggap foto bukti sebagai sumber kebenaran. Rekening/akun pencairan dan biaya mengikuti penyedia; jangan mengarang persyaratan. QRIS dinamis/otomatis adalah tahap lanjutan, bukan syarat rilis pertama.

## Tahap produksi setelah demo
Pilih penyedia backend bersama pemilik. Wajib autentikasi, role admin di server, otorisasi per pesanan/file, database, upload privat, validasi jumlah/ukuran/tipe file, penyimpanan aman kredensial, audit log, backup, dan aturan retensi. Jangan gunakan localStorage sebagai database produksi atau mengirim service key ke frontend. Gunakan simulasi sampai koneksi layanan nyata benar-benar dikonfigurasi dan diuji.

## Kriteria selesai tahap pertama
React/TypeScript terstruktur, 3D interaktif dengan fallback, formulir dan admin terhubung pada data demo, alur lengkap dapat dicoba, responsif, typecheck/build berhasil, browser flow diuji, instruksi instalasi/menjalankan tersedia. Catat batas demo dan pengujian yang belum dilakukan secara jujur.
