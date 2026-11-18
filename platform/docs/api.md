# REST API

Base URL lokal: `http://localhost:4000/api`. Dokumentasi interaktif dan OpenAPI JSON tersedia di
`/docs` dan `/docs-json`. Saat ini tidak ada autentikasi.

## Dashboard API

| Method           | Path                       | Keterangan                            |
| ---------------- | -------------------------- | ------------------------------------- |
| GET              | `/health`                  | Kesehatan API dan MongoDB             |
| GET/POST         | `/cameras`                 | Daftar/tambah kamera                  |
| GET/PATCH/DELETE | `/cameras/:id`             | Detail/ubah/hapus kamera              |
| PUT              | `/cameras/:id/enabled`     | Aktif/nonaktif kamera                 |
| GET/POST         | `/zones`                   | Daftar/tambah zona; filter `cameraId` |
| GET/PATCH/DELETE | `/zones/:id`               | Detail/ubah/hapus zona                |
| GET              | `/events`                  | Event paginated dan filter            |
| GET              | `/events/summary`          | Statistik 24 jam                      |
| GET              | `/events/:id`              | Detail dan signed media URLs          |
| GET/POST         | `/telegram/recipients`     | Daftar/tambah recipient               |
| PATCH/DELETE     | `/telegram/recipients/:id` | Ubah/hapus recipient                  |

Filter event: `cameraId`, `zoneId`, `status`, `from`, `to`, `page`, dan `limit` (maksimal 100). Semua
waktu menggunakan ISO-8601; UI menampilkan timezone kamera.

## Contoh membuat kamera

```json
{
  "name": "Pintu Utama",
  "location": "Lantai 1",
  "rtspUrl": "rtsp://user:password@192.168.1.10:554/stream",
  "previewUrl": "http://localhost:8090/api/v1/previews/<cameraId>",
  "enabled": true,
  "timezone": "Asia/Jakarta",
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
  }
}
```

RTSP URL disimpan untuk kebutuhan CV tetapi selalu dimask pada response dashboard. Pada update, hilangkan
field `rtspUrl` bila nilainya tidak berubah.

## Contoh membuat polygon zone

```json
{
  "cameraId": "673a11111111111111111111",
  "name": "Area Kasir",
  "kind": "polygon",
  "points": [
    { "x": 0.18, "y": 0.31 },
    { "x": 0.79, "y": 0.29 },
    { "x": 0.84, "y": 0.82 },
    { "x": 0.13, "y": 0.85 }
  ],
  "enabled": true,
  "scheduleMode": "inherit",
  "direction": "both"
}
```

Koordinat selalu normalisasi `0..1` terhadap frame asli. Line wajib dua titik; polygon minimal tiga.

## Error response

NestJS mengembalikan status HTTP yang relevan dan payload umum:

```json
{
  "statusCode": 400,
  "message": ["A line requires exactly two points"],
  "error": "Bad Request"
}
```

Client harus memperlakukan `409/duplicate key` sebagai konflik nama/Chat ID, `400` sebagai payload tidak
valid, dan `404` sebagai resource tidak ditemukan.
