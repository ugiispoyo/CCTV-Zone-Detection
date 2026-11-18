# Development guide

## Aturan arsitektur

- Feature-based: controller/service/DTO sebuah domain berada dalam folder feature yang sama.
- Controller hanya menangani transport; aturan bisnis berada di service.
- Integrasi lintas aplikasi berada di package reusable, bukan copy-paste.
- Maksimum 400 baris per file. Pecah berdasarkan tanggung jawab sebelum menyentuh batas.
- Hindari generic repository yang menyembunyikan query MongoDB; service feature harus tetap eksplisit.
- Worker harus idempotent karena RabbitMQ dapat redelivery.
- Tidak ada business logic dalam React component presentational.

## Dependency direction

```text
apps/* ──> backend-core / messaging / database / contracts
database ──> contracts
messaging ──> contracts
contracts ──> tidak bergantung pada package internal lain
```

Package tidak boleh mengimpor source dari `apps`. CV tidak boleh mengimpor package TypeScript; ia memakai
JSON Schema/AsyncAPI yang dipublikasikan sebagai artifact versi.

## Menambah backend feature

1. Buat `apps/api/src/features/<name>`.
2. Definisikan DTO `class-validator` dan decorator Swagger.
3. Tambahkan schema reusable di `packages/database` bila menyentuh persistence.
4. Implement service dan controller tipis.
5. Daftarkan module pada `AppModule`.
6. Dokumentasikan endpoint dan contoh payload.
7. Jalankan `pnpm typecheck && pnpm build`.

## Menambah worker message

1. Tambah JSON Schema versioned.
2. Tambah exchange/routing key pada contracts dan AsyncAPI.
3. Tentukan idempotency key serta unique index sebelum membuat consumer.
4. Tentukan retry, DLX, dan kondisi terminal.
5. Jangan mengirim image/video melalui RabbitMQ.

## Konvensi waktu

- Persistence dan message memakai `Date`/UTC ISO-8601.
- Schedule dievaluasi dengan IANA timezone kamera.
- Hari memakai `0=Sunday` sampai `6=Saturday`.
- Window lintas tengah malam (`22:00–05:00`) dievaluasi sebagai dua bagian logis oleh CV.

## Environment

Gunakan `.env.example` sebagai katalog. Jangan commit `.env`, RTSP URL, token Telegram, atau R2 secret.
Validasi environment yang wajib dilakukan saat service mulai. API mengizinkan R2 kosong untuk development;
media/Telegram worker sengaja gagal cepat jika credential belum lengkap.

## Quality gates

Fase pertama belum memiliki unit test. Minimum sebelum merge:

```bash
pnpm typecheck
pnpm build
docker compose config
```

Fase berikutnya sebaiknya menambahkan integration test dengan MongoDB/RabbitMQ container untuk event
idempotency, media flow, recipient filtering, dan schedule edge cases.
