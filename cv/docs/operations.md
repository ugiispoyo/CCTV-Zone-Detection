# Operasional dan troubleshooting

## Endpoint

- `/health/live`: process hidup.
- `/health/ready`: snapshot config pertama sudah dimuat.
- `/metrics`: Prometheus.
- `/docs`: OpenAPI endpoint control/preview.

Metric penting: `cv_camera_connected`, `cv_inference_seconds`, `cv_detections_total`,
`cv_zone_events_total`, `cv_media_uploads_total`, dan `cv_spool_bytes`.

## Runbook singkat

Kamera `reconnecting`: cek reachability host/port, kredensial RTSP, jumlah session kamera, codec, lalu log
tanpa menyalin password. Preview kosong tetapi schedule aktif: cek endpoint preview, browser mixed-content,
dan `cv_camera_frames_total`. Detection kosong: cek target class, confidence, model/device, resolusi objek,
dan inference latency. Media tertahan: cek API, disk spool, limit multipart, RabbitMQ media worker, serta R2.

## Security sebelum production

Versi awal belum memakai auth sesuai scope saat ini. Sebelum expose network: pasang service-to-service auth,
TLS untuk API/AMQP/RTSP bila tersedia, secret manager, network policy, log redaction, rate limit preview,
retention media, audit log, dan pembatasan akses dashboard. Port CV tidak boleh dipublikasikan ke internet.

## Deployment

Gunakan satu instance CV terlebih dahulu. Multi-instance tanpa camera ownership akan memproses kamera/event
dua kali. Untuk HA, tambahkan lease kamera TTL (contoh Redis), assignment/partitioning, dan fencing token
sebelum menambah replica. Pisahkan disk spool persistent dari filesystem container ephemeral.

## Upgrade

1. Validasi schema/routing version.
2. Uji model dan clip pada staging recording.
3. Drain active 10-second captures.
4. Deploy satu worker canary.
5. Pantau false events, latency, GPU memory, dan spool.
6. Roll out bertahap.

