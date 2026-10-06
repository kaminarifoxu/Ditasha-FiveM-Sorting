# Ditasha FiveM Sorting

Desktop utility untuk merapikan asset FiveM dan membuat resource yang siap dipasang ke server.

## Fitur v0.3.0

- Scan folder FiveM secara rekursif.
- Sorting ped, hair, dan clothing ke resource terpisah.
- Kategori clothing: tops, pants, shoes, masks, hats, glasses, ears, watches, bracelets, accessories, undershirts, metadata, dan other.
- Mode **Copy** atau **Move**.
- Duplicate identik dilewati dan conflict diamankan.
- Membuat `fxmanifest.lua`, `sort-report.json`, dan `conflicts.json` otomatis.
- Asset browser YDD dengan pencarian.
- Pairing otomatis **1 YDD → banyak YTD** berdasarkan component/index FiveM.
- Dropdown texture variant sehingga tidak perlu mencari YTD manual.
- **3D Preview YDD/YTD langsung di aplikasi** pada Windows.
- Drag mouse untuk rotate, scroll untuk zoom, dan tombol Reset View.
- Mengganti dropdown YTD langsung reload texture model.
- Auto-check update dari GitHub Releases.
- Download, install, lalu buka ulang EXE terbaru otomatis.
- GitHub Actions build Windows EXE dan publish release saat tag `v*` dibuat.

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

Folder hasil bisa dicopy ke folder `resources` server.

```cfg
ensure [ditasha_peds]
ensure [ditasha_hair]
ensure [ditasha_clothes]
```

## 3D Preview

Preview native `.ydd/.ytd` memakai **szio + PyMateria** untuk membaca resource GTA V dan OpenGL untuk menampilkannya di aplikasi.

1. Pilih Source folder.
2. Buka tab **Preview 3D**.
3. Klik **Load Assets**.
4. Pilih YDD.
5. Semua YTD yang cocok muncul di dropdown **Texture Variant**.
6. Pilih variant lain untuk langsung reload texture.
7. Drag untuk rotate dan scroll untuk zoom.

Jika sebuah YDD tidak punya YTD pasangan, model tetap dicoba dibuka tanpa external texture.

## Menjalankan dari source

Windows direkomendasikan untuk native preview.

```bash
python -m pip install -r requirements.txt
python app.py
```

## Build EXE Windows

```bat
build.bat
```

Hasil:

```text
dist/Ditasha-FiveM-Sorting.exe
```

## Release & Auto Update

Aplikasi mengecek **latest GitHub Release**, bukan commit `main`. Untuk menerbitkan versi yang bisa didownload updater:

```bash
git tag v0.3.0
git push origin v0.3.0
```

GitHub Actions akan build `Ditasha-FiveM-Sorting.exe` dan memasukkannya ke Release. Pengguna versi lama kemudian akan mendapatkan notifikasi update otomatis.
