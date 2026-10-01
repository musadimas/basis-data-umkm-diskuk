# Geometri kabupaten/kota Jawa Barat

Peta dashboard menggunakan layer **Wilayah Administrasi Kabupaten/Kota** milik Badan Informasi Geospasial (BIG), edisi September 2023:

- metadata: <https://geoservices.big.go.id/rbi/rest/services/Hosted/Wilayah_Administrasi_Kabupaten__Kota/FeatureServer/0>
- cakupan yang diimpor: `wadmpr = 'Jawa Barat'`
- identitas wilayah: kode PUM `kdpkab` (`32.01`–`32.79`)
- sistem koordinat: EPSG:4326
- penyederhanaan untuk web: toleransi 0,001 derajat; sumber resolusi penuh tidak diubah

Layer BIG tersebut menjelaskan bahwa geometri September 2023 memadukan RBI, data digital Kemendagri April 2023, garis pantai 2022, serta batas yang telah ditetapkan melalui Permendagri. BIG juga mencatat masih mungkin ada kesalahan topologi pada data sumber. Importer karena itu menjalankan `ST_MakeValid`, mengubah hasil menjadi `MultiPolygon`, dan menolak publikasi bila bukan tepat 27 geometri valid dengan kode unik.

Untuk memperbarui data pada deployment yang sedang berjalan:

```sh
./scripts/import-jawa-barat-geometry.sh
```

Perintah tersebut idempoten. Bucket sintetis `Tidak diketahui` tidak diberi poligon dan tidak dihitung sebagai wilayah administratif, tetapi jumlah usahanya tetap dipertahankan dalam tabel.
