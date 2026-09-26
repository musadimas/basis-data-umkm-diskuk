# Runbook Data Dummy Dashboard Operasional

> **Hanya untuk stack disposable** (`docker compose -p diskuk-operasional-e2e ...`).
> **Dilarang** menjalankan perintah ini pada environment bersama atau produksi.

## Marker dummy

| Objek | Marker |
| --- | --- |
| Akun Directus | email berawalan `dummy_` (`dummy_admin@diskuk.jabarprov.go.id`, `dummy_admin.subang@jabarprov.go.id`, `dummy_coach.pendamping@jabarprov.go.id`, `dummy_wawan.leathercraft@gmail.com`) |
| Usaha | `usaha.sumber_id = 'dummy_usaha_NN'`, id `d0000000-0000-4000-8000-0000000000NN`, NIB `99000000000NN` |
| Pelaku usaha | `pelaku_usaha.nik = 'dummy_00000000NN'` |
| Alamat | `alamat.alamat_jalan = 'Jl. Contoh No. NN'` |
| Wilayah | kode `dummy_32` / `dummy_kota_*` / `dummy_kec_*` / `dummy_kel_*` (wilayah asli dipakai bila sudah ada) |
| Klasifikasi | `klasifikasi_usaha.deskripsi` berawalan `dummy_` (klasifikasi asli dipakai bila sudah ada) |
| Kata sandi | dari env `DEMO_ACCOUNT_PASSWORD` (tidak pernah ditulis di repo/log) |

## Seed

```bash
set -a; . /tmp/operasional-e2e.env; set +a
node scripts/seed-dummy-operasional.mjs seed
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_DATABASE" < scripts/seed-dummy-operasional.sql
```

Seed idempoten: menjalankan dua kali tidak menambah baris (8 usaha, 8 pelaku usaha, 4 akun).

## Cleanup

```bash
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_DATABASE" < scripts/cleanup-dummy-operasional.sql
node scripts/seed-dummy-operasional.mjs cleanup
```

## Verifikasi nol baris dummy

```bash
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis \
  psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "
    SELECT
      (SELECT count(*) FROM directus_users WHERE email LIKE 'dummy\_%') AS akun,
      (SELECT count(*) FROM usaha WHERE sumber_id LIKE 'dummy\_%') AS usaha,
      (SELECT count(*) FROM pelaku_usaha WHERE nik LIKE 'dummy\_%') AS pelaku,
      (SELECT count(*) FROM kota WHERE kode LIKE 'dummy\_%') AS kota,
      (SELECT count(*) FROM kecamatan WHERE kode LIKE 'dummy\_%') AS kecamatan,
      (SELECT count(*) FROM kelurahan WHERE kode LIKE 'dummy\_%') AS kelurahan,
      (SELECT count(*) FROM provinsi WHERE kode LIKE 'dummy\_%') AS provinsi,
      (SELECT count(*) FROM klasifikasi_usaha WHERE deskripsi LIKE 'dummy\_%') AS klasifikasi;"
```

Hasil yang diharapkan: semua kolom `0`.

## Catatan

- `DEMO_ACCOUNT_PASSWORD` minimal 12 karakter, tidak mengandung `change-me`, tidak pernah dicetak.
- Skrip menolak host non-lokal kecuali `ALLOW_REMOTE_DUMMY_SEED=yes`.
- Rebuild `usaha_tabular`/`infografis` berjalan via `analitik_enqueue_job` (worker harus hidup).
