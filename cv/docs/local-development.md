# Menjalankan di lokal

## 1. Infrastruktur dan platform

```bash
cd platform
pnpm install
pnpm infra:check
pnpm infra:up
cp .env.example .env
pnpm dev
```

`infra:up` mengecek service yang sudah ada dan hanya menyalakan MongoDB, RabbitMQ, atau MediaMTX yang
belum tersedia. API/dashboard/worker tidak dijalankan dalam Docker saat development.

## 2. Runtime CV

Install `uv`, lalu dari root repository:

```bash
cd cv
cp .env.example .env
uv sync --extra dev
```

`uv` otomatis mengambil Python 3.12 sesuai `.python-version`; Python system tidak perlu diganti.

Untuk CPU, biarkan `CV_MODEL_DEVICE=cpu`. Pada Apple Silicon, coba `mps`. Server NVIDIA memakai
`cuda:0` setelah PyTorch/CUDA yang sesuai dipasang.

## 3. Model

YOLO default diunduh saat run pertama. Unduh YuNet resmi OpenCV Zoo dengan:

```bash
uv run python scripts/download_models.py
```

File akan disimpan di:

```text
cv/models/face_detection_yunet_2023mar.onnx
```

Untuk kelas kepala, tempatkan model YOLO custom dan isi `CV_HEAD_MODEL_PATH`. Detail ada di
[`models.md`](models.md).

## 4. Kamera

Tambahkan kamera dari dashboard, termasuk RTSP URL, zona, dan schedule. Gunakan preview URL:

```text
http://localhost:8090/api/v1/previews/<Mongo-camera-id>
```

Jalankan:

```bash
uv run cctv-cv
```

Verifikasi:

```bash
curl http://localhost:8090/health/live
curl http://localhost:8090/health/ready
curl http://localhost:8090/metrics
```

## RTSP test tanpa CCTV

MediaMTX menerima publisher di `rtsp://localhost:8554/<path>`. Gunakan aplikasi seperti VLC/OBS atau
FFmpeg system untuk loop video sample ke path tersebut, lalu daftar URL itu sebagai kamera. FFmpeg system
tidak diwajibkan oleh service CV; encoder memakai executable terisolasi dari `imageio-ffmpeg`.

## Shutdown

Tekan `Ctrl+C` pada CV dan platform. Infrastruktur dapat dihentikan tanpa menghapus data:

```bash
cd platform
pnpm infra:stop
```

