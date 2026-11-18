# Model data MongoDB

Media binary tidak disimpan di MongoDB. Database hanya menyimpan konfigurasi, metadata, object key R2,
dan delivery state.

## `cameras`

- Identitas: `name`, `description`, `location`.
- Source: `rtspUrl` dan `previewUrl`.
- Kontrol: `enabled`, `timezone`, `schedule`, `preview`.
- Runtime: `runtimeStatus`, `lastSeenAt`, `lastError`.
- `schedule.enabled=false` berarti 24 jam, bukan kamera nonaktif.

RTSP URL dapat berisi credential. Response dashboard selalu menggunakan `rtspUrlMasked`. Sebelum sistem
dibuka keluar jaringan privat, enkripsi field ini menggunakan KMS/application encryption.

## `zones`

- Referensi `cameraId` dengan index.
- `kind`: `line` atau `polygon`.
- `points`: koordinat normalisasi `0..1`.
- `scheduleMode`: `inherit` atau `custom`.
- Unique index `(cameraId, name)`.

Menghapus kamera menghapus konfigurasi zona dan mengeluarkan camera ID dari recipient. Event historis
tidak ikut dihapus agar audit tetap utuh.

## `detectionevents`

- `eventId` UUID dari CV dan unique index.
- Referensi `cameraId`, `zoneId`, `trackId`.
- Tipe objek, waktu, confidence, object/head/face bounding box, trigger, direction.
- Status state machine dan metadata empat media.
- Index `(cameraId, occurredAt desc)` untuk halaman event.

Pada skala besar, gunakan retention policy eksplisit. Jangan memakai TTL sebelum kebutuhan audit dan
retensi media disepakati.

## `telegramrecipients`

- `chatId` unique.
- `enabled` mengontrol pengiriman tanpa menghapus konfigurasi.
- `cameraScope=all` mengabaikan `cameraIds`.
- `cameraScope=selected` membutuhkan setidaknya satu kamera.

## `telegramdeliveries`

- Delivery per event dan recipient.
- Unique index `(eventId, recipientId)` mencegah notifikasi ganda.
- `attempts`, `status`, `sentAt`, dan `error` membantu replay/audit.

## Evolusi schema

Mongoose bukan pengganti migrasi. Perubahan data wajib melalui script versioned pada package database.
Strategi aman: tambah field opsional → backfill batch → deploy pembaca field baru → baru hapus fallback.
