# Pipeline deteksi

1. Supervisor mengambil snapshot kamera aktif dari API.
2. Worker membuka RTSP hanya bila ada zona terjadwal atau preview sedang dilihat.
3. Frame dibaca pada capture FPS; inference berjalan pada detection FPS yang lebih rendah.
4. Detector hanya menghasilkan kelas target.
5. Tracker memberi ID stabil per kamera dan per tipe objek.
6. Evaluator memakai titik bawah-tengah bounding box untuk line/polygon.
7. Trigger menerbitkan event v2 segera, menyimpan crop/frame, lalu merekam 10 detik.
8. Setelah MP4 selesai, uploader mengirim multipart ke API dan menghapus spool hanya setelah sukses.

## Aturan zona

- Polygon memicu saat state berubah dari luar ke dalam.
- Line memicu ketika sisi titik terhadap garis berubah tanda.
- Arah `a-to-b`/`b-to-a` dihitung dari urutan dua titik line.
- Observasi pertama tidak memicu; ini mencegah objek yang sudah berada di zona saat schedule mulai.
- Cooldown berlaku untuk kombinasi zona, tipe objek, dan track.

## Head dan face

Head adalah kelas deteksi mandiri dan dapat memicu event bila melintasi zona. Untuk event person, head box
terbaik yang berada di dalam person box ikut dilampirkan. Face detector YuNet hanya mencoba crop di dalam
person box. Bila wajah tertutup/tidak terlihat, field face tidak dibuat—tidak ada crop kepala palsu.

## Tracker baseline

Implementasi awal memakai IoU tracker yang ringan dan dependency-stable untuk CCTV statis. Interface-nya
terpisah agar ByteTrack/BoT-SORT dapat dipasang ketika evaluasi dataset menunjukkan ID switch tinggi.
Sebelum produksi, ukur precision/recall/crossing accuracy terhadap rekaman kamera aktual, bukan demo saja.

