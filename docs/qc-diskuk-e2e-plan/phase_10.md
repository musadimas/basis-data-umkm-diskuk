# Phase 10 — Talent Passport: dialog cabut & terbitkan ulang (BUG-022)

## 1. Tujuan, dependensi, hasil yang dapat diamati

**Tujuan.** Screenshot QC menunjukkan `window.confirm` di build produksi pra-P4. Di build lokal (P4) dialog sudah ada, tetapi masih punya lima masalah:
- isinya berganti ke versi "Terbitkan ulang" saat animasi menutup (karena `konfirmasi = null` di-set sebelum aksi)
- tidak ada status sibuk di dalam dialog
- error tampil di banner halaman di balik overlay
- copy generik tanpa kode passport dan nama usaha
- lebar `max-w-md` tidak berlaku di desktop

Phase ini membuat dialog stabil:
- dialog tetap terbuka selama proses
- tombol menampilkan "Memproses…" dan nonaktif
- error tampil di dalam dialog
- dialog menutup hanya setelah sukses
- judul memuat kode passport dan nama usaha

**Dependensi.** Phase 9 sudah ter-commit (urutan §6). Tidak ada perubahan API.

**Hasil yang dapat diamati.** Klik "Cabut passport" membuka dialog berjudul "Cabut Talent Passport TP-…?" dengan deskripsi yang menyebut nama usaha. Klik "Ya, cabut" mengubah tombol menjadi "Memproses…", dan dialog tetap berjudul "Cabut…" sampai tertutup. Bila gagal, dialog tetap terbuka dengan pesan merah di dalamnya. Bila sukses, dialog tertutup dan banner "Talent Passport … dicabut." tampil.

## 2. Manifest file (tertutup)

| Aksi | Path |
|---|---|
| modify | `apps/web/app/pages/(private)/dashboard/usaha/passport.vue` |
| modify | `apps/web/tests/fixtures/mock-program.mjs` |
| modify | `apps/web/tests/e2e/passport.spec.ts` |

## 3. Simbol dan anchor pencarian

- `passport.vue`:
  - `const busy = ref(false)`
  - `async function terbitkan()` (sudah punya `catch`, memetakan `PASSPORT_BELUM_MEMENUHI`)
  - `async function cabut()` (sudah punya `catch` sejak P1; temuan UI_audit "try/finally tanpa catch" **sudah tidak berlaku**, sudah diverifikasi)
  - `const konfirmasi = ref<"terbitkan" | "cabut" | null>(null)`
  - `async function jalankanKonfirmasi()` (`konfirmasi.value = null;` sebelum `await`)
  - blok `<UiDialog :open="Boolean(konfirmasi)" …>` di akhir template
  - `<UiDialogContent class="max-w-md">`
  - `<UiDialogFooter class="gap-2">`
  - tombol pemicu `@click="konfirmasi = 'terbitkan'"` / `'cabut'`
  - `data.usaha.nama` (`PassportDetail.usaha.nama`, `types/program.ts:321`)
  - `passport.kode`
- `components/ui/dialog/DialogContent.vue`:
  - kelas dasar `max-w-[calc(100%-2rem)] … sm:max-w-lg`
  - prop `showCloseButton` (dipakai `v-if` pada `DialogClose`)
- Pola rujukan: dialog tolak `talent/kurasi.vue` (`v-if="tolakTarget"` pada content).
- Mock: `tests/fixtures/mock-program.mjs`. Handler `GET /passport` mengembalikan `bisaMenerbitkan: true`. Handler `POST /passport` membuat `state.passport`. **Belum ada** handler `POST /passport/:id/cabut`.

## 4. Kontrak saat ini → kontrak akhir

| Aspek | Saat ini | Akhir |
|---|---|---|
| Penutupan | ditutup sebelum request; isi berganti ke varian "terbitkan" | tetap terbuka sampai request selesai; tutup hanya bila sukses |
| Sibuk | `busy` hanya menonaktifkan tombol pemicu di halaman | tombol dialog nonaktif + label "Memproses…"; tombol X disembunyikan, Esc/klik luar diabaikan selama proses |
| Error | `message` banner halaman (di balik overlay) | `konfirmasiError` `role="alert"` di dalam dialog; banner halaman hanya untuk sukses |
| Copy cabut | "Cabut Talent Passport?" / "Passport tidak dapat diverifikasi lagi dan QR-nya menjadi tidak berlaku." | judul `Cabut Talent Passport ${kode}?`; deskripsi `Passport milik ${nama usaha} tidak dapat diverifikasi lagi dan QR-nya menjadi tidak berlaku. Halaman publik akan menampilkan status dicabut.` |
| Copy terbitkan ulang | "Terbitkan ulang Talent Passport?" / "Passport lama akan dicabut dan QR lama tidak berlaku lagi." | judul `Terbitkan ulang Talent Passport ${nama usaha}?`; deskripsi `Passport ${kode} akan dicabut dan QR lamanya tidak berlaku lagi. Passport baru diterbitkan dengan kode dan QR baru.` |
| Lebar | `max-w-md` (ditelan `sm:max-w-lg`; margin mobile hilang) | `sm:max-w-md` |
| API | `POST /v1/program/passport` dan `POST /v1/program/passport/:id/cabut` | tidak berubah |

## 5. Edit berurutan (keputusan sudah diambil)

### 5.1 `passport.vue` — script

1. `terbitkan()` dan `cabut()` mengembalikan `Promise<boolean>`: `true` bila sukses, `false` bila gagal. Isi `try` dan pesan sukses tetap.
   - Di `catch` pada kedua fungsi, simpan teks error ke `konfirmasiError.value` **bila** `konfirmasi.value !== null`, selain itu ke `message.value` (perilaku lama untuk penerbitan pertama tanpa dialog).
   - Teks error yang sama:
     - terbitkan: `PASSPORT_BELUM_MEMENUHI` → `data.value?.alasan ?? "Usaha belum memenuhi syarat."`, selain itu "Passport tidak dapat diterbitkan. Coba lagi."
     - cabut: "Talent Passport tidak dapat dicabut. Coba lagi."
   - Pesan sukses cabut menjadi `` `Talent Passport ${kode} dicabut.` ``. Simpan `const kode = passport.value.kode` sebelum `await`.
   - Klaim `busy`: tambahkan `if (busy.value) return false;` sebelum `busy.value = true` di kedua fungsi (R6).
2. Tambahkan `const konfirmasiError = ref("");`.
3. Ganti `jalankanKonfirmasi`:

   ```ts
   function bukaKonfirmasi(jenis: "terbitkan" | "cabut") {
     konfirmasi.value = jenis;
     konfirmasiError.value = "";
   }
   /** Dialog tetap terbuka (dan isinya tetap) selama proses; hanya ditutup setelah sukses (R4/R14). */
   async function jalankanKonfirmasi() {
     const jenis = konfirmasi.value;
     if (!jenis || busy.value) return;
     konfirmasiError.value = "";
     const berhasil = jenis === "terbitkan" ? await terbitkan() : await cabut();
     if (berhasil) konfirmasi.value = null;
   }
   function ubahDialog(open: boolean) {
     if (!open && !busy.value) konfirmasi.value = null;
   }
   ```

4. Tambahkan computed `const salinanKonfirmasi = computed(() => …)` yang mengembalikan `{ judul, deskripsi, tombol, varian }` untuk `konfirmasi.value`. Pakai `passport.value?.kode ?? ""` dan `data.value?.usaha.nama ?? "usaha ini"`, persis teks §4.
   - `tombol`: "Ya, cabut" / "Ya, terbitkan ulang".
   - `varian`: `"destructive"` / `"default"`.
   - Kembalikan `null` bila `konfirmasi.value` null.

### 5.2 `passport.vue` — template

- Tombol pemicu diganti:
  - `@click="konfirmasi = 'terbitkan'"` → `@click="bukaKonfirmasi('terbitkan')"`
  - `@click="konfirmasi = 'cabut'"` → `@click="bukaKonfirmasi('cabut')"`
- Ganti blok dialog:

  ```html
  <UiDialog :open="Boolean(konfirmasi)" @update:open="ubahDialog">
    <UiDialogContent v-if="salinanKonfirmasi" class="sm:max-w-md" :show-close-button="!busy">
      <UiDialogHeader>
        <UiDialogTitle class="pr-6 leading-snug">{{ salinanKonfirmasi.judul }}</UiDialogTitle>
        <UiDialogDescription>{{ salinanKonfirmasi.deskripsi }}</UiDialogDescription>
      </UiDialogHeader>
      <p v-if="konfirmasiError" role="alert" class="text-sm text-destructive">{{ konfirmasiError }}</p>
      <UiDialogFooter>
        <UiButton variant="outline" :disabled="busy" @click="ubahDialog(false)">Batal</UiButton>
        <UiButton :variant="salinanKonfirmasi.varian" :disabled="busy" @click="jalankanKonfirmasi">
          <LoaderCircle v-if="busy" class="size-4 animate-spin" />
          {{ busy ? "Memproses…" : salinanKonfirmasi.tombol }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
  ```

  - `LoaderCircle` sudah diimpor di file ini.
  - Isi dialog hanya bergantung pada `konfirmasi`, yang tetap terisi sampai sukses. Karena itu tidak ada flip isi selama proses.
  - Saat sukses, `konfirmasi = null` dan `v-if` melepas konten. Animasi tutup mungkin terpotong; itu diterima, dan isi lama tidak pernah tampil berganti.

### 5.3 Mock `tests/fixtures/mock-program.mjs`

Setelah handler `POST /passport`, tambahkan:

```js
const cabutMatch = path.match(/^\/passport\/([^/]+)\/cabut$/);
if (method === "POST" && cabutMatch) {
  if (state.gagalCabutPassport) return json(route, 500, "INTERNAL");
  if (!state.passport || state.passport.id !== cabutMatch[1]) return json(route, 404, "PASSPORT_NOT_FOUND");
  if (state.tundaCabutPassport) await new Promise((resolve) => setTimeout(resolve, 800));
  state.passport = { ...state.passport, status: "dicabut" };
  return json(route, 200, state.passport);
}
```

Gunakan nama variabel lokal yang tidak bentrok dengan `match` yang sudah dideklarasikan di handler. Periksa scope `let match` sebelum menamai.

### 5.4 `tests/e2e/passport.spec.ts`

Tambahkan test "kurator mencabut passport lewat dialog yang tetap stabil saat proses dan gagal" dengan langkah berikut:

1. Persiapan:
   - `state.usaha.talentStatus = "talent_pool"`
   - `installMockDirectus(page, { authenticated: true })`, `installMockProgram`, `loginMock(page, "/dashboard/usaha/passport")`
2. Masuk ke passport: Cari "Usaha 01" → "Buka passport" → "Terbitkan Talent Passport", lalu tunggu teks `Talent Passport ${PASSPORT_KODE} diterbitkan.`.
3. Jalur gagal:
   - Set `state.gagalCabutPassport = true`, lalu klik "Cabut passport".
   - `page.getByRole("dialog")` berisi judul `Cabut Talent Passport ${PASSPORT_KODE}?` dan teks "Usaha 01".
   - Klik "Ya, cabut". Dialog masih terlihat, `getByRole("dialog").getByRole("alert")` berteks "Talent Passport tidak dapat dicabut. Coba lagi.", dan judul tetap varian "Cabut" (R4/R14).
4. Jalur sukses:
   - Set `state.gagalCabutPassport = false` dan `state.tundaCabutPassport = true`, lalu klik "Ya, cabut".
   - Selama proses, tombol `"Memproses…"` terlihat dan nonaktif, judul dialog masih `Cabut Talent Passport ${PASSPORT_KODE}?`, dan tidak ada teks "Terbitkan ulang Talent Passport" di dalam dialog (R14).
   - Setelah selesai, dialog `toHaveCount(0)` dan banner `Talent Passport ${PASSPORT_KODE} dicabut.` tampil.
5. Hitungan request: setelah langkah 4, `state.requests.filter((r) => r.method === "POST" && /\/passport\/.+\/cabut$/.test(r.path)).length === 2` (satu gagal + satu sukses; guard `busy` mencegah request ganda selama "Memproses…").

## 6. Kasus campuran, negatif, batas, lintas peran, siklus hidup

- **Gagal lalu ulang** (e2e langkah 3–4).
- **Proses lambat** (`tundaCabutPassport`): isi dialog tidak berganti.
- **Esc atau klik overlay saat proses**: `ubahDialog(false)` diabaikan karena `busy`. Ditutupi oleh logika; e2e opsional `page.keyboard.press("Escape")` saat "Memproses…" → dialog masih ada (masukkan ke langkah 4 sebelum menunggu selesai).
- **Terbitkan ulang**: dialog berjudul `Terbitkan ulang Talent Passport Usaha 01?`. Asersi singkat di test yang sama sebelum langkah cabut: buka lalu "Batal" → dialog hilang.
- **Lintas peran**: tombol hanya ada bila `data.bisaMenerbitkan` (tidak berubah).
- **Penerbitan pertama** (tanpa dialog): error tetap ke banner halaman. Test lama "a business outside the talent pool cannot get a passport yet" dan "a curator issues a passport…" tetap hijau.

## 7. Perintah validasi dan hasil yang diharapkan

```bash
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk
python3 docs/qc-diskuk-e2e-plan/scope_guard.py snapshot --output /tmp/qc-phase-10.json   # sebelum edit
cd apps/web && pnpm lint && pnpm typecheck                                                 # 0 error/warning
pnpm exec playwright test tests/e2e/passport.spec.ts tests/e2e/produk-passport.spec.ts --project=chromium --project=mobile   # pass
cd /Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk && python3 docs/qc-diskuk-e2e-plan/scope_guard.py check --snapshot /tmp/qc-phase-10.json --manifest docs/qc-diskuk-e2e-plan/scope_manifest.json --phase 10   # "outside": []
```

Sentinel (masing-masing 0 hit setelah edit):
- `rg -n 'class="max-w-md"' "apps/web/app/pages/(private)/dashboard/usaha/passport.vue"`
- `rg -n "konfirmasi.value = null;\s*$" -A1 "apps/web/app/pages/(private)/dashboard/usaha/passport.vue"` tidak boleh diikuti `if (jenis === "terbitkan") await terbitkan();`. Cek visual pada konteks hit: satu-satunya `konfirmasi.value = null` ada di `if (berhasil)` dan `ubahDialog`.

## 8. Bukti runtime/browser

- Browser (mock atau stack lokal, peran provinsi). Simpan screenshot:
  - `evidence/BUG-022-after-1.png`: dialog cabut berisi kode dan nama
  - `evidence/BUG-022-after-2.png`: tombol "Memproses…"
  - `evidence/BUG-022-after-3.png`: error di dalam dialog
  - "Before" dari baseline: dialog generik `max-w-md`.
- Viewport mobile (`iPhone 13`): dialog berjarak 1rem dari tepi layar karena kelas dasar `max-w-[calc(100%-2rem)]` tidak lagi ditimpa.
- Tanpa perubahan API/migration. Halaman publik `/passport/:kode` setelah cabut menampilkan "Talent Passport sudah dicabut" (perilaku lama; cek manual di stack lokal bila tersedia, selain itu catat "unproven, tidak diubah").

## 9. Rollback dan handoff

- Rollback: `git revert <commit phase 10>`.
- Commit: `fix(web): BUG-022 dialog cabut/terbitkan ulang Talent Passport stabil dengan status proses dan galat di dalam dialog` + trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Handoff: phase terakhir. Lengkapi `docs/qc-diskuk-e2e-plan/execution_log.md` dengan tabel BUG-001…022, TS-15, TS-17 → commit + bukti, sesuai definisi selesai di `main_plan.md` §1.

## 10. Aturan scope-amendment

Bila perbaikan memerlukan perubahan `components/ui/dialog/*`, `pages/(public)/passport/[kode].vue`, atau endpoint passport, **berhenti** dan laporkan file, alasan, dan diff usulan. `scope_guard.py check` harus `"outside": []` sebelum commit.
