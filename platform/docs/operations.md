# Operasional dan deployment

## Mode lokal

Compose lokal hanya menjalankan MongoDB, RabbitMQ, dan MediaMTX:

```bash
pnpm infra:up
```

Seluruh aplikasi host, termasuk media worker dan Telegram worker, dijalankan dengan:

```bash
pnpm dev
```

`mongo-init` menginisialisasi single-node replica set agar transaction/change stream dapat digunakan di
fase berikutnya. Container init selesai lalu berhenti dengan exit code 0. Jika credential R2/Telegram
belum tersedia, gunakan `pnpm dev:core`. Lihat `docs/local-development.md`.

Wrapper `infra:up` memeriksa endpoint yang sudah tersedia dan hanya memulai service yang hilang. Dengan
demikian, container dari project lain dapat dipakai ulang tanpa bergantung pada nama containernya.

## Mode server tunggal

```bash
docker compose -f docker-compose.server.yml up -d --build
```

Compose server berdiri sendiri dan menjalankan infrastruktur beserta seluruh aplikasi. MongoDB dan
RabbitMQ tidak dipublikasikan ke host. Dashboard, MediaMTX RTSP/HLS/WebRTC, dan UDP ICE dipublikasikan.
Tempatkan TLS reverse proxy di depan port tersebut. Karena autentikasi belum ada, batasi akses memakai
VPN, private network, atau firewall allowlist.

## Konfigurasi Cloudflare R2

1. Buat bucket private, contoh `cctv-events`.
2. Buat API token Object Read & Write khusus bucket.
3. Isi `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, dan `R2_BUCKET`.
4. Jangan membuat bucket publik; API membuat signed URL sementara untuk dashboard, sedangkan
   Telegram worker mengambil object secara privat lalu mengunggahnya langsung ke Telegram.
5. Atur lifecycle R2 setelah kebijakan retensi disepakati.

Object layout:

```text
events/YYYY/MM/DD/{eventId}/face.jpg
events/YYYY/MM/DD/{eventId}/body.jpg
events/YYYY/MM/DD/{eventId}/frame.jpg
events/YYYY/MM/DD/{eventId}/clip.mp4
```

## Telegram

Bot harus pernah di-start oleh user atau ditambahkan ke group tujuan. Daftarkan numeric Chat ID melalui
dashboard. Telegram worker mengirim alert teks langsung dari event deteksi, lalu media group berisi crop
yang tersedia, body, frame, dan video langsung dari staging lokal. Upload R2 berjalan paralel. File lokal
dipertahankan selama `LOCAL_MEDIA_RETENTION_SECONDS` (default satu jam) agar Telegram dan fallback
dashboard tidak bergantung pada ketersediaan R2.

## Volume

- `mongodb-data`: data primer; backup wajib.
- `rabbitmq-data`: durable queue/message.
- `media-staging`: file sementara API → media worker.

Jangan membersihkan `media-staging` manual ketika worker berjalan. Setelah upload R2 dan publish
`media.ready`, media worker menghapus folder event. Monitor kapasitas; pertumbuhan berarti R2/worker gagal.

## Backup dan recovery

- MongoDB: jadwalkan `mongodump`/snapshot dan lakukan uji restore.
- R2: gunakan lifecycle/versioning sesuai kebutuhan audit.
- RabbitMQ bukan backup permanen; message DLX perlu monitoring dan replay procedure.
- Simpan `.env` produksi di secret manager, bukan hanya di host filesystem.

## Health dan observability

- HTTP probe API: `/api/health`.
- Dashboard: Nginx root.
- RabbitMQ/MongoDB memakai health check Compose.
- MediaMTX API: `:9997`; metrics Prometheus: `:9998/metrics` di local.
- Worker saat ini diamati melalui process/container status dan log terstruktur sederhana.

Sebelum skala produksi, tambahkan Prometheus metrics: reconnect RTSP, detection rate, queue depth, event
latency, staging bytes, R2 upload duration, Telegram failure rate, dan heartbeat age.

## Failure handling

| Kegagalan            | Perilaku                                                            |
| -------------------- | ------------------------------------------------------------------- |
| MongoDB mati         | API/worker tidak siap; container restart/reconnect                  |
| RabbitMQ mati        | Publish gagal; CV/API harus retry                                   |
| R2 gagal             | Message retry sekali lalu DLX; staging dipertahankan                |
| Telegram gagal       | Delivery ditandai gagal; message retry/DLX, sent recipient dilewati |
| API mati saat upload | CV mempertahankan spool dan retry                                   |
| CV mati              | Heartbeat menua; dashboard menampilkan status terakhir              |

## Scaling

Replica worker dapat ditambah sebagai competing consumers. Untuk multi-host, pindahkan staging ke shared
volume yang konsisten atau desain direct-to-staging object store; jangan menjalankan API dan media worker
di host berbeda dengan volume lokal terpisah. MongoDB produksi sebaiknya replica set multi-node.

## Checklist sebelum internet exposure

- Implement autentikasi dashboard dan service-to-service credential.
- Enkripsi RTSP credential at rest.
- TLS untuk HTTP, RabbitMQ, dan MongoDB.
- Ganti user/password RabbitMQ default.
- Network policy: database dan broker tidak publik.
- Rate limit, audit log, secret rotation, backup restore test, dan alerting.
