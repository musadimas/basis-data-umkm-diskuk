# R03 runtime evidence (N7-01, N7-02, N7-03) and R01 pending items

Date: 29 Sep 2026 (session clock 28 Sep 19:1x UTC). Verdict scope: evidence only; Y10 gate is still `blocked`, so R03 stays `partial`.

## Isolation

- DB `r03_clone` created with `pg_dump diskuk | psql` in `diskuk-operasional-e2e-postgis-1` (the shared DB had live connections, so `TEMPLATE` was not usable). Clone was at migration `20260927B`; the temp container applied `20260928A..G`.
- Temp container `r03-directus` (port 127.0.0.1:8155, network `diskuk_net`) used the existing image `diskuk-operasional-e2e-directus:latest` (Directus 11.17.4) with the CURRENT extensions and migrations bind-mounted read-only from a scratch copy: `analytics`, `authentication`, `program` (dist rebuilt from current source, including the fixes below), `directus-extension-operasional` (plain copy of `src` incl. `permen-aspek.js`), `shared`. Migration files were copied with mode 0644 (works around the 0600 trap on B-E); the Dockerfile.directus pnpm-workspace trap was avoided by not rebuilding the image. No shared file was edited for deploy purposes.
- Captcha: the `/auth/login` captcha was disabled on the temp container (`AUTH_CAPTCHA_ENFORCE=false`). The program endpoints (`/daftar`) always require ALTCHA, so real challenges from `/v1/auth/captcha/challenge` were solved with the `altcha` lib in every registration call.
- Clone-only data prep: argon2 password set for all clone users; 6 extra `umkm` users cloned from the dummy owner and linked to usaha 2..7; usaha 7 NIB nulled; 9 test events inserted; 8 bantuan cards published; 300k synthetic `usaha`/`usaha_tabular` rows for timing. None of it touched the shared DB.
- Cleanup verified: container removed, DB dropped, scratch stage/env/xlsx removed, no `r03*` image existed (no image was built), web preview process killed. Shared DB `diskuk` still at max migration `20260927B`, `kegiatan_pendaftaran` absent, 8 usaha / 6 kegiatan unchanged; shared containers untouched (uptime unchanged).

## Step 1 - migrations (official migrator in the temp container)

| Probe | Result |
| --- | --- |
| `init.sh` -> `migrate:latest` | applied App Role Tanpa Default, Tabular Search Trgm, Analitik Job Expired, Waktu Jakarta, Batalkan Job Export Lama, Executive Investor, Kegiatan Registrasi Bantuan; "Database up to date" |
| Readback after latest | tables `bantuan_fasilitasi, kegiatan_keputusan_audit, kegiatan_pendaftaran, kegiatan_presensi, kegiatan_sertifikat, kegiatan_sertifikat_dampak` (+ pre-existing `kegiatan_pengingat`); no `kegiatan_notifikasi`; 4 new `kegiatan` columns (`pendaftaran_internal, butuh_pakta_integritas, jumlah_sesi, butuh_tugas`); 8 seed rows in `bantuan_fasilitasi`; 18 indexes incl. `ux_kegiatan_pendaftaran_aktif` (partial), `kegiatan_pendaftaran_epass_token_key`, `kegiatan_presensi_pendaftaran_sesi_ke_key` (idempotent scan), `ux_kegiatan_sertifikat_aktif` (partial, one active per pendaftaran), `kegiatan_sertifikat_kode_key`, `idx_kegiatan_sertifikat_dampak_usaha`, `idx_bantuan_fasilitasi_publik` |
| `migrate:down` (G only) | "Undoing Kegiatan Registrasi Bantuan... Downgrade successful". Readback: `to_regclass` of `kegiatan_pendaftaran` and `bantuan_fasilitasi` NULL, 0 of the 4 columns, latest version `20260928F`, 1 remaining `directus_collections` row (`kegiatan_pengingat`) |
| `migrate:latest` again | re-applied, identical table/column/index readback |

## N7-01 - registration (real HTTP against clone)

| Probe | Status / readback |
| --- | --- |
| `GET /v1/program/registrasi/prefill` as u1 | 200, own usaha only (Wawan Leathercraft, Subang). Same call with `?nib=<other NIB>&usaha=<other id>` returns the caller's own data (params ignored, no oracle). u2 gets u2's data. Anonymous 401, provinsi staff 403 |
| `POST /kegiatan/:id/daftar` on event with `registration_url` (`pendaftaran_internal=false`) | 409 `PENDAFTARAN_EKSTERNAL` |
| skala: micro usaha -> `syarat_skala=small` | 422 `TIDAK_ELIGIBLE` (`skala_tidak_memenuhi`); small usaha 201 |
| NIB: usaha without NIB -> `syarat_nib` | 422 (`wajib_nib`); usaha with NIB 201 |
| wilayah: Sumedang usaha -> `syarat_wilayah=Subang` | 422 `wilayah_tidak_memenuhi`; Subang usaha **first run 422 (BUG 1, see below)**, after fix 201 |
| pakta missing / false on `butuh_pakta_integritas` | 400 `PAKTA_WAJIB` x2; with pakta true 201 |
| consent false | 400 `CONSENT_WAJIB` |
| `butuhDisabilitas=true` without text | 400 `AKSESIBILITAS_WAJIB` |
| registration closed (`batas_registrasi` past) | 409 `PENDAFTARAN_DITUTUP` |
| staff (provinsi) calls daftar | 403 |
| re-register same event | 409 `SUDAH_TERDAFTAR`; after `batal`, re-register 201 (status `daftar_tunggu` because quota held), again 409 |
| e-pass while `menunggu` / `ditolak` | 404 `EPASS_NOT_FOUND`; only `diterima` gets a QR |
| Last slot, quota 1, 4 concurrent registrants (`Promise.all`) | **First run: all four `menunggu` (BUG 2)**. After fix: SQL readback `menunggu, daftar_tunggu, daftar_tunggu, daftar_tunggu` (row lock on `kegiatan` serialises them) |
| Quota enforced server side | quota check runs in the transaction under `FOR UPDATE`; UI not involved |

## N7-02 - selection, e-pass, presence, certificate

| Probe | Status / readback |
| --- | --- |
| Roles: umkm on `/pendaftar`, `/keputusan`, `/pendaftar/xlsx`, `/sertifikat`, `/cabut` | all 403; anonymous 401 |
| kabkota (Subang) list | only Subang rows (2 of 5); decide on Sumedang participant 404; **tugas/issue/revoke on other city: 200/500/200 before fix (BUG 3), 404 after fix**; own city works (accept 200, issue 201) |
| Decisions | `diterima` computes `skor_talent` server side (`placeholder-v0`, 48.13 / 46.25 / 38.75); `ditolak` with reason. Audit rows (8 in the run): `menunggu->diterima` with score, rubric, reason, actor email; `menunggu->ditolak`; `diterima->batal`; `daftar_tunggu->diterima` (promotion). Invalid decision 400 |
| `KUOTA_PENUH` | quota 1 held by u6, accepting u3 -> 409 `KUOTA_PENUH` |
| Waitlist promotion | u6 `batal` -> u3 (oldest `daftar_tunggu`) became `diterima` in the same transaction; readback `6:batal 3:diterima 4:daftar_tunggu 5:daftar_tunggu` |
| `POST /pindai` | no secret / wrong secret 403; malformed QR 400; session 11 of 10 400 `SESI_TIDAK_VALID`; same QR+session twice -> both 200 `hadir:1`; SQL: 8 presensi rows per participant for sessions 1..8, no duplicate; cross-participant QR (u2 pendaftaran id + u1 token) 404 `QR_TIDAK_DITEMUKAN` |
| Certificate refusals | 10% hadir: 409; 80% hadir but tugas not done: 409; tugas set `selesai=false` at 80%: 409; 70% hadir + tugas: 409; `ditolak` participant: 409; **79.9% is not reachable with <=60 sessions**, the closest below the gate is 47/59 = 79.7%: refused 409, 48/59 = 81.4% issued 201 |
| Issue | 80% + tugas -> 201, then 3 parallel retries -> all 200 `duplikat:true`, one certificate row, one `kegiatan_sertifikat_dampak` row (`bukti_pelatihan_manajemen` / `peningkatan_kapasitas_sdm`, `aktif=t`, `sumber=kegiatan_sertifikat`, `versi=1`). **First run: 500 (BUG 4)** |
| Public verify `GET /sertifikat/:kode` (anonymous) | valid: `{"valid":true,"status":"aktif"}`; unknown / malformed code 404 |
| Revoke | kab on other city 404, umkm 403, provinsi 200 `dicabut`; second revoke 404; SQL `aktif=f` for that certificate; public verify -> `{"valid":false,"status":"dicabut","dicabutPada":...}`; re-issue after revoke creates a new active certificate |
| XLSX export (`/pendaftar/xlsx`) | 200 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; `unzip -l` lists 5 parts; openpyxl opens sheet `Pendaftar`, header `Usaha, Skala, Kota, Status, Skor Talent, Didaftarkan`; provinsi file 5 rows, kabkota file only the 2 Subang rows; no NIK/NIB column or value. Numbers are written as text (`'48.13'`), cosmetic |
| WhatsApp / notifikasi | removed by user decision; not tested |

## N7-03 - facilitation cards

| Probe | Status / readback |
| --- | --- |
| `GET /v1/program/fasilitasi` with the 8 seed rows in `draft` | 200, `items=[]` (drafts hidden) |
| After `status_publikasi='terbit'` on all 8 | 200, 8 items, 8 distinct `bentuk`, each with `serverNow`, `petunjuk`, `kanalResmi`; `meta.serverNow` present; client/server clock diff 1.7 s (dates come from the server) |
| Status from server time | `beasiswa` ditutup (end in past), `penghargaan` segera (start in future), others dibuka |
| Filters | `jenis=uang` -> beasiswa, operasional, permodalan; `barang` -> revitalisasi_gedung, sarpras_pemasaran, sarpras_produksi; `jasa` -> lainnya, penghargaan; `bentuk=beasiswa&jenis=uang` -> 1; `jenis=xyz` and `bentuk=xyz` -> 400 `INVALID_PAYLOAD` |
| Quota display | kuota 50/terisi 10 -> sisa 40; kuota 0 card -> sisa 0; kuota null -> sisa null; full card (10/10) sisa 0 |
| `PATCH /:id/terisi` | anon 401, umkm 403, kabkota 403; provinsi 6 -> 200 sisa 14; 20 (=kuota) 200; 21 (>kuota) 400 `TERISI_MELEBIHI_KUOTA`; -1, `"5"`, 1.5 -> 400; unknown id 404; bad id 400; quota-0 card `terisi=1` 400, `0` 200. Public list afterwards shows terisi 20 / sisa 0 |
| Observation | a card with sisa 0 still reports `statusPendaftaran: "dibuka"` (status derives from dates only). Not changed; product decision |

## R01 pending items

| Probe | Status / readback |
| --- | --- |
| Actual route | `GET /operasional/aspek-perkembangan` (extension id `operasional`); `/panel/operasional/...` is 404 on Directus (that prefix is the web BFF namespace, not this route) |
| provinsi, no filter | 200, total 8; provinsi `?kota=1` total 4; `?kota=2` total 1 |
| kabkota (kota 1) | 200 total 4; `?kota=2` ignored (still kota 1); umkm 403, anon 401, `?kota=abc` 400 `WILAYAH_TIDAK_VALID` |
| Independent SQL (`rollup` by `usaha_tabular.kota_id`, `nib`, EXISTS on active dampak) | matches API: total 8/4/1/1/1/1, bukti = 3 overall (kota1 2, kota2 1), sdm same, NIB 7 overall (kota 1 four, kota 5 zero because NIB nulled) |
| IP-UMKM indicators react to certificates | kab ya=2/belum=2 with 3 active certs; revoke Subang cert of u5 -> ya=1/belum=3 (SQL 1); u1 holds two active certificates (two events): revoking one keeps ya=1 (counted once per usaha, EXISTS semantics), revoking both -> ya=0, tidak=0, belumAdaData=4, persentase null. So absence is `belumAdaData`, never `tidak` |
| Timing of the province aggregate | 300,008 rows (300k synthetic in `usaha`, `usaha_tabular`, half in `usaha_atribut_jabar`, ANALYZE run): HTTP total 1.45 s cold, 1.12 s, 1.07 s warm on Docker for Mac. Synthetic rows carry no dampak/attribute variety; production hardware unknown. Treat as order-of-magnitude, not an SLO |
| Demo switch `POST /api/demo/switch` | Proven against the clone Directus using the already built `apps/web/.output` (built 28 Sep 16:51) run natively on 127.0.0.1:3155 with `DEMO_MODE/DEMO_DISPOSABLE=true`, password of the clone accounts, `PANEL_URL` = clone: provinsi/kabkota/pendamping/umkm each 200 with only `{data:{role}}` in the body and an HttpOnly `diskuk_session` cookie; unknown role 400; foreign origin 403. Cookie sessions verified against Directus `/operasional/me`: role and email match each persona; aspek endpoint provinsi 200 (total 300008), kabkota 200 scoped to Subang (11,115 incl. synthetic), pendamping and umkm 403. Caveat: the `.output` build may lag the latest web source; browser UI switching not tested (no Chromium on macOS) |

## Failures found and fixed (root cause)

1. **wilayah eligibility always false** (`registrasi/service.js` `muatUsahaRingkas`): the SQL aliases `t.kota_nama AS kota` but the mapper read `u.kota_nama` (undefined), so any event with `syarat_wilayah` returned 422 for every business. Unit tests hid it because the fake row used the raw column name. Fix: `kota: u.kota`.
2. **quota did not hold a slot for pending registrations**: the daftar-time count only counted `diterima`, so with quota 1 four concurrent registrants were all `menunggu` and nobody was waitlisted (N7-01 expects the second for the last slot to be `daftar_tunggu`). Fix: count `status IN ('menunggu','diterima')` at registration time.
3. **kabkota scope hole**: `nilaiTugas` (also 200 with 0 rows updated for missing/non-accepted ids), `terbitkanSertifikat` and `cabutSertifikat` did no city check, so a Subang admin could grade, issue and revoke for other cities. Fix: shared `cakupanUsaha` helper (404 for out-of-scope, `KOTA_NOT_ASSIGNED` 403), tugas now 404 for missing / not-accepted.
4. **certificate issuance returned 500**: `INSERT INTO kegiatan_sertifikat` had 6 placeholders (`diterbitkan_oleh` included) and only 5 bindings. Fix: add `pemanggil.id`. After the fix issuance 201, retries idempotent, dampak row written in the same transaction.

Tests added in `services/directus/extensions/program/test/registrasi.test.js` (3 tests: wilayah alias, pending counts toward quota, insert binds every placeholder plus kabkota scope on sertifikat/tugas/cabut). `node --test services/directus/extensions/program/test/*.test.js` 169/169 pass; `node --test services/directus/test/*.test.mjs` 51 pass, 3 skipped, 0 fail (route-manifest contract now green); operasional extension tests 25/25. Program bundle `dist` rebuilt (`pnpm build`, git-ignored).

## Not proven / open

- 79.9% exactly: unreachable with `jumlah_sesi <= 60`; boundary evidenced with 79.7% (47/59) and 81.4% (48/59); exact 80.0% with 8/10 issued. The 79.9 unit test (1000 sessions) stays the only exact evidence.
- Promoted waitlist entries become `diterima` without a computed `skor_talent` (audit row also has null score) and a kabkota decision can promote a waitlisted participant from another city; left as-is (design question).
- Public certificate verification returns the usaha and kegiatan UUIDs (no NIK); confirm this is acceptable disclosure.
- Browser flows, mobile UI, QR image scanning by a camera, and PDF certificate rendering: not tested (no Chromium on macOS; no PDF endpoint exists for the certificate).
- Web pages for registration/fasilitasi were not exercised; only the Directus API and the demo-switch BFF.
- Timing evidence is synthetic (see above); provider WhatsApp is out of scope by decision.
- `hooks/registrasi-epass.js` appeared in the working tree during this session (not created by this run, not in the package entries I loaded); it was not tested.
