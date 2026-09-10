# Panduan Setup OAuth — Google & GitHub

Login di Techrey Digital menggunakan **better-auth** dengan social provider.
Halaman `/masuk` sudah siap — kamu hanya perlu mengisi **Client ID** dan **Client Secret** di file `.env`.

---

## A. Google OAuth

### 1. Buat Project di Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Klik **Select a project** → **New Project**
3. Beri nama (contoh: `Techrey Digital`) → **Create**

### 2. Aktifkan OAuth Consent Screen

1. Buka **APIs & Services → OAuth consent screen**
2. Pilih **External** → **Create**
3. Isi:
   - **App name**: `Techrey Digital`
   - **User support email**: email kamu
   - **Developer contact**: email kamu
4. Klik **Save and Continue** sampai selesai
5. Di tab **Publishing status**, biarkan di **Testing** (cukup untuk development)

### 3. Buat Credentials

1. Buka **APIs & Services → Credentials**
2. Klik **Create Credentials → OAuth 2.0 Client ID**
3. Tipe: **Web application**
4. **Name**: `Techrey Web`
5. **Authorized JavaScript origins**:
   ```
   http://127.0.0.1:5173
   ```
6. **Authorized redirect URIs**:
   ```
   http://127.0.0.1:5173/api/auth/callback/google
   ```
7. Klik **Create**
8. Salin **Client ID** dan **Client Secret**

> **Produksi**: Ganti origin dan redirect URI ke domain produksi, contoh:
> ```
> https://techrey.com
> https://techrey.com/api/auth/callback/google
> ```

---

## B. GitHub OAuth

### 1. Buat OAuth App

1. Buka [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Klik **New OAuth App**
3. Isi:
   - **Application name**: `Techrey Digital`
   - **Homepage URL**: `http://127.0.0.1:5173`
   - **Authorization callback URL**:
     ```
     http://127.0.0.1:5173/api/auth/callback/github
     ```
4. Klik **Register application**
5. Salin **Client ID**
6. Klik **Generate a new client secret** → salin **Client Secret**

> **Produksi**: Ganti Homepage URL dan callback URL ke domain produksi.

---

## C. Isi File `.env`

Salin `.env.example` menjadi `.env` lalu isi:

```env
# Secret untuk enkripsi session (wajib unik, minimal 32 karakter)
BETTER_AUTH_SECRET=masukkan-random-string-minimal-32-karakter

# Base URL aplikasi
BETTER_AUTH_URL=http://127.0.0.1:5173

# Google OAuth (dari langkah A)
GOOGLE_CLIENT_ID=123456789-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx

# GitHub OAuth (dari langkah B)
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXX
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email akun Google/GitHub yang boleh akses /admin (pisahkan dengan koma)
ADMIN_EMAILS=emailkamu@gmail.com
```

### Generate Random Secret

```powershell
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

```bash
# Bash / macOS
openssl rand -base64 32
```

---

## D. Mulai Ulang Server

```bash
# Ctrl+C untuk stop, lalu:
npm run dev
```

Buka `http://127.0.0.1:5173/masuk` untuk pelanggan atau `http://127.0.0.1:5173/admin/masuk` untuk admin. Tombol Google dan GitHub seharusnya aktif.

---

## E. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Tombol login disabled | Pastikan `.env` terisi dan server sudah di-restart |
| Error `redirect_uri_mismatch` (Google) | Pastikan redirect URI di Google Console **persis** `http://127.0.0.1:5173/api/auth/callback/google` |
| Error `The redirect_uri is not associated` (GitHub) | Pastikan callback URL di GitHub OAuth App **persis** `http://127.0.0.1:5173/api/auth/callback/github` |
| Tidak bisa login saat testing | Di Google Console, tambahkan email tester di OAuth consent screen → **Test users** |
| Halaman admin menolak akses | Pastikan email akun Google/GitHub ada di `ADMIN_EMAILS` pada `.env` |

---

## F. Cara Kerjanya

```
Pelanggan klik "Masuk dengan Google"
  → better-auth redirect ke Google OAuth
  → Google verifikasi → callback ke /api/auth/callback/google
  → better-auth simpan session di SQLite (data/techrey-auth.sqlite)
  → redirect ke /akun/pesanan
```

File server terkait:
- **`server/auth.mjs`** — konfigurasi better-auth, membaca `.env`
- **`src/lib/authClient.ts`** — client-side auth helper
- **`src/pages/AuthPages.tsx`** — halaman login UI

Kamu **tidak perlu mengubah kode** — cukup isi `.env` dan restart.
