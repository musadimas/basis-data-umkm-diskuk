# ADR-003: Dynamic Semantic Field Registry

- **Status:** Accepted
- **Tanggal:** 18 Agustus 2026
- **Keputusan target:** belum diimplementasikan

## Context

Directus akan menerima field baru dan kelak digunakan untuk CRUD. Hard-coded UI dan SQL per field akan cepat rapuh. Sebaliknya, mengaktifkan setiap field otomatis dapat mengekspos PII, menjumlahkan identifier, membuat join multiplicative, atau menjalankan query mahal.

## Decision

1. Buat collection `analitik_field` sebagai semantic registry.
2. Hook/schema reconciliation mendeteksi create, rename, type change, dan delete.
3. Lifecycle:

```text
discovered → classified/quarantined → projected/indexed → active → disabled/deleted
```

4. Field baru otomatis **diregistrasikan**, bukan otomatis dipercaya.
5. Field aman dapat diberi default semantic behavior dan muncul di profile/field picker setelah projection/indexing siap.
6. Field sensitif/ambigu menjadi `quarantined` sampai privacy/null/aggregation/relation semantics ditentukan.
7. Saved view dan API mereferensikan immutable registry ID, bukan physical column name.
8. Server memetakan registry ID ke allowlisted dan correctly quoted physical expression. Identifier SQL tidak berasal langsung dari client dan tidak dapat diamankan hanya dengan value parameterization.
9. Text selalu di-escape; HTML/script mentah tidak dirender.
10. Raw migration dapat melewati Directus hook, sehingga periodic schema reconciliation wajib.

## Default mapping

- text/enum/boolean/date/M2O → candidate dimension/filter;
- number/currency → candidate metric tanpa auto-`SUM`;
- NIK/telepon/UUID/NIB → identifier;
- file/image → profile-only;
- geometry → map bila valid/diizinkan;
- O2M/M2M → memerlukan explicit relation grain dan `COUNT DISTINCT usaha`.

## Schema lifecycle

- **Rename:** explicit mapping memigrasikan metadata/config.
- **Type change:** capability direvalidasi, projection/index/cache dibangun ulang.
- **Delete:** registry disabled/tombstone; saved view memberi warning dan bagian lain tetap berjalan.
- **Unknown renderer:** fail closed dan escaped.

Registrasi saja tidak membuat field queryable atau cepat pada 5,4 juta row. Activation mensyaratkan approved source expression, projection strategy (column/JSONB/relational), index strategy, dan benchmark.

## Consequences

### Positive

- UI/profile tahan perubahan schema.
- Definisi metrik dan privacy terpusat.
- Query dapat menggunakan allowlist stabil.
- Field baru dapat ditemukan otomatis tanpa langsung mengeksposnya.

### Negative

- Dibutuhkan hook, reconciliation, migration config, dan admin metadata.
- Rename/type change tetap memerlukan logic migrasi.
- Queryability field baru mungkin tertunda sampai projection/index selesai.

## Alternatives rejected

- **Hard-code semua field:** tidak memenuhi kebutuhan field dinamis.
- **Expose seluruh schema otomatis:** tidak aman dan rawan salah agregasi.
- **Client membaca Directus schema langsung:** UI menjadi security boundary dan tidak memiliki semantic definitions.

## Acceptance evidence required

Matrix test create/rename/type/delete untuk text, number, identifier, file, geometry, M2O, dan O2M/M2M; saved view compatibility; PII quarantine; injection via registry metadata; page tetap berfungsi ketika satu field gagal.
