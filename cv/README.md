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

Repository ini sengaja tidak dimasukkan ke Turborepo `platform`; lifecycle dependency dan deployment
CV berbeda dari Node.js apps.

