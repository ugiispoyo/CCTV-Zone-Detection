# Dashboard dan design system

Dashboard memakai Vite, React, TypeScript, Tailwind CSS, TanStack React Query, Zustand, dan React Router.

## Prinsip visual

- Latar charcoal gelap untuk ruang monitoring yang dilihat lama.
- Kontras teks utama tidak putih murni agar mengurangi silau.
- Mint hanya untuk aksi/status sehat; amber untuk transisi; merah untuk error/destruktif.
- Font sistem 13–15 px pada data padat, line-height longgar pada deskripsi.
- Grid responsif dan bottom navigation pada layar kecil.

Token ada di `src/styles.css` melalui Tailwind `@theme`. Style dibagi menjadi `base.css`, `layout.css`,
dan `features.css` agar setiap file tetap terfokus. Komponen reusable berada di `src/components`.

## State

- React Query: seluruh server state, cache, invalidation, loading, dan mutation.
- Zustand: preferensi UI lokal seperti sidebar dan jumlah kolom monitoring.
- Local component state: draft form dan titik zone yang belum disimpan.
- Jangan menyalin response API ke Zustand.

## Zone editor

Preview ditampilkan dalam rasio 16:9. Klik dikonversi ke koordinat relatif. SVG overlay menyimpan line
dua titik dan polygon minimal tiga. Data tidak bergantung pada resolusi preview/browser.

## Live monitoring

`previewUrl` diarahkan ke gateway browser-compatible, idealnya MediaMTX WebRTC. Browser tidak mendapat
RTSP URL. Di luar schedule, CV preview inference hanya aktif ketika ada viewer dan otomatis idle sesuai
`idleTimeoutSeconds`.

## Menambah halaman

1. Buat folder `src/features/<feature>`.
2. Letakkan query/mutation sedekat mungkin dengan page feature.
3. Promosikan elemen ke `components` hanya jika dipakai lintas feature.
4. Tambahkan route di `App.tsx` dan navigation bila merupakan top-level task.
5. Gunakan komponen `PageHeader`, `Card`, `Button`, `Badge`, `Modal`, dan state kosong yang konsisten.
