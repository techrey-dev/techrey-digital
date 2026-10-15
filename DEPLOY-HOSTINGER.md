# Panduan Deployment Hostinger Shared Hosting (LiteSpeed)

Dokumen ini menjelaskan konfigurasi dan cara kerja deployment repositori ini ke folder `public_html` pada layanan Shared Hosting (Hostinger / cPanel / LiteSpeed).

---

## 1. Penyebab Error "403 Forbidden" Sebelumnya

1. **Tidak Ada File Entry Point di Root (`public_html`):**
   Di root repositori sebelumnya hanya ada folder `.github`, `app/`, `prototype/`, dan file markdown. Saat Git melakukan clone/pull langsung ke `public_html`, server LiteSpeed mencari `index.html` atau `index.php` di root. Karena tidak ditemukan dan *Directory Listing* (Options +Indexes) dimatikan demi keamanan, server otomatis merespons **403 Forbidden**.
2. **Build Vite Terabaikan oleh `.gitignore`:**
   Folder `app/dist/` sebelumnya berada di dalam `.gitignore`. Pada shared hosting, Git Deployment di hPanel hanya menjalankan perintah `git pull` tanpa menjalankan `npm install` atau `npm run build`. Akibatnya, file hasil kompilasi tidak pernah sampai ke server.

---

## 2. Solusi yang Telah Diterapkan

### A. File `.htaccess` di Root Repositori
File [`.htaccess`](file:///r:/Ngoding%20Rey/TechreyDigital/.htaccess) telah dibuat di root repositori dengan aturan khusus LiteSpeed:
- **`DirectoryIndex index.php app/dist/index.html prototype/index.html index.html`**:
  Memberi tahu LiteSpeed untuk mencari `index.php` atau `app/dist/index.html` saat pengunjung membuka domain utama (`https://domain.com/`).
- **Aman dari 403 LiteSpeed**:
  Tidak menggunakan direktif terlarang seperti `Options +FollowSymLinks` (yang sering memicu 403 di Hostinger LiteSpeed). Menggunakan `Options -Indexes` untuk mencegah pembacaan struktur folder.
- **Routing Aset Otomatis**:
  Request ke `/assets/*`, `/favicon.png`, dan `/favicon.ico` otomatis diteruskan ke `app/dist/assets/*` dan `app/dist/favicon.*`.
- **SPA Routing (Single Page Application)**:
  Request halaman React (seperti `/pesan`, `/akun/pesanan`, `/masuk`, `/admin`) otomatis di-rewrite ke `app/dist/index.html` dengan mulus tanpa merusak URL di browser.
- **Fallback Cerdas**:
  Jika suatu saat `app/dist/index.html` belum di-build, `.htaccess` secara otomatis mengarahkan ke `prototype/index.html` sehingga web tidak pernah mati/403.
- **Proteksi Berkas Privat**:
  Memblokir akses luar ke file `.env`, database `.sqlite`, `node_modules`, dan source code `app/src/`.

### B. File Fail-Safe `index.php` di Root
File [`index.php`](file:///r:/Ngoding%20Rey/TechreyDigital/index.php) bertindak sebagai jaring pengaman lapis kedua:
- Karena Hostinger LiteSpeed memprioritaskan PHP, keberadaan file ini menjamin server tidak akan pernah menganggap `public_html` sebagai folder kosong.
- Jika `mod_rewrite` mengalami kendala, `index.php` otomatis membaca dan menyajikan file `app/dist/index.html` beserta MIME-type header yang benar.

### C. Pelacakan Folder `app/dist/` di `.gitignore`
File [`.gitignore`](file:///r:/Ngoding%20Rey/TechreyDigital/.gitignore) dan [`app/.gitignore`](file:///r:/Ngoding%20Rey/TechreyDigital/app/.gitignore) telah diperbarui dengan:
```gitignore
!app/dist/
!app/dist/**
```
Hal ini memastikan file hasil build siap saji (`HTML`, `JS`, `CSS`, aset web) ikut ter-commit ke Git dan langsung tersedia saat Hostinger melakukan `git pull`.

### D. File `.htaccess` di `app/dist/` & `app/public/`
File [`.htaccess`](file:///r:/Ngoding%20Rey/TechreyDigital/app/public/.htaccess) telah ditempatkan di `app/public/` sehingga setiap kali perintah `npm run build` dijalankan, Vite otomatis menyalin file konfigurasi ini ke dalam `app/dist/`.

### E. GitHub Actions Auto-Build Workflow
File [`.github/workflows/build-dist.yml`](file:///r:/Ngoding%20Rey/TechreyDigital/.github/workflows/build-dist.yml) ditambahkan untuk mengotomatisasi kompilasi di GitHub Actions (`ubuntu-latest`). Setiap ada push ke `main`, GitHub akan otomatis mengompilasi Vite dan memperbarui folder `app/dist/`.

---

## 3. Cara Mengunggah ke Hostinger (Langkah Pengguna)

### Cara 1: Menggunakan Fitur Git di hPanel Hostinger (Rekomendasi)
1. Di komputer lokal, jalankan build dan commit perubahan:
   ```bash
   npm run build
   git add .
   git commit -m "fix(deploy): add root .htaccess, index.php, and commit production dist"
   git push origin main
   ```
2. Buka **hPanel Hostinger** > pilih domain Anda > menu **Lanjutan (Advanced)** > **Git**.
3. Jika repositori sudah terhubung ke folder `public_html`, klik tombol **Deploy** (atau aktifkan **Auto Deployment** via Webhook GitHub).
4. Selesai! Buka domain Anda di browser, halaman utama Techrey Digital langsung tampil tanpa error 403.

### Cara 2: Jika Mengunggah Manual via File Manager / FTP
Jika Anda mengunggah berkas secara manual:
- Pastikan file `.htaccess` dan `index.php` berada persis di dalam folder root `public_html/`.
- Pastikan folder `app/dist/` ikut terunggah utuh bersama folder `assets/` di dalamnya.

---

## 4. Struktur Folder Setelah Deployment di `public_html`

```text
public_html/
├── .htaccess            <-- Menangani rewrite LiteSpeed, SPA fallback, & pencegah 403
├── index.php            <-- Fail-safe entry point default LiteSpeed
├── package.json         <-- Root build helper
├── DEPLOY-HOSTINGER.md   <-- Panduan ini
├── app/
│   ├── dist/            <-- File hasil kompilasi siap saji (HTML, CSS, JS bundle)
│   │   ├── index.html
│   │   ├── .htaccess
│   │   ├── favicon.png
│   │   └── assets/
│   ├── src/             <-- Source code TypeScript / React
│   └── package.json
└── prototype/           <-- Versi prototype lama (sebagai cadangan fallback)
    └── index.html
```
