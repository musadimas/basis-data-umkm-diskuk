# R04 runtime evidence (N7-04, N7-05)

Date: 29 Sep 2026 (container clock 28 Sep 20:4x–21:3x UTC). Scope: evidence only. Y10 is still `blocked`, so R04 stays `partial`.

## Isolation

- DB `r04_clone`: `pg_dump diskuk | psql` inside `diskuk-operasional-e2e-postgis-1`. The shared DB `diskuk` was never written to; its migration level, tables and containers are untouched.
- Temp container `r04-directus` (127.0.0.1:8156, network `diskuk_net`), image `diskuk-operasional-e2e-directus:latest` with the CURRENT source bind-mounted read-only from a scratch stage: `migrations/`, `analytics-shared/`, extensions `analytics`, `authentication`, `program` (dist rebuilt with `pnpm build`), `directus-extension-operasional` (`dist/` rebuilt with `cp -R src/* dist/`, as its `build` script does), `shared`. Env taken from the running shared container, then overridden: `DB_DATABASE=r04_clone`, `DB_HOST=postgis` (pgbouncer does not know the clone), `AUTH_CAPTCHA_ENFORCE=false`, `RATE_LIMITER_ENABLED=false`, `AUTH_ALLOWED_ORIGINS` + `http://127.0.0.1:3120`, no WhatsApp gateway. The program endpoints still require a real ALTCHA solution; every call solved a fresh challenge from `/v1/auth/captcha/challenge` with the `altcha` library.
- Clone-only data prep: argon2 password for every clone user; extra users `r04_kab.sumedang@example.com` (kabkota, kota 2), `r04_pendamping2@example.com`, `r05_umkm2@example.com`, `r05_umkm6@example.com`; Wawan's attributes reset to `npwp=false, sop=NULL, ecommerce=false, medsos=false` so an outcome has a visible effect; konsultan rows inserted by SQL; ticket creation timestamps moved back a whole number of hours so response time is meaningful.
- Web for the browser proof: `nuxt dev` from the working tree on 127.0.0.1:3120 with `PANEL_URL=http://127.0.0.1:8156` (not the shared web image). Killed afterwards; temporary Playwright config and spec copies removed from `apps/web`.
- Recipe scripts (kept only in the session scratchpad, secrets are clone-only): reset = stop container, drop/create `r04_clone`, `pg_dump | psql`, start container (the official migrator applies `20260928A…20260929C` on start), then set passwords and extra users.

## Migration `20260929C` (official migrator inside the container)

`migration-cycle-C.txt`: latest → `migrate:down` → `migrate:latest`.

| State | Tables (5 new) | Indexes | `directus_collections` | fields/relations | Latest |
| --- | --- | --- | --- | --- | --- |
| after latest | `klinik_konsultan, konsultasi_outcome, konsultasi_outcome_audit, konsultasi_outcome_item, konsultasi_tiket_csat` | 11 (incl. `ux_konsultasi_outcome_hidup`) | 5 | 11 / 4 | Klinik Konsultan Csat Outcome |
| after down | none | 0 | 0 | 0 / 0 | Kegiatan Pengingat Drop Kolom Lama |
| after latest again | identical | 11 | 5 | 11 / 4 | Klinik Konsultan Csat Outcome |

## API probes (`r04-runtime.mjs`, real HTTP, SQL readback) — 66/66 pass

`r04-runtime-run-1.log` (first run) and `r04-runtime-run.log` (final run, also `r04-runtime-results.json`): both 66/66 on a freshly reset clone. Latency of 20 sequential reads, p95: statistik 4–5 ms, konsultan 6–9 ms, poli 3–5 ms.

### N7-04 (27 checks)

| Probe | Result |
| --- | --- |
| Baseline statistics vs independent computation from raw rows (JS over `konsultasi_tiket`, `konsultasi_tiket_audit`, `konsultasi_tiket_csat`) | equal: total selesai 0, 3 responded tickets at 0.0 h, CSAT `null` / sampel 0 |
| Six tickets created through the public API as the UMKM owner (SIDT source, real ALTCHA) then moved through the kanban: S1/S2/S4 `selesai`, S3 `berjalan`, S5 left `masuk`, S6 cancelled from `masuk`; created-at moved back 26/5/2/10 h | total selesai +3, respons sampel +4 (S5 and S6 excluded), mean 6.1 h = (0·3+26+5+2+10)/7, API equals the independent number |
| CSAT: not selesai → 409 `TIKET_BELUM_SELESAI`; wrong WhatsApp and unknown number → identical 404; no/invalid captcha → 400 and no row | as specified |
| Non-consent answer stored but the public CSAT stays `null` (sampel 0); two simultaneous answers for one ticket → 201 + 409 `CSAT_SUDAH_ADA`, one row; second consented answer accepted; repeat → 409 | CSAT = (5+4)/2 = 4.50, sampel 2 |
| Track a ticket: `csat` flags `{bisaMenilai, sudahMenilai}` follow the state | as specified |
| Directory: 5 konsultan rows inserted (4 active), all `/konsultan` availability compared with an independent per-date/per-slot computation from raw ticket rows | equal for every konsultan and date; inactive one hidden |
| A konsultan whose only weekly slot (Monday 09:00) is booked on every Monday in the horizon | listed with `ketersediaan: []`, `totalSlotBebas: 0` (coach unavailable), not dropped |
| Pendamping-linked konsultan loses slots held by that pendamping on another poli (7 busy slots) | as specified |
| Book a slot through the API → it disappears from that poli's konsultan; cancel → it returns; whole directory still equals the independent computation | as specified |
| `?hari=3` limits the range; `0/31/abc` → 400 `HORIZON_TIDAK_VALID` | as specified |
| PII scan of public responses (account id, e-mail, phone, ticket number, 16-digit) | none |

### N7-05 (39 checks)

| Probe | Result |
| --- | --- |
| Ticket closed without an outcome | no outcome row; profile and IP-UMKM indicators unchanged; `outcomeBisaDicatat: true` |
| Pendamping closes with an outcome in one PATCH | ticket `selesai` + outcome `diajukan` v1, two items, audit `ajukan` with actor and name; submitter is offered no action; profile and indicators unchanged |
| Queue scoping: provinsi sees it, kab/kota Subang sees it, kab/kota Sumedang does not | as specified |
| IDOR/role matrix | pendamping 403, umkm 403, anonymous 401, kab/kota of another city 404 on verify/koreksi/cabut/record, other pendamping 404, queue for umkm/pendamping 403; no write and no audit from any refusal |
| Two verifiers at once | both 200, exactly one `duplikat:false`, one audit row; a late third verifier → `duplikat:true` |
| Profile after verification | `hasilKonsultasi` lists ticket number, poli, verifier, time and 2 items only |
| IP-UMKM `aspek-perkembangan` (`indikator-operasional-v2`) | NPWP ya +1 / tidak −1, SOP ya +1 / belum-ada −1 (one business); Sumedang's own view unchanged |
| Submitter = verifier (provinsi closes and submits) | not offered `verifikasi`; API 409 `VERIFIKATOR_SAMA`; another verifier succeeds; e-commerce counted once per business |
| Two simultaneous closes with the same `versi` | 200 + 409 `TIKET_BERUBAH`, one live outcome, one `selesai` transition |
| Five simultaneous identical `POST /tiket/:id/outcome` | one 201, four 200 `duplikat:true`, one row; different content → 409 `OUTCOME_SUDAH_ADA` |
| Invalid items, not-yet-selesai ticket, outcome without `status: selesai`, manual (no usaha) ticket | 400 `OUTCOME_TIDAK_VALID`, 409 `TIKET_BELUM_SELESAI`, 400, 409 `USAHA_TIDAK_TERTAUT` and the close rolls back with it |
| **Integration failure** (real fault injection: `ALTER TABLE konsultasi_outcome_item ADD CONSTRAINT r04_fault CHECK (FALSE) NOT VALID` on the clone) | close+outcome → 500; ticket still `tindak_lanjut`, audit count unchanged, zero outcome rows; constraint dropped, client retries → succeeds once |
| Koreksi | no reason 400, identical 409 `OUTCOME_TIDAK_BERUBAH`; valid → v2 `terverifikasi` by the corrector, v1 `dicabut` with `Dikoreksi ke versi 2: …`, exactly one live outcome per ticket; effects swap (NPWP/SOP back to field values, social media +1); retry on the old id → `duplikat:true`, no v3 |
| Cabut | no reason 400; success; retry idempotent (one audit row); effect gone from profile/indicators; panel offers a new outcome and shows the reason |
| Reopen | `selesai → dijadwalkan` 409 `TRANSISI_TIDAK_VALID` (final; corrected via outcome); `batal → dijadwalkan` works and creates no outcome |
| Privacy | note/diagnosis/action plan/meeting link/e-mail/WhatsApp/contact name planted on the ticket never appear in the outcome DTO, queue, profile, outcome/item/audit tables or public responses; no 16-digit pattern; profile DTO keys are exactly `diverifikasiOleh, diverifikasiPada, id, items, nomorTiket, poli, versi` |
| History | v1 and v2 keep source ticket, submitter, verifier and time; audit order `ajukan>verifikasi>koreksi>koreksi>cabut`, each with actor name |

## Browser proof (`r04.real.spec.ts`, Chromium, real ALTCHA login, `nuxt dev` :3120 → clone) — 6/6 pass

`r04-browser-run.log`, screenshots in `screenshots/`.

1. Public `/konsultasi`: statistics (total equals SQL, CSAT "Belum ada penilaian", never a number) and directory (PLUT card with free slots, a konsultan with "Belum ada slot") from the real API.
2. Applicant tracks a `selesai` ticket, rates 4 with consent → SQL `4|true`; a second look shows "sudah tercatat"; statistics then read "4,00 / 5 · dari 1 penilaian".
3. Pendamping closes a ticket with an outcome from the sheet → "Menunggu verifikasi", no Verifikasi/Koreksi/Cabut buttons; SQL `selesai|diajukan|1`, 2 items, profile still empty.
4. Kab/kota Sumedang: empty queue, the ticket number absent, the Subang business profile → "di luar wilayah Anda".
5. Provinsi verifies from the queue with a double click (one audit row); the profile lists the outcome and the body contains none of the planted notes.
6. Provinsi revokes with a reason (5-character minimum enforced in the UI); SQL `dicabut|<reason>`, audit `ajukan>verifikasi>cabut`, profile back to "Belum ada hasil konsultasi terverifikasi".

Infrastructure notes: the first browser attempt failed with 403 `ORIGIN_NOT_ALLOWED` because the clone's `AUTH_ALLOWED_ORIGINS` lacked the dev port (clone config, not a code defect); two test-side SQL slips (`4|t` vs `4|true`, ambiguous `status`) were fixed in the spec.

## Not proven here

Tablet/mobile browser projects; the shared web image (dev server used); the clinic WhatsApp notifications (`not provider-proven`, unchanged); a UI for admins to curate `klinik_konsultan` (Data Studio only); a dummy seed for konsultan.

## Cleanup

Clone DB, container and stage are removed at the end of the R05 session (see `../R05/`); the shared DB `diskuk` and its containers were untouched throughout.
