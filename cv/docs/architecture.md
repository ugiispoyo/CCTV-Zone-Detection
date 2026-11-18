# Arsitektur CV

## Batas tanggung jawab

```text
RTSP cameras
     │
     ▼
CameraSupervisor ── satu CameraWorker per kamera aktif
     │                    │
     │                    ├─ capture + schedule gate
     │                    ├─ shared detector (GPU-safe lock)
     │                    ├─ per-camera tracker
     │                    ├─ zone evaluator
     │                    └─ preview + event media recorder
     │
     ├── RabbitMQ: detection.created.v2
     ├── HTTP API: config, heartbeat, multipart media
     └── local spool: media yang belum diterima platform
```

CV bertanggung jawab atas frame, inference, tracking, crossing/entry, timestamp event, crop, dan clip.
Platform bertanggung jawab atas konfigurasi, MongoDB, R2, recipient Telegram, delivery, dan dashboard.
Binary tidak dikirim melalui RabbitMQ.

## Struktur source

| Folder | Tanggung jawab |
| --- | --- |
| `app` | lifecycle process dan sinkronisasi worker |
| `cameras` | koneksi RTSP dan loop per kamera |
| `detection` | interface detector, adapter YOLO, YuNet |
| `tracking` | identitas objek per kamera |
| `zones` | geometri line/polygon dan cooldown |
| `media` | crop, encoder MP4, spool |
| `integrations` | API platform dan RabbitMQ |
| `monitoring` | health, metrics, preview on-demand |
| `domain` | model murni dan aturan jadwal |
| `config` | environment settings |

Dependency mengarah dari adapter ke domain, bukan sebaliknya. Mengganti YOLO dengan TensorRT/ONNX
tidak mengubah scheduler, evaluator zona, media contract, atau API client.

## Concurrency

- Event loop mengelola supervisor, HTTP, RabbitMQ, dan upload.
- Operasi OpenCV/inference/encoding dijalankan di worker thread agar event loop tidak macet.
- Detector dibagi antar kamera dan dilindungi lock. Ini menghindari duplikasi model GPU, tetapi membuat
  inference serial pada satu process.
- Tracker dan state zona selalu per kamera sehingga ID tidak tercampur.

Untuk throughput lebih tinggi, jalankan beberapa instance CV dengan pembagian kamera eksplisit pada fase
berikutnya. Sebelum itu diperlukan camera lease/ownership (Redis cocok untuk lease TTL); saat ini desain
mengasumsikan satu instance CV.

## Keputusan utama

- Python 3.12 dipin agar ecosystem PyTorch/OpenCV stabil.
- `uv.lock` membuat dependency reproducible.
- Koordinat kontrak selalu normalized `0..1`.
- Schedule memakai timezone kamera; timestamp event tetap UTC ISO-8601.
- Preview memakai MJPEG on-demand untuk baseline yang langsung berfungsi. MediaMTX tetap dapat dipakai
  sebagai transport produksi setelah adapter publisher H.264 ditambahkan.

