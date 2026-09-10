# Techrey Digital — aplikasi operasional lokal

Aplikasi React + TypeScript + Vite dengan server Express, Better Auth, dan SQLite. Pelanggan masuk dengan Google/GitHub, membuat pesanan, membaca penawaran, membayar melalui QRIS merchant manual, memantau progres, mengunduh hasil, dan mengajukan revisi. Admin memiliki workspace terpisah dengan pemeriksaan allowlist di server.

## Menjalankan

Prasyarat: Node.js 22.13 atau lebih baru.

```bash
cd app
npm install
npm run dev
```

Buka `http://127.0.0.1:5173/`. Jangan membuka server ke internet sebelum domain HTTPS, database produksi, backup, rate limit terdistribusi, dan object storage privat selesai dikonfigurasi.

Pemeriksaan:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
```

## Rute

- `/` — beranda, layanan, contoh karya, proses, FAQ, dan tombol WhatsApp bila dikonfigurasi.
- `/masuk` — login pelanggan Google/GitHub.
- `/pesan` — formulir bertahap dan lampiran privat.
- `/akun/pesanan` — semua pesanan milik akun yang sedang masuk.
- `/akun/pesanan/:id` — penawaran, QRIS, progres, unduhan hasil, dan revisi milik pelanggan.
- `/admin/masuk` — pintu login admin yang terpisah.
- `/admin` — ringkasan admin.
- `/admin/pesanan` — pencarian, filter, dan detail pesanan.
- `/admin/pembayaran` — pembayaran yang perlu ditinjau.

Rute admin memeriksa sesi dan email `ADMIN_EMAILS` di server. Tidak ada rute pratinjau yang memungkinkan admin melakukan aksi atas nama pelanggan.

## Konfigurasi `.env`

Salin `.env.example` menjadi `.env`. Jangan menyimpan `.env` ke Git.

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — session Better Auth.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth Google.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — OAuth GitHub.
- `ADMIN_EMAILS` — email admin, dipisahkan koma.
- `WHATSAPP_NUMBER` — nomor bisnis format internasional tanpa `+`, misalnya `62812...`.
- `QRIS_MERCHANT_NAME` — nama merchant yang harus cocok dengan QRIS, untuk QR yang diberikan: `techrey digital`.
- `QRIS_IMAGE_PATH` — path absolut ke gambar QRIS merchant asli. Jangan taruh file QR di `public/`.
- `OPENAI_API_KEY` — opsional; mengaktifkan Asisten Techrey di server.
- `OPENAI_MODEL` — model AI, default `gpt-5.6-luna`.
- `HOST` — default `127.0.0.1`. Gunakan binding network hanya pada lingkungan yang memang diamankan.

## Data dan aturan

- Pesanan tersimpan dalam `data/techrey.sqlite` dan selalu dibatasi oleh `owner_user_id` untuk pelanggan.
- Session OAuth tersimpan dalam `data/techrey-auth.sqlite`.
- Byte lampiran dan hasil disimpan dalam `data/private-files/`, bukan dalam folder publik atau localStorage.
- Unduhan file memerlukan session pemilik pesanan atau admin yang diizinkan.
- File maksimal 10 MB dengan allowlist ekstensi, MIME, dan pemeriksaan signature untuk format utama.
- Status pekerjaan dikunci pada transisi server; pengerjaan tidak dapat dimulai sebelum pembayaran aktif diverifikasi.
- Verifikasi pembayaran wajib menyimpan referensi transaksi merchant dan identitas admin.
- QRIS tidak tampil sama sekali bila nama merchant atau gambar QR resmi belum dikonfigurasi.
- QRIS bawaan adalah QR statis: nominal tagihan mengikuti penawaran di aplikasi, tetapi pelanggan tetap memasukkan nominal saat memindai. Nominal terkunci dan verifikasi otomatis memerlukan QRIS dinamis + webhook dari acquirer/payment gateway.
- Untuk DANA Bisnis, buka profil Bisnis dan gunakan gambar QRIS resmi yang sudah disetujui. Setelah pelanggan menandai pembayaran, cocokkan nominal, status berhasil, dan nomor referensi pada **Riwayat Transaksi** DANA Bisnis sebelum verifikasi admin.
- Jangan pernah memasukkan PIN, OTP, password, atau kredensial login DANA ke aplikasi ini.

## Asisten Techrey

Asisten hanya tersedia bagi admin. Request dilakukan oleh server melalui OpenAI Responses API dengan structured output dan `store: false`. Nama pelanggan, WhatsApp, dan isi file tidak dikirim. Judul, brief, tenggat, anggaran, serta metadata nama/ukuran lampiran dikirim saat admin menekan tombol analisis. Hasil selalu berlabel draf; AI tidak menentukan harga dan tidak menyimpan penawaran otomatis.

Tanpa `OPENAI_API_KEY`, tombol AI dinonaktifkan dan aplikasi tetap dapat digunakan.

### Menggunakan akun ChatGPT tanpa API key

Panel **Asisten Techrey** juga memiliki mode manual yang tidak membutuhkan API key:

1. Buka detail pesanan di admin, lalu pilih tab cepat **AI** pada tampilan HP.
2. Buka **Pakai akun ChatGPT secara manual** dan tekan **Salin prompt**.
3. Tekan **Buka ChatGPT**, kirim prompt, lalu salin JSON jawaban ChatGPT.
4. Tempel jawaban ke kolom hasil dan tekan **Gunakan hasil ChatGPT**.

Mode ini sengaja tidak menyalin nama pelanggan, nomor WhatsApp, atau isi lampiran. Langganan ChatGPT tidak mengaktifkan API otomatis karena ChatGPT dan API Platform memiliki sistem penggunaan serta tagihan yang terpisah.

## Yang masih membutuhkan infrastruktur produksi

- Database terkelola, migrasi formal, backup, observability, dan concurrency lintas instance.
- Object storage privat terkelola serta pemindaian malware.
- Domain HTTPS dan konfigurasi OAuth produksi.
- Dashboard/akun merchant QRIS yang benar-benar digunakan admin untuk pencocokan transaksi.
- Kebijakan privasi, retensi, penghapusan akun/data, serta prosedur pemulihan.
- Notifikasi WhatsApp otomatis. Implementasi saat ini hanya membuka percakapan `wa.me`; tidak mengirim pesan otomatis.

Rincian kelanjutan tersedia di [PRODUCTION-PLAN.md](./PRODUCTION-PLAN.md).
