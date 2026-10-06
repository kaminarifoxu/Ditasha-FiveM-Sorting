# Ditasha FiveM Sorting

Desktop utility untuk merapikan kumpulan asset FiveM menjadi resource yang lebih siap dipasang ke server.

## Fitur v0.1.0

- Scan folder secara rekursif.
- Preview kategori sebelum file dipindahkan.
- Deteksi `ped`, `hair`, dan kategori pakaian umum.
- Kategori clothing: tops, pants, shoes, masks, hats, glasses, ears, watches, bracelets, accessories, undershirts, metadata, dan other.
- Mode **Copy (aman)** atau **Move**.
- Duplicate identik otomatis dilewati.
- Conflict dengan nama sama tetapi isi berbeda disimpan di `_conflicts` agar tidak merusak resource.
- Membuat `fxmanifest.lua` otomatis.
- Membuat `sort-report.json` dan `conflicts.json`.
- GitHub Actions untuk build Windows EXE dan release otomatis ketika membuat tag `v*`.

## Struktur hasil

```text
Ditasha_Sorted/
├─ [ditasha_peds]/
│  ├─ fxmanifest.lua
│  └─ stream/
├─ [ditasha_hair]/
│  ├─ fxmanifest.lua
│  └─ stream/
├─ [ditasha_clothes]/
│  ├─ fxmanifest.lua
│  └─ stream/
│     ├─ tops/
│     ├─ pants/
│     ├─ shoes/
│     ├─ masks/
│     ├─ hats/
│     └─ ...
├─ [ditasha_misc]/
└─ [ditasha_unsorted]/
```

Folder hasil bisa dicopy ke folder `resources` server. Tambahkan resource yang ingin dipakai ke `server.cfg`, misalnya:

```cfg
ensure [ditasha_peds]
ensure [ditasha_hair]
ensure [ditasha_clothes]
```

> Catatan: aturan klasifikasi dibuat konservatif. File ambigu tidak dipaksa masuk ke kategori tertentu karena salah rename/pindah dapat merusak pasangan model-texture.

## Menjalankan dari source

```bash
python -m pip install -r requirements.txt
python app.py
```

## Build EXE Windows

Jalankan:

```bat
build.bat
```

Hasil berada di:

```text
dist/Ditasha-FiveM-Sorting.exe
```

## Release

Workflow GitHub akan selalu menghasilkan artifact EXE pada push ke `main`.
Untuk membuat GitHub Release otomatis, buat tag versi seperti:

```bash
git tag v0.1.0
git push origin v0.1.0
```
