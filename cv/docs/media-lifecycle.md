# Lifecycle media dan reliability

Pada T0, CV membuat UUID event, publish metadata, lalu menulis `object.jpg`, `frame.jpg`, dan `clip.mp4` ke
`data/spool/<eventId>`. Face/head crop ikut ditulis bila valid. Clip merekam frame T0 sampai T0+10 detik,
H.264 `yuv420p`, tanpa audio.

Uploader memakai retry exponential untuk multipart. Directory dihapus hanya setelah API merespons sukses.
Saat restart, bundle lengkap ditemukan kembali dan di-upload. Event ID tetap sama pada semua retry sehingga
worker event MongoDB dapat melakukan upsert idempotent.

## Kapasitas

Estimasi disk berdasarkan bitrate hasil benchmark, bukan frame mentah. Alert wajib dipasang pada
`cv_spool_bytes`; `CV_SPOOL_MAX_GB` adalah guardrail konfigurasi dan harus disesuaikan dengan jumlah kamera,
durasi outage API, serta event rate. Jangan menghapus event lama diam-diam ketika disk penuh.

## Failure matrix

| Failure | Perilaku |
| --- | --- |
| RabbitMQ mati | event memakai HTTP fallback; config memakai polling |
| API mati setelah event | media tetap di spool dan retry |
| RTSP putus | reconnect exponential, heartbeat `reconnecting` |
| Process restart | config reload dan complete spool di-resume |
| Face/head model tidak ada | target lain tetap berjalan, warning terstruktur |
| Schedule off tanpa viewer | RTSP ditutup dan inference berhenti |

