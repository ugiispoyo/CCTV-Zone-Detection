# Arsitektur platform

## Tujuan desain

Platform dipisahkan dari CV agar GPU service hanya bertanggung jawab pada RTSP, inference, tracking,
evaluasi line/zone, crop, dan perekaman. Platform menangani konfigurasi, data bisnis, penyimpanan R2,
dashboard, dan Telegram. Setiap proses dapat diskalakan serta gagal secara independen.

## Komponen

```text
Dashboard ──REST/WebSocket──> API ─────> MongoDB
                              │
                              ├──configuration event──> RabbitMQ ──> CV
                              │
CV ──detection event────────> RabbitMQ ──> Event Worker ──> MongoDB
CV ──multipart media────────> API staging
                                  │
                                  └──RabbitMQ──> Media Worker ──> R2
                                                             │
                                                             └──RabbitMQ
                                                                  │
                                                        Telegram Worker
                                                                  │
                                                           Telegram API
```

## Batas tanggung jawab

### Dashboard

- CRUD kamera, zona, jadwal, dan recipient Telegram.
- Menggambar koordinat normalisasi pada preview kamera.
- Live monitoring dan status operasional.
- Melihat event dan signed URL media.
- Tidak menerima RTSP credential dari API.

### API

- Sumber kebenaran konfigurasi dan endpoint dashboard.
- Endpoint internal konfigurasi/heartbeat CV.
- Validasi metadata event fallback HTTP.
- Menerima file hasil CV sebagai multipart dan menaruhnya di staging bersama.
- Menerbitkan pekerjaan ke RabbitMQ; tidak melakukan upload/Telegram di request thread.

### Event worker

- Mengonsumsi `detection.created.v2`.
- Upsert berdasarkan `eventId`; redelivery tidak membuat event ganda.

### Media worker

- Mengonsumsi `media.upload.requested.v1`.
- Upload face/body/frame/clip ke prefix R2 per tanggal dan event.
- Mengubah status event menjadi `ready`, menerbitkan `media.ready.v1`, lalu membersihkan staging.

### Telegram worker

- Memilih recipient aktif dengan scope semua/selected camera.
- Membuat signed URL R2 sementara; Telegram menerima file sebagai album, bukan link pesan.
- Menyimpan delivery per `(eventId, recipientId)` untuk mencegah pengiriman ganda.

## State machine event

```text
detected → media-processing → ready → notified
    │              │           │
    └──────────────┴───────────┴──> failed
```

- `detected`: metadata sudah persisten.
- `media-processing`: upload sedang berlangsung.
- `ready`: object R2 lengkap dan dapat dikirim.
- `notified`: seluruh recipient yang dipilih telah diproses.
- `failed`: kegagalan terminal yang memerlukan inspeksi/replay.

## Idempotensi dan ordering

- `eventId` dibuat CV sebagai UUID dan unik secara global.
- Event worker memakai MongoDB upsert dengan unique index.
- Media object key deterministik: `events/YYYY/MM/DD/{eventId}/{kind}.{ext}`.
- Telegram delivery memiliki unique compound index.
- Media normalnya tiba setelah video 10 detik selesai. Jika event belum terlihat, message di-requeue satu
  kali lalu masuk dead-letter exchange untuk inspeksi.

## Schedule efektif

Kamera adalah gate utama. Zona dengan `scheduleMode=inherit` mengikuti kamera. Zona custom efektif
hanya ketika jadwal kamera dan jadwal zona sama-sama aktif. Di luar seluruh schedule, CV boleh menutup
RTSP. Live preview dapat meminta inference ringan secara on-demand tanpa membuat event.

## Skalabilitas

- API stateless kecuali volume staging; gunakan shared volume atau object staging ketika multi-host.
- Tambahkan replica worker dengan queue yang sama untuk competing consumers.
- Jangan scale API sebelum staging dipindah ke shared filesystem/object store.
- Satu kamera diproses oleh satu CV owner pada satu waktu; ownership/lease berada di scope repository CV.

## Keputusan Redis

Redis belum menjadi dependency fase pertama. MongoDB menangani state persisten, RabbitMQ menangani
pekerjaan asynchronous, dan tracker CV menyimpan state frame-by-frame di memori proses. Menambahkan Redis
sekarang tidak memberi fungsi yang dipakai source.

Redis layak ditambahkan ketika platform memakai beberapa replica API/CV untuk camera ownership lease,
heartbeat dengan TTL, viewer presence untuk preview on-demand, distributed rate limit, atau Socket.IO
adapter lintas replica. Sampai kebutuhan tersebut diimplementasikan, MongoDB dan RabbitMQ sudah cukup.
