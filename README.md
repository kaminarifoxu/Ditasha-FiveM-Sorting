# DITASHA Asset Sorter — Windows

Aplikasi portable Windows 10/11 64-bit untuk menyortir aset FiveM dan mengekspor resource. Buka **DITASHA-Asset-Sorter.exe** langsung; tidak perlu Node.js, browser terpisah, login, atau pemasangan. Pembukaan pertama perlu waktu untuk mengekstrak runtime ke folder sementara. Aplikasi tidak membutuhkan hak administrator. Unduhan resmi: https://github.com/kaminarifoxu/Ditasha-FiveM-Sorting/releases/latest.

## Penggunaan

1. Pilih file/ZIP, pilih folder, atau tarik aset ke area impor. Batas total 25 GiB (25 × 1024³ byte), 50.000 file. File dibaca bertahap.
2. Periksa kategori dan temuan. Mode Pertahankan memakai nama dan metadata bawaan; Add-on freemode membuat YMT biner RSC7 dan shop META. Ped kustom memerlukan YMT dan peds.meta asli.
3. Klik nama YDD atau Preview 3D. Pilih drawable, LOD, file YTD pasangan, dan gambar tekstur di dalam YTD. Mendukung GTA V Legacy, DXT1/3/5 dan RGBA. Preview statis, tanpa animasi/rig/cloth; maks. 128 MiB per file.
4. Klik Unduh resource ZIP dan pilih lokasi penyimpanan. Hasil berisi fxmanifest.lua, stream per kategori/item, metadata, README dan laporan.
5. Ekspor sebelum menutup: sesi impor tidak tersimpan. Aplikasi meminta konfirmasi jika sesi masih berisi aset. Pembatalan ekspor menghapus file sementara dan mempertahankan ZIP lama.

Aset diproses lokal, tidak diunggah. Seluruh runtime dan library 3D ada dalam aplikasi. Tautan dokumentasi hanya membutuhkan internet jika dibuka. Sediakan ruang disk untuk ZIP keluaran; ukuran dapat sedikit lebih besar dari total aset. YMT baru dan resource keluaran tetap harus diuji di server FiveM.

## Beberapa YDD sekaligus

Pada Preview 3D, centang model dalam daftar lalu klik Buka model terpilih. Maksimal 4 YDD, gabungan 2 juta vertex / 512 MiB resource, dan tekstur GPU 128 MiB. Pilih Tumpuk untuk melihat kombinasi komponen atau Jajarkan untuk membandingkan model. Dropdown Model aktif untuk tekstur mengubah YTD, drawable dan LOD khusus model itu; model lain tetap terlihat. Ini mesh statis dengan posisi vertex asli, bukan perakitan karakter memakai rig.

## Update otomatis

Aplikasi memeriksa GitHub Releases ketika dibuka dan setiap 30 menit. Unduh otomatis aktif secara bawaan dan dapat dimatikan lewat tombol Update. Unduhan ditulis bertahap dan diverifikasi SHA-256. Setelah siap, klik Pasang & mulai ulang; sesi impor perlu diekspor terlebih dahulu. EXE lama diganti oleh helper Windows setelah runtime portable ditutup. Helper memulihkan EXE sebelumnya jika aplikasi baru gagal mengonfirmasi startup. Internet hanya diperlukan untuk update dan tautan dokumentasi.

Versi 1.3.0 yang dibagikan sebelumnya belum memiliki updater: unduh versi 1.4.0 ini sekali secara manual. Versi berikutnya bisa diunduh dari aplikasi.

## Merilis versi berikutnya di GitHub

Naikkan nomor `version` di package.json dan package-lock.json, lalu push perubahan ke main. GitHub Actions menjalankan tes, membangun portable Windows, menghasilkan checksum, dan menerbitkan release vX.Y.Z beserta EXE. Rilis yang sudah ada dipertahankan; setiap versi baru perlu nomor lebih tinggi. EXE disimpan di Releases, bukan file source Git karena ukurannya melebihi batas file biasa GitHub.

## Membangun dari kode sumber

Gunakan Node.js 22 atau lebih baru di Windows:

```sh
npm ci
npm test
npm run build:win
```

Hasil: `release/DITASHA-Asset-Sorter.exe`. Versi Electron dan electron-builder dikunci di package-lock.json. `npm start` membuka versi pengembangan.

Paket portable memakai Electron 44.5.1 dan electron-builder 26.15.3. Copyright © 2026 Ditasha-Workshop. Kode proyek tidak diberi lisensi distribusi bebas; lisensi dependensi tercantum dalam `ui/THIRD_PARTY_NOTICES.txt` dan runtime Chromium/Electron.

## Validasi dan keterbatasan

Pengujian engine, streaming ZIP64 dan parser model/tekstur lolos. Pengujian desktop mencakup penulisan ZIP bertahap, commit dan pembatalan, penjagaan origin/IPC, serta bridge renderer. Struktur PE x64 dan isi app.asar paket diperiksa. Pengujian UI Electron di Linux headless terhalang pembatasan runtime. GitHub Actions menjalankan smoke test UI pada runner Windows; hasil terakhir dapat dilihat di Actions. Ekspor 25 GiB penuh dan render WebGL belum diuji pada perangkat nyata. Executable belum ditandatangani dengan sertifikat penerbit.
