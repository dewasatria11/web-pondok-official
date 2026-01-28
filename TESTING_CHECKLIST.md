# Testing Checklist - Mobile File Upload Fix

## Test di Local Dulu (Sebelum Deploy)

### 1. Test Desktop Browser
- [ ] Buka `daftar.html` di Chrome desktop
- [ ] Isi form lengkap, upload semua file (ijazah, akta, foto, KK)
- [ ] Navigasi antar step wizard
- [ ] Klik "Konfirmasi Kirim"
- [ ] Pastikan semua file berhasil diupload
- [ ] Check browser console untuk log `[FILE_STORE]`

### 2. Test Mobile Browser (PENTING!)
- [ ] Buka `daftar.html` di Chrome/Safari mobile
- [ ] Isi form lengkap, upload semua file
- [ ] **Scroll halaman naik-turun**
- [ ] **Navigasi ke step lain dan kembali**
- [ ] **Tunggu 10-30 detik** (simulasi delay)
- [ ] Klik "Konfirmasi Kirim"
- [ ] Pastikan **TIDAK ADA error "file could not be read"**
- [ ] Pastikan semua file berhasil diupload

### 3. Test Edge Cases
- [ ] Upload file, hapus, upload lagi (file ganti)
- [ ] Upload file optional (BPJS) - pastikan tidak error
- [ ] Upload file besar mendekati 2MB
- [ ] Upload file dengan nama aneh (spasi, karakter khusus)

### 4. Check Browser Console
- [ ] Harus ada log: `[FILE_STORE] Stored fileIjazah: ...`
- [ ] Harus ada log: `[UPLOAD] File sources - Ijazah: stored ...`
- [ ] Tidak boleh ada error FileReader

## Cara Test Local

```bash
# Jalankan local server
npx http-server . -p 8080

# Atau gunakan Python
python3 -m http.server 8080

# Buka di browser
# Desktop: http://localhost:8080/public/daftar.html
# Mobile: http://[YOUR_IP]:8080/public/daftar.html
```

## Monitoring Setelah Deploy

1. Check error logs di Vercel dashboard
2. Monitor apakah ada error "file could not be read" di production
3. Check analytics untuk failed submissions
4. Siapkan rollback plan jika ada masalah

## Rollback Plan

Jika ada masalah setelah deploy:
```bash
# Revert ke commit sebelumnya
git revert HEAD
git push origin main
```

Atau restore file daftar.html dari backup:
- `daftar.html.backup` (sudah ada di public/)
