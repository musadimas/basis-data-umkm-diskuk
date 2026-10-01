# Phase 1 — Fondasi identitas multi-role (backend)

## Objective, dependencies, observable result

- **Dependency:** tidak ada (baseline `fc450bb`).
- **Objective:** menambah tiga role Directus baru + rename role lama menjadi Admin Provinsi, kolom penugasan `directus_users.kota/usaha`, helper otorisasi berbasis role, extension `operasional` dengan `/me`, `/internal/resolve-nib`, `/aktivitas`, seed akun dan usaha dummy, cleanup, runbook, dan ADR-007.
- **Observable result:** pada disposable stack, keempat akun `dummy_` dapat login via Directus `/auth/login`; `GET /operasional/me` mengembalikan role key + kota/usaha; endpoint existing (tabular/infografis/analitik) tetap hanya menerima provinsi (role lama) dan admin — perilaku identik dengan baseline.

Before work:

```bash
git status --short --branch
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py snapshot --output /tmp/operasional-phase-1-before.json
```

Catatan dirty file pre-existing: `.zcodeignore` (untracked, bukan milik plan) tidak boleh diubah atau dihapus.

## Closed file manifest

| Action | Path |
| --- | --- |
| create | `docs/architecture/decisions/0007-operational-multi-role-dashboard.md` |
| modify | `docs/architecture/decisions/README.md` |
| create | `docs/operasional/dummy-data-runbook.md` |
| create | `services/directus/migrations/20260926A-operational-roles.js` |
| modify | `services/directus/extensions/shared/auth.cjs` |
| create | `services/directus/extensions/shared/operator.cjs` |
| create | `services/directus/extensions/directus-extension-operasional/package.json` |
| create | `services/directus/extensions/directus-extension-operasional/src/index.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/errors.js` |
| create | `services/directus/extensions/directus-extension-operasional/src/me-service.js` |
| create | `services/directus/extensions/directus-extension-operasional/test/index.test.cjs` |
| create | `services/directus/test/operasional-schema.contract.test.mjs` |
| modify | `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` |
| create | `scripts/seed-dummy-operasional.mjs` |
| create | `scripts/seed-dummy-operasional.sql` |
| create | `scripts/cleanup-dummy-operasional.sql` |
| modify | `docker/Dockerfile.directus` |
| modify | `docker-compose.yml` |
| modify | `.env.example` |

`docs/` ada di `.gitignore`; file docs **baru** wajib di-stage dengan `git add -f <path>` sebelum `scope_guard.py check`, kalau tidak guard dan commit tidak melihatnya. `docs/architecture/decisions/README.md` sudah tracked.

## Exact symbols and search anchors

- `services/directus/extensions/shared/auth.cjs::APPLICATION_ROLE_ID`, `requireDashboardAccountability`, `routeGuard`, `DashboardAuthError`
- `services/directus/migrations/20260819A-private-dashboard-access.js::POLICY_ID` (`9325db4b-9518-41db-b122-8c667f2ce510`)
- `services/directus/migrations/20260819C-create-analytics-foundation.js::analitik_capture_source_change`
- `scripts/provision-application-user.mjs` (pola request Directus admin tanpa mencetak body)
- `docker/Dockerfile.directus` baris `RUN cd /directus/extensions/directus-extension-analitik`
- `services/directus/extensions/directus-extension-tabular/test/index.test.cjs::run` (accountability role lama)

```bash
rg -n "APPLICATION_ROLE_ID|function requireDashboardAccountability|function routeGuard" services/directus/extensions/shared/auth.cjs
rg -n "9325db4b-9518-41db-b122-8c667f2ce510|'directus_users', 'read'" services/directus/migrations/20260819A-private-dashboard-access.js
rg -n "directus-extension-analitik && pnpm install" docker/Dockerfile.directus
rg -n "NUXT_SESSION_POLICY_SECRET|SESSION_COOKIE_NAME" docker-compose.yml
rg -n "statusCode, 40[13]" services/directus/extensions/directus-extension-tabular/test/index.test.cjs services/directus/extensions/directus-extension-analitik/test/index.test.cjs services/directus/extensions/directus-extension-infografis/test/index.test.cjs
```

## Current contract and final desired contract

### Current

- `requireDashboardAccountability(req, { adminOnly })`: 401 tanpa user; 403 bila bukan admin dan role ≠ `APPLICATION_ROLE_ID`.
- `directus_users` hanya kolom bawaan; permission baca diri sendiri `id,email,first_name,last_name,avatar`.
- Tidak ada extension `operasional`, tidak ada akun demo.

### Final

- `auth.cjs` mengekspor tambahan:
  - `ROLE_IDS = { provinsi: "7d6d493c-1a6d-4c59-9e74-40d42a7862eb", kabkota: "ade3c009-8725-46ba-a7a0-904eeba89d01", pendamping: "d824230f-46db-407d-b8ea-fb2ed58c6c4f", umkm: "d821d35e-62e1-4f27-a323-843845d6c965" }` (frozen)
  - `ALL_ROLES = ["provinsi","kabkota","pendamping","umkm"]`
  - `roleKeyOf(accountability)` → `"provinsi"` bila `accountability.admin`, key dari `ROLE_IDS` bila cocok, selain itu `null`
  - `requireDashboardAccountability(req, { adminOnly = false, roles = ["provinsi"] } = {})`: 401 tanpa user; 403 `FORBIDDEN` "Administrator access required" bila `adminOnly` dan bukan admin; 403 `FORBIDDEN` "Dashboard access is not permitted" bila `roleKeyOf` null atau tidak di `roles`
  - `requireRole(req, roles)` = `requireDashboardAccountability(req, { roles })`
  - `routeGuard(req, next, options)` tidak berubah signature. Default `roles` = `["provinsi"]` → perilaku endpoint existing identik dengan baseline.
- `operator.cjs` mengekspor `resolveOperator(database, accountability, { requireAssignment = true } = {})` → `{ userId, role, admin, email, firstName, lastName, avatar, kotaId, kotaNama, usahaId, usahaNama, usahaNib }`. Short-circuit: bila `roleKeyOf(accountability) === "provinsi"` dan `requireAssignment` true, kembalikan `{ userId, role: "provinsi", admin, email: null, firstName: null, lastName: null, avatar: null, kotaId: null, kotaNama: null, usahaId: null, usahaNama: null, usahaNib: null }` tanpa query DB (provinsi tidak butuh penugasan; menjaga stub test existing tetap valid). Selain itu query DB; melempar `DashboardAuthError(403, "KOTA_NOT_ASSIGNED")` bila role `kabkota` tanpa kota dan `requireAssignment`, `DashboardAuthError(403, "USAHA_NOT_ASSIGNED")` bila role `umkm` tanpa usaha dan `requireAssignment`, `DashboardAuthError(401, "AUTHENTICATION_REQUIRED")` bila baris user tidak ada. Query tunggal:

  ```sql
  SELECT u.id, u.email, u.first_name, u.last_name, u.avatar, u.kota, k.nama AS kota_nama,
         u.usaha, us.nama AS usaha_nama, us.nib AS usaha_nib
  FROM directus_users u
  LEFT JOIN kota k ON k.id = u.kota
  LEFT JOIN usaha us ON us.id = u.usaha
  WHERE u.id = ?
  ```

- Migrasi `20260926A-operational-roles.js` (satu transaksi):
  - `UPDATE directus_roles SET name='Admin Provinsi', description='Eksekutif / Admin DISKUK Provinsi Jawa Barat' WHERE id='7d6d493c-…'`
  - Role baru (`INSERT … ON CONFLICT (id) DO UPDATE SET name, description`): kabkota `ade3c009-…` "Admin Kab/Kota" (icon `location_city`), pendamping `d824230f-…` "Pendamping" (icon `support_agent`), umkm `d821d35e-…` "Pelaku UMKM" (icon `storefront`)
  - Policy baru (`admin_access FALSE, app_access FALSE, enforce_tfa FALSE`): kabkota `542bb438-226b-49b6-8792-bcfc614560a5`, pendamping `81086586-a5a3-4d9e-a650-eca9bac81c23`, umkm `98524352-468a-45bd-b638-d4075243d27d`
  - Access: `7cc0f55e-5d61-4d7c-8220-b4c8006ded0c` (kabkota), `a9d792fa-e506-40f7-96d3-6c0a08bf3e86` (pendamping), `c876f629-d471-46b6-b068-2325b95600dc` (umkm)
  - `ALTER TABLE directus_users ADD COLUMN IF NOT EXISTS kota INTEGER REFERENCES kota(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS usaha UUID REFERENCES usaha(id) ON DELETE SET NULL`
  - `CREATE UNIQUE INDEX IF NOT EXISTS ux_directus_users_usaha ON directus_users(usaha) WHERE usaha IS NOT NULL`
  - `directus_fields`: `('directus_users','kota', interface 'select-dropdown-m2o', note 'Wilayah Admin Kab/Kota')`, `('directus_users','usaha', interface 'select-dropdown-m2o', note 'Usaha milik akun Pelaku UMKM')` `ON CONFLICT DO NOTHING`; `directus_relations` `('directus_users','kota','kota')`, `('directus_users','usaha','usaha')` dengan `one_deselect_action 'nullify'` (guard `WHERE NOT EXISTS`).
  - Permission `directus_users.read` diri sendiri fields `id,email,first_name,last_name,avatar,role,kota,usaha`: UPDATE baris policy provinsi; INSERT untuk tiga policy baru.
  - Permission `directus_users.update` diri sendiri (`{"id":{"_eq":"$CURRENT_USER"}}`, validation sama, fields `password`) untuk keempat policy (dipakai halaman akun Phase 2).
  - `down`: hapus permission tiga policy baru + update password keempat policy, kembalikan fields baca provinsi ke `id,email,first_name,last_name,avatar`, hapus access/policy/role baru, `DROP INDEX ux_directus_users_usaha`, hapus relations/fields, `ALTER TABLE directus_users DROP COLUMN IF EXISTS usaha, DROP COLUMN IF EXISTS kota`, rename role lama kembali ke `Application User` / `Least-privilege private dashboard analyst`.
- Extension `directus-extension-operasional` (id `operasional`, CommonJS):
  - `GET /me` — `requireRole(req, ALL_ROLES)`; `resolveOperator(..., { requireAssignment: false })`; response `{ data: { id, email, firstName, lastName, avatar, role, roleLabel, instansi, kota: {id,nama}|null, usaha: {id,nama,nib}|null } }`; `roleLabel` dari `ROLE_LABELS` (`Admin Provinsi`, `Admin Kab/Kota`, `Pendamping`, `Pelaku UMKM`); `instansi`: provinsi → `"DISKUK Provinsi Jawa Barat"`, kabkota → `"Dinas KUK " + kotaNama` (atau `"Dinas KUK Kabupaten/Kota"` bila null), pendamping → `"Pendamping Program Akselerasi"`, umkm → `usahaNama` (atau `"Pelaku UMKM"`).
  - `POST /internal/resolve-nib` — tanpa accountability; header `x-operasional-internal-secret` dibandingkan `crypto.timingSafeEqual` dengan `process.env.OPERASIONAL_INTERNAL_SECRET` (env kosong/<16 char → 503 `INTERNAL_SECRET_UNAVAILABLE`; header salah → 403 `FORBIDDEN`); body `{ nib }` harus `/^\d{13}$/` (selain itu 400 `VALIDATION_FAILED`); query `SELECT u.email FROM directus_users u JOIN usaha us ON us.id=u.usaha WHERE us.nib=? AND u.role=? AND u.status='active' LIMIT 1` dengan `ROLE_IDS.umkm`; tidak ada → 404 `NOT_FOUND`; ada → `{ data: { email } }`.
  - `GET /aktivitas` — `requireRole(req, ALL_ROLES)`; `SELECT id, action, collection, item, "timestamp", ip, user_agent FROM directus_activity WHERE "user" = ? ORDER BY "timestamp" DESC LIMIT 50`; response `{ data: [{ id, action, collection, item, timestamp (ISO Z), ip, userAgent }] }`.
  - Semua response `Cache-Control: private, no-store`; error via `errors.js::sendError(res, error)` menghasilkan `{ errors: [{ message, extensions: { code, status } }] }` dengan status dari `error.statusCode` (fallback 500 `INTERNAL_SERVER_ERROR`, pesan generik, tanpa stack).

## Ordered edits

1. Tulis ADR `docs/architecture/decisions/0007-operational-multi-role-dashboard.md` mengikuti format ADR-001: judul `# ADR-007: Dashboard Operasional Multi-Role dengan Scoping Server-Side`, bullet `- **Status:** Accepted — menggantikan sebagian ADR-001 (alternatif "Empat role produk" dan Decision 7 satu Application User)`, `- **Tanggal:** 26 September 2026`, `- **Keputusan target:** diimplementasikan bertahap oleh docs/dashboard-operasional-e2e-plan`, lalu heading `## Context`, `## Decision`, `## Consequences`, `## Alternatives rejected`, `## Acceptance evidence required`. Isi Decision: keputusan §1 main plan butir 1–6, 8, 14; scoping server-side via `resolveOperator`; data dummy bertanda `dummy_`; SSO/CAPTCHA/reset password tetap tidak fungsional (ADR-001 Decision 6 tetap berlaku). Tambah satu baris tabel `| [ADR-007](./0007-operational-multi-role-dashboard.md) | Dashboard operasional multi-role dengan scoping server-side |` setelah baris ADR-005 di `docs/architecture/decisions/README.md` (jangan menambah ADR-006 yang hilang dari indeks; catat saja di laporan).
2. Buat migrasi `20260926A-operational-roles.js` persis sesuai §Final (ESM `export const up/down`, `knex.transaction`, `trx.raw` dengan binding `?`).
3. Ubah `auth.cjs` sesuai §Final; pertahankan status/pesan error existing agar assert `statusCode` 401/403 di test existing tetap lulus.
4. Buat `operator.cjs` sesuai §Final (CommonJS, `require("./auth.cjs")` untuk `DashboardAuthError`, `roleKeyOf`).
5. Buat extension: `package.json` (salin bentuk `directus-extension-analitik/package.json` tanpa dependency; `build`: `rm -rf dist && mkdir -p dist && cp -R src/* dist/`; `pretest`: `npm run build`; `test`: `node --test test/*.test.cjs`; `engines.node >=22.0.0`), `src/errors.js` (`class OperasionalError extends Error` dengan `statusCode`, `code`, `fields?`; `sendError`), `src/me-service.js` (`getMe(database, accountability)`, `resolveNib(database, headers, body)`, `listAktivitas(database, accountability)`), `src/index.js` (`module.exports = { id: "operasional", handler: (router, { database, logger }) => { … } }`; setiap route membungkus `try/catch` → `sendError`).
6. Test `test/index.test.cjs` (pola `captureRouter` dari tabular test): `/me` untuk tiap role (kabkota dengan kota, umkm dengan usaha, admin → provinsi); `/me` role asing → 403; tanpa user → 401; `/internal/resolve-nib` env kosong → 503, header salah → 403, NIB `123` → 400, NIB tidak ada → 404, ada → email; `/aktivitas` meneruskan `accountability.user` sebagai binding; header `cache-control` `private, no-store`.
7. Tambah pada `services/directus/extensions/directus-extension-tabular/test/index.test.cjs` satu test: role kabkota (`ade3c009-…`) ke `GET /` → 403 (membuktikan default roles tetap provinsi-only).
8. Buat `services/directus/test/operasional-schema.contract.test.mjs`: baca migrasi `20260926A` sebagai teks dan assert keempat UUID role, tiga UUID policy, `ADD COLUMN IF NOT EXISTS kota`, `ADD COLUMN IF NOT EXISTS usaha`, fields baca `id,email,first_name,last_name,avatar,role,kota,usaha`; `require` `extensions/shared/auth.cjs` dan assert `ROLE_IDS` sama dengan migrasi, `roleKeyOf({admin:true}) === "provinsi"`, `roleKeyOf({role:"x"}) === null`.
9. `docker/Dockerfile.directus`: tambah `RUN cd /directus/extensions/directus-extension-operasional && pnpm run build` setelah baris build analitik.
10. `docker-compose.yml`: service `directus.environment` tambah `OPERASIONAL_INTERNAL_SECRET: ${OPERASIONAL_INTERNAL_SECRET}`; service `web.environment` tambah `OPERASIONAL_INTERNAL_SECRET: ${OPERASIONAL_INTERNAL_SECRET}`, `DEMO_MODE: ${DEMO_MODE:-false}`, `DEMO_ACCOUNT_PASSWORD: ${DEMO_ACCOUNT_PASSWORD:-}`.
11. `.env.example`: tambah blok
    ```text
    # Dashboard operasional
    OPERASIONAL_INTERNAL_SECRET=change-me-operasional-internal-secret
    DEMO_MODE=false
    DEMO_ACCOUNT_PASSWORD=change-me-demo-password
    ```
12. `scripts/seed-dummy-operasional.mjs` (Node ≥20, ESM, tanpa dependency; pola `scripts/provision-application-user.mjs`):
    - argumen `seed` atau `cleanup`; env `DIRECTUS_BASE_URL` (default `http://127.0.0.1:8055`), `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD`, `DEMO_ACCOUNT_PASSWORD` (wajib ≥12 char dan tidak mengandung `change-me` untuk `seed`).
    - Tolak (exit 1) bila hostname `DIRECTUS_BASE_URL` bukan `127.0.0.1`/`localhost` kecuali `ALLOW_REMOTE_DUMMY_SEED=yes`.
    - `seed`: login admin (`mode: "json"`), upsert akun berdasarkan email: `dummy_admin@diskuk.jabarprov.go.id` (Admin / DISKUK Provinsi, role provinsi), `dummy_admin.subang@jabarprov.go.id` (Admin / Dinas KUK Subang, kabkota), `dummy_coach.pendamping@jabarprov.go.id` (Rina / Pendamping Wilayah, pendamping), `dummy_wawan.leathercraft@gmail.com` (Wawan / Setiawan, umkm); `status: "active"`, `password: DEMO_ACCOUNT_PASSWORD`. Verifikasi setiap akun dengan `/auth/login` json lalu `/users/me`.
    - `cleanup`: hapus user `filter[email][_starts_with]=dummy_` via `DELETE /users/:id`.
    - Jangan pernah mencetak body response; pesan sukses satu baris per aksi.
13. `scripts/seed-dummy-operasional.sql` (idempotent, satu transaksi `BEGIN; … COMMIT;`):
    - Guard: `DO $$ BEGIN IF (SELECT count(*) FROM directus_users WHERE email LIKE 'dummy\_%') < 4 THEN RAISE EXCEPTION 'Jalankan node scripts/seed-dummy-operasional.mjs seed terlebih dahulu'; END IF; END $$;`
    - Fungsi `pg_temp.dummy_kelurahan(token text) RETURNS integer`: pastikan provinsi `lower(nama)='jawa barat'` ada (buat `('JAWA BARAT','dummy_32')` bila tidak); cari kota di provinsi itu dengan `lower(nama) LIKE '%'||token||'%'`: tepat 1 → pakai, 0 → buat `('KABUPATEN '||upper(token), kode 'dummy_kota_'||token)`, >1 → `RAISE EXCEPTION`; kecamatan: `min(id)` milik kota, bila tidak ada buat `(upper(token)||' TENGAH', 'dummy_kec_'||token)`; kelurahan: `min(id)` milik kecamatan, bila tidak ada buat `('DESA '||upper(token), 'dummy_kel_'||token)`; return id kelurahan.
    - Fungsi `pg_temp.dummy_klasifikasi(kode text, kategori text, deskripsi text) RETURNS integer`: pakai `klasifikasi_usaha` dengan `kode` itu bila ada, selain itu insert dengan `deskripsi = 'dummy_'||deskripsi`.
    - Delapan usaha dummy (insert `alamat` → `pelaku_usaha` → `usaha` → `statistik_tenaga_kerja`; `ON CONFLICT` pada `pelaku_usaha.nik` dan `usaha.id` → `DO UPDATE` kolom non-kunci):

      | NN | usaha.nama | pemilik (jenis_kelamin) | token wilayah | KBLI (kategori) | skala | omzet_tahunan | total_aset | lat, lng | TK L/P |
      | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
      | 01 | Wawan Leathercraft | Wawan Setiawan (male) | subang | 15121 INDUSTRI PENGOLAHAN "Industri Barang dari Kulit" | small | 780000000 | 250000000 | -6.5715, 107.7587 | 4/3 |
      | 02 | Tahu Sumedang Bu Ika | Ika Kartika (female) | sumedang | 10792 INDUSTRI PENGOLAHAN "Industri Tahu Kedelai" | micro | 420000000 | 90000000 | -6.8586, 107.9164 | 2/4 |
      | 03 | Kopi Gunung Garut | Asep Hidayat (male) | garut | 10761 INDUSTRI PENGOLAHAN "Industri Pengolahan Kopi" | small | 950000000 | 400000000 | -7.2279, 107.9087 | 6/2 |
      | 04 | Batik Cimahi Lestari | Dewi Lestari (female) | cimahi | 13134 INDUSTRI PENGOLAHAN "Industri Batik" | micro | 300000000 | 60000000 | -6.8722, 107.5425 | 1/5 |
      | 05 | Keripik Nanas Subang | Siti Aminah (female) | subang | 10794 INDUSTRI PENGOLAHAN "Industri Kerupuk, Keripik, Peyek dan Sejenisnya" | micro | 240000000 | 45000000 | -6.5602, 107.7731 | 1/3 |
      | 06 | Madu Hutan Subang | Dadan Ramdani (male) | subang | 10799 INDUSTRI PENGOLAHAN "Industri Produk Makanan Lainnya" | micro | 180000000 | 30000000 | -6.6105, 107.7402 | 2/1 |
      | 07 | Anyaman Bambu Karawang | Nining Suryani (female) | karawang | 16292 INDUSTRI PENGOLAHAN "Industri Kerajinan Anyaman dari Bambu, Rotan dan Sejenisnya" | micro | 150000000 | 25000000 | -6.3227, 107.3376 | 0/4 |
      | 08 | Sambal Subang Mantap | Yudi Permana (male) | subang | 10779 INDUSTRI PENGOLAHAN "Industri Bumbu Masak dan Penyedap Masakan Lainnya" | micro | 360000000 | 70000000 | -6.5488, 107.7610 | 2/2 |

      Kolom tetap: `usaha.id = 'd0000000-0000-4000-8000-0000000000NN'`, `sumber_id = 'dummy_usaha_NN'`, `nib = '99000000000NN'` (13 digit), `status = 'active'`, `status_hukum = 'sole_proprietorship'`; `pelaku_usaha.nik = 'dummy_00000000NN'`, `tingkat_pendidikan` NULL; `alamat.alamat_jalan = 'Jl. Contoh No. NN'`.
    - Tautkan akun: `UPDATE directus_users SET kota = <kota id token subang> WHERE email='dummy_admin.subang@jabarprov.go.id'`; `UPDATE directus_users SET usaha='d0000000-0000-4000-8000-000000000001' WHERE email='dummy_wawan.leathercraft@gmail.com'`.
    - Setelah insert: `SELECT analitik_enqueue_job('rebuild_current_model','rebuild_current_model',NULL);` (agar `usaha_tabular`/`infografis_snapshot` memuat baris dummy; dedupe existing).
14. `scripts/cleanup-dummy-operasional.sql` (satu transaksi): lepas penugasan akun (`UPDATE directus_users SET usaha=NULL, kota=NULL WHERE email LIKE 'dummy\_%'`); kumpulkan alamat dummy ke temp table; `DELETE FROM usaha WHERE sumber_id LIKE 'dummy\_%'`; `DELETE FROM pelaku_usaha WHERE nik LIKE 'dummy\_%'`; hapus alamat terkumpul; hapus `kelurahan`, `kecamatan`, `kota`, `provinsi` `WHERE kode LIKE 'dummy\_%'` (urutan itu); hapus `klasifikasi_usaha` `WHERE deskripsi LIKE 'dummy\_%'` yang tidak direferensikan; `SELECT analitik_enqueue_job('rebuild_current_model','rebuild_current_model',NULL);`. Setiap phase berikut menambah `DELETE` tabel domainnya di bagian atas file (sebelum delete usaha).
15. `docs/operasional/dummy-data-runbook.md`: tujuan, daftar marker (salin tabel "Dummy marker" main plan §4), perintah seed (urutan: `.mjs seed` → `.sql`), perintah cleanup (urutan: `cleanup-dummy-operasional.sql` → `.mjs cleanup`), larangan production tanpa konfirmasi, contoh perintah memakai `docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_DATABASE" < scripts/<file>.sql`, dan query verifikasi sisa dummy (hitung baris `LIKE 'dummy\_%'` per tabel = 0).

## Mixed, negative, boundary, cross-role, lifecycle, and failure cases

- Admin break-glass (`accountability.admin`) → role `provinsi` di `/me` dan lolos semua guard default.
- Role pendamping/umkm/kabkota ke endpoint existing → 403 (default roles provinsi).
- Kabkota tanpa kota → `/me` 200 dengan `kota: null` (requireAssignment false); `resolveOperator` default → 403 `KOTA_NOT_ASSIGNED`.
- Umkm tanpa usaha → `/me` 200 `usaha: null`.
- User terhapus di tengah session → 401 `AUTHENTICATION_REQUIRED`.
- `resolve-nib`: NIB 12/14 digit, huruf, spasi → 400; NIB milik usaha tanpa akun umkm → 404; NIB milik akun non-umkm → 404; akun `suspended` → 404.
- Header secret panjang berbeda → 403 tanpa exception `timingSafeEqual` (bandingkan panjang dulu).
- Seed dijalankan dua kali → jumlah baris dummy tetap (8 usaha, 8 pelaku, 4 akun).
- Seed terhadap host non-lokal → exit 1 sebelum request apa pun.
- Migration `down` lalu `up` ulang → idempotent.

## Validation commands

Narrow source/package gates:

```bash
node --check scripts/seed-dummy-operasional.mjs
node --check services/directus/extensions/shared/operator.cjs
pnpm --dir services/directus/extensions/directus-extension-operasional test
pnpm --dir services/directus/extensions/directus-extension-tabular test
pnpm --dir services/directus/extensions/directus-extension-infografis test
pnpm --dir services/directus/extensions/directus-extension-analitik test
pnpm --dir services/directus test
pnpm lint:oxlint
docker compose --env-file .env.example config --quiet
```

Expected: setiap command exit 0; operasional ≥12 test pass; tabular 16 pass; infografis 7 pass; analitik 27 pass/1 skip; directus foundation ≥7 pass; oxlint 0 warning/0 error.

## Runtime/migration proof and unproven boundary

Jalankan prosedur disposable stack main plan §7, lalu:

```bash
set -a; . /tmp/operasional-e2e.env; set +a
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT name FROM directus_roles ORDER BY name"
docker compose -p diskuk-operasional-e2e --env-file /tmp/operasional-e2e.env exec -T postgis psql -U "$DB_USER" -d "$DB_DATABASE" -tAc "SELECT count(*) FROM usaha WHERE sumber_id LIKE 'dummy\_%'"
curl -s -c /tmp/op.cookies -H 'content-type: application/json' -d "{\"email\":\"dummy_admin.subang@jabarprov.go.id\",\"password\":\"$DEMO_ACCOUNT_PASSWORD\",\"mode\":\"session\"}" http://127.0.0.1:8055/auth/login -o /dev/null -w '%{http_code}\n'
curl -s -b /tmp/op.cookies http://127.0.0.1:8055/operasional/me | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d["role"], d["kota"] is not None)'
curl -s -b /tmp/op.cookies http://127.0.0.1:8055/tabular/ -o /dev/null -w '%{http_code}\n'
```

Expected: roles berisi `Admin Kab/Kota`, `Admin Provinsi`, `Pelaku UMKM`, `Pendamping`; count `8`; login `200`; `/me` mencetak `kabkota True`; tabular untuk kabkota `403`. Lalu jalankan cleanup (runbook) dan buktikan count `0`. Bila Docker/port tidak tersedia: status `not runtime-proven`; yang tetap tidak terbukti: eksekusi SQL migrasi/seed nyata dan cookie session Directus.

## No-advance condition

Jangan lanjut ke Phase 2 bila test existing tabular/infografis/analitik berubah jumlah pass, atau `/me` tidak mengembalikan role key yang benar untuk keempat role.

## Required failure probes

- Unit: `/internal/resolve-nib` dengan env `OPERASIONAL_INTERNAL_SECRET` tidak diset → 503.
- Unit: tabular `GET /` dengan role kabkota → 403.

## Scope-amendment rule

Sebelum menyentuh path di luar manifest, stop dan laporkan path, alasan, dan dampak. Setelah `git add -f` untuk file docs baru:

```bash
python3 docs/dashboard-operasional-e2e-plan/scope_guard.py check \
  --snapshot /tmp/operasional-phase-1-before.json \
  --manifest docs/dashboard-operasional-e2e-plan/scope_manifest.json \
  --phase 1
```

Expected: exit `0` dan `outside` adalah array kosong.

## Rollback dan handoff

Rollback: revert commit phase; pada disposable stack jalankan `npx directus database migrate:down` satu langkah atau `down -v`. Handoff ke Phase 2: kontrak `GET /panel/operasional/me` (bentuk §Final), `POST /internal/resolve-nib` (dipanggil server Nuxt dengan header secret), akun dummy + password env `DEMO_ACCOUNT_PASSWORD`.
