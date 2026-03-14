# ⬡ NodeCtrl

GUI untuk npm, pnpm, bun, dan nvm berbasis web — backend Node.js + WebSocket.

**Zero npm dependencies** — hanya pakai Node.js built-in modules.

---

## 🚀 Cara Menjalankan

### 1. Pastikan Node.js terinstall
```bash
node --version   # minimal v16
```

### 2. Clone / extract folder ini, lalu jalankan server
```bash
cd nodectrl
node server/index.js
```

### 3. Buka browser
```
http://localhost:3000
```

---

## 📁 Struktur Project

```
nodectrl/
├── server/
│   ├── index.js        ← HTTP + WebSocket server utama
│   └── ws-server.js    ← WebSocket RFC 6455 (pure Node.js)
├── public/
│   └── index.html      ← Frontend GUI lengkap
├── package.json
└── README.md
```

---

## ✨ Fitur

### Package Managers
| Fitur | Keterangan |
|-------|-----------|
| **npm** | 40+ command lengkap dengan flag toggle |
| **pnpm** | 40+ command lengkap termasuk workspace & filtering |
| **bun** | Runtime + package manager cepat, semua command tersedia |
| **nvm** | Kelola versi Node.js, install/switch/alias |
| **Drag-and-drop Cards** | Urutkan ulang command card sesuai preferensi |

### Terminal
| Fitur | Keterangan |
|-------|-----------|
| **Live Terminal Output** | stdout/stderr streaming real-time via WebSocket |
| **Split Terminal** | Dua terminal berjalan sejajar (Ctrl+T) |
| **Kill Process** | Stop command yang sedang berjalan |
| **Command History** | Tekan ↑↓ di terminal untuk navigasi history |

### Project Tools
| Fitur | Keterangan |
|-------|-----------|
| **Workspace Manager** | Simpan & switch antar project favorit di sidebar |
| **Git Integration** | Branch aktif, status clean/dirty, recent commits, quick actions |
| **Project Scanner** | Deteksi package manager, framework, scripts, env files |
| **package.json Editor** | Load, edit, dan save package.json secara visual |
| **.env Editor** | Baca dan edit file .env langsung dari GUI |

### Monitoring & Analysis
| Fitur | Keterangan |
|-------|-----------|
| **Dependency Manager** | Tabel deps dengan versi installed vs latest, badge outdated & vulnerable |
| **npm audit Visual** | Vulnerability report dengan badge severity (critical/high/moderate/low) |
| **Update All Outdated** | Update semua package outdated sekaligus |
| **Process Monitor** | CPU% dan Memory usage semua proses, auto-refresh 3 detik |
| **Port Scanner** | Tampilkan semua port aktif + PID, tombol kill per proses |
| **Log Viewer** | Auto-detect file `.log`, filter by level ERROR/WARN/INFO |

### UX & Produktivitas
| Fitur | Keterangan |
|-------|-----------|
| **Command Palette** | Ctrl+K — fuzzy search command, panel, workspace, dan script |
| **Script Favorites** | Pin script favorit di sidebar, drag-and-drop untuk reorder |
| **Command History Panel** | Riwayat semua command + status, klik untuk re-run, export JSON |
| **Desktop Notifications** | Notifikasi sistem saat command selesai (opt-in) |
| **Persistent State** | Tema, working directory, dan panel aktif tersimpan di localStorage |
| **Dark/Light Mode** | Toggle tema, disimpan otomatis |
| **nodemon Panel** | Jalankan nodemon dengan flag pilihan langsung dari GUI |
| **ncu Panel** | npm-check-updates — cek dan upgrade versi dependency |

### Keyboard Shortcuts
| Shortcut | Aksi |
|----------|------|
| `Ctrl+K` | Buka Command Palette |
| `Ctrl+T` | Toggle Split Terminal |
| `Ctrl+L` | Clear terminal aktif |
| `Ctrl+Shift+P` | Buka package.json Editor |
| `Ctrl+Shift+E` | Buka .env Editor |
| `Ctrl+1…9` | Switch panel (npm, pnpm, bun, nvm, git, pkg, scanner, env, ports) |
| `↑ / ↓` | Navigasi command history di terminal |

---

## ⚙️ Konfigurasi

```bash
# Ganti port (default: 3000)
PORT=8080 node server/index.js
```

Workspace favorit disimpan di `~/.nodectrl/workspaces.json`.

---

## 🔒 Keamanan

- Server **hanya berjalan di localhost** — tidak expose ke internet
- Command berbahaya diblokir (`rm -rf /`, `mkfs`, dll)
- Gunakan hanya di development machine sendiri

---

## 📋 Persyaratan

- Node.js >= 16
- npm / pnpm / bun / nvm sudah terinstall di sistem (sesuai yang dipakai)
- OS: Linux, macOS, atau Windows (WSL direkomendasikan untuk nvm)
