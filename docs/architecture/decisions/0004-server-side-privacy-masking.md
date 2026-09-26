# ADR-004: Server-Side Privacy dan Masking pada Analitik

- **Status:** Accepted
- **Tanggal:** 18 Agustus 2026
- **Keputusan target:** diimplementasikan pada projector worker (`safeProjection`) dan read model `analitik_usaha_*`; verifikasi runtime produksi belum dilakukan

## Context

Source memiliki NIK, telepon, tanggal lahir, domisili pribadi, financials, dan koordinat. Halaman Analitik dan profil UMKM bersifat private, tetapi authenticated bukan alasan untuk mengirim semua PII ke browser, cache, export, atau log.

## Decision

1. Terapkan masking/minimization pada server DTO/query boundary.
2. NIK Analitik: `************1234`.
3. Telepon Analitik: `08******1234`.
4. Tanggal lahir menjadi kelompok usia.
5. Domisili pribadi pelaku usaha tidak dikirim.
6. Nama pelaku dapat tampil untuk application user authenticated.
7. Alamat/koordinat usaha dapat tampil pada profil authenticated; canvas utama memakai agregat geography.
8. Financials persis dapat tampil pada profil dengan status kualitas.
9. Raw PII hanya pada experience Edit yang berizin dan teraudit.
10. PII mentah tidak boleh masuk response Analitik, cache, export, outbox, health, URL, atau log.
11. Masked identifiers tetap dianggap personal/linkable dan tidak boleh diperlakukan sebagai data publik.
12. File private memakai authorized/signed delivery; private `/panel/assets` tidak boleh memakai public CacheFirst PWA cache dan cache harus dibersihkan saat logout.
13. Directus Activity/Revisions ditinjau karena before/after payload dapat menyimpan PII; akses, retensi, dan redaction dikonfigurasi eksplisit.
14. Seluruh text di-escape dan source HTML/script tidak dirender.

## Consequences

### Positive

- Browser dan export tidak menerima PII yang tidak diperlukan.
- Kebijakan konsisten terhadap field dinamis.
- UI bug tidak otomatis menjadi raw-PII leak.

### Negative

- Profile/Edit membutuhkan DTO/policy berbeda.
- Audit/revision dan PWA asset caching harus ditinjau.
- Exact business location/financials tetap sensitif dan memerlukan minimization review.

## Alternatives rejected

- **Mask hanya di Vue:** raw PII tetap melewati jaringan/cache/devtools.
- **Izinkan semua karena dashboard private:** melanggar data minimization.
- **Hapus seluruh owner/business detail:** tidak memenuhi kebutuhan profil internal.

## Acceptance evidence required

- Response/cache/export/log scan tidak menemukan raw NIK/telepon.
- IDOR profil dan permission tests.
- Dynamic sensitive-field quarantine test.
- PWA/private asset cache test saat login/logout.
- Directus Activity/Revisions privacy review.
- Signed URL expiry maksimal 24 jam.
