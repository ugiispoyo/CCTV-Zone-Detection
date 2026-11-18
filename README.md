# CCTV Zone Detection

Workspace ini terdiri dari dua bagian yang sengaja dipisahkan:

| Folder | Fungsi | Runtime |
| --- | --- | --- |
| [`platform`](platform/README.md) | Dashboard, API, workers, MongoDB/RabbitMQ/R2/Telegram | Node.js + pnpm |
| [`cv`](cv/README.md) | RTSP, inference, tracking, zona, preview, crop, clip | Python 3.12 + uv |

Urutan development lokal:

1. Jalankan infrastruktur dari `platform` dengan `pnpm infra:up`.
2. Jalankan API/dashboard/workers platform dari terminal.
3. Siapkan model dan jalankan CV dari terminal terpisah.
4. Tambahkan kamera/zona melalui dashboard dan gunakan preview URL CV.

Mulai dari [panduan local platform](platform/docs/local-development.md), lalu lanjutkan ke
[panduan local CV](cv/docs/local-development.md). Kontrak lintas service ada di
[`platform/packages/contracts`](platform/packages/contracts/README.md).

Autentikasi belum termasuk scope fase ini. Jangan expose service ke internet publik.
