# 🎁 Saweria Discord Bot

Bot Discord untuk integrasi dengan [Saweria](https://saweria.co) - platform donasi Indonesia. Bot ini akan mengirimkan notifikasi real-time ke Discord setiap ada donasi masuk, lengkap dengan fitur leaderboard, donation goals, TTS, dan banyak lagi!

## ✨ Fitur

### 📢 Notifikasi Donasi
- Notifikasi real-time ke Discord channel
- Embed dengan informasi lengkap (nama, jumlah, pesan, waktu)
- Support media/GIF dari Saweria
- Milestone alerts untuk donasi besar (Diamond, Super, Bintang, Spesial)

### 🏆 Leaderboard & Statistik
- Top donatur all-time
- Donasi terbaru
- Total statistik donasi
- Rangkuman harian & mingguan (manual atau otomatis)

### 🎯 Donation Goals
- Set target donasi dengan deskripsi
- Progress bar visual
- Notifikasi otomatis saat goal tercapai

### 🔊 Voice Channel Features
- Sound alert saat donasi masuk
- **Text-to-Speech (TTS)** - Bacakan pesan donasi dengan suara
- Queue system untuk audio

### 🚫 Blacklist Filter
- Filter kata-kata terlarang dari pesan donasi
- Default blacklist + custom words
- Admin dapat menambah/hapus kata

### � Minimum Amount Alert
- Set minimum donasi untuk notifikasi Discord
- Set minimum donasi untuk TTS
- Donasi di bawah minimum tetap tercatat di database

### �💾 Database
- SQLite untuk penyimpanan persisten
- Semua donasi tercatat di database

## 📋 Daftar Commands

### Informasi
| Command | Deskripsi |
|---------|-----------|
| `/leaderboard [jumlah]` | Tampilkan top donatur |
| `/recentdonasi [jumlah]` | Tampilkan donasi terbaru |
| `/totaldonasi` | Tampilkan statistik donasi |
| `/summary [periode]` | Rangkuman donasi (harian/mingguan/semua) |
| `/goal` | Tampilkan progress donation goal |
| `/donasi` | Informasi cara berdonasi |
| `/donasihelp` | Bantuan semua perintah |

### Admin Only
| Command | Deskripsi |
|---------|-----------|
| `/testdonasi [nama] [jumlah] [pesan]` | Test notifikasi donasi |
| `/setgoal <target> [deskripsi]` | Set target donasi |
| `/resetgoal` | Reset donation goal |
| `/autosummary <mode>` | Atur summary otomatis |
| `/joinvc [channel]` | Bot gabung voice channel |
| `/leavevc` | Bot keluar voice channel |
| `/blacklist add <kata>` | Tambah kata ke blacklist |
| `/blacklist remove <kata>` | Hapus kata dari blacklist |
| `/blacklist list` | Lihat daftar blacklist |
| `/blacklist test <teks>` | Test filter blacklist |
| `/minalert set <jumlah>` | Set minimum amount untuk notifikasi |
| `/minalert tts <jumlah>` | Set minimum amount untuk TTS |
| `/minalert status` | Lihat setting minimum amount |

## 🚀 Instalasi

### Prerequisites
- [Node.js](https://nodejs.org/) v16.9.0 atau lebih baru
- Akun [Discord Developer](https://discord.com/developers/applications)
- Akun [Saweria](https://saweria.co)

### Langkah Instalasi

1. **Clone repository**
   ```bash
   git clone https://github.com/IsmetMaulanaAzhari/Tes_Saweria.git
   cd Tes_Saweria
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi environment**
   ```bash
   cp .env.example .env
   ```
   Edit file `.env` dengan data kamu (lihat bagian Konfigurasi)

4. **Jalankan bot**
   ```bash
   npm start
   ```
   
   Atau untuk development:
   ```bash
   npm run dev
   ```

## ⚙️ Konfigurasi

Edit file `.env` dengan konfigurasi berikut:

### Wajib Diisi
```env
# Token dari Discord Developer Portal
DISCORD_TOKEN=your_discord_bot_token

# ID channel untuk notifikasi donasi
DISCORD_CHANNEL_ID=your_channel_id

# Stream key dari Saweria (https://saweria.co/overlays)
SAWERIA_STREAM_KEY=your_stream_key

# Username Saweria untuk link donasi
SAWERIA_USERNAME=your_username
```

### Opsional
```env
# Server & Role untuk top donatur
GUILD_ID=your_server_id
TOP_DONATOR_ROLE_ID=your_role_id

# Voice channel untuk sound alert & TTS
VOICE_CHANNEL_ID=your_voice_channel_id
ENABLE_SOUND_ALERT=true
SOUND_FILE=alert.mp3

# Text-to-Speech
ENABLE_TTS=true
TTS_LANGUAGE=id

# Minimum Amount Alert (0 = tampilkan semua)
MIN_ALERT_AMOUNT=0
MIN_TTS_AMOUNT=0

# Channel untuk summary otomatis
SUMMARY_CHANNEL_ID=your_summary_channel_id
```

### Cara Mendapatkan ID

1. **Discord Token**: 
   - Buka [Discord Developer Portal](https://discord.com/developers/applications)
   - Buat aplikasi baru → Bot → Reset Token → Copy

2. **Channel/Server ID**: 
   - Discord Settings → Advanced → Enable Developer Mode
   - Klik kanan channel/server → Copy ID

3. **Saweria Stream Key**: 
   - Login ke [Saweria](https://saweria.co)
   - Buka menu Overlays
   - Copy Stream Key dari URL

## 📁 Struktur Project

```
Saweria/
├── index.js                 # Entry point
├── .env                     # Environment variables
├── .env.example             # Template konfigurasi
├── package.json
├── donations.db             # SQLite database (auto-generated)
├── alert.mp3                # Sound alert file (opsional)
│
└── src/
    ├── config.js            # Konfigurasi & konstanta
    ├── database.js          # Setup SQLite
    │
    ├── commands/
    │   └── index.js         # Definisi slash commands
    │
    ├── handlers/
    │   └── commandHandler.js # Handler interaksi
    │
    ├── modules/
    │   ├── blacklist.js     # Filter kata terlarang
    │   ├── donation.js      # Pemrosesan donasi
    │   ├── goals.js         # Donation goals
    │   ├── summary.js       # Rangkuman donasi
    │   └── voice.js         # Voice & TTS
    │
    ├── services/
    │   └── saweria.js       # Koneksi Saweria socket
    │
    └── utils/
        └── helpers.js       # Fungsi utilitas
```

## 🔧 Milestone Donasi

Bot akan memberikan alert khusus untuk donasi besar:

| Jumlah | Emoji | Title |
|--------|-------|-------|
| ≥ Rp 500.000 | 💎 | DONASI DIAMOND! |
| ≥ Rp 200.000 | 🌟 | DONASI SUPER! |
| ≥ Rp 100.000 | ⭐ | DONASI BINTANG! |
| ≥ Rp 50.000 | 🔥 | DONASI SPESIAL! |

## 🗣️ Text-to-Speech (TTS)

Fitur TTS akan membacakan pesan donasi di voice channel:

1. Set `ENABLE_TTS=true` di `.env`
2. Gunakan `/joinvc` untuk bot gabung voice channel
3. Setiap donasi masuk, bot akan membacakan:
   > "[Nama] donasi [jumlah] ribu rupiah. Pesan: [isi pesan]"

Bahasa yang didukung:
- `id` - Indonesia (default)
- `en` - English
- `ja` - Japanese
- Dan lain-lain (Google Translate TTS)

## 📝 Blacklist Words

Bot secara default memfilter kata-kata kasar dalam bahasa Indonesia. Admin dapat mengelola blacklist:

```
/blacklist add <kata>     # Tambah kata
/blacklist remove <kata>  # Hapus kata
/blacklist list           # Lihat semua
/blacklist test <teks>    # Test filter
```

## � Minimum Amount Alert

Fitur untuk mengatur minimum donasi yang akan ditampilkan/dibacakan:

```
/minalert set <jumlah>    # Set min. untuk notifikasi Discord
/minalert tts <jumlah>    # Set min. untuk TTS
/minalert status          # Lihat setting saat ini
```

**Contoh penggunaan:**
- `/minalert set 10000` - Hanya donasi Rp 10.000+ yang muncul di Discord
- `/minalert tts 50000` - Hanya donasi Rp 50.000+ yang dibacakan TTS
- `/minalert set 0` - Tampilkan semua donasi

> **Note:** Donasi di bawah minimum tetap tercatat di database dan dihitung dalam leaderboard/statistik.

## �🐛 Troubleshooting

### Bot tidak bisa login
- Pastikan `DISCORD_TOKEN` benar
- Pastikan bot sudah diinvite ke server dengan permission yang cukup

### Donasi tidak muncul
- Cek `SAWERIA_STREAM_KEY` sudah benar
- Pastikan console tidak ada error koneksi

### TTS tidak berbunyi
- Pastikan `ENABLE_TTS=true`
- Bot harus sudah di voice channel (`/joinvc`)
- Cek apakah ada error di console

### Sound alert tidak berbunyi
- Pastikan file `alert.mp3` ada di folder root
- Set `ENABLE_SOUND_ALERT=true`

## 📄 License

MIT License - Silakan gunakan dan modifikasi sesuai kebutuhan.

## 🤝 Contributing

Pull requests welcome! Untuk perubahan besar, silakan buka issue terlebih dahulu.

---

Made with ❤️ for Indonesian Streamers
