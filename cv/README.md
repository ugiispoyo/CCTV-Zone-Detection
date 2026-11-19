# CCTV Zone CV

Service computer vision terpisah untuk membaca banyak kamera RTSP, mendeteksi dan melacak
`person`, `car`, `motorcycle`, serta `head`, mengevaluasi line/polygon zone, lalu menyiapkan media
event 10 detik untuk platform.

CV tidak menyimpan data bisnis, mengunggah ke R2, atau mengirim Telegram. CV membuat media ke
spool lokal; API platform menerima multipart dan worker platform mengurus R2 serta Telegram.

## Mulai cepat

Prasyarat: `uv`, API platform, MongoDB, RabbitMQ, dan minimal satu RTSP stream.

```bash
cd platform
pnpm infra:up
pnpm dev

# terminal baru
cd cv
cp .env.example .env
uv sync --extra dev
uv run python scripts/download_models.py
uv run cctv-cv
```

Health check dan dokumentasi HTTP tersedia di `http://localhost:8090/docs`. Preview kamera dapat
dipasang ke field `previewUrl` sebagai `http://localhost:8090/api/v1/previews/<cameraId>`.

Preview RTSP memakai strategi latest-frame: reader terus menguras stream kamera dan membuang
frame lama ketika inference/encoding sedang sibuk. Profil kualitas kamera juga mengatur ukuran
preview (`low` 640 px, `medium` 960 px, `high` 1280 px), sehingga live view tetap dekat real-time
tanpa mengubah resolusi frame yang dipakai untuk deteksi dan media kejadian.

## Menjalankan dan menghentikan service

Jalankan CV dari terminal di folder `cv`:

```bash
uv run cctv-cv
```

Untuk menghentikannya secara normal, tekan `Ctrl+C` pada terminal yang menjalankan CV. Tunggu sampai
pesan shutdown Uvicorn selesai dan prompt terminal kembali.

### Proxy RTSP lokal di macOS

Jika Python dari `uv` mendapat `No route to host` saat membuka kamera LAN tetapi Python bawaan macOS
bisa terhubung, jalankan proxy TCP dari terminal terpisah:

```bash
cd cv
/usr/bin/python3 scripts/rtsp_tcp_proxy.py --target-host 192.168.1.5
```

Proxy mendengarkan di `127.0.0.1:18554` dan meneruskan koneksi ke port RTSP kamera `554`. Ubah host
RTSP kamera di dashboard menjadi `127.0.0.1` dan port menjadi `18554`, tanpa mengubah username,
password, atau path stream. Contoh bentuk URL:

```text
rtsp://user:password@127.0.0.1:18554/Streaming/Channels/201
```

Biarkan terminal proxy tetap berjalan selama CV digunakan. Hentikan proxy dengan `Ctrl+C` setelah CV
dimatikan. Service CV memaksa RTSP interleaved TCP agar video dan kontrol melewati proxy yang sama.

Jika terminal asal sudah tertutup tetapi port `8090` masih digunakan, cari PID prosesnya:

```bash
lsof -nP -iTCP:8090 -sTCP:LISTEN
```

Hentikan PID yang tampil dengan shutdown normal terlebih dahulu:

```bash
kill -TERM <PID>
```

Periksa ulang dengan perintah `lsof` di atas. Hanya jika proses tetap macet dan port belum dilepas,
gunakan penghentian paksa sebagai langkah terakhir:

```bash
kill -KILL <PID>
```

MongoDB, RabbitMQ, dan MediaMTX adalah proses terpisah. Untuk menghentikan infrastrukturnya tanpa
menghapus data:

```bash
cd ../platform
pnpm infra:stop
```

Model YOLO default akan diunduh Ultralytics saat run pertama. Model YuNet untuk face crop perlu
diunduh mengikuti [panduan model](docs/models.md). Kelas `head` memerlukan weight custom; tanpa
weight tersebut service tetap menjalankan person/mobil/motor dan menulis warning yang eksplisit.

## Peta dokumentasi

- [Arsitektur](docs/architecture.md)
- [Setup lokal](docs/local-development.md)
- [Konfigurasi](docs/configuration.md)
- [Pipeline deteksi](docs/detection-pipeline.md)
- [Model dan akselerasi](docs/models.md)
- [Integrasi platform](docs/platform-integration.md)
- [Media dan retry](docs/media-lifecycle.md)
- [Operasional dan troubleshooting](docs/operations.md)

## Perintah pengembangan

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run pytest
```

