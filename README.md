# PPDSB – Pendaftaran Web

Platform ini digunakan Pondok Pesantren Al Ikhsan Beji untuk mengelola seluruh proses Penerimaan Peserta Didik dan Santri Baru (PPDSB). Aplikasi memadukan laman publik untuk calon santri/wali dan dashboard admin yang terintegrasi dengan Supabase. 

Login Admin  email : admin@pondok.com | password : admin123 

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



klo mau edit ini langsung aja git add dan push ke main, biar otomatis ke deploy di vercel
Salam Hangat Dewa S.
