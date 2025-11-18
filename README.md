# PPDSB – Pendaftaran Web

Platform ini digunakan Pondok Pesantren Al Ikhsan Beji untuk mengelola seluruh proses Penerimaan Peserta Didik dan Santri Baru (PPDSB). Aplikasi memadukan laman publik untuk calon santri/wali dan dashboard admin yang terintegrasi dengan Supabase.

## Fitur Utama

- **Form Pendaftaran Santri** – Calon santri mengisi data lengkap, mengunggah berkas, lalu mendapatkan status melalui halaman cek-status.
- **Pembayaran Online** – Pengguna mengunggah bukti transfer, status diverifikasi admin, dan otomatis sinkron dengan data pendaftar.
- **Halaman Informasi Publik** – Beranda, biaya, brosur, alur, syarat, hingga berita terbaru terlokalisasi (ID/EN) dan mudah diperbarui.
- **Dashboard Admin** – Mengelola pendaftar, verifikasi berkas/pembayaran, export data, kelola konten hero, gelombang, kontak, dan statistik real-time.
- **Mode Maintenance** – Admin dapat mengunci semua halaman publik dengan pesan islami profesional saat perawatan sedang berlangsung.
- **PWA & Service Worker** – Situs dapat di-install sebagai aplikasi, dengan caching cerdas namun tetap memastikan data sensitif (pendaftar/pembayaran) selalu real-time.

## Teknologi

- **Frontend**: HTML5, Tailwind CSS, Bootstrap Icons, vanilla JS modular (admin.js, navbar.js, i18n.js)
- **Backend/API**: Vercel serverless (Python) dengan Supabase sebagai basis data & storage
- **Utility**: Toastr, Moment-style helpers, CSV export, WhatsApp notification templates

## Struktur Direktori Singkat

- `public/` – Halaman publik (beranda, daftar, cek-status, admin, dsb.) plus asset CSS/JS
- `lib/handlers/` – Router API (pendaftar, pembayaran, konten dinamis, maintenance, dsb.)
- `api/index.py` – Router utama Vercel yang memetakan endpoint ke handler
- `styles/`, `styles/tailwind`, `PWA_GUIDE.md`, dll. – utilitas styling dan panduan PWA

## Cara Menjalankan

1. Salin `.env.example` menjadi `.env` dan isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Jalankan secara lokal (misal menggunakan Vercel CLI):
   ```bash
   vercel dev
   ```
4. Deploy ke Vercel untuk memanfaatkan routing serverless & integrasi Supabase.

## Catatan

- Mode maintenance membutuhkan tabel `maintenance_settings` di Supabase (lihat handler `lib/handlers/maintenance_status.py`).
- Pastikan service worker terbaru (`public/sw.js`) telah aktif setelah deploy untuk menjamin caching & maintenance overlay bekerja.

Kontribusi, isu, atau perbaikan dapat diajukan melalui repository ini. Semoga bermanfaat untuk keberlangsungan PPDSB Al Ikhsan Beji.

Salam Hangat Dewa S.
