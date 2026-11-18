# Model dan akselerasi

## Detector utama

Default `yolo11n.pt` memberi baseline ringan untuk `person`, `car`, dan `motorcycle`. File dapat diganti
dengan model Ultralytics-compatible hasil fine-tuning. Periksa lisensi model/framework sebelum deployment
komersial; Ultralytics menyediakan opsi AGPL dan enterprise.

## Detector kepala

COCO tidak memiliki kelas `head`. Karena kepala dari belakang bukan wajah, YuNet tidak dipakai sebagai
pengganti. Siapkan dataset berlabel head, train/export model satu kelas, lalu konfigurasi:

```env
CV_TARGET_CLASSES=person,car,motorcycle,head
CV_HEAD_MODEL_PATH=models/head-detector.pt
CV_HEAD_MODEL_CLASS_ID=0
```

Jika path kosong/tidak ada, service menulis `head_detector_disabled` dan tetap memproses tiga kelas COCO.
Hal ini fail-visible dan mencegah klaim deteksi kepala yang sebenarnya hanya face detection.

## YuNet face crop

Jalankan `uv run python scripts/download_models.py` untuk mengambil weight resmi OpenCV Zoo model
`face_detection_yunet` ke `CV_FACE_MODEL_PATH`. Script mencetak SHA-256; pin checksum tersebut dalam
prosedur deployment organisasi setelah versi model disetujui.

## Device

- Development umum: `cpu`.
- Apple Silicon: `mps`; lakukan benchmark karena tidak semua operasi selalu lebih cepat.
- NVIDIA: `cuda:0`. Pasang build PyTorch yang cocok dengan driver/CUDA server.
- Produksi throughput tinggi: benchmark export TensorRT/ONNX; adapter detector dapat diganti tanpa
  menyentuh domain.

## Acceptance test model

Dataset evaluasi minimal harus mencakup siang/malam, hujan, glare, objek kecil, occlusion, kendaraan
berhenti, orang membawa barang, serta sudut kepala depan/samping/belakang. Ukur per-class precision/recall,
false event per jam, missed crossing, ID switch, latency P95, dan GPU memory.

