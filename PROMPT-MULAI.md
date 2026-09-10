Saya ingin melanjutkan proyek usaha Techrey Digital melalui vibe coding di Antigravity. Tolong kerjakan implementasinya, bukan hanya memberi rencana.

Baca README.md, BRIEF-PRODUK.md, dan seluruh file relevan di prototype/ terlebih dahulu. Prototipe sudah berisi beranda, formulir, dan admin. Pertahankan nama brand, bahasa Indonesia, layanan, serta aturan bisnisnya. Prototipe merupakan referensi, bukan aplikasi produksi.

Buat aplikasi baru di app/ dengan React + TypeScript + Vite, React Router, Motion untuk animasi, dan React Three Fiber + Drei untuk objek 3D interaktif. Gunakan versi stabil yang kompatibel dan periksa dokumentasi resmi saat memilih versi. CSS/Tailwind tetap boleh dipakai untuk styling; yang saya inginkan adalah interaksi React dan 3D nyata, bukan halaman statis atau gambar yang hanya digoyangkan. Jangan sekadar membungkus HTML lama di iframe atau memasukkannya sebagai raw HTML ke React.

Desain harus lebih berkarakter dari prototipe: biru elektrik, navy gelap, aksen hijau lime, tipografi tegas, komposisi asimetris yang rapi, kartu berlapis, dan motion yang halus. Gunakan bahasa yang natural, bukan kalimat promosi generik. Buat beranda dengan satu adegan 3D yang merespons kursor dan sentuhan, berupa perangkat kerja/objek digital yang cocok untuk layanan. Gunakan aset 3D yang sah jika diperlukan. Jangan menambahkan chatbot atau fitur AI karena tidak diminta.

Kerjakan tahap pertama sebagai aplikasi demo lengkap:
- Beranda, layanan, contoh karya, FAQ.
- Formulir bertahap: layanan, detail, ringkasan.
- Halaman pesanan pelanggan dan status pekerjaan.
- Admin: ringkasan, daftar pesanan, filter/pencarian, detail, penawaran, pembayaran QRIS simulasi, progres, hasil, dan revisi.
- Hubungkan formulir dan admin melalui data demo bersama. Isolasi data demo dalam repository/service agar mudah diganti API. Data pribadi/file jangan disimpan di localStorage. Tampilkan jelas batas demo.
- Gunakan komponen React dan state yang terstruktur. Semua tombol harus menjalankan aksi yang jelas.
- Sediakan loading, empty, error, dan success states; dialog dapat ditutup dengan keyboard dan mengembalikan fokus.
- Optimalkan tampilan HP, gunakan reduced motion, lazy loading 3D, batas kualitas render, dan fallback gambar saat WebGL tidak tersedia. Admin harus tetap ringan.

Jangan membuat login palsu atau mengklaim pembayaran, upload, dan pesan terkirim jika hanya simulasi. Jangan memasang QRIS palsu yang bisa disalahartikan sebagai tagihan nyata. Jangan menghapus folder prototype/.

Mulai dengan memasang kebutuhan proyek dan membuat aplikasi. Jalankan typecheck dan build, lalu uji alur utama di browser desktop dan mobile: pelanggan mengajukan kebutuhan, admin meninjau dan memberi penawaran, pelanggan menyetujui, pembayaran disimulasikan, admin memverifikasi, pengerjaan, hasil, dan revisi. Periksa juga transaksi belum dibayar, hasil belum dipilih, serta akses keyboard. Perbaiki kegagalan yang ditemukan. Berikan alamat preview, petunjuk menjalankan, dan daftar hal yang masih demo.

Setelah tahap demo selesai, tuliskan rencana tahap produksi dengan autentikasi pelanggan/admin, database, penyimpanan file privat, validasi server, dan QRIS merchant manual. Jangan mengaktifkan layanan berbayar, pembayaran nyata, atau publikasi tanpa instruksi lanjutan dari saya.
