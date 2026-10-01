<script setup lang="ts">
// R03/N7-01…N7-02: detail kegiatan + pendaftaran internal (prefill sesi pemilik,
// pakta bersyarat, aksesibilitas, consent, captcha) dan e-pass QR peserta diterima.
import QRCode from "qrcode";
import { ArrowLeft, BadgeCheck, CalendarDays, MapPin, QrCode } from "@lucide/vue";
import { useAuth } from "~/composables/useAuth";
import { appRoleBadge } from "~/constants";
import { endpoint } from "~/lib/directus";
import { requestErrorCode } from "~/lib/request-error";
import { KATEGORI_KEGIATAN, METODE_LABEL, STATUS_KEGIATAN, waktuKegiatan } from "~/lib/kegiatan";
import type { EpassSaya, KegiatanAgenda, RegistrasiPendaftaran, RegistrasiPrefill } from "~/types/program";

definePageMeta({ layout: "landing" });

const route = useRoute();
const directus = useDirectus();
const { user, status: authStatus, currentUser } = useAuth();

const { data: kegiatan, status: muat } = await useAsyncData(`kegiatan:detail:${route.params.id}`, async () => {
  // SAFETY: SDK membuka amplop `data` level atas, jadi hasil request sudah objek kegiatan.
  return directus.request(endpoint<KegiatanAgenda>(`/v1/program/kegiatan/${route.params.id}`));
});
useSeoMeta({
  title: kegiatan.value ? `${kegiatan.value.judul} – Kegiatan Diskuk` : "Kegiatan Diskuk Jawa Barat",
});

const prefill = ref<RegistrasiPrefill | null>(null);
const pendaftaranSaya = ref<RegistrasiPendaftaran | null>(null);
const epass = ref<EpassSaya | null>(null);
const qrGambar = ref("");

const butuhDisabilitas = ref(false);
const kebutuhanAksesibilitas = ref("");
const paktaIntegritas = ref(false);
const consent = ref(false);
const error = ref<string | null>(null);
const mengirim = ref(false);
type CaptchaRef = { solve: () => Promise<string | null>; reset: () => void };
const submitCaptcha = useTemplateRef<CaptchaRef>("submitCaptcha");

const ERRORS = new Map(Object.entries({
  PENDAFTARAN_EKSTERNAL: "Kegiatan ini memakai formulir pendaftaran resmi penyelenggara.",
  KEGIATAN_DIBATALKAN: "Kegiatan dibatalkan.",
  PENDAFTARAN_DITUTUP: "Masa pendaftaran sudah lewat.",
  TIDAK_ELIGIBLE: "Usaha Anda belum memenuhi syarat skala/wilayah/NIB kegiatan ini.",
  PAKTA_WAJIB: "Pakta integritas Non-ASN/TNI/Polri wajib disetujui.",
  CONSENT_WAJIB: "Persetujuan pemrosesan data wajib dicentang.",
  AKSESIBILITAS_WAJIB: "Jelaskan kebutuhan aksesibilitas yang Anda butuhkan.",
  SUDAH_TERDAFTAR: "Usaha Anda sudah terdaftar pada kegiatan ini.",
  CAPTCHA_INVALID: "Verifikasi captcha belum selesai; coba lagi.",
  USAHA_BELUM_TERHUBUNG: "Akun Anda belum terhubung ke usaha.",
}));

const internalTerbuka = computed(() => kegiatan.value?.pendaftaranInternal === true);
const sayaUmkm = computed(() => user.value?.app_role === "umkm");

/** Prefill + status pendaftaran sendiri hanya dimuat untuk sesi pemilik (bukan oracle). */
watchEffect(() => {
  if (!internalTerbuka.value || !sayaUmkm.value || !user.value?.usaha) return;
  directus
    .request(endpoint<RegistrasiPrefill>("/v1/program/registrasi/prefill"))
    .then((payload) => (prefill.value = payload))
    .catch(() => (prefill.value = null));
  directus
    .request(endpoint<RegistrasiPendaftaran>(`/v1/program/registrasi/kegiatan/${route.params.id}/saya`))
    .then((payload) => ((pendaftaranSaya.value = payload), muatEpass(payload)))
    .catch(() => (pendaftaranSaya.value = null));
});

async function muatEpass(pendaftaran: RegistrasiPendaftaran) {
  if (pendaftaran.status !== "diterima") return;
  try {
    const payload = await directus.request(endpoint<EpassSaya>(`/v1/program/registrasi/kegiatan/${route.params.id}/epass`));
    epass.value = payload;
    qrGambar.value = await QRCode.toDataURL(payload.qr, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  } catch {
    epass.value = null;
  }
}

/**
 * Altcha memverifikasi sendiri di latar belakang, tetapi promise verify() programatik bisa
 * tidak pernah settle bila dipanggil sebelum verifikasi itu selesai. Karena itu kirimannya
 * dipolling dengan batas waktu: begitu event verified mengisi payload, solve() langsung
 * mengembalikannya; tanpa captcha dalam 10 detik, kembalikan null dan tampilkan pesan jujur.
 */
async function amankanCaptcha(): Promise<string | null> {
  const batas = Date.now() + 10_000;
  while (Date.now() < batas) {
    const captcha = await Promise.race([
      submitCaptcha.value?.solve() ?? Promise.resolve(null),
      new Promise<null>((selesai) => setTimeout(() => selesai(null), 1_000)),
    ]);
    if (captcha) return captcha;
  }
  return null;
}

async function daftar() {
  error.value = null;
  const captcha = await amankanCaptcha();
  if (!captcha) {
    error.value = ERRORS.get("CAPTCHA_INVALID")!;
    return;
  }
  mengirim.value = true;
  try {
    const payload = await directus.request(
      endpoint<RegistrasiPendaftaran, { butuhDisabilitas: boolean; kebutuhanAksesibilitas: string | null; paktaIntegritas: boolean; consent: boolean; captcha: string | null }>(`/v1/program/registrasi/kegiatan/${route.params.id}/daftar`, {
        method: "POST",
        body: {
          butuhDisabilitas: butuhDisabilitas.value,
          kebutuhanAksesibilitas: butuhDisabilitas.value ? kebutuhanAksesibilitas.value : null,
          paktaIntegritas: paktaIntegritas.value,
          consent: consent.value,
          captcha,
        },
      }),
    );
    pendaftaranSaya.value = payload;
    await muatEpass(payload);
  } catch (cause) {
    const code = requestErrorCode(cause);
    error.value = (code && ERRORS.get(code)) || "Pendaftaran gagal dikirim. Coba lagi.";
    // Captcha tidak direset: penolakan awal (consent/aksesibilitas/pakta) terjadi sebelum
    // server mengonsumsi captcha, jadi payload yang sama sah untuk percobaan ulang. Bila
    // server benar-benar sudah mengonsumsinya, ia menjawab CAPTCHA_INVALID yang jujur.
  } finally {
    mengirim.value = false;
  }
}

if (import.meta.client) currentUser();

const STATUS_PENDAFTARAN_LABEL = new Map(Object.entries({
  menunggu: "Menunggu keputusan panitia",
  diterima: "Diterima — e-pass aktif",
  ditolak: "Ditolak",
  daftar_tunggu: "Daftar tunggu",
  batal: "Dibatalkan",
}));
</script>

<template>
  <div class="min-h-dvh">
    <LandingHeaderMask :title="kegiatan?.judul ?? 'Detail Kegiatan'" subtitle="Kegiatan UMKM" badge-color="#c7d2fe" />
    <div class="mx-auto max-w-4xl px-3 pb-16 | lg:px-0">
      <NuxtLink to="/kegiatan" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="kembali-agenda">
        <ArrowLeft class="size-4" /> Kembali ke daftar kegiatan
      </NuxtLink>

      <p v-if="muat === 'error'" class="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" data-testid="detail-error">
        Kegiatan tidak ditemukan atau belum diterbitkan.
      </p>

      <article v-else-if="kegiatan" class="mt-4 space-y-6">
        <header class="rounded-xl border bg-card p-6 shadow-sm">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="KATEGORI_KEGIATAN[kegiatan.kategori].className">{{ kegiatan.kategoriLabel }}</span>
            <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="STATUS_KEGIATAN[kegiatan.status].className">{{ kegiatan.statusLabel }}</span>
            <span v-if="kegiatan.pendaftaranInternal" class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800" data-testid="badge-internal">Pendaftaran internal</span>
          </div>
          <h1 class="mt-3 text-xl font-bold leading-snug | lg:text-2xl">{{ kegiatan.judul }}</h1>
          <p v-if="kegiatan.ringkasan" class="mt-2 text-sm text-muted-foreground">{{ kegiatan.ringkasan }}</p>
          <dl class="mt-4 grid gap-3 text-sm | sm:grid-cols-2">
            <div class="flex items-center gap-2"><CalendarDays class="size-4 text-muted-foreground" /><dd>{{ waktuKegiatan(kegiatan) }}</dd></div>
            <div class="flex items-center gap-2"><MapPin class="size-4 text-muted-foreground" /><dd>{{ kegiatan.metode === "daring" ? `${METODE_LABEL[kegiatan.metode]}` : kegiatan.lokasi ?? METODE_LABEL[kegiatan.metode] }}</dd></div>
            <div v-if="kegiatan.penyelenggara"><dt class="sr-only">Penyelenggara</dt><dd class="text-muted-foreground">Penyelenggara: {{ kegiatan.penyelenggara }}</dd></div>
            <div v-if="kegiatan.kuota !== null"><dt class="sr-only">Kuota</dt><dd class="text-muted-foreground">Sisa {{ kegiatan.sisaKuota }} dari {{ kegiatan.kuota }} kuota</dd></div>
          </dl>
        </header>

        <section v-if="kegiatan.silabus || kegiatan.narasumber || kegiatan.fasilitas || kegiatan.syarat.skala || kegiatan.syarat.wilayah || kegiatan.syarat.nib" class="rounded-xl border bg-card p-6 shadow-sm">
          <h2 class="font-bold">Rincian kegiatan</h2>
          <p v-if="kegiatan.silabus" class="mt-2 text-sm text-muted-foreground">Silabus: {{ kegiatan.silabus }}</p>
          <p v-if="kegiatan.narasumber" class="mt-2 text-sm text-muted-foreground">Narasumber: {{ kegiatan.narasumber }}</p>
          <p v-if="kegiatan.fasilitas" class="mt-2 text-sm text-muted-foreground">Fasilitas: {{ kegiatan.fasilitas }}</p>
          <h3 class="mt-4 text-sm font-bold">Syarat peserta</h3>
          <ul class="list-inside list-disc text-sm text-muted-foreground">
            <li v-if="kegiatan.syarat.skala">Skala usaha: {{ kegiatan.syarat.skala }}</li>
            <li v-if="kegiatan.syarat.wilayah">Wilayah: {{ kegiatan.syarat.wilayah }}</li>
            <li>{{ kegiatan.syarat.nib ? "Wajib memiliki NIB" : "NIB tidak diwajibkan" }}</li>
          </ul>
        </section>

        <section v-if="internalTerbuka" class="rounded-xl border bg-card p-6 shadow-sm" data-testid="blok-pendaftaran">
          <h2 class="font-bold">Pendaftaran internal</h2>

          <div v-if="pendaftaranSaya" class="mt-4 space-y-4">
            <p class="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-semibold" :data-testid="`status-pendaftaran`">
              <BadgeCheck class="size-4 text-primary" /> {{ STATUS_PENDAFTARAN_LABEL.get(pendaftaranSaya.status) ?? pendaftaranSaya.status }}
            </p>
            <p v-if="pendaftaranSaya.status === 'daftar_tunggu'" class="text-sm text-muted-foreground">
              Kuota penuh saat Anda mendaftar; Anda masuk daftar tunggu dan akan naik bila ada peserta batal.
            </p>
            <p v-if="pendaftaranSaya.alasan" class="text-sm text-muted-foreground">Catatan panitia: {{ pendaftaranSaya.alasan }}</p>

            <div v-if="epass" class="rounded-lg border p-4" data-testid="kartu-epass">
              <p class="flex items-center gap-2 text-sm font-bold"><QrCode class="size-4" /> E-pass peserta</p>
              <div class="mt-3 flex flex-wrap items-center gap-4">
                <img v-if="qrGambar" :src="qrGambar" alt="QR e-pass kegiatan" class="size-40 rounded-lg bg-white p-2" data-testid="qr-epass" :data-qr="epass.qr">
                <dl class="space-y-1 text-sm text-muted-foreground">
                  <div v-if="epass.jadwal"><dt class="sr-only">Jadwal</dt><dd>{{ new Date(epass.jadwal).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Jakarta" }) }} WIB</dd></div>
                  <div v-if="epass.lokasi"><dt class="sr-only">Lokasi</dt><dd>{{ epass.lokasi }}</dd></div>
                  <dd>Perlihatkan QR ini saat presensi. QR terikat pada kegiatan dan peserta Anda.</dd>
                </dl>
              </div>
            </div>
          </div>

          <template v-else>
            <p v-if="authStatus === 'anonymous'" class="mt-3 text-sm text-muted-foreground">
              Pendaftaran internal memakai akun UMKM Anda.
              <NuxtLink :to="`/sign-in?returnTo=/kegiatan/${route.params.id}`" class="font-semibold text-primary hover:underline" data-testid="cta-masuk">Masuk untuk mendaftar</NuxtLink>.
            </p>
            <p v-else-if="!sayaUmkm" class="mt-3 text-sm text-muted-foreground">
              Pendaftaran internal hanya untuk akun UMKM. Akun Anda tercatat sebagai {{ appRoleBadge(user?.app_role).label }}.
            </p>
            <form v-else class="mt-4 max-w-xl space-y-4" data-testid="form-pendaftaran" @submit.prevent="daftar">
              <dl v-if="prefill" class="rounded-lg bg-muted/60 p-3 text-sm">
                <dt class="font-semibold">Profil terisi otomatis dari data Anda</dt>
                <dd class="mt-1 text-muted-foreground">
                  {{ prefill.usaha.nama }}<template v-if="prefill.usaha.kota"> · {{ prefill.usaha.kota }}</template><template v-if="prefill.usaha.skala"> · skala {{ prefill.usaha.skala }}</template>
                  <template v-if="prefill.kontak.whatsapp"> · WA {{ prefill.kontak.whatsapp }}</template>
                </dd>
              </dl>

              <label class="flex items-start gap-2 text-sm">
                <UiCheckbox v-model="butuhDisabilitas" class="mt-1" data-testid="input-disabilitas" />
                <span>Saya penyandang disabilitas / butuh dukungan aksesibilitas</span>
              </label>
              <div v-if="butuhDisabilitas" class="space-y-1">
                <label class="text-sm font-medium" for="kebutuhan-aksesibilitas">Kebutuhan aksesibilitas <span class="text-destructive">*</span></label>
                <UiTextarea
                  id="kebutuhan-aksesibilitas"
                  v-model="kebutuhanAksesibilitas"
                  class="min-h-20"
                  maxlength="500"
                  placeholder="Contoh: jalur kursi roda, penerjemah bahasa isyarat, materi braile…"
                  data-testid="input-aksesibilitas"
                />
              </div>

              <label v-if="kegiatan.butuhPaktaIntegritas" class="flex items-start gap-2 text-sm">
                <UiCheckbox v-model="paktaIntegritas" class="mt-1" data-testid="input-pakta" />
                <span>Pakta integritas: saya bukan ASN/TNI/Polri dan data yang saya ajukan benar. <span class="text-destructive">*</span></span>
              </label>

              <label class="flex items-start gap-2 text-sm">
                <UiCheckbox v-model="consent" class="mt-1" data-testid="input-consent" />
                <span>Saya menyetujui data pendaftaran diproses untuk seleksi peserta kegiatan. <span class="text-destructive">*</span></span>
              </label>

              <AuthCaptcha ref="submitCaptcha" />
              <p v-if="error" class="text-sm text-destructive" data-testid="error-pendaftaran">{{ error }}</p>
              <UiButton type="submit" :disabled="mengirim" data-testid="tombol-daftar">{{ mengirim ? "Mengirim…" : "Kirim pendaftaran" }}</UiButton>
            </form>
          </template>
        </section>

        <section v-else-if="kegiatan.registrationUrl" class="rounded-xl border bg-card p-6 shadow-sm">
          <h2 class="font-bold">Pendaftaran resmi</h2>
          <p class="mt-2 text-sm text-muted-foreground">Kegiatan ini memakai formulir pendaftaran resmi penyelenggara.</p>
          <a :href="kegiatan.registrationUrl" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" data-testid="cta-eksternal">
            Daftar lewat tautan resmi
          </a>
        </section>
      </article>
    </div>
  </div>
</template>
