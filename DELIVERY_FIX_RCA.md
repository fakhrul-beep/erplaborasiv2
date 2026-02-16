# Root Cause Analysis (RCA) - Delivery Module Issues

## 1. Masalah: Redirect/Konten Kosong pada Menu Vendor Ekspedisi
### Deskripsi
User melaporkan bahwa menu Vendor Ekspedisi menampilkan konten kosong dan terkadang mengarahkan kembali ke dashboard utama.

### Akar Masalah (Root Cause)
1. **Role-Based Access Control (RBAC) Terlalu Restriktif**: Pada file `Layout.tsx`, section "Pengiriman" hanya diizinkan untuk role `superadmin`, `delivery`, `warehouse`, dan `admin`. Role lain seperti `sales` atau `purchasing` tidak dapat melihat menu ini di sidebar, sehingga saat diakses secara manual, sidebar terlihat kosong.
2. **Logika Auto-Expand Sidebar**: Logika auto-expand hanya berjalan jika `profile` sudah dimuat. Jika navigasi terjadi saat profil masih dalam proses loading, section menu tidak terbuka secara otomatis.

### Solusi yang Diimplementasikan
1. **Pembaruan RBAC**: Menambahkan role `sales`, `sales_equipment`, `sales_raw_material`, dan `purchasing` ke dalam daftar akses section "Pengiriman" di `Layout.tsx`.
2. **Perbaikan Auto-Expand**: Memindahkan logika deteksi route aktif ke luar pengecekan `profile` sehingga sidebar selalu terbuka pada section yang benar meskipun data profil masih dimuat.
3. **Mekanisme Recovery Schema Cache**: Mengimplementasikan utilitas `withRetry` di `src/lib/supabase.ts` yang secara otomatis melakukan percobaan ulang (retry) hingga 2 kali dengan jeda jika mendeteksi error `PGRST205` (schema cache). Hal ini memastikan aplikasi tetap berjalan lancar saat terjadi sinkronisasi skema database.

---

## 2. Masalah: Error 'Could not find the table public.shipment_orders'
### Deskripsi
Terjadi error saat memuat laporan pengiriman karena tabel `shipment_orders` tidak ditemukan dalam schema cache.

### Akar Masalah (Root Cause)
1. **Schema Cache Stale**: Meskipun migrasi SQL untuk pembuatan tabel `shipment_orders` sudah ada, API Supabase (PostgREST) terkadang belum memperbarui cache skema internalnya setelah tabel baru dibuat.
2. **Migrasi Belum Terintegrasi**: Tabel `shipment_orders` mungkin belum sepenuhnya ter-apply ke instance database remote.

### Solusi yang Diimplementasikan
1. **Auto-Retry on Frontend**: Seluruh query ke tabel `shipment_orders` dan `shipping_vendors` kini dibungkus dengan fungsi `withRetry` untuk menangani kegagalan cache sementara secara transparan bagi pengguna.
2. **Refresh Schema Cache**: (Rekomendasi) Jalankan perintah berikut di SQL Editor Supabase untuk memaksa pembaruan cache jika masalah menetap:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
3. **Verifikasi Tabel**: Pastikan tabel `shipment_orders` dan `shipping_vendors` sudah muncul di daftar tabel skema `public` pada dashboard Supabase.

---

## 3. Masalah: Keamanan Route (RBAC) pada Level Aplikasi
### Deskripsi
Sebelumnya, `ProtectedRoute.tsx` hanya memeriksa apakah user sudah login, namun tidak memvalidasi apakah user memiliki role yang diizinkan untuk mengakses route tertentu.

### Akar Masalah (Root Cause)
Komponen `ProtectedRoute` hanya melakukan pengecekan `user` (auth session), sehingga user dengan role apa pun bisa mengakses URL internal jika mereka mengetahui path-nya, meskipun menu tersebut disembunyikan di sidebar.

### Solusi yang Diimplementasikan
1. **Validasi Role di ProtectedRoute**: Memperbarui [ProtectedRoute.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/components/ProtectedRoute.tsx) untuk menerima properti `allowedRoles`. Jika user tidak memiliki role yang sesuai, mereka akan diarahkan kembali ke Dashboard.
2. **Penerapan di App.tsx**: Membungkus route pengiriman di [App.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/App.tsx) dengan `ProtectedRoute` yang membatasi akses hanya untuk role yang relevan.

---

## 4. Masalah: Error Handling dan Logging yang Minim
### Deskripsi
Beberapa halaman di modul pengiriman tidak memberikan feedback yang jelas saat terjadi error, terutama saat terjadi masalah koneksi atau schema cache stale.

### Solusi yang Diimplementasikan
1. **User-Friendly Error Messages**: Menambahkan deteksi error "schema cache" pada [ShipmentList.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/ShipmentList.tsx), [VendorManagement.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/VendorManagement.tsx), dan [DeliveryReports.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/DeliveryReports.tsx). Jika error ini terdeteksi, user disarankan untuk me-refresh halaman.
2. **Logging**: Menambahkan `console.error` pada blok `catch` untuk memudahkan debugging melalui browser console.

---

## Langkah Deployment & Pencegahan Regresi
1. **Deployment**:
   - Push perubahan pada `src/components/Layout.tsx`, `src/components/ProtectedRoute.tsx`, dan `src/App.tsx`.
   - Update file-file di folder `src/pages/Delivery/` untuk menyertakan error handling terbaru.
   - Pastikan file migrasi `supabase/migrations/20260213000000_shipment_management_system.sql` sudah dijalankan di database target.
2. **Pencegahan**:
   - Gunakan properti `allowedRoles` pada `ProtectedRoute` untuk setiap modul baru yang membutuhkan pembatasan akses.
   - Selalu gunakan blok `try-catch` dengan feedback `toast` dan `console.error` pada setiap fungsi fetch data.
   - Jalankan unit tests pada [Layout.test.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/components/Layout.test.tsx) sebelum melakukan deployment untuk memastikan navigasi tidak pecah.
## Verifikasi Akhir
- **Build Status**: ✅ Berhasil (`npm run build` sukses tanpa error pada 2026-02-13).
- **Unit Tests**: ✅ Test case untuk navigasi Vendor Ekspedisi telah ditambahkan dan diverifikasi.
- **Syntax Check**: ✅ Perbaikan syntax pada [ShipmentDetail.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/ShipmentDetail.tsx) untuk menangani karakter khusus (`&gt;`).

---

## 5. Pembaruan Role dan Hak Akses Logistik (Februari 2026)
### Deskripsi
Implementasi role baru "logistik" dan pengetatan hak akses pada modul Logistik untuk meningkatkan keamanan data.

### Perubahan Utama
1. **Role Baru**: Menambahkan role `logistik` ke dalam sistem.
2. **Database Constraint**: Memperbarui `users_role_check` di database melalui migrasi [20260213000001_add_logistics_role.sql](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/supabase/migrations/20260213000001_add_logistics_role.sql).
3. **Pembatasan Akses**:
   - Modul logistik kini hanya dapat diakses oleh: `superadmin`, `admin`, `manager`, dan `logistik`.
   - Role lain (seperti `sales`, `purchasing`) yang sebelumnya memiliki akses terbatas kini telah dicabut hak aksesnya dari modul ini.
4. **Validasi Multi-layer**:
   - **UI (Sidebar)**: Menu logistik disembunyikan di [Layout.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/components/Layout.tsx) bagi user yang tidak berwenang.
   - **Routing**: Proteksi route di [App.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/App.tsx) menggunakan `ProtectedRoute`.
   - **Data Fetching/Saving**: Validasi role di dalam komponen (misal: [ShipmentList.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/ShipmentList.tsx) dan [VendorManagement.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/VendorManagement.tsx)).

### Verifikasi
- **Unit Tests**: ✅ [LogisticsAccess.test.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Delivery/LogisticsAccess.test.tsx) memverifikasi pembatasan akses untuk berbagai role.
- **UI Management**: ✅ Role `logistik` telah ditambahkan ke dropdown pilihan role di [UserManagement.tsx](file:///c:/Users/Fakhrul/Documents/trae_projects/ERPLaborasi/src/pages/Admin/UserManagement.tsx).

---

## 6. Penanganan Lanjutan Error PGRST205 (Penting)

Jika Anda masih melihat error `Could not find the table 'public.shipment_orders'`, hal ini kemungkinan besar disebabkan oleh salah satu dari dua hal berikut:

### A. Migrasi Belum Dijalankan
Pastikan file migrasi berikut telah dijalankan di dashboard Supabase atau melalui CLI:
1. `supabase/migrations/20260213000000_shipment_management_system.sql` (Membuat tabel)
2. `supabase/migrations/20260213000001_logistics_split.sql` (Menambah kolom & reload schema)

### B. PostgREST Cache Belum Refresh
Sistem telah diperbarui untuk melakukan retry hingga **10 kali** dengan jeda yang meningkat (*exponential backoff*). Jika retry tetap gagal:
1. Masuk ke Supabase SQL Editor.
2. Jalankan perintah berikut untuk memaksa refresh cache secara manual:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
3. Refresh halaman browser Anda.

### C. Perbaikan Kode yang Dilakukan
- Menambahkan `withRetry` dengan parameter yang lebih agresif (10 retries, 2000ms initial delay).
- Memberikan feedback visual berupa Toast saat sinkronisasi sedang berlangsung.
- Menambahkan log detail di konsol untuk memantau proses retry.
