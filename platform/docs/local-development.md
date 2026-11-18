# Menjalankan platform di local

Workflow lokal sengaja memisahkan infrastruktur dan source application:

```text
Docker Compose : MongoDB + RabbitMQ + MediaMTX
Terminal host  : API + Dashboard + Workers + CV (nanti)
Cloud external : Cloudflare R2 + Telegram Bot API
```

API, dashboard, worker, dan CV tidak dijalankan melalui Docker saat development lokal. Ini membuat hot
reload, debugging, dan akses GPU CV lebih sederhana.

## 1. Prasyarat

- Node.js 22 atau lebih baru.
- Corepack dan pnpm 10.
- Docker Desktop atau Docker Engine dengan Compose v2.
- FFmpeg opsional untuk mengetes stream MediaMTX.
- Akun Cloudflare R2 dan bot Telegram hanya diperlukan untuk pipeline media lengkap.

Periksa instalasi:

```bash
node --version
corepack --version
docker compose version
```

## 2. Instal dependency dan environment

Dari folder `platform`:

```bash
corepack enable
pnpm install
cp .env.example .env
```

Seluruh app membaca satu file `platform/.env`. Tidak perlu membuat `.env` di setiap folder app.

Konfigurasi minimum local:

```dotenv
API_PORT=4000
DASHBOARD_ORIGIN=http://localhost:5175
MONGODB_URI=mongodb://localhost:27017/cctv_platform?replicaSet=rs0
RABBITMQ_URL=amqp://guest:guest@localhost:5672
MEDIA_STAGING_DIR=./staging-media
MEDIAMTX_WEBRTC_HOSTS=localhost
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

Jika dashboard dibuka dari perangkat lain dalam LAN, isi `MEDIAMTX_WEBRTC_HOSTS` dengan IP host yang
dapat dijangkau browser, misalnya `192.168.1.10`. Restart MediaMTX setelah mengubahnya.

## 3. Jalankan infrastruktur

Gunakan wrapper pemeriksa agar tidak berbenturan dengan container/project lain:

```bash
pnpm infra:check
pnpm infra:up
docker compose ps
```

`infra:up` memeriksa endpoint aktual, bukan nama container. Jika MongoDB/RabbitMQ/MediaMTX sudah aktif
dan kompatibel, service tersebut diberi status `REUSE` dan tidak dibuat ulang. Service yang tidak ada
diberi status `START`. Port yang sudah ditempati service tidak kompatibel diberi status `BLOCK`; tidak
ada container baru yang dipaksa berjalan.

Compose hanya berisi:

| Service          | Port         | Fungsi                         |
| ---------------- | ------------ | ------------------------------ |
| MongoDB          | `27017`      | Konfigurasi dan event metadata |
| mongo-init       | sekali jalan | Membentuk replica set `rs0`    |
| RabbitMQ         | `5672`       | Message broker CV dan worker   |
| RabbitMQ UI      | `15672`      | Inspeksi queue/exchange lokal  |
| MediaMTX RTSP    | `8554`       | Target publish stream CV       |
| MediaMTX HLS     | `8888`       | Fallback browser playback      |
| MediaMTX WebRTC  | `8889`       | Live monitoring latency rendah |
| MediaMTX ICE     | `8189/udp`   | Media WebRTC                   |
| MediaMTX API     | `9997`       | Control API lokal              |
| MediaMTX metrics | `9998`       | Metrics Prometheus             |

`mongo-init` normalnya berstatus `Exited (0)` setelah replica set berhasil dibuat.

Health check manual:

```bash
docker compose exec mongodb mongosh --quiet --eval "rs.status().ok"
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
curl http://localhost:9997/v3/paths/list
curl http://localhost:9998/metrics
```

RabbitMQ management memakai username/password `guest`/`guest` hanya untuk local.

### Bila sudah ada container dengan nama berbeda

Nama container tidak menjadi masalah. Dua MongoDB, misalnya, dapat berjalan bersamaan selama host port
berbeda. Jika MongoDB yang sudah ada memakai `27017` dan kompatibel dengan replica set pada
`MONGODB_URI`, platform memakainya. Jika tidak kompatibel, pindahkan MongoDB platform ke port lain:

```dotenv
MONGODB_PORT=27018
MONGODB_URI=mongodb://localhost:27018/cctv_platform?replicaSet=rs0
```

RabbitMQ dapat dipindahkan dengan pasangan konfigurasi berikut:

```dotenv
RABBITMQ_PORT=5673
RABBITMQ_MANAGEMENT_PORT=15673
RABBITMQ_URL=amqp://guest:guest@localhost:5673
```

Port MediaMTX juga tersedia sebagai `MEDIAMTX_RTSP_PORT`, `MEDIAMTX_HLS_PORT`,
`MEDIAMTX_WEBRTC_PORT`, `MEDIAMTX_ICE_PORT`, `MEDIAMTX_API_PORT`, dan
`MEDIAMTX_METRICS_PORT`. Setelah mengubah `.env`, jalankan kembali `pnpm infra:check`.

## 4. Jalankan aplikasi

Pilihan paling ringkas:

```bash
pnpm dev
```

Perintah tersebut menjalankan API, dashboard, dan event worker melalui Turborepo. Media worker serta
Telegram worker tidak otomatis dijalankan karena credential eksternal mungkin belum tersedia.

Untuk log yang terpisah, buka beberapa terminal:

```bash
# Terminal 1
pnpm dev:api

# Terminal 2
pnpm dev:dashboard

# Terminal 3
pnpm dev:event-worker
```

Verifikasi:

```bash
curl http://localhost:4000/api/health
open http://localhost:5175
open http://localhost:4000/docs
```

Gunakan URL secara manual jika command `open` tidak tersedia pada sistem operasi Anda.

## 5. Aktifkan pipeline R2 dan Telegram

Isi nilai berikut dalam `.env`:

```dotenv
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=cctv-events
TELEGRAM_BOT_TOKEN=...
```

Lalu jalankan terminal tambahan:

```bash
pnpm dev:media-worker
pnpm dev:telegram-worker
```

Atau jalankan seluruh aplikasi sekaligus setelah credential lengkap:

```bash
pnpm dev:all
```

File dari CV masuk ke `MEDIA_STAGING_DIR`, di-upload media worker ke R2, kemudian folder staging event
dibersihkan. Jangan menghapus staging ketika upload sedang berjalan.

## 6. Tes MediaMTX

CV nantinya memublikasikan stream ber-overlay ke path yang stabil, misalnya `camera-{cameraId}`. Untuk
tes manual dengan file video:

```bash
ffmpeg -re -stream_loop -1 -i sample.mp4 \
  -c:v libx264 -pix_fmt yuv420p -an \
  -f rtsp -rtsp_transport tcp \
  rtsp://localhost:8554/camera-demo
```

Buka salah satu URL:

- WebRTC: `http://localhost:8889/camera-demo`
- HLS page: `http://localhost:8888/camera-demo`
- HLS playlist: `http://localhost:8888/camera-demo/index.m3u8`

Saat membuat kamera melalui dashboard, isi `previewUrl` dengan URL WebRTC tersebut. RTSP kamera asli
tetap hanya dikonsumsi CV; browser tidak menerima credential RTSP.

## 7. Integrasi CV nanti

CV tetap dijalankan manual dari folder/repository `cv`, misalnya melalui `uv run`. Karena CV berjalan di
host, alamat dependencynya menggunakan:

```text
Platform API : http://localhost:4000
RabbitMQ     : amqp://guest:guest@localhost:5672
MediaMTX RTSP: rtsp://localhost:8554/{stream-path}
```

Kontrak lengkap CV berada di `docs/cv-integration.md` dan `packages/contracts`.

## 8. Stop dan reset

Menghentikan infrastruktur tanpa menghapus data:

```bash
pnpm infra:stop
```

Perintah ini hanya menghentikan container milik project Compose ini. Service eksternal yang sebelumnya
berstatus `REUSE` tidak ikut dihentikan.

Menghapus container/network tetapi mempertahankan volume:

```bash
docker compose down
```

Perintah berikut menghapus seluruh data MongoDB dan RabbitMQ lokal; gunakan hanya jika memang ingin reset:

```bash
docker compose down -v
```

## Troubleshooting

### API gagal terhubung MongoDB

Pastikan `mongo-init` selesai dan URI memiliki `replicaSet=rs0`. Periksa `docker compose logs mongo-init`.

### Worker gagal terhubung RabbitMQ

Pastikan port `5672` tidak digunakan service lain dan `docker compose ps rabbitmq` berstatus healthy.

### WebRTC kosong tetapi HLS berfungsi

Pastikan UDP `8189` tidak diblok firewall dan `MEDIAMTX_WEBRTC_HOSTS` berisi IP/DNS yang dapat dijangkau
browser. HLS dapat dipakai sebagai fallback dengan latency lebih tinggi.

### Event tersimpan tetapi media tidak ter-upload

Pastikan media worker berjalan, credential R2 benar, dan periksa dead-letter exchange di RabbitMQ UI.

### Telegram tidak menerima media

Pastikan recipient aktif, scope kameranya sesuai, bot sudah di-start atau ditambahkan ke group, dan
Telegram worker berjalan dengan token yang benar.
