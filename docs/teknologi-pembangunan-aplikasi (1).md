## Teknologi Pembangunan Aplikasi

### 1. Ringkasan Arsitektur Teknologi

Pembangunan sistem informasi direncanakan menggunakan tumpukan teknologi (*technology stack*) modern yang mengutamakan performa, keamanan, kemudahan pemeliharaan, interoperabilitas, serta skalabilitas. Arsitektur dirancang untuk mendukung pengelolaan data terstruktur dan geospasial, penyajian informasi melalui dashboard, integrasi dengan sistem eksternal, serta pemrosesan data dalam jumlah besar secara asinkron.

Sistem menggunakan pendekatan arsitektur modular dengan pemisahan tanggung jawab antara lapisan antarmuka pengguna (*frontend*), layanan aplikasi dan API (*backend*), basis data, penyimpanan berkas, pemrosesan latar belakang (*background processing*), dan infrastruktur deployment.

Teknologi yang direncanakan meliputi Node.js sebagai runtime backend, TypeScript sebagai bahasa pemrograman utama, Directus sebagai platform pengelolaan data dan API, Nuxt berbasis Vue sebagai framework frontend, PostgreSQL dengan ekstensi PostGIS sebagai basis data utama, MinIO sebagai penyimpanan objek, Redis untuk caching dan dukungan pemrosesan asinkron, serta Docker untuk pengemasan dan deployment aplikasi.

Versi teknologi ditetapkan dengan mempertimbangkan status dukungan, kompatibilitas antarkomponen, keamanan, stabilitas ekosistem, dan kebutuhan operasional. Seluruh versi final akan dikunci pada tahap implementasi dan diverifikasi melalui pengujian integrasi sebelum diterapkan pada lingkungan produksi.

### 2. Rincian Teknologi dan Versi

#### 2.1 Runtime Environment: Node.js

- **Teknologi:** Node.js.
- **Versi target:** Node.js 24.x LTS sebagai kandidat utama, dengan Node.js 22.x sebagai alternatif apabila diperlukan oleh kompatibilitas dependensi.
- **Fungsi:** Menjalankan layanan backend Directus, server-side rendering frontend, serta layanan pendukung berbasis JavaScript atau TypeScript.

Node.js menyediakan lingkungan eksekusi JavaScript di sisi server yang mendukung operasi I/O asinkron dan pemrosesan permintaan secara efisien. Teknologi ini menjadi fondasi layanan backend dan mendukung penggunaan ekosistem pustaka JavaScript yang luas.

Pemilihan versi final harus mempertimbangkan kompatibilitas Directus, Nuxt, modul native, dan seluruh dependensi aplikasi. Penggunaan versi LTS ditujukan untuk memperoleh dukungan pemeliharaan dan pembaruan keamanan dalam jangka panjang.

#### 2.2 Bahasa Pemrograman: TypeScript dan JavaScript

- **Teknologi:** TypeScript dan JavaScript.
- **Versi target:** TypeScript 5.x atau versi stabil yang kompatibel dengan framework dan dependensi yang digunakan.
- **Fungsi:** Pengembangan frontend, backend, integrasi API, validasi data, dan layanan pendukung.

TypeScript digunakan sebagai bahasa utama pengembangan aplikasi untuk memberikan pemeriksaan tipe data (*static type checking*), meningkatkan konsistensi struktur data, dan mengurangi potensi kesalahan implementasi sejak tahap pengembangan.

Penggunaan TypeScript diterapkan pada modul aplikasi yang dikembangkan secara khusus, termasuk komponen antarmuka, logika bisnis, layanan integrasi, serta kontrak data antarlapisan. JavaScript tetap menjadi bahasa eksekusi hasil kompilasi dan dapat digunakan untuk skrip konfigurasi atau kebutuhan tertentu dalam ekosistem Node.js.

Penerapan TypeScript tidak menggantikan validasi pada saat aplikasi berjalan. Data dari pengguna dan sistem eksternal tetap harus divalidasi menggunakan mekanisme validasi runtime serta pemeriksaan otorisasi yang sesuai.

#### 2.3 Framework Backend: Directus

- **Teknologi:** Directus.
- **Versi target:** Directus 11.x atau 12.x, ditentukan berdasarkan evaluasi kompatibilitas ekstensi, dependensi, dan kebutuhan implementasi.
- **Fungsi:** Pengelolaan data, administrasi sistem, manajemen hak akses, serta penyediaan REST API dan GraphQL API.

Directus merupakan platform pengelolaan data yang menyediakan antarmuka administrasi dan lapisan API di atas basis data SQL. Platform ini digunakan untuk mempercepat pembangunan modul pengelolaan data, konfigurasi struktur koleksi, manajemen pengguna, serta implementasi hak akses berdasarkan peran (*role-based access control*).

Directus menyediakan REST API dan GraphQL API berdasarkan konfigurasi skema data dan izin akses. Fitur tersebut memungkinkan frontend maupun sistem eksternal mengakses data melalui antarmuka yang terstandar tanpa harus membangun seluruh mekanisme CRUD secara manual.

Untuk kebutuhan bisnis yang lebih kompleks, Directus dapat diperluas menggunakan *hooks*, *event handlers*, *custom endpoints*, dan ekstensi khusus. Mekanisme tersebut digunakan untuk mengimplementasikan validasi bisnis, integrasi dengan sistem eksternal, sinkronisasi data, dan proses otomatisasi.

Integrasi dengan sistem eksternal seperti SIDT akan menggunakan layanan integrasi yang terpisah apabila diperlukan, sehingga proses sinkronisasi dalam jumlah besar tidak membebani jalur permintaan utama aplikasi.

#### 2.4 Framework Frontend: Nuxt dan Vue

- **Teknologi:** Nuxt berbasis Vue.
- **Versi target:** Nuxt 4.x dengan Vue 3.x, atau versi stabil yang telah tervalidasi kompatibilitasnya.
- **Fungsi:** Pengembangan dashboard, formulir, halaman administrasi, visualisasi informasi, dan antarmuka responsif.

Nuxt digunakan sebagai framework frontend untuk membangun aplikasi web modular berbasis Vue. Framework ini mendukung *server-side rendering* (SSR), *client-side rendering* (CSR), serta *static generation* sesuai kebutuhan masing-masing halaman.

SSR dapat digunakan pada halaman yang membutuhkan penyajian konten awal dari server, sedangkan CSR dapat digunakan pada antarmuka interaktif seperti dashboard, peta, formulir, dan visualisasi data. Pemilihan strategi rendering dilakukan berdasarkan kebutuhan fungsional, performa, keamanan, dan kompleksitas antarmuka.

Antarmuka dirancang responsif agar dapat diakses melalui perangkat desktop maupun perangkat mobile. Untuk kebutuhan pelaporan lapangan, aplikasi dapat dikembangkan dengan pendekatan *Progressive Web App* (PWA), termasuk dukungan penyimpanan lokal, antrean pengiriman data, dan sinkronisasi setelah koneksi tersedia kembali.

Kemampuan offline tidak diperoleh secara otomatis hanya dengan menggunakan Nuxt. Implementasi PWA memerlukan konfigurasi service worker, mekanisme penyimpanan lokal, penanganan konflik data, serta pengelolaan status sinkronisasi secara eksplisit.

#### 2.5 Basis Data Utama: PostgreSQL dan PostGIS

- **Teknologi:** PostgreSQL dengan ekstensi PostGIS.
- **Versi target:** PostgreSQL 17.x atau 18.x, dengan versi final mengikuti kompatibilitas ekstensi PostGIS, Directus, dan lingkungan deployment.
- **Ekstensi geospasial:** PostGIS 3.x yang kompatibel dengan versi PostgreSQL terpilih.
- **Fungsi:** Penyimpanan data operasional, transaksi, relasi antardata, serta data geospasial.

PostgreSQL digunakan sebagai basis data relasional utama karena mendukung transaksi, integritas referensial, indeks, serta pengelolaan data terstruktur secara konsisten.

PostGIS memperluas kemampuan PostgreSQL untuk menyimpan, mengindeks, dan memproses data geospasial. Ekstensi ini mendukung kebutuhan pemetaan, analisis lokasi, perhitungan jarak, pemrosesan geometri, serta pengelolaan objek spasial yang digunakan oleh Geodashboard.

Indeks spasial dan optimasi kueri akan diterapkan berdasarkan pola akses dan volume data aktual. Pemisahan skema, pembatasan hak akses, pengelolaan koneksi, serta strategi pencadangan akan digunakan untuk menjaga integritas dan ketersediaan data.

Versi PostgreSQL dan PostGIS harus dipilih sebagai satu kesatuan kompatibilitas, bukan secara independen. Penggunaan versi mayor terbaru hanya dilakukan setelah pengujian terhadap seluruh ekstensi dan komponen aplikasi.

#### 2.6 Penyimpanan Objek: MinIO

- **Teknologi:** MinIO dengan antarmuka kompatibel S3.
- **Versi target:** Rilis stabil yang didukung dan telah diverifikasi pada lingkungan deployment.
- **Fungsi:** Penyimpanan berkas digital berukuran besar.

MinIO digunakan sebagai penyimpanan objek untuk mengelola aset digital yang tidak ideal disimpan langsung sebagai data biner di dalam basis data relasional. Jenis berkas yang dapat dikelola meliputi foto dokumentasi, video *storytelling*, gambar katalog produk, lampiran laporan, serta dokumen proposal.

Penyimpanan objek dipisahkan dari metadata berkas yang dicatat dalam PostgreSQL. Pendekatan ini memungkinkan pengelolaan berkas, metadata, dan hak akses secara terstruktur sekaligus menjaga efisiensi basis data.

Akses terhadap berkas akan dikendalikan melalui mekanisme autentikasi, otorisasi, dan URL bertanda tangan (*presigned URL*) apabila diperlukan. Kebijakan retensi, pencadangan, kapasitas penyimpanan, dan perlindungan terhadap akses tidak sah akan ditentukan sesuai klasifikasi data.

Pemilihan distribusi dan versi MinIO harus mempertimbangkan status pemeliharaan, dukungan operasional, dan model distribusi yang tersedia pada saat implementasi.

#### 2.7 Caching dan Pemrosesan Asinkron: Redis dan Database Outbox

- **Teknologi caching:** Redis 8.x atau versi stabil yang kompatibel dengan aplikasi.
- **Mekanisme integrasi:** Pola *transactional outbox* berbasis PostgreSQL.
- **Fungsi:** Mengurangi beban pembacaan data dan memproses pekerjaan latar belakang.

Redis digunakan sebagai lapisan caching untuk data yang sering diakses dan sesuai untuk disimpan sementara. Penerapannya dapat mencakup hasil kueri tertentu, data referensi, atau informasi lain yang memiliki strategi invalidasi cache yang jelas.

Redis tidak digunakan sebagai satu-satunya sumber data utama untuk transaksi bisnis. Data yang membutuhkan konsistensi dan ketahanan transaksi tetap disimpan pada PostgreSQL.

Untuk sinkronisasi data SIDT dalam jumlah besar dan pengiriman notifikasi, sistem menggunakan pola *transactional outbox*. Perubahan bisnis dan pencatatan pekerjaan sinkronisasi disimpan dalam satu transaksi basis data. Worker terpisah kemudian membaca pekerjaan yang belum diproses dan menjalankan integrasi secara asinkron.

Pendekatan ini membantu mengurangi risiko kehilangan pekerjaan ketika proses utama berhasil menyimpan transaksi tetapi gagal mengirimkan permintaan ke sistem eksternal.

Implementasi worker harus mencakup mekanisme percobaan ulang (*retry*), jeda bertahap (*backoff*), pencatatan kegagalan, pemantauan antrean, dan idempotensi untuk mencegah pemrosesan ulang menimbulkan efek samping yang tidak diinginkan. Redis dapat mendukung caching atau antrean operasional tambahan apabila kebutuhan sistem mengharuskannya.

#### 2.8 Infrastruktur Deployment: Docker

- **Teknologi:** Docker Engine dan Docker Compose.
- **Versi target:** Rilis stabil yang kompatibel dengan sistem operasi dan infrastruktur pusat data.
- **Fungsi:** Pengemasan, isolasi, konfigurasi, dan deployment aplikasi.

Docker digunakan untuk mengemas komponen aplikasi beserta dependensi runtime ke dalam kontainer. Pendekatan ini membantu menjaga konsistensi lingkungan pengembangan, pengujian, dan produksi serta menyederhanakan proses deployment dan pemeliharaan.

Komponen seperti frontend Nuxt, backend Directus, worker integrasi, dan layanan pendukung dapat dijalankan dalam kontainer terpisah sesuai kebutuhan arsitektur. PostgreSQL, Redis, dan MinIO dapat dijalankan sebagai layanan terpisah dengan volume penyimpanan persisten serta kebijakan pencadangan yang sesuai.

Docker Compose dapat digunakan untuk mengelola deployment pada lingkungan dengan kompleksitas operasional yang sesuai. Apabila kebutuhan ketersediaan tinggi, jumlah layanan, atau skala beban meningkat, orkestrasi kontainer dapat dievaluasi sebagai tahap pengembangan berikutnya.

Kontainerisasi tidak dengan sendirinya menyediakan *high availability*, *disaster recovery*, atau *auto-scaling*. Kapabilitas tersebut memerlukan konfigurasi infrastruktur, redundansi layanan, pemantauan, serta prosedur pemulihan yang dirancang secara terpisah.

### 3. Ringkasan Technology Stack

| Lapisan | Teknologi | Versi target | Peran utama |
|---|---|---|---|
| Runtime | Node.js | 24.x LTS | Menjalankan layanan JavaScript/TypeScript |
| Bahasa | TypeScript / JavaScript | TypeScript 5.x atau kompatibel | Pengembangan aplikasi dan validasi tipe |
| Backend | Directus | 11.x / 12.x | Pengelolaan data, API, dan administrasi |
| Frontend | Nuxt / Vue | Nuxt 4.x / Vue 3.x | Dashboard dan antarmuka web |
| Basis data | PostgreSQL | 17.x / 18.x | Penyimpanan data relasional |
| Geospasial | PostGIS | 3.x yang kompatibel | Pengolahan dan analisis data spasial |
| Object storage | MinIO | Rilis yang didukung | Penyimpanan berkas digital |
| Caching | Redis | 8.x atau kompatibel | Cache dan dukungan pemrosesan asinkron |
| Sinkronisasi | PostgreSQL Outbox + Worker | Implementasi aplikasi | Integrasi eksternal dan pemrosesan latar belakang |
| Deployment | Docker / Docker Compose | Rilis stabil yang kompatibel | Pengemasan dan pengelolaan layanan |

**Catatan penetapan versi:** Angka di atas merupakan target perencanaan, bukan jaminan bahwa seluruh kombinasi versi telah teruji. Versi patch yang tepat, kompatibilitas ekstensi, dan dukungan resmi setiap produk harus diverifikasi sebelum penguncian dependensi serta deployment produksi.

### 4. Ringkasan Manfaat Arsitektur

Arsitektur teknologi yang direncanakan memberikan manfaat sebagai berikut:

1. **Efisiensi pengembangan:** Directus menyediakan API dan antarmuka administrasi sehingga pengembangan fitur pengelolaan data dapat dilakukan lebih cepat.
2. **Konsistensi implementasi:** TypeScript membantu mendeteksi ketidaksesuaian tipe data dan meningkatkan keterpeliharaan kode.
3. **Fleksibilitas antarmuka:** Nuxt dan Vue mendukung dashboard interaktif, tampilan responsif, dan strategi rendering sesuai kebutuhan.
4. **Kemampuan geospasial:** PostgreSQL dan PostGIS menyediakan fondasi untuk pengelolaan serta analisis data lokasi.
5. **Efisiensi penyimpanan:** MinIO memisahkan penyimpanan berkas digital dari data operasional dan metadata.
6. **Ketahanan integrasi:** Pola outbox dan worker terpisah membantu menangani sinkronisasi data serta notifikasi tanpa membebani permintaan utama.
7. **Konsistensi deployment:** Docker memudahkan pengemasan dan pengelolaan komponen aplikasi di berbagai lingkungan.
8. **Kemudahan pengembangan lanjutan:** Arsitektur modular memungkinkan penambahan fitur, integrasi, dan layanan baru tanpa harus membangun ulang keseluruhan sistem.

### 5. Standar Implementasi dan Operasional

Untuk memastikan teknologi yang dipilih memberikan hasil sesuai tujuan, implementasi perlu mengikuti standar berikut:

- **Manajemen dependensi:** Versi runtime, framework, pustaka, dan image kontainer dikunci melalui berkas konfigurasi serta mekanisme version control.
- **Keamanan:** Terapkan autentikasi, otorisasi berbasis peran, pengelolaan rahasia, pembatasan akses jaringan, dan pembaruan keamanan berkala.
- **Kualitas kode:** Terapkan pemeriksaan tipe, linting, pengujian unit, pengujian integrasi, dan pengujian penerimaan sesuai kebutuhan.
- **Kinerja:** Lakukan pengujian beban, optimasi kueri, pengaturan koneksi basis data, serta evaluasi penggunaan cache.
- **Keandalan data:** Terapkan pencadangan terjadwal, pengujian pemulihan, retensi data, dan prosedur pemulihan insiden.
- **Integrasi eksternal:** Sediakan pencatatan proses, mekanisme retry, idempotensi, pemantauan kegagalan, serta rekonsiliasi data.
- **Deployment:** Pisahkan lingkungan pengembangan, pengujian, dan produksi; gunakan konfigurasi yang terkendali serta prosedur rilis dan rollback.
- **Dokumentasi:** Sediakan dokumentasi arsitektur, API, konfigurasi, prosedur operasional, dan panduan pemeliharaan.

Dengan pendekatan tersebut, sistem diharapkan memiliki fondasi teknologi yang modular, terukur, dan dapat dikembangkan secara bertahap sesuai kebutuhan operasional serta pertumbuhan volume data.
