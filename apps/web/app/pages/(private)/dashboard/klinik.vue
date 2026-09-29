<script setup lang="ts">
import { ArrowRight, History, LayoutGrid, List, Paperclip, Video } from "@lucide/vue";
import { KANBAN_KOLOM, KLINIK_ASPEK, KLINIK_PRIORITAS, KLINIK_RUJUKAN, KLINIK_STATUS, labelStatusKlinik, lampiranKlinikUrl } from "~/constants";
import { useAuth } from "~/composables/useAuth";
import { KlinikError, daftarTiket, klaim, majukan, simpanSesi, tahapBerikutnya } from "~/lib/klinik";
import type { RuntimeLabelMap } from "~/types/directus";
import type { KlinikAspek, KlinikOutcomeIsi, KlinikPrioritas, KlinikRujukan, KlinikStatus, KlinikTiket, KlinikTiketAudit } from "~/types/program";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Klinik Konsultasi – Dashboard UMKM" });

const directus = useDirectus();
const auth = useAuth();
const view = ref<"kanban" | "list">("kanban");

// Panel pendamping/dinas (M7-13). A UMKM account reads its own ticket back through the public
// tracking form instead of the staff list, which the API refuses for non-staff roles.
const peran = computed(() => auth.user.value?.app_role ?? null);
const petugas = computed(() => ["provinsi", "kabkota", "pendamping"].includes(peran.value ?? ""));
/** Antrean verifikasi outcome hanya untuk provinsi dan kab/kota; pendamping hanya mengajukan (server menolak 403). */
const verifikator = computed(() => ["provinsi", "kabkota"].includes(peran.value ?? ""));

/** Arsip batal (B34, K23): kanban tetap lima kolom; toggle di bawah memanggil `?status=batal`. */
const tampilBatal = ref(false);
const { data: tiket, error, refresh } = await useAsyncData(
  "klinik:tiket",
  async () => {
    if (!petugas.value) return [];
    return daftarTiket(directus, tampilBatal.value ? "batal" : undefined);
  },
  { watch: [tampilBatal] },
);
const entriBatal = computed(() => KLINIK_STATUS.find((item) => item.value === "batal")!);
const kolomTampil = computed(() => (tampilBatal.value ? [...KANBAN_KOLOM, entriBatal.value] : KANBAN_KOLOM));
/** Aduan PMSE mendesak: advokasi PMSE flagged urgent by the officer (M7-13). */
const hanyaPmse = ref(false);
const jumlahPmse = computed(() => (tiket.value ?? []).filter((item) => item.pmseMendesak).length);
const daftar = computed(() => (tiket.value ?? []).filter((item) => !hanyaPmse.value || item.pmseMendesak));
// SAFETY: kolom kanban selalu terisi larik, termasuk arsip batal saat toggle aktif.
const byStatus = computed(() =>
  Object.fromEntries(kolomTampil.value.map(({ value }) => [value, daftar.value.filter((item) => item.status === value)])) as Record<KlinikStatus, KlinikTiket[]>,
);

// Tahap yang boleh dituju datang dari server (`tiket.transisi`), bukan dari aturan yang disalin di sini.
const pilihanStatus = computed(() => (active.value ? [active.value.status, ...active.value.transisi] : []));

// ── Detail sheet ────────────────────────────────────────────────────────────
const active = ref<KlinikTiket | null>(null);

/** Isian panel detail; tipe eksplisit agar nilai awal tidak perlu assertion. */
interface DraftTiket {
  status: KlinikStatus;
  prioritas: KlinikPrioritas;
  linkMeet: string;
  diagnosis: Partial<Record<KlinikAspek, string>>;
  actionPlan: string;
  rujukan: KlinikRujukan[];
  catatan: string;
}

const draft = reactive<DraftTiket>({
  status: "masuk",
  prioritas: "normal",
  linkMeet: "",
  diagnosis: {},
  actionPlan: "",
  rujukan: [],
  catatan: "",
});
const saving = ref(false);
const sheetError = ref("");

/** Outcome opsional yang dikirim bersama penutupan tiket (R04); kosong berarti tiket ditutup tanpa outcome. */
const draftOutcome = ref<KlinikOutcomeIsi[]>([]);
/** Checklist tampil saat petugas menetapkan Selesai pada tiket yang belum selesai; tiket selesai memakai "Catat outcome". */
const menutTiket = computed(() => active.value !== null && draft.status === "selesai" && active.value.status !== "selesai");
const antrean = useTemplateRef<{ muatUlang: () => Promise<void> }>("antrean");

function open(item: KlinikTiket) {
  active.value = item;
  sheetError.value = "";
  draftOutcome.value = [];
  Object.assign(draft, {
    status: item.status,
    prioritas: item.prioritas,
    linkMeet: item.linkMeet ?? "",
    diagnosis: { ...item.diagnosis },
    actionPlan: item.actionPlan ?? "",
    rujukan: [...item.rujukan],
    catatan: item.catatan ?? "",
  });
}

/** Pesan kegagalan module klinik; kegagalan lain (mis. jaringan) memakai teks cadangan aksinya. */
function pesanGagal(cause: unknown, cadangan: string) {
  return cause instanceof KlinikError ? cause.pesan : cadangan;
}

async function simpan() {
  if (!active.value) return;
  saving.value = true;
  sheetError.value = "";
  try {
    active.value = await simpanSesi(directus, active.value, {
      status: draft.status,
      prioritas: draft.prioritas,
      linkMeet: draft.linkMeet.trim() || null,
      diagnosis: Object.fromEntries(Object.entries(draft.diagnosis).map(([key, value]) => [key, value?.trim() || null])),
      actionPlan: draft.actionPlan.trim() || null,
      rujukan: draft.rujukan,
      catatan: draft.catatan.trim() || null,
      outcome: menutTiket.value && active.value.usaha && draftOutcome.value.length ? { items: draftOutcome.value } : undefined,
    });
    draftOutcome.value = [];
    await Promise.all([refresh(), antrean.value?.muatUlang()]);
  } catch (cause) {
    sheetError.value = pesanGagal(cause, "Perubahan tidak dapat disimpan.");
    if (cause instanceof KlinikError && cause.muatUlang) await refresh();
  } finally {
    saving.value = false;
  }
}

async function ambil() {
  if (!active.value || !auth.user.value?.id) return;
  sheetError.value = "";
  try {
    active.value = await klaim(directus, active.value, auth.user.value.id);
    await refresh();
  } catch (cause) {
    sheetError.value = pesanGagal(cause, "Tiket tidak dapat diambil.");
  }
}

/** Setelah outcome dicatat, diverifikasi, dikoreksi, atau dicabut: muat ulang daftar dan tiket yang terbuka. */
async function outcomeBerubah() {
  await refresh();
  const segar = tiket.value?.find((item) => item.id === active.value?.id);
  if (segar) active.value = segar;
  await antrean.value?.muatUlang();
}

const aksiError = ref("");
/** Satu langkah di kartu kanban (tiket batal maju ke dijadwalkan), dengan muat ulang bila versinya basi. */
async function geser(item: KlinikTiket) {
  aksiError.value = "";
  try {
    await majukan(directus, item);
    await refresh();
  } catch (cause) {
    aksiError.value = pesanGagal(cause, "Status tidak dapat diubah.");
    if (cause instanceof KlinikError && cause.muatUlang) await refresh();
  }
}

function toggleRujukan(value: KlinikRujukan) {
  draft.rujukan = draft.rujukan.includes(value) ? draft.rujukan.filter((item) => item !== value) : [...draft.rujukan, value];
}

// ── Audit trail: who changed what, when (M7-13) ─────────────────────────────
const AKSI_AUDIT_LABEL = { transisi: "Transisi status", penugasan: "Penugasan", catatan: "Catatan" } satisfies Record<KlinikTiketAudit["aksi"], string>;
const KOLOM_LABEL: RuntimeLabelMap = {
  status: "status",
  pendamping: "pendamping",
  prioritas: "prioritas",
  link_meet: "tautan rapat",
  action_plan: "rencana aksi",
  catatan: "catatan",
  diagnosis: "diagnosis",
  rujukan: "rujukan",
};
const stempel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
/** Label untuk kode status di jejak audit dan pilihan status; kode yang tak dikenal tampil apa adanya. */
const statusLabel = (status: KlinikStatus | string | null | undefined) => labelStatusKlinik(status);
const ringkasPerubahan = (item: KlinikTiketAudit) => item.perubahan.map((kolom) => KOLOM_LABEL[kolom] ?? kolom).join(", ");

const tanggal = (value: string) => new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
</script>

<template>
  <div class="flex w-full flex-col gap-6 pb-10">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Klinik Konsultasi</h1>
        <p class="mt-1 text-sm text-muted-foreground">Tiket dari formulir publik, diurutkan menurut prioritas dan jadwal.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="petugas && jumlahPmse"
          type="button"
          class="rounded-md border px-3 py-1.5 text-sm"
          :class="hanyaPmse ? 'border-red-300 bg-red-100 font-semibold text-red-900' : 'hover:bg-muted'"
          :aria-pressed="hanyaPmse"
          data-testid="filter-pmse"
          @click="hanyaPmse = !hanyaPmse"
        >Aduan PMSE mendesak ({{ jumlahPmse }})</button>
        <label v-if="petugas" class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          <input v-model="tampilBatal" type="checkbox" data-testid="toggle-batal" class="size-4 accent-current" >
          Tampilkan dibatalkan
        </label>
        <div v-if="petugas" class="flex rounded-md border p-0.5" role="group" aria-label="Tampilan">
          <button type="button" class="inline-flex items-center gap-1 rounded px-2 py-1 text-sm" :class="view === 'kanban' && 'bg-muted font-semibold'" :aria-pressed="view === 'kanban'" @click="view = 'kanban'"><LayoutGrid class="size-4" /> Kanban</button>
          <button type="button" class="inline-flex items-center gap-1 rounded px-2 py-1 text-sm" :class="view === 'list' && 'bg-muted font-semibold'" :aria-pressed="view === 'list'" @click="view = 'list'"><List class="size-4" /> Daftar</button>
        </div>
      </div>
    </div>

    <template v-if="petugas">
    <p v-if="aksiError" role="alert" class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{{ aksiError }}</p>
    <div v-if="error" role="alert" class="rounded-lg border border-destructive/30 p-6 text-sm text-destructive">Tiket tidak dapat dimuat.</div>
    <p v-else-if="!daftar.length" role="status" class="rounded-lg border p-6 text-sm text-muted-foreground">
      {{ hanyaPmse ? "Tidak ada aduan PMSE mendesak saat ini." : "Belum ada tiket dalam penugasan Anda." }}
    </p>

    <div v-else-if="view === 'kanban'" class="grid auto-cols-[16rem] grid-flow-col gap-3 overflow-x-auto pb-2">
      <section v-for="column in kolomTampil" :key="column.value" class="grid content-start gap-2 rounded-xl bg-muted/50 p-2" :aria-label="column.label" :data-testid="`kolom-${column.value}`">
        <h2 class="px-1 text-sm font-bold">{{ column.label }} <span class="text-muted-foreground">({{ byStatus[column.value].length }})</span></h2>
        <article v-for="item in byStatus[column.value]" :key="item.id" class="grid gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-xs">{{ item.nomor }}</span>
            <span class="flex items-center gap-1">
              <span v-if="item.pmseMendesak" class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800" data-testid="badge-pmse">PMSE mendesak</span>
              <ProgramStatusPill :meta="KLINIK_PRIORITAS[item.prioritas]" />
            </span>
          </div>
          <button type="button" class="text-left font-semibold leading-snug hover:underline" @click="open(item)">{{ item.namaUsaha }}</button>
          <p class="text-xs text-muted-foreground">{{ item.poliNama }}</p>
          <p class="text-xs">{{ tanggal(item.jadwalTanggal) }} · {{ item.jadwalSlot }} · {{ item.moda === "daring" ? "Daring" : "Luring" }}</p>
          <div class="flex items-center justify-between text-xs">
            <span class="text-muted-foreground">{{ item.pendampingNama || "Belum ada pendamping" }}</span>
            <button v-if="tahapBerikutnya(item)" type="button" class="rounded p-1 hover:bg-muted" :aria-label="`Pindahkan ${item.nomor} ke tahap berikutnya`" @click="geser(item)"><ArrowRight class="size-4" /></button>
          </div>
        </article>
      </section>
    </div>

    <UiCard v-else>
      <UiCardContent class="overflow-x-auto p-0">
        <table class="w-full min-w-[48rem] text-sm">
          <thead class="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th class="px-4 py-3">Tiket</th><th class="px-4 py-3">Usaha</th><th class="px-4 py-3">Poli</th><th class="px-4 py-3">Jadwal</th><th class="px-4 py-3">Prioritas</th><th class="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in daftar" :key="item.id" class="cursor-pointer border-b last:border-0 hover:bg-muted/30" @click="open(item)">
              <td class="px-4 py-3 font-mono text-xs">{{ item.nomor }}</td>
              <td class="px-4 py-3 font-medium">{{ item.namaUsaha }}</td>
              <td class="px-4 py-3">{{ item.poliNama }}</td>
              <td class="px-4 py-3">{{ tanggal(item.jadwalTanggal) }} · {{ item.jadwalSlot }}</td>
              <td class="px-4 py-3">
                <span class="flex items-center gap-1">
                  <ProgramStatusPill :meta="KLINIK_PRIORITAS[item.prioritas]" />
                  <span v-if="item.pmseMendesak" class="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">PMSE mendesak</span>
                </span>
              </td>
              <td class="px-4 py-3">{{ item.statusLabel }}</td>
            </tr>
          </tbody>
        </table>
      </UiCardContent>
    </UiCard>

    <KlinikOutcomeAntrean v-if="verifikator" ref="antrean" @berubah="refresh" />

    <UiSheet :open="Boolean(active)" @update:open="(value) => !value && (active = null)">
      <UiSheetContent v-if="active" class="w-full overflow-y-auto sm:max-w-xl">
        <UiSheetHeader>
          <UiSheetTitle>{{ active.namaUsaha }}</UiSheetTitle>
          <UiSheetDescription>{{ active.nomor }} · {{ active.poliNama }}</UiSheetDescription>
        </UiSheetHeader>
        <div class="grid gap-5 px-4 pb-6 text-sm">
          <dl class="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
            <div><dt class="text-xs text-muted-foreground">Narahubung</dt><dd>{{ active.namaKontak }} · <a :href="`https://wa.me/${active.whatsapp.replace(/^0/, '62').replace(/\D/g, '')}`" target="_blank" rel="noopener noreferrer" class="underline">{{ active.whatsapp }}</a></dd></div>
            <div><dt class="text-xs text-muted-foreground">Jadwal</dt><dd>{{ tanggal(active.jadwalTanggal) }} · {{ active.jadwalSlot }} WIB · {{ active.moda === "daring" ? "Daring" : "Luring" }}</dd></div>
            <div class="sm:col-span-2"><dt class="text-xs text-muted-foreground">Permasalahan</dt><dd class="whitespace-pre-line">{{ active.deskripsi }}</dd></div>
            <div v-if="active.lampiran.length" class="sm:col-span-2">
              <dt class="text-xs text-muted-foreground">Lampiran</dt>
              <dd class="flex flex-wrap gap-2 pt-1">
                <a v-for="(id, index) in active.lampiran" :key="id" :href="lampiranKlinikUrl(id)" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 underline"><Paperclip class="size-3" /> Lampiran {{ index + 1 }}</a>
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap items-center gap-3">
            <span>Pendamping: <strong>{{ active.pendampingNama || "belum ada" }}</strong></span>
            <UiButton v-if="active.pendamping !== auth.user.value?.id" size="sm" variant="outline" @click="ambil">Ambil tiket ini</UiButton>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="grid gap-1"><span class="font-medium">Status</span>
              <select v-model="draft.status" name="status" class="h-9 rounded-md border border-input bg-transparent px-2" data-testid="pilih-status">
                <option v-for="status in pilihanStatus" :key="status" :value="status">{{ statusLabel(status) }}</option>
              </select>
              <span class="text-xs text-muted-foreground">Tiket hanya bisa maju satu tahap; tahap berikutnya: {{ pilihanStatus.filter((status) => status !== draft.status).map(statusLabel).join(", ") || "tidak ada" }}.</span>
            </label>
            <label class="grid gap-1"><span class="font-medium">Prioritas</span>
              <select v-model="draft.prioritas" name="prioritas" class="h-9 rounded-md border border-input bg-transparent px-2">
                <option v-for="(meta, key) in KLINIK_PRIORITAS" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </label>
          </div>

          <UiField class="gap-1">
            <UiFieldLabel for="link-meet">Tautan rapat daring</UiFieldLabel>
            <div class="flex gap-2">
              <UiInput id="link-meet" v-model="draft.linkMeet" type="url" placeholder="https://" />
              <UiButton v-if="active.linkMeet" as-child size="sm" variant="outline"><a :href="active.linkMeet" target="_blank" rel="noopener noreferrer"><Video class="size-4" /> Buka</a></UiButton>
            </div>
          </UiField>

          <fieldset class="grid gap-2">
            <legend class="mb-1 font-bold">Notulensi sesi: diagnosis per aspek</legend>
            <UiField v-for="aspek in KLINIK_ASPEK" :key="aspek.value" class="gap-1">
              <UiFieldLabel :for="`diagnosis-${aspek.value}`">{{ aspek.label }}</UiFieldLabel>
              <UiTextarea :id="`diagnosis-${aspek.value}`" v-model="draft.diagnosis[aspek.value]" rows="2" maxlength="2000" />
            </UiField>
          </fieldset>
          <UiField class="gap-1"><UiFieldLabel for="action-plan">Rencana aksi</UiFieldLabel><UiTextarea id="action-plan" v-model="draft.actionPlan" rows="3" maxlength="5000" /></UiField>

          <div class="grid gap-2">
            <span class="font-bold">Rujukan</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="item in KLINIK_RUJUKAN"
                :key="item.value"
                type="button"
                :aria-pressed="draft.rujukan.includes(item.value)"
                class="rounded-full border px-3 py-1.5 text-xs font-medium"
                :class="draft.rujukan.includes(item.value) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'"
                @click="toggleRujukan(item.value)"
              >{{ item.label }}</button>
            </div>
          </div>
          <UiField class="gap-1"><UiFieldLabel for="catatan-klinik">Catatan internal</UiFieldLabel><UiTextarea id="catatan-klinik" v-model="draft.catatan" rows="2" maxlength="5000" /></UiField>

          <fieldset v-if="menutTiket" class="grid gap-2" data-testid="outcome-penutupan">
            <legend class="mb-1 font-bold">Hasil konsultasi (outcome), opsional</legend>
            <template v-if="active.usaha">
              <p class="text-xs text-muted-foreground">Tandai atribut usaha yang berubah. Dikirim bersama penutupan tiket dan menunggu verifikasi petugas lain; boleh dikosongkan.</p>
              <KlinikOutcomeForm v-model="draftOutcome" :disabled="saving" />
            </template>
            <p v-else class="text-xs text-muted-foreground">Tiket tanpa usaha terdaftar tidak dapat memiliki outcome.</p>
          </fieldset>

          <p v-if="sheetError" role="alert" class="text-destructive">{{ sheetError }}</p>
          <UiButton :disabled="saving" @click="simpan">{{ saving ? "Menyimpan…" : "Simpan" }}</UiButton>

          <p class="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Menutup tiket tanpa outcome tidak mengubah profil UMKM. Outcome baru masuk ke profil dan
            indikator usaha setelah diverifikasi oleh petugas lain (provinsi atau kab/kota wilayah usaha).
          </p>

          <section v-if="active.outcome || active.outcomeBisaDicatat" class="grid gap-3 border-t pt-4" aria-label="Outcome konsultasi" data-testid="outcome-tiket">
            <h3 class="font-bold">Outcome konsultasi</h3>
            <KlinikOutcomePanel v-if="active.outcome" :outcome="active.outcome" @berubah="outcomeBerubah" />
            <KlinikOutcomeCatat v-if="active.outcomeBisaDicatat" :tiket="active" @berubah="outcomeBerubah" />
          </section>

          <section class="grid gap-2 border-t pt-4" aria-label="Jejak audit tiket">
            <h3 class="inline-flex items-center gap-2 font-bold"><History class="size-4" aria-hidden="true" /> Jejak audit</h3>
            <p v-if="!active.riwayat?.length" class="text-xs text-muted-foreground">Belum ada perubahan tercatat.</p>
            <ol v-else class="grid gap-2" data-testid="riwayat-tiket">
              <li v-for="(jejak, index) in active.riwayat" :key="`${jejak.dateCreated}-${index}`" class="grid gap-0.5 rounded-md border p-2 text-xs">
                <span class="font-semibold">
                  {{ AKSI_AUDIT_LABEL[jejak.aksi] }}<template v-if="jejak.aksi === 'transisi'">: {{ statusLabel(jejak.statusDari) }} → {{ statusLabel(jejak.statusKe) }}</template><template v-else>: {{ ringkasPerubahan(jejak) }}</template>
                </span>
                <span class="text-muted-foreground">{{ jejak.aktorNama || "Petugas" }} · {{ stempel(jejak.dateCreated) }}</span>
              </li>
            </ol>
          </section>
        </div>
      </UiSheetContent>
    </UiSheet>
    </template>

    <template v-else>
      <section class="grid gap-2 rounded-xl border bg-card p-5 text-sm" aria-label="Klinik untuk UMKM">
        <h2 class="text-lg font-bold">Klinik Konsultasi</h2>
        <p class="text-muted-foreground">
          Ajukan konsultasi lewat halaman publik klinik. Setelah tiket terbit, baca statusnya di sini dengan
          nomor tiket dan nomor WhatsApp yang Anda pakai saat mengajukan.
        </p>
        <NuxtLink to="/konsultasi" class="inline-flex w-fit rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">Ajukan konsultasi</NuxtLink>
      </section>
      <KlinikLacakTiket />
    </template>
  </div>
</template>
