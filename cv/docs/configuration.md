# Konfigurasi

Semua setting memakai prefix `CV_`. Nilai production harus berada di secret manager, bukan commit Git.

| Variable | Default | Keterangan |
| --- | --- | --- |
| `CV_WORKER_ID` | `cv-local-01` | ID unik instance |
| `CV_API_BASE_URL` | `http://localhost:4000/api` | API platform |
| `CV_RABBITMQ_URL` | local RabbitMQ | AMQP URL |
| `CV_HTTP_PORT` | `8090` | health/metrics/preview |
| `CV_MODEL_PATH` | `yolo11n.pt` | weight detector utama |
| `CV_MODEL_DEVICE` | `cpu` | `cpu`, `mps`, atau `cuda:0` |
| `CV_TARGET_CLASSES` | empat target | daftar comma-separated |
| `CV_HEAD_MODEL_PATH` | kosong | weight YOLO custom kepala |
| `CV_DETECTION_CONFIDENCE` | `0.45` | batas confidence |
| `CV_DETECTION_FPS` | `5` | inference saat schedule aktif |
| `CV_CAPTURE_FPS` | `10` | frame capture/clip |
| `CV_CLIP_SECONDS` | `10` | durasi setelah trigger |
| `CV_CLIP_WIDTH` | `1280` | batas lebar clip |
| `CV_EVENT_COOLDOWN_SECONDS` | `15` | dedupe track-zone |
| `CV_CONFIG_REFRESH_SECONDS` | `60` | fallback polling config |
| `CV_SPOOL_DIR` | `data/spool` | media menunggu API |
| `CV_SPOOL_MAX_GB` | `20` | batas operasional disk |

## Jadwal

Hari mengikuti JavaScript: Minggu `0`, Senin `1`, ... Sabtu `6`. Window akhir eksklusif. Window
`22:00–02:00` valid dan melewati tengah malam. `schedule.enabled=false` berarti selalu aktif.

Zona `inherit` memakai schedule kamera. Zona `custom` memakai irisan schedule kamera dan schedule zona;
schedule kamera selalu menjadi gate utama untuk semua zonanya. Kamera hanya membuka stream untuk deteksi
bila minimal satu zona aktif; di luar jadwal stream dapat dibuka sementara ketika ada viewer preview.

## Target class

- `person`: kelas COCO person.
- `car`: kelas COCO car.
- `motorcycle`: kelas COCO motorcycle (bukan bicycle).
- `head`: detector custom kedua; dinonaktifkan dengan warning bila weight tidak ada.

Menghapus `head` dari `CV_TARGET_CLASSES` tidak memengaruhi face crop person. Face crop adalah enrichment,
bukan target event.

