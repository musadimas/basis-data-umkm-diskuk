# E2E Plan — Analitik UMKM dan Architecture Decisions

**Verdict plan:** executor-ready  
**Repository:** `/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk`  
**Baseline inspeksi:** branch `main`, commit `a12001023b048049a11169cdf4b20b75472eae48`, working tree ahead 1 dan sudah dirty  
**Sumber normatif:** `docs/analytics/*.md` dan `docs/architecture/decisions/*.md`  
**Scope implementasi:** target current-state MVP pada roadmap Phase 0–3, tanpa CRUD form khusus; roadmap analytics Phase 4–6 tetap di luar scope.

## 1. Outcome, pengguna, dan definisi selesai

### Outcome

Membangun dashboard privat berbasis Directus yang menambahkan `/dashboard/analitik` dan `/dashboard/umkm/:id`, memakai current-state read model terversi, query server-side yang aman, saved analysis, ekspor privat, server-side privacy masking, worker terpisah, rekonsiliasi, dan last-known-good. Infografis, Tabular, dan Spasial tetap tersedia tetapi berubah dari public menjadi authenticated.

### Pengguna dan role

- **Application User:** analis/perencana internal DisKUK; akun harian least-privilege.
- **Break-glass Admin:** Super Admin Directus terpisah; hanya konfigurasi dan pemulihan.
- **Analytics Worker:** identity database/object-storage tersendiri; bukan token manusia.
- Tidak ada registrasi publik, reset password publik, public share link, atau role UI tambahan.

### Perilaku saat ini

- Deployment mengembalikan `200` tanpa sesi untuk `/dashboard`, `/panel/infografis/`, dan `/panel/tabular/status`.
- `AuthSignInForm.vue` adalah template statis; tidak ada route middleware, bootstrap user, logout fungsional, atau server-side idle policy.
- `/panel/assets/**` memakai `CacheFirst`; beberapa service ports dipublish; material runtime/key Caddy masih tracked.
- SIDT bersifat insert-only; snapshot dibangun dengan `TRUNCATE`; workforce yang belum tervalidasi tetap dipublikasikan; sector percentage memakai kelompok terbesar sebagai denominator.
- Tidak ada `analitik_field`, `analitik_view`, `analitik_job`, `analitik_health`, worker, generation pointer, API `/analitik`, canvas, profil, atau export job.

### Perilaku target

1. Seluruh `/dashboard/**`, endpoint dashboard, docs internal, asset privat, saved view, profil, dan ekspor memerlukan sesi Directus serta policy yang tepat.
2. Mutasi sumber menulis outbox atomik melalui database trigger; worker terpisah memproyeksikan current state dalam ≤60 detik.
3. Rebuild memakai candidate generation, tail replay, rekonsiliasi, atomic promotion, dan previous last-good.
4. Query memakai immutable registry ID, allowlisted expression/operator/aggregation, bound values, `COUNT DISTINCT usaha.id`, filtered-total share, explicit missing/unmapped, timeout, dan complexity limit.
5. Canvas Indonesia/WIB menyediakan template, apply-only builder, URL state aman, KPI, insight deterministik, bar/stacked/donut/histogram/choropleth/table, drill-down, cross-filter terpisah, record list, saved analysis, dan ekspor.
6. Profil hanya menerima DTO semantic; NIK/telepon termasking, tanggal lahir menjadi kelompok usia, domisili pribadi tidak dikirim, dan exact coordinates hanya tampil pada profil authenticated atau halaman Spasial authenticated.
7. Health/watchdog, structured logs, log budget, WAL/PITR, restore/replay/reconcile drill, dan release probes menghasilkan bukti runtime yang jujur.

### Keputusan produk dan arsitektur yang dikunci

- MVP berarti seluruh fase 1–9 plan ini; milestone parsial tidak boleh disebut MVP selesai.
- Golden analyst tasks: sebaran kabupaten/kota; drill-down ke kecamatan; share sektor C dalam filter; komposisi skala yang dilaporkan; KBLI mapped/unmapped; perbandingan dua wilayah pada snapshot yang sama; buka profil dari record list lalu kembali; simpan/buka ulang analisis; ekspor hasil dengan masking.
- Source scope adalah seluruh `usaha` aktif pada instalasi; provinsi selain Jawa Barat dikeluarkan, sedangkan chain geography yang hilang tetap masuk bucket `Tidak diketahui` agar record tidak hilang diam-diam.
- Absennya record dari satu batch SIDT tidak mengarsipkan record karena ingest dapat parsial/resumable. Archive hanya melalui aksi eksplisit Directus `status = archived`; restore mengembalikan `active`.
- Database trigger adalah capture seam untuk Directus, import, dan raw SQL. `analitik_job` berfungsi sebagai durable outbox sekaligus queue, tanpa raw PII payload.
- Read model memakai fixed indexed core columns plus approved scalar `extra_fields JSONB`; O2M/M2M tetap memerlukan relation definition dan distinct count. Discovery tidak pernah mengaktifkan field.
- Initial active metrics: jumlah UMKM dan quality/coverage. Financial distribution aktif hanya setelah readiness membuktikan completeness ≥80%, invalid ≤5%, dan benchmark lulus; `SUM` tetap disabled. Workforce tetap disabled sampai data owner memberi evidence tertulis di luar repository.
- Mapping sektor A–U memakai range dua-digit yang saat ini ada di `scripts/refresh-dashboard-snapshots.sql` dan label `kategori.md`, disalin ke reference SQL terversi. Missing, nonnumeric, out-of-range, dan mapping gap dipisah.
- Choropleth memakai `kota.kode` dan `kota.geom` sebagai authoritative 27-region source. Release terhenti bila readiness menemukan code/geometry administratif tidak lengkap; UI tidak memakai fabricated SVG map.
- UUID `usaha.id` diperbolehkan sebagai opaque authenticated profile path. UUID, NIK, telepon, dan PII lain tetap dilarang di serialized analysis filter/query URL.
- Aksi **Edit** profil membuka Directus Admin untuk field usaha yang diizinkan; custom CRUD dan raw owner-PII edit tetap non-goal. Archive/Restore tersedia pada profil.
- Aggregate CSV diproses sinkron oleh `POST /exports` dan mengembalikan completed private URL; detail CSV, PNG, dan PDF mengembalikan `202` job. Semua jalur diaudit; detail CSV maksimum 50.000 row.
- Session memakai Directus session cookie 8 jam dan signed Nitro policy cookie yang menegakkan absolute 8 jam serta idle 30 menit. Refresh request tidak memperbarui human-activity timestamp. Mutasi `/panel/**` ditolak bila `Origin` tidak sama.
- Directus image dipin ke `11.17.4`. Infografis/Tabular response shape dipertahankan; intentional breaking change-nya hanya auth.
- Operational logs memakai bounded Docker local logging capacity yang dibuktikan cukup untuk ≥30 hari dari measured daily volume. Audit Directus/job disimpan satu tahun.
- WAL-G dipin ke `v3.0.8` dan mengirim base backup/WAL ke encrypted off-host S3-compatible target. MinIO pada host yang sama bukan bukti disaster RPO.

### Non-goals

- Trend, pertumbuhan, event-history analytics, prediksi, AI generatif, causal recommendation.
- Program/outcome, shortlist, notes/conclusions/approval workflow.
- Multi-user role UI, public sharing, free-form dashboard builder.
- Custom CRUD application, raw-PII owner editor, unrestricted joins, browser export jutaan row.
- External uptime monitor, push alert, Redis/BullMQ, OLAP database, read replica.

### Completion definition

Semua deterministic no-advance gates lulus; runtime auth/permission/migration/worker/browser/load/PITR probes memiliki evidence; source dan active generation reconcile; common query p95 ≤3 detik, profile/drill p95 ≤5 detik, source-to-visible ≤60 detik; canary scan menemukan nol raw PII/credential; visual/accessibility flows lulus; production public probes berubah ke redirect/401; accepted external-monitoring blind spot tetap tercatat.

## 2. Evidence map

| Jalur / simbol | Fakta yang mengikat plan |
|---|---|
| `apps/web/nuxt.config.ts::routeRules`, `pwa.workbox.runtimeCaching` | Same-origin proxy sudah ada; private assets saat ini CacheFirst. |
| `apps/web/app/plugins/directus.client.ts` | Session SDK client-only dan belum menjadi SSR guard. |
| `apps/web/app/components/auth/SignInForm.vue` | Form statis, English/social/register/reset UI, tanpa submit. |
| `apps/web/app/pages/(private)/dashboard/*.vue::definePageMeta` | `(private)` hanya route group; tidak ada middleware auth. |
| `apps/web/app/components/nav/Header.vue` | User hard-coded dan logout tidak memiliki handler. |
| `services/directus/extensions/directus-extension-tabular/src/index.js::buildFilter`, route handlers | Fixed identifiers dan bound values dapat dipertahankan; read routes belum memeriksa accountability. |
| `services/directus/extensions/directus-extension-infografis/dist/index.js::handler` | Public raw snapshot read; source/build reproducibility belum ada. |
| `services/directus/extensions/docs/src/index.ts::handler` | Docs/OAS internal masih dapat dibuka anonymous. |
| `scripts/ingest-sidt-batch-end.sql::sidt_new`, `ON CONFLICT ... DO NOTHING` | Existing source changes diabaikan. |
| `scripts/refresh-dashboard-snapshots.sql::TRUNCATE usaha_tabular`, `sektor_definisi`, `percentage` | Rebuild memblokir, join chain membuang missing, legacy denominator salah. |
| `services/directus/migrations/20250801C-create-businesses.js::up` | Grain UUID tersedia; belum ada archive/status/source timestamps. |
| `services/directus/migrations/20250801B-create-entrepreneurs.js::up` | NIK, birth date, phone, private address adalah PII source. |
| `services/directus/migrations/20250801D-create-workforce-stats.js::up` | Workforce semantics tidak membuktikan disability disjoint. |
| `docker-compose.yml` dan `docker/Caddyfile` | Belum ada worker, ports masih exposed, Caddy hanya proxy web. |
| `services/caddy/data/**`, `services/caddy/config/**` | Delapan runtime/key artifacts tracked; isinya dilarang dibaca. |
| `docs/analytics/api-contract.md`, `domain-model.md`, `ux-spec.md`, `operations-runbook.md` | Kontrak API, privacy, visual, lifecycle, reliability normatif. |
| `docs/architecture/decisions/0001`–`0005` | Security, outbox, registry, privacy, dan health decisions accepted. |

## 3. Current dan target end-to-end flow

### Current read

```text
anonymous browser -> Caddy -> Nuxt /dashboard SSR -> /panel proxy
-> public infografis/tabular extension -> infografis_snapshot / usaha_tabular
-> HTML/API payload visible without session
```

### Current write/publish

```text
SIDT CSV -> psql batch -> INSERT unseen rows only -> commit each batch
-> final refresh SQL -> TRUNCATE usaha_tabular -> rebuild + overwrite singleton
-> public endpoint -> dashboard
```

### Target mutation/projection

```text
Directus Items | corrected SIDT upsert | authorized raw SQL
-> source transaction + DB trigger -> analitik_job queued atomically
-> separate worker short SKIP LOCKED claim -> safe denormalized projection
-> per-record validation or candidate rebuild + tail replay + reconcile
-> active generation pointer/dataAsOf -> last-good preserved
```

### Target query/consumer

```text
authenticated browser -> Caddy-only ingress -> Nitro /panel policy proxy
-> Directus accountability + Application User role
-> /analitik metadata/query/records/profile/export
-> registry ID AST -> read-only transaction on active generation
-> semantic DTO + privacy minimization -> Nuxt canvas/profile/export
```

### Target failure flow

```text
worker/projection/reconcile failure -> candidate not promoted or old row retained
-> incident fingerprint + health update + retry/dead workflow
-> API returns active last-good with status/warning
-> UI shows nontechnical stale message and no queue internals
```

## 4. Contract ledger

| Area | Final contract |
|---|---|
| Producer | DB triggers cover `usaha`, `pelaku_usaha`, `alamat`, geography, KBLI, workforce, archive, delete, and schema reconciliation. Ingest batch explicitly enqueues one coalesced rebuild and never emits millions of duplicate jobs. |
| Persistence | `analitik_job`, `analitik_field`, `analitik_view`, `analitik_health`, generation metadata, active pointer, one-row-per-usaha generation table, KBLI sector reference. Candidate/active/previous are explicit. |
| API serialization | `schemaVersion: 1`; metadata includes `dataAsOf`, `generatedAt`, user-facing status, population, matched, coverage, warnings. Error envelope never exposes SQL/stack/PII. |
| Query | One metric, ≤2 dimensions, top 20 plus `others`, donut ≤6, bound values, identifier mapping only from active registry, distinct usaha count. Invalid filters fail closed rather than broadening scope. |
| Consumers | Existing Infografis/Tabular/Spasial preserve payload shape under auth. Analitik, profile, saved view, export, browser history, screenshots, and accessibility table use the same semantic definitions. |
| Permissions | Anonymous 401; no session UI redirect; authenticated wrong role 403; Application User only approved dashboard/API/items; admin accepted as break-glass; owner filter on `analitik_view`/export. |
| Privacy | Read model stores masked NIK/phone and age band only, not raw PII/private domicile. Raw `usaha.foto` URL remains quarantined; profile uses fallback until a Directus-managed private file exists. |
| Time storage | PostgreSQL `TIMESTAMPTZ` normalizes to UTC; source `pulled_at`/`updated_at` accepted only with explicit `Z` or numeric offset; missing/invalid is NULL plus quality flag. |
| Time serialization | API emits RFC 3339 UTC with `Z`. `dataAsOf` is successful projection/promotion time, not business event time; `generatedAt` is response time. |
| Time display | UI parses absolute instants and formats `id-ID`, `Asia/Jakarta`, `WIB`. Test `2026-08-16T23:30:00Z` must display `17 Agustus 2026, 06.30 WIB` in browser zones UTC and America/Los_Angeles. |
| Failure | Timeout 504; complexity 422; quarantined 400; removed field 409; LKG 200 + warning; export over limit 422; logs/errors sanitized and correlated. |
| Compatibility | Existing dashboard wire fields remain unchanged. Public access removal is intentional. `tabular/publish` becomes enqueue-only admin action and no longer performs a synchronous truncate. |
| Offline/cache | Private API/assets are `private, no-store`; no offline private dashboard promise. Logout clears memory, TanStack persisted state, relevant IndexedDB stores, and Workbox private caches. |
| Retention | Completed ordinary jobs/health detail 30 days; export/audit records one year; export object ≤24h; active+previous generation retained, older generation removed only after safe retention gate. |

## 5. Intentional visual dan behavior deltas

| Surface | Before | After | Evidence wajib |
|---|---|---|---|
| Sign-in | English Acme template, social/register/reset, no action | Indonesian email/password/show-password, generic error, working safe redirect | Desktop 1440×900 and mobile 390×844 before/after |
| Landing nav | `Dashboard` opens public UI; `Daftar` shown | Dashboard redirects to sign-in; no registration | Anonymous screenshot + network trace proving no dashboard fetch |
| Dashboard header/sidebar | Hard-coded Admin, no logout, 3 dashboard links | Current user, working logout, Analitik link | Authenticated desktop/tablet screenshot |
| Existing pages | Anonymous and public API | Same content shape under session; freshness wording added only where specified | Before/after Infografis, Tabular, Spasial; data layout parity except auth/freshness |
| Analitik | Route absent | Single canvas per UX spec | Desktop, tablet, mobile; default, filtered, partial, empty, stale, invalid states |
| Choropleth | Existing Infografis fabricated/composite SVG | Authoritative 27-region geometry + unknown in table | Map and equivalent table screenshot; fabricated map must not be reused |
| Profile | Route absent | Rich semantic profile, masked fields, archive state, fallback image | Active and archived desktop/mobile screenshots |
| Export/saved | Browser CSV loop only | Saved config and audited private export state | Saved reopen warning, queued/completed/expired screenshot |

Screenshots go to Playwright `apps/web/test-results/` and are test artifacts, not source files. Every chart screenshot must include its table alternative and a keyboard-focus capture.

## 6. Phase index

| Phase | Depends on | Exit result | Rationale |
|---:|---|---|---|
| 1 | none | Existing dashboard and APIs have a real private session boundary | Security must close before adding surfaces. |
| 2 | 1 | Source updates/archive/current semantics are truthful | Projection cannot repair ignored source updates. |
| 3 | 2 | Database contracts, registry, outbox, health, permissions exist | Worker and API require stable persistence. |
| 4 | 3 | Separate worker projects/rebuilds/reconciles with LKG | API must not target an unproven read model. |
| 5 | 4 | Private semantic query API is contract-tested | UI consumes stable server semantics. |
| 6 | 5 | Accessible stateful analytics canvas works end-to-end | First visible vertical slice. |
| 7 | 5 and 6 | Masked profile and archive/restore work | Profile reuses records/state and privacy contracts. |
| 8 | 4, 5, 6, 7 | Saved config and private export workflow work | Export reuses worker, API, canvas, profile. |
| 9 | 1–8 | Reliability, performance, PITR, visual, release proof closed | Claims close only against integrated runtime. |

## 7. Global validation matrix

| Category | Command/proof | Expected |
|---|---|---|
| Source inspection | `git status --short --branch`; exact `rg` anchors from each phase | No silent scope drift; baseline dirt preserved. |
| Scope | `python3 docs/analytics-architecture-e2e-plan/scope_guard.py check ...` | Exit 0, `outside: []`. |
| Static | `node --check` for JS/MJS/migrations; `python3 -m py_compile`; `pnpm run typecheck` | Exit 0. |
| Unit/contract | Web Vitest; extension Node tests; worker Node tests; ingest unittest | Exit 0 and named negative cases pass. |
| Authenticated API | Ephemeral Directus plus Application User and wrong-role user | 401/403/2xx matrix, CSRF and IDOR negative probes. |
| Browser | Playwright mock first, then actual ephemeral stack | Golden tasks, URL restore, keyboard, cache logout, cross-timezone. |
| Migration | Fresh up, down last two analytics migrations, up again; inspect constraints/indexes | Exit 0; no source loss; rollback documented. |
| Worker | Actual PostgreSQL kill/reclaim/duplicate/rebuild/reconcile | No loss/double count; LKG retained; ≤60s. |
| Provider/storage | S3 export expiry; off-host WAL/base backup and isolated restore | Object private/expired; measured RPO/RTO. |
| Deployment | Only 80/443 public; anonymous production probes; key rotation receipt | Dashboard redirect; APIs 401; no bypass ports. |
| Production data | Read-only readiness/reconciliation and representative benchmark | Zero invariant diff; thresholds met; no PII output. |

## 8. Dirty-worktree dan high-risk boundaries

**Approved scope amendment:** Phase 1 includes a root `.dockerignore` and the Directus package manifest. Docker build contexts must exclude Caddy runtime/key paths, local data volumes, dependency/build trees, and environment files before any image build.

### Baseline yang wajib dipertahankan

Working tree sebelum plan sudah memuat perubahan pada `.gitignore`, KBLI/scale UI, Tabular/Spasial pages/types, snapshot SQL, Tabular endpoint/tests, serta untracked docs dan migration koordinat. Executor dilarang menganggap perubahan tersebut miliknya. Phase 1 menyentuh `.gitignore` dan Tabular endpoint/tests; Phase 2 menyentuh snapshot SQL. Pada file overlap itu, executor harus menggabungkan perubahan tanpa menghapus spatial/coordinate work yang sudah ada.

### Dilarang tanpa pengecualian

- `git reset --hard`, `git clean`, stash seluruh tree, checkout/restore file user, rebase/force-push, history rewrite.
- Membaca, menyalin, mencetak, atau membuka isi file `.key`, token, cookie, password, `.env`, database dump, atau PII.
- Menjalankan destructive SQL, truncate source, hard-delete usaha, production migration down, restore PITR, key rotation, deploy, public ingress change, user provisioning, atau network write ke deployment tanpa konfirmasi eksplisit pengguna.
- Menulis file di luar closed manifest phase; generated ignored outputs hanya boleh berasal dari command gate yang disebutkan.

### Operasi yang memerlukan konfirmasi pengguna

- Rotasi/revoke ACME/private keys, repository-history cleanup, dan clone-distribution response.
- Provision Application User/break-glass credential pada deployment.
- Menjalankan migration/upsert/rebuild/load test pada database non-ephemeral.
- Mengubah firewall/DNS/Caddy production, deploy image, membuat off-host backup bucket, atau melakukan restore drill.
- Menghapus generation/export/audit object di luar retention test environment.

`git rm --cached` terhadap delapan runtime Caddy paths diperbolehkan sebagai perubahan repository; file lokal tidak dihapus dan tidak dibaca. Rotasi key tetap boundary terpisah.

## 9. Global invariants

1. `COUNT DISTINCT usaha.id` active source scope sama dengan active read model.
2. Geography buckets + unmapped, KBLI mapped + all unmapped subtypes, dan scale buckets + unknown masing-masing sama dengan total scope.
3. Satu committed mutation menghasilkan durable/coalesced job; rollback menghasilkan neither source mutation nor job.
4. Replay/duplicate/out-of-order job tidak menggandakan aggregate.
5. Candidate tidak aktif sebelum reconciliation pass; failure mempertahankan last-good.
6. No raw NIK, phone, birth date, owner domicile, credential, signed URL, SQL, stack, atau job payload pada analytics response/cache/export/log/health/URL/SSR HTML.
7. Public landing tidak mengambil dashboard payload. Dashboard wire format lama berubah hanya pada auth boundary.
8. Application User bukan Super Admin; generic Items permissions tidak membuka raw owner PII.
9. Workforce/trend/causal wording tetap disabled.
10. Private response tidak offline-cached; cache key tidak pernah melintasi user, permission, generation, schema, masking, atau locale.
11. PostgreSQL adalah owner source dan outbox; browser tidak melakukan aggregate jutaan row.
12. p95/common performance, ≤60s freshness, export cap, timeout, and category budgets tidak boleh dilonggarkan untuk membuat gate hijau.

## 10. Executor checklist

1. Baca repository instructions dan semua plan files dari disk.
2. Jalankan `git status --short --branch`; simpan baseline dirty list; jangan mengubah user work di luar manifest.
3. Baca keputusan terkunci, non-goals, invariants, phase dependency, dan high-risk confirmation boundaries.
4. Sebelum tiap phase, jalankan scope snapshot:
   ```bash
   python3 docs/analytics-architecture-e2e-plan/scope_guard.py snapshot --output /tmp/analytics-phase-N-before.json
   ```
5. Kerjakan phase hanya setelah dependency berstatus `proven` atau explicit allowed runtime boundary dicatat.
6. Jalankan narrow tests lebih dahulu, lalu deterministic no-advance gate, lalu runtime/negative probes.
7. Jalankan scope check dan `git diff --name-only`; review setiap file yang berubah.
8. Satu phase normalnya satu focused commit; jangan memasukkan pre-existing user changes tanpa persetujuan.
9. Catat status dengan vocabulary `proven | blocked | not runtime-proven | not applicable`.
10. Saat manifest perlu melebar, stop; laporkan path, alasan, contract impact, test impact, dan proposed phase amendment.

## 11. Stop-and-amend rule

Executor harus berhenti sebelum menyentuh file di luar `scope_manifest.json`, sebelum mengubah decision normatif, sebelum mengaktifkan workforce/financial metric yang gagal gate, sebelum memakai map non-authoritative, atau sebelum mengganti queue/read-model/session/export/PITR design. Tidak ada ekspansi diam-diam. Amendment harus mengubah main plan, phase file, dan scope manifest secara konsisten lalu mengulang dependency/validation review.

## 12. Status vocabulary

- **proven:** deterministic gate dan runtime proof yang diwajibkan phase lulus.
- **blocked:** dependency, confirmation, data, provider, atau gate gagal.
- **not runtime-proven:** source/tests lulus tetapi runtime boundary yang disebutkan belum tersedia; phase tidak boleh diklaim complete.
- **not applicable:** probe tidak berhubungan dengan phase dan alasannya tercatat.
