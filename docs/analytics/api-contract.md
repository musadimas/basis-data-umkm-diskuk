# API Contract Konseptual — Analitik

**Status:** target contract; belum diimplementasikan
**Base path target:** `/panel/analitik` melalui same-origin Nuxt proxy

Kontrak ini sengaja konseptual. Detail framework boleh berubah, tetapi semantic behavior, security boundary, dan response metadata bersifat normatif.

## 1. Authentication

- Semua endpoint pada dokumen ini membutuhkan session Directus yang valid.
- Browser mengirim secure HTTP-only session cookie melalui same origin.
- Request tanpa sesi: `401`.
- Sesi valid tanpa permission: `403`.
- UI route guard tidak menggantikan Directus accountability.
- Custom endpoint yang menjalankan raw Knex/SQL wajib memeriksa `req.accountability.user`/policy secara eksplisit; Directus Items permissions tidak otomatis melindungi raw query extension.
- Mutasi berbasis session cookie wajib memakai CSRF/origin protection.
- Public landing tidak boleh memanggil endpoint Analitik, Infografis, Tabular, atau Spasial privat.

## 2. Versioning

Request dan response membawa `schemaVersion`. Perubahan breaking menghasilkan versi contract baru. Saved config menyimpan schema version agar dapat dimigrasikan ketika field berubah.

## 3. Common response metadata

Setiap response query membawa:

```json
{
  "meta": {
    "schemaVersion": 1,
    "dataAsOf": "2026-08-16T06:36:13.061Z",
    "generatedAt": "2026-08-18T03:00:00.000Z",
    "status": "current",
    "source": {
      "label": "Basis Data UMKM DisKUK Jawa Barat"
    },
    "filters": [],
    "population": 5429638,
    "matched": 120000,
    "coverage": {},
    "warnings": []
  },
  "data": {}
}
```

`status` yang boleh tampil ke pengguna:

- `current`;
- `processing`;
- `stale_last_good`.

Job/queue/cache internals tidak dikirim ke canvas.

## 4. Error envelope

```json
{
  "errors": [
    {
      "code": "ANALYTICS_QUERY_TOO_COMPLEX",
      "message": "Kombinasi analisis belum didukung.",
      "correlationId": "...",
      "details": {
        "userAction": "Kurangi dimensi atau filter hasil."
      }
    }
  ]
}
```

Response production tidak mengirim SQL, stack trace, credential, PII, atau payload job mentah.

Kode utama:

| Code | HTTP | Makna |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | Session tidak ada/kedaluwarsa |
| `FORBIDDEN` | 403 | Permission tidak cukup |
| `ANALYTICS_FIELD_NOT_ALLOWED` | 400 | Field tidak aktif/quarantined |
| `ANALYTICS_FIELD_UNAVAILABLE` | 409 | Field saved config berubah/dihapus |
| `ANALYTICS_QUERY_TOO_COMPLEX` | 422 | Query melampaui budget |
| `ANALYTICS_TIMEOUT` | 504 | Query melewati timeout |
| `ANALYTICS_LAST_GOOD` | 200 + warning | Data terbaru gagal; response last-good |
| `EXPORT_LIMIT_EXCEEDED` | 422 | Ekspor detail >50.000 record |

## 5. Metadata

### `GET /panel/analitik/metadata`

Mengembalikan field registry aktif dan catalog state yang aman untuk user.

```json
{
  "data": {
    "fields": [
      {
        "id": "jumlah_umkm",
        "label": "Jumlah UMKM",
        "semanticRole": "metric",
        "dataType": "integer",
        "group": "Metrik resmi",
        "allowedAggregations": ["count_distinct"],
        "format": "integer",
        "filterable": false,
        "groupable": false,
        "status": "active",
        "description": "Jumlah record usaha unik dalam filter aktif."
      }
    ],
    "hierarchies": [],
    "visualRules": {},
    "qualityThresholds": {
      "warning": 0.05,
      "high": 0.20
    }
  }
}
```

API tidak mengirim masking implementation, raw source schema, atau field quarantined yang tidak perlu diketahui UI. Jika catalog ingin menampilkan **Perlu konfigurasi**, kirim hanya label/status aman tanpa nilai data.

## 6. Templates

### `GET /panel/analitik/templates`

Mengembalikan preset terversi:

- sebaran wilayah;
- sektor/KBLI;
- skala;
- tenaga kerja bila feature gate aktif;
- kualitas data;
- eksplorasi kustom.

Template tenaga kerja harus `enabled: false` sampai semantik sumber dikonfirmasi.

## 7. Analytics query

### `POST /panel/analitik/query`

Request:

```json
{
  "schemaVersion": 1,
  "metric": {
    "fieldId": "jumlah_umkm",
    "aggregation": "count_distinct"
  },
  "groupBy": "wilayah_kabupaten_kota",
  "breakdown": "skala_usaha",
  "filters": [
    {
      "fieldId": "kbli_sektor",
      "operator": "eq",
      "value": "C"
    }
  ],
  "comparison": {
    "mode": "share_of_filtered_total"
  },
  "limit": 20,
  "includeOthers": true
}
```

Response:

```json
{
  "meta": {
    "schemaVersion": 1,
    "dataAsOf": "...",
    "generatedAt": "...",
    "status": "current",
    "population": 5429638,
    "matched": 900000,
    "coverage": {
      "kbli": 0.5633
    },
    "warnings": []
  },
  "data": {
    "metric": {
      "id": "jumlah_umkm",
      "label": "Jumlah UMKM",
      "unit": "usaha",
      "definition": "COUNT DISTINCT usaha.id"
    },
    "groups": [
      {
        "key": "38",
        "label": "KAB. GARUT",
        "value": 100000,
        "share": 0.1111,
        "breakdown": []
      }
    ],
    "others": {
      "value": 1000
    }
  }
}
```

### Validasi server

Server wajib:

1. Resolve `fieldId` hanya melalui active registry.
2. Tolak raw SQL, column name arbitrer, dan expression dari client.
3. Allowlist operator per tipe.
4. Parameterize seluruh nilai. Karena SQL identifier tidak dapat di-parameterize, resolve registry ID ke physical identifier/expression yang di-allowlist dan di-quote server-side.
5. Memaksa `COUNT DISTINCT usaha.id` untuk relasi multiplicative.
6. Menerapkan statement timeout, row/category limit, dan complexity budget.
7. Menghitung share terhadap matched filtered total.
8. Menyertakan null/unmapped coverage.
9. Menghindari PII dalam group label maupun warning.

## 8. Record query

### `POST /panel/analitik/records`

Mengembalikan record yang mendasari analysis config dengan pagination server-side.

Request:

```json
{
  "analysis": {
    "metric": { "fieldId": "jumlah_umkm", "aggregation": "count_distinct" },
    "filters": []
  },
  "page": 1,
  "pageSize": 25,
  "sort": [{ "fieldId": "nama_usaha", "direction": "asc" }],
  "fields": ["nama_usaha", "skala_usaha", "wilayah_kabupaten_kota", "kbli_kode"]
}
```

Rules:

- `pageSize` memiliki hard maximum.
- Requested fields harus active/exportable sesuai context.
- NIK/telepon mentah tidak pernah ada dalam response.
- Response menyertakan stable opaque `id` untuk `/dashboard/umkm/:id`.

## 9. Profil UMKM

### `GET /panel/analitik/umkm/:id`

Response dibentuk menjadi section semantic, bukan dump schema mentah:

```json
{
  "meta": {
    "schemaVersion": 1,
    "dataAsOf": "...",
    "generatedAt": "...",
    "status": "current",
    "warnings": []
  },
  "data": {
    "id": "uuid",
    "title": "Nama Usaha",
    "badges": [],
    "hero": {},
    "sections": [
      {
        "id": "ringkasan",
        "label": "Ringkasan",
        "fields": [
          {
            "fieldId": "skala_usaha",
            "label": "Skala Usaha",
            "value": "micro",
            "displayValue": "Mikro",
            "qualityStatus": "reported"
          }
        ]
      }
    ],
    "actions": {
      "canEdit": true,
      "canArchive": true,
      "canRestore": false
    }
  }
}
```

Rules:

- Renderer UI tetap memakai allowlisted `dataType` dari metadata.
- HTML tidak pernah dipercaya.
- Missing dikirim dengan `qualityStatus: missing` dan display **Belum tersedia**.
- NIK/telepon sudah dimasking atau tidak dikirim.
- Domisili pelaku usaha tidak dikirim.
- Field quarantined tidak dikirim.
- Field baru yang aman masuk section registry atau **Informasi Tambahan**.

## 10. Saved analysis

Gunakan Directus Items API terhadap `analitik_view`, dengan policy yang membatasi application user.

Config minimal:

```json
{
  "name": "UMKM Mikro Sektor C per Kabupaten",
  "schemaVersion": 1,
  "config": {
    "metric": {},
    "groupBy": "...",
    "breakdown": "...",
    "filters": [],
    "visual": "stacked_bar"
  }
}
```

Tidak ada notes, conclusions, shortlist, public token, atau frozen result. Client merender hasil baru dari `/query` setiap saved view dibuka.

## 11. Export

### `POST /panel/analitik/exports`

```json
{
  "type": "detail_csv",
  "analysis": {},
  "fields": [],
  "locale": "id-ID",
  "timezone": "Asia/Jakarta"
}
```

Response `202`:

```json
{
  "data": {
    "jobId": "uuid",
    "status": "queued"
  }
}
```

### `GET /panel/analitik/exports/:jobId`

Status aman untuk UI: `queued | processing | completed | failed`. Tidak mengirim worker internals.

Completed response membawa signed/private URL yang kedaluwarsa maksimal 24 jam. Job menyimpan audit, schema version, data-as-of, filter, record count, dan masking version.

## 12. Plain freshness

Canvas boleh memperoleh freshness dari query metadata atau endpoint ringan:

### `GET /panel/analitik/status`

```json
{
  "data": {
    "status": "current",
    "dataAsOf": "...",
    "message": "Data terakhir diperbarui pada ..."
  }
}
```

Endpoint ini tidak mengirim heartbeat worker, queue depth, incident detail, atau retry count.

## 13. Internal contracts

Collection internal:

- `analitik_field`;
- `analitik_view`;
- `analitik_job`;
- `analitik_health`.

API operasional memakai Directus Admin/permission khusus dan tidak diekspos pada canvas. `analitik_health` menyatukan component status, incident, recovery, dan reconciliation melalui `record_type`.

## 14. Query budget baseline

Implementation benchmark menentukan nilai final, tetapi contract minimal membatasi:

- satu metric utama;
- maksimal dua dimension;
- maksimal 20 groups sebelum `others`;
- donut maksimal enam groups;
- server pagination; keyset pagination diprioritaskan untuk deep result;
- rate/concurrency limit, cancellation, `statement_timeout`, dan `lock_timeout`;
- read query memakai read-only database role bila seam memungkinkan;
- detail export maksimal 50.000 rows;
- statement timeout sesuai SLO ≤3/≤5 detik plus margin terkontrol;
- tidak ada unbounded free-form joins.

## 15. Compatibility tests

Contract tests wajib membuktikan:

- unauthenticated `401`;
- field quarantined ditolak;
- raw SQL/expression ditolak;
- share memakai filtered total;
- high-cardinality guard;
- missing/unmapped coverage;
- relasi one-to-many tetap count distinct usaha;
- schema rename/delete menghasilkan warning terstruktur;
- profil dan export tidak mengandung PII mentah;
- last-known-good menghasilkan `200` dengan status/warning yang benar.
