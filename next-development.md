# NodeCtrl — Next Development Ideas

Roadmap fitur pengembangan selanjutnya, diurutkan berdasarkan prioritas dan impact.

---

## Status

| # | Fitur | Status |
|---|-------|--------|
| 1 | Multi-Project / Workspace Manager | ✅ Done |
| 2 | Git Integration | ✅ Done |
| 3 | Split Terminal | ✅ Done |
| 4 | Dependency Manager Visual | ✅ Done |
| 5 | Script Favorites / Quick Launch | ✅ Done |
| 6 | Bun Support | ✅ Done |
| 7 | Process Monitor | ✅ Done |
| 8 | Log File Viewer | ✅ Done |
| 9 | Keyboard Shortcuts | ✅ Done |
| 10 | Persistent State | ✅ Done |
| 11 | Command Palette (Ctrl+K) | ✅ Done |
| 12 | Notifications & History Log | ✅ Done |

---

## Prioritas Utama

### 1. Multi-Project / Workspace Manager
- Sidebar daftar project favorit yang bisa disimpan
- Klik project untuk langsung switch working directory
- Simpan ke file config lokal (`nodectrl.config.json`) agar persisten
- Tampilkan nama project, package manager, dan framework yang terdeteksi per item

### 2. Git Integration (Dasar)
- Panel info: branch aktif, status (clean/dirty), jumlah uncommitted changes
- Tampilkan recent commits (5 terakhir)
- Quick-action buttons: `git pull`, `git push`, `git status`, `git stash`
- Indikator visual di header jika ada perubahan yang belum di-commit

### 3. Split Terminal
- Dua atau lebih terminal pane yang bisa dibuka sejajar (horizontal/vertical)
- Berguna untuk jalankan `dev server` + `test watcher` bersamaan
- Tiap pane punya history sendiri
- Tombol close per pane

---

## Fitur Penting Lainnya

### 4. Dependency Manager Visual
- Tabel semua dependencies dengan versi terinstall vs versi latest
- Badge untuk deps yang outdated
- Tombol update per-package atau "Update All Outdated"
- Integrasi `npm audit` — tampilkan vulnerability report secara visual (bukan plain text)
- Filter: production / devDependencies / outdated / vulnerable

### 5. npm Script Favorites / Quick Launch
- Panel tombol-tombol untuk script yang paling sering dipakai (dev, build, test, lint)
- Bisa dikustomisasi per project
- Drag-and-drop untuk reorder
- Shortcut keyboard per script (misal: `Ctrl+Shift+D` untuk `npm run dev`)

### 6. Bun Support
- Tambah Bun sebagai opsi package manager
- Deteksi otomatis via `bun.lockb` di project scanner
- Semua command npm/pnpm yang ada juga tersedia untuk Bun

### 7. Process Monitor
- Tampilkan CPU % dan RAM usage dari proses yang berjalan di port aktif
- Auto-refresh setiap beberapa detik
- Highlight proses yang konsumsi resource tinggi
- Pada Windows: gunakan `wmic`, pada Unix: gunakan `ps`

### 8. Log File Viewer
- Auto-detect file log di project (`logs/`, `*.log`, `npm-debug.log`)
- Tail log dengan auto-scroll di terminal panel
- Filter log by level (ERROR, WARN, INFO)
- Clear log button

---

## Kualitas & Polish

### 9. Keyboard Shortcuts Lebih Lengkap
| Shortcut | Aksi |
|----------|------|
| `Ctrl+K` | Command palette (cari & jalankan command apapun) |
| `Ctrl+T` | Buka terminal baru / split |
| `Ctrl+1/2/3` | Switch antar panel (sidebar / terminal / info) |
| `Ctrl+Shift+P` | Buka package.json editor |
| `Ctrl+Shift+E` | Buka .env editor |
| `Ctrl+L` | Clear terminal aktif |
| `Ctrl+C` | Kill proses yang sedang berjalan |

### 10. Persistent State
- Simpan ke `localStorage`: working directory, tema, panel sizes, open tabs
- Simpan project favorites ke file `~/.nodectrl/config.json`
- Restore session terakhir saat browser di-refresh
- Export / import config sebagai file JSON

### 11. Command Palette
- `Ctrl+K` membuka modal search
- Cari command, script, atau project dengan fuzzy search
- Jalankan langsung dari palette tanpa klik-klik

### 12. Notifications & History Log
- Simpan riwayat semua command yang pernah dijalankan dengan timestamp
- Status terakhir (sukses/gagal/dibatalkan)
- Ekspor history sebagai `.txt` atau `.json`
- Desktop notification (Web Notifications API) saat command selesai

---

## Ide Jangka Panjang

### 13. Plugin / Extension System
- API sederhana untuk menambah panel atau command custom
- Plugin disimpan di folder `plugins/`
- Contoh plugin: Docker manager, Database viewer, API tester

### 14. Remote Server Support
- Koneksi ke server remote via SSH tunnel
- Jalankan npm/node commands di server remote
- Tampilkan output live seperti biasa via WebSocket

### 15. Template Project
- Buat project baru dari template (React+Vite, Express, Next.js, dll.)
- Jalankan `npx create-*` dengan pilihan interaktif lewat GUI
- Simpan template custom sendiri

### 16. Docker Integration
- Tampilkan container Docker yang sedang berjalan
- Start/stop/restart container
- Lihat logs container langsung di terminal panel

---

## Catatan Teknis

- Tetap pertahankan **zero npm dependencies** sebisa mungkin
- Semua fitur baru harus backward compatible (tidak break existing behavior)
- Pertimbangkan memecah `server/index.js` menjadi beberapa modul saat fitur bertambah:
  - `server/routes/` — per-feature API routes
  - `server/services/` — git, ports, nvm, dll.
- Frontend bisa mulai dipisah ke beberapa file JS jika `index.html` makin besar
