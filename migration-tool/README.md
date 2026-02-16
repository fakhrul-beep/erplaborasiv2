# Panduan Migrasi & Duplikasi Data Supabase

Dokumen ini menjelaskan proses identifikasi, analisis, dan duplikasi data dari `https://xnqxcxptjjqafrjwynsj.supabase.co` ke proyek Supabase tujuan Anda.

## 1. Identifikasi & Analisis Awal
Berdasarkan analisis otomatis menggunakan `verify_and_migrate.js`, ditemukan kondisi berikut pada Source Database:

- **Total Tabel:** 20 Tabel teridentifikasi.
- **Tabel dengan Data:**
  - `users`: 6 baris (Data pengguna)
  - `products`: 8 baris (Data produk)
- **Tabel Kosong:** 18 tabel lainnya (termasuk `customers`, `orders`, `transactions`, dll.)
- **Status Tujuan:** Tabel belum dibuat di database tujuan (semua tabel missing).

## 2. Proses Duplikasi & Validasi

Proses ini dirancang untuk menjamin integritas data 100% identik dengan sumbernya.

### Langkah 1: Persiapan Skema (Wajib)
Karena keterbatasan akses API (Anon Key), pembuatan tabel harus dilakukan manual melalui Dashboard Supabase.
1. Buka file `migration-tool/migrated_schema.sql`.
2. Copy seluruh isinya.
3. Buka Dashboard Supabase Tujuan -> SQL Editor.
4. Paste dan jalankan script tersebut.
   - *Pastikan tidak ada error saat pembuatan tabel.*

### Langkah 1b: Izin Akses Migrasi (KRITIS)
Secara default, Supabase mengaktifkan Row Level Security (RLS) yang memblokir akses tulis/baca dari luar. Anda WAJIB menjalankan script ini agar tool bisa mengisi data.
1. Buka file `migration-tool/enable_rls_policies.sql`.
2. Copy seluruh isinya.
3. Paste di SQL Editor Supabase Tujuan (tab baru).
4. Klik **Run**.
   - *Script ini memberikan izin sementara untuk INSERT/SELECT ke semua tabel.*

### Langkah 2: Eksekusi Duplikasi Otomatis
Jalankan script `verify_and_migrate.js` yang telah dibuat. Script ini mencakup:
- **Validasi Pra-Migrasi**: Memastikan tabel ada sebelum insert.
- **Upsert (Idempotent)**: Mencegah duplikasi ganda jika script dijalankan ulang.
- **Dependency Ordering**: Mengurutkan tabel berdasarkan relasi Foreign Key (misal: `roles` -> `users` -> `orders`).
- **Verifikasi Integritas**: Membandingkan jumlah baris Source vs Destination setelah migrasi.

```bash
node migration-tool/verify_and_migrate.js
```

### Langkah 3: Verifikasi & Laporan
Setelah script selesai, periksa file laporan yang dihasilkan:
- `migration-tool/reconciliation_report.md`: Laporan perbandingan jumlah baris dan status integritas.
- `migration-tool/migration.log`: Log detail setiap operasi.

## 3. Prosedur Rollback
Jika terjadi kesalahan atau kegagalan migrasi:
1. Buka file `migration-tool/rollback_script.sql` (dibuat otomatis saat migrasi berjalan).
2. File ini berisi perintah `DELETE` untuk membersihkan data yang baru saja dimasukkan, dikelompokkan per tabel.
3. Jalankan script ini di SQL Editor Supabase Tujuan untuk mengembalikan kondisi data (tabel tetap ada, data dihapus).

## 4. Troubleshooting
- **Error "Table not found"**: Pastikan Langkah 1 (Persiapan Skema) sudah dijalankan sukses.
- **Error "Foreign Key Violation"**: Script otomatis menangani urutan insert, namun jika terjadi, cek `migration.log` untuk detail tabel mana yang bermasalah.
