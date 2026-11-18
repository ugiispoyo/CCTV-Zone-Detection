# Kontrak integrasi CV

Dokumen ini adalah panduan implementasi repository `cv`. Kontrak machine-readable berada di
`packages/contracts/schemas` dan `packages/contracts/asyncapi.yaml`.

## Prinsip

- CV hanya memproses kamera `enabled=true`.
- CV mendeteksi `person`, `car`, `motorcycle`, dan `head`.
- CV menghasilkan face/head crop opsional, object crop, full frame, dan MP4 10 detik.
- Platform memiliki MongoDB, R2, recipient Telegram, dan delivery state.
- File besar tidak pernah masuk RabbitMQ; gunakan multipart HTTP.
- Setiap event mempunyai UUID yang tetap sama pada semua retry.

## Startup dan sinkronisasi konfigurasi

Saat startup, CV memanggil:

```http
GET /api/internal/v1/cv/configuration
```

Response adalah array kamera aktif beserta zona aktifnya:

```json
[
  {
    "_id": "673a11111111111111111111",
    "name": "Pintu Utama",
    "rtspUrl": "rtsp://user:password@host/stream",
    "timezone": "Asia/Jakarta",
    "enabled": true,
    "schedule": {
      "enabled": true,
      "days": [1, 2, 3, 4, 5],
      "windows": [{ "start": "14:00", "end": "17:00" }]
    },
    "preview": {
      "showBoundingBoxes": true,
      "inferenceFps": 2,
      "idleTimeoutSeconds": 60,
      "quality": "medium"
    },
    "zones": [
      {
        "_id": "673a22222222222222222222",
        "name": "Line Masuk",
        "kind": "line",
        "points": [
          { "x": 0.2, "y": 0.7 },
          { "x": 0.8, "y": 0.7 }
        ],
        "enabled": true,
        "scheduleMode": "inherit",
        "direction": "both"
      }
    ]
  }
]
```

Setelah snapshot awal, bind queue CV yang durable ke exchange `cctv.configuration` dengan routing key
`camera.configuration.changed.v1`. Pesan perubahan hanya sinyal invalidasi; setelah menerimanya, ambil
ulang snapshot API. Debounce 250–1000 ms agar perubahan berturut-turut tidak menimbulkan banyak request.

## Status/heartbeat kamera

```http
POST /api/internal/v1/cameras/{cameraId}/heartbeat
Content-Type: application/json

{"status":"online"}
```

Status valid: `inactive`, `scheduled-off`, `connecting`, `online`, `reconnecting`, `error`. Untuk error,
kirim ringkasan aman pada field `error`; jangan memasukkan RTSP password. Kirim heartbeat setiap 15–30
detik dan segera pada transisi status.

## Detection event

Pilihan utama adalah publish RabbitMQ:

- Exchange: `cctv.detections` (topic, durable)
- Routing key: `detection.created.v2`
- Content type: `application/json`
- Delivery mode: persistent

Payload:

```json
{
  "schemaVersion": "2.0",
  "eventId": "6b2a96dc-90ea-4849-9f2c-9417e59f6ffd",
  "cameraId": "673a11111111111111111111",
  "zoneId": "673a22222222222222222222",
  "trackId": "cam-01:motorcycle:4821",
  "objectType": "motorcycle",
  "occurredAt": "2026-11-17T08:30:10.428Z",
  "confidence": 0.936,
  "objectBox": { "x": 0.31, "y": 0.12, "width": 0.21, "height": 0.76 },
  "headBox": { "x": 0.376, "y": 0.14, "width": 0.078, "height": 0.12 },
  "faceBox": { "x": 0.376, "y": 0.14, "width": 0.078, "height": 0.12 },
  "trigger": "line-crossed",
  "direction": "a-to-b"
}
```

Fallback jika publisher RabbitMQ CV belum tersedia:

```http
POST /api/internal/v1/detections
Content-Type: application/json
```

Body sama. Response `202/200 accepted` bukan berarti media telah di-upload; hanya event diterima.

### Aturan koordinat dan waktu

- `x/y/width/height` adalah rasio frame `0..1`, bukan pixel.
- `x/y` menunjuk sudut kiri atas bounding box.
- `occurredAt` adalah saat crossing/entry, bukan saat clip selesai.
- Timestamp wajib UTC ISO-8601 dengan milidetik. Timezone kamera hanya untuk schedule/display.
- `objectType` valid: `person`, `car`, `motorcycle`, `head`.
- Face crop opsional bila wajah tidak terlihat; head detector adalah model terpisah.

## Media upload

Setelah trigger, CV segera menyimpan full frame dan crop. Rekam clip dari `T0` sampai `T0+10 detik`,
kemudian kirim satu multipart request:

```http
POST /api/internal/v1/detections/{eventId}/media
Content-Type: multipart/form-data
```

| Field   | Wajib | Content type                  | Isi                                        |
| ------- | ----- | ----------------------------- | ------------------------------------------ |
| `face`  | Tidak | `image/jpeg` atau `image/png` | Crop wajah atau kepala valid               |
| `body`  | Ya    | `image/jpeg` atau `image/png` | Crop full-body/full-object                  |
| `frame` | Ya    | `image/jpeg` atau `image/png` | Full frame saat T0                         |
| `clip`  | Ya    | `video/mp4`                   | H.264/AAC atau H.264 tanpa audio, 10 detik |

Contoh:

```bash
curl -X POST http://platform-api:4000/api/internal/v1/detections/6b2a96dc-90ea-4849-9f2c-9417e59f6ffd/media \
  -F 'face=@face.jpg;type=image/jpeg' \
  -F 'body=@body.jpg;type=image/jpeg' \
  -F 'frame=@frame.jpg;type=image/jpeg' \
  -F 'clip=@clip.mp4;type=video/mp4'
```

Limit request saat ini 150 MiB per file dan maksimal empat file. Target operasional sebaiknya jauh lebih
kecil: JPEG quality 85 dan MP4 yang dapat diputar Telegram (`yuv420p`, faststart).

## Retry dan spool lokal CV

1. Publish event dengan publisher confirm.
2. Tulis media ke spool lokal sebelum upload.
3. Retry multipart dengan exponential backoff dan jitter.
4. Gunakan `eventId` dan nama field yang sama pada retry.
5. Hapus spool hanya setelah response platform `accepted=true`.
6. Batasi disk spool dan alert sebelum penuh; jangan diam-diam membuang event lama.

API menulis file dengan mode create-exclusive. Jika koneksi putus setelah file diterima tetapi sebelum
response, retry yang sama dapat mendapat konflik file. Client harus meminta status event atau menunggu
operator hingga endpoint resumable/idempotent media ditambahkan. Untuk produksi skala tinggi, fase berikut
sebaiknya menambahkan upload session manifest sebelum transfer.

## Deduplikasi trigger

- Satu `trackId + zoneId` hanya membuat satu entry event sampai track benar-benar keluar dan cooldown habis.
- Crossing line dihitung dari perubahan sisi lintasan centroid/foot point, bukan overlap bbox semata.
- Orang yang sudah berada di zona saat schedule mulai tidak langsung menghasilkan `zone-entered`.
- Event yang terjadi sesaat sebelum schedule berakhir tetap menyelesaikan clip dan upload.

## Kompatibilitas versi

- CV wajib menolak config/message major version yang tidak dikenal.
- Field baru yang opsional tidak memerlukan major version baru.
- Rename, perubahan tipe, atau perubahan semantik membuat schema/routing key `v2`.
- Saat migrasi, platform dapat mengonsumsi `v1` dan `v2` paralel sampai semua CV worker diperbarui.
