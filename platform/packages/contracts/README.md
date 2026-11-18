# Platform contracts

Folder ini adalah sumber kontrak lintas repository untuk `platform` dan `cv`.

- `schemas/`: JSON Schema Draft 2020-12 yang dapat divalidasi di TypeScript maupun Python.
- `asyncapi.yaml`: exchange, routing key, dan arah pesan RabbitMQ.
- `src/index.ts`: tipe dan constant untuk aplikasi TypeScript.

CV harus mengunci versi kontrak. Perubahan kompatibel boleh menambah field opsional. Menghapus field,
mengubah arti field, atau mengubah tipe data wajib membuat routing key dan schema major baru, misalnya
`detection.created.v2`. Detail integrasi ada di `../../docs/cv-integration.md`.
