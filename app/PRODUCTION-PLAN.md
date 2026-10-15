# Rencana menuju produksi publik

Fondasi aplikasi lokal sudah mencakup OAuth Google/GitHub, pemisahan akses pelanggan/admin, kepemilikan pesanan di server, state machine, QRIS merchant manual berbasis konfigurasi, penyimpanan file privat lokal, dan AI server-side opsional. Tahapan berikut tetap diperlukan sebelum domain dibuka untuk pelanggan umum.

## 1. Staging dan database terkelola

- Pindahkan SQLite ke PostgreSQL terkelola dengan migrasi skema yang dapat diulang.
- Tambahkan transaksi database, optimistic locking, indeks, backup otomatis, dan latihan pemulihan.
- Pisahkan development, staging, dan production; gunakan data sintetis di staging.
- Simpan audit event sebagai tabel append-only dengan actor ID, request ID, waktu UTC, dan sumber perubahan.

## 2. Autentikasi dan keamanan

- Daftarkan origin/callback OAuth domain HTTPS produksi.
- Simpan secret hanya di secret manager hosting dan rotasi bila pernah terekspos.
- Terapkan rate limit terdistribusi, CSRF/origin checks, CSP produksi, alert login, dan observability.
- Uji lintas akun: pelanggan A tidak boleh membaca pesanan/file pelanggan B; pelanggan tidak boleh mengakses admin.
- Buat prosedur pencabutan admin, penghapusan akun, ekspor data, dan respons insiden.

## 3. File privat terkelola

- Ganti disk lokal `data/private-files/` dengan object storage privat.
- Gunakan signed URL singkat atau streaming backend setelah pemeriksaan kepemilikan.
- Tambahkan pemindaian malware, kuota, checksum, retensi, penghapusan, dan backup.
- Jangan menjadikan nama file atau bukti transfer sebagai sumber kebenaran transaksi.

## 4. QRIS merchant manual

- Gunakan QRIS merchant resmi milik pemilik usaha; jangan memakai generator QR atau kode contoh.
- Admin mencocokkan nominal, waktu, dan referensi pada dashboard/acquirer merchant sebelum verifikasi.
- Tetapkan cara menangani transaksi kurang/lebih bayar, refund, penawaran versi baru, dan sengketa.
- Gambar QRIS saat ini adalah QR statis: harga penawaran tampil sebagai instruksi, tetapi nominal tidak tertanam di dalam QR.

### Migrasi ke nominal dan status otomatis

1. Pilih acquirer/payment gateway yang menyediakan **QRIS dinamis** dan webhook, misalnya DANA QRIS Acquirer atau Midtrans.
2. Selesaikan aktivasi merchant dan dapatkan kredensial sandbox; jangan memasukkan PIN, OTP, atau kredensial dashboard pribadi ke aplikasi.
3. Setelah penawaran disetujui, backend membuat transaksi dengan ID pembayaran internal, nominal persis dari penawaran aktif, mata uang IDR, dan waktu kedaluwarsa.
4. Simpan ID/reference penyedia, nominal, masa berlaku, serta status transaksi. Tampilkan hanya QR dinamis yang dikembalikan penyedia untuk pembayaran tersebut.
5. Sediakan endpoint webhook HTTPS publik. Verifikasi signature sesuai dokumentasi penyedia, cocokkan order ID dan nominal dengan data server, lalu proses event secara idempotent.
6. Status pekerjaan berubah ke `antrean` hanya setelah status pembayaran sah (`settlement`/`success`) diterima atau dikonfirmasi lewat API status penyedia.
7. Tambahkan proses rekonsiliasi terjadwal untuk transaksi tertunda dan uji kasus webhook duplikat, terlambat, nominal tidak cocok, kedaluwarsa, pembatalan, dan refund.

Jangan mengubah isi gambar/teks QRIS statis untuk memaksakan nominal. Integrasi dinamis harus menggunakan API resmi penyedia yang mengakuisisi merchant tersebut.

## 5. WhatsApp

- Tautan `wa.me` sudah cukup untuk percakapan manual dan tidak mengirim pesan tanpa tindakan pengguna.
- Jika kelak membutuhkan notifikasi otomatis, pilih WhatsApp Business Platform/provider bersama pemilik.
- Minta persetujuan, gunakan template yang disetujui, simpan status delivery, dan sediakan opt-out.
- Jangan mengirim brief atau file privat melalui pesan otomatis.

## 6. AI server-side

- Asisten hanya aktif melalui `OPENAI_API_KEY` di server dan tidak boleh menentukan harga atau mengubah pesanan otomatis.
- Pertahankan structured output, pembatasan data, `store: false`, rate limit, dan review manusia.
- Tambahkan evaluasi brief sintetis, pengukuran kualitas, pencatatan versi model/prompt, serta batas biaya bulanan.
- Beri pelanggan kebijakan privasi yang menjelaskan kapan isi brief dapat diproses penyedia AI.

## 7. Uji rilis

- Uji OAuth Google dan GitHub pada domain staging dan produksi.
- Uji alur lengkap dengan dua akun pelanggan dan satu admin, termasuk klik ganda dan request paralel.
- Uji pembayaran belum masuk, QRIS belum dikonfigurasi, referensi merchant kosong, hasil kosong, revisi kedaluwarsa, dan batas revisi.
- Audit keyboard, screen reader, reduced motion, viewport HP nyata, WebGL fallback, ukuran bundle, dan koneksi lambat.
- Lakukan pilot tertutup sebelum publikasi. Pembayaran nyata dan layanan berbayar hanya diaktifkan setelah pemilik memeriksa konfigurasi merchant serta prosedur operasional.
