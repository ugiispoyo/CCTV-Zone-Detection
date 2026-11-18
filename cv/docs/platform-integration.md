# Integrasi platform

Kontrak canonical berada di `platform/packages/contracts`. CV memanggil:

- `GET /api/internal/v1/cv/configuration`
- `POST /api/internal/v1/cameras/:id/heartbeat`
- fallback `POST /api/internal/v1/detections`
- `POST /api/internal/v1/detections/:eventId/media`

RabbitMQ detection memakai exchange `cctv.detections`, routing `detection.created.v2`, persistent message,
dan publisher confirm. Perubahan config tetap `camera.configuration.changed.v1`; pesan itu hanya invalidasi,
CV selalu mengambil ulang snapshot API.

## Event v2

```json
{
  "schemaVersion": "2.0",
  "eventId": "6b2a96dc-90ea-4849-9f2c-9417e59f6ffd",
  "cameraId": "673a11111111111111111111",
  "zoneId": "673a22222222222222222222",
  "trackId": "673a...:car:42",
  "objectType": "car",
  "occurredAt": "2026-11-17T08:30:10.428Z",
  "confidence": 0.936,
  "objectBox": { "x": 0.31, "y": 0.12, "width": 0.21, "height": 0.76 },
  "trigger": "line-crossed",
  "direction": "a-to-b"
}
```

`objectType` adalah `person`, `car`, `motorcycle`, atau `head`. `headBox`/`faceBox` opsional. Semua box
normalized. Waktu event adalah saat crossing/entry dalam UTC, bukan waktu upload selesai.

## Multipart

Field `body`, `frame`, dan `clip` wajib; `face` opsional. `body` berarti full-body untuk person dan
full-object untuk mobil/motor/head. Nama ini dipertahankan agar delivery media platform stabil.

## Preview

Endpoint CV `/api/v1/previews/:cameraId` berupa halaman MJPEG yang cocok dengan iframe dashboard. Koneksi
viewer sendiri menjadi demand signal. Endpoint POST `/demand` tersedia bila platform kelak ingin melakukan
pre-warm. Tanpa viewer, preview berhenti setelah idle timeout.

