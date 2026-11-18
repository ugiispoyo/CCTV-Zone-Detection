# CCTV Platform

Platform operasional untuk mengatur kamera RTSP, line/polygon zone, jadwal deteksi, live monitoring,
arsip kejadian, media Cloudflare R2, dan penerima Telegram. Computer vision berada di repository/folder
`cv` terpisah dan berkomunikasi melalui kontrak versi.

> Status keamanan: autentikasi dan otorisasi sengaja belum diaktifkan. Jangan membuka API, dashboard,
> MongoDB, atau RabbitMQ ke internet publik sebelum lapisan keamanan ditambahkan.

## Isi workspace

| Path                    | Fungsi                                                    |
| ----------------------- | --------------------------------------------------------- |
| `apps/dashboard`        | Vite + React + Tailwind, React Query, Zustand             |
| `apps/api`              | NestJS/Fastify REST, Swagger, WebSocket, media ingestion  |
| `apps/event-worker`     | Menyimpan detection event dari RabbitMQ secara idempotent |
| `apps/media-worker`     | Upload media CV dari staging ke Cloudflare R2             |
| `apps/telegram-worker`  | Memilih recipient dan mengirim tiga gambar + video        |
| `packages/contracts`    | TypeScript types, JSON Schema, dan AsyncAPI CV–platform   |
| `packages/database`     | Mongoose schema/model bersama                             |
| `packages/messaging`    | RabbitMQ publisher/consumer bersama                       |
| `packages/backend-core` | R2, Telegram, dan helper backend                          |

## Mulai cepat di local

Docker Compose lokal hanya menjalankan infrastruktur: MongoDB, RabbitMQ, dan MediaMTX. API, dashboard,
worker, serta nantinya CV dijalankan manual dari terminal.

Prasyarat: Node.js 22, Corepack/pnpm, dan Docker Compose v2.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up
pnpm dev
```

`infra:up` memeriksa service yang sudah berjalan lebih dulu. MongoDB, RabbitMQ, atau MediaMTX yang
kompatibel akan dipakai ulang meskipun nama containernya berbeda; Compose hanya memulai service yang
belum tersedia.

`pnpm dev` menjalankan API, dashboard, dan event worker. Akses lokal:

- Dashboard Vite: `http://localhost:5173`
- API Swagger: `http://localhost:4000/docs`
- API health: `http://localhost:4000/api/health`
- RabbitMQ management: `http://localhost:15672` (`guest` / `guest`)
- MediaMTX WebRTC: `http://localhost:8889/{stream-path}`
- MediaMTX HLS: `http://localhost:8888/{stream-path}`
- MediaMTX metrics: `http://localhost:9998/metrics`

Untuk menjalankan aplikasi di terminal terpisah:

```bash
pnpm dev:api
pnpm dev:dashboard
pnpm dev:event-worker
pnpm dev:media-worker
pnpm dev:telegram-worker
```

Media dan Telegram worker membutuhkan konfigurasi R2 serta `TELEGRAM_BOT_TOKEN`. Panduan lengkap ada
di [Local development](docs/local-development.md).

## Verifikasi

Belum ada unit test sesuai scope fase pertama. Gerbang kualitas saat ini:

```bash
pnpm typecheck
pnpm build
docker compose config
```

## Dokumentasi

1. [Arsitektur](docs/architecture.md)
2. [REST API](docs/api.md)
3. [Kontrak integrasi CV](docs/cv-integration.md)
4. [Model data](docs/data-model.md)
5. [Dashboard dan design system](docs/dashboard.md)
6. [Development guide](docs/development.md)
7. [Operasional dan deployment](docs/operations.md)
8. [Menjalankan di local](docs/local-development.md)

Dokumentasi runtime REST yang selalu mengikuti source tersedia melalui Swagger di `/docs`. Kontrak
RabbitMQ yang machine-readable berada di `packages/contracts/asyncapi.yaml`.
