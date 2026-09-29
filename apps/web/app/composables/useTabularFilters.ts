/*
 * State filter tabular bersama untuk halaman dashboard (Infografis, Spasial).
 * Nilai "semua" berarti tanpa filter; draft `filters` baru dipindahkan ke
 * `appliedFilters` saat pengguna menekan "Terapkan" pada dialog FilterFab.
 * Opsi dropdown diambil dari endpoint `/v1/analytics/tabular/options`, dengan daftar
 * desa/kelurahan dimuat lazily per kecamatan dari `/v1/analytics/tabular/kelurahan`.
 */
import type {
  TabularFilters,
  TabularKbliOption,
  TabularKelurahanItem,
  TabularOptions,
} from "~/types/tabular";
import { endpoint } from "~/lib/directus";
import { lockedKotaId } from "~/constants/ROLES";
import { useAuth } from "~/composables/useAuth";

/** Konversi nilai skala UI (Indonesia) ke nilai enum API snapshot. */
export const TABULAR_SKALA_TO_API = new Map<string, string>([
  ["mikro", "micro"],
  ["kecil", "small"],
  ["menengah", "medium"],
]);

export const defaultTabularFilters = (): TabularFilters => ({
  kabupatenKota: "semua",
  kecamatan: "semua",
  desaKelurahan: "semua",
  skala: "semua",
  kegiatanUsaha: "semua",
  kodeKbli: "semua",
});

/** Bentuk query param API dari filter terapan; nilai "semua" dihilangkan. */
export function tabularFilterQuery(applied: TabularFilters) {
  return {
    kota: applied.kabupatenKota !== "semua" ? applied.kabupatenKota : undefined,
    kecamatan: applied.kecamatan !== "semua" ? applied.kecamatan : undefined,
    kelurahan: applied.desaKelurahan !== "semua" ? applied.desaKelurahan : undefined,
    skala: applied.skala !== "semua" ? TABULAR_SKALA_TO_API.get(applied.skala) : undefined,
    kegiatan: applied.kegiatanUsaha !== "semua" ? applied.kegiatanUsaha : undefined,
    kbli: applied.kodeKbli !== "semua" ? applied.kodeKbli : undefined,
  };
}

/**
 * Kota terkunci menurut akun (Y01/B39): kabkota hanya melihat kotanya sendiri.
 * Satu aturan untuk composable ini, TabularData.vue, dan dashboard infografis;
 * server tetap menegakkan scope lewat `scopeTabularQuery`.
 */
export function useLockedKota() {
  const auth = useAuth();
  return computed(() =>
    lockedKotaId({ app_role: auth.user.value?.app_role, kota: auth.user.value?.kota }),
  );
}

/** Salin kunci ke draft dan filter terpakai; `false` bila tidak ada kunci. */
export function applyLockedKota(
  filters: TabularFilters,
  appliedFilters: TabularFilters,
  locked: string | null,
): boolean {
  if (!locked) return false;
  filters.kabupatenKota = locked;
  appliedFilters.kabupatenKota = locked;
  return true;
}

export function useTabularFilters() {
  const filters = reactive(defaultTabularFilters());
  const appliedFilters = reactive(defaultTabularFilters());
  const filterOpen = ref(false);

  const lockedKota = useLockedKota();
  watch(
    lockedKota,
    (locked) => {
      applyLockedKota(filters, appliedFilters, locked);
    },
    { immediate: true },
  );

  const directus = useDirectus();
  // Shared key: every dashboard component that needs these options reuses one request.
  const { data: optionsData, error: optionsError } = useAsyncData("tabular:options", () =>
    directus.request(endpoint<TabularOptions>("/v1/analytics/tabular/options")),
  );

  const kabupatenOptions = computed(() => [
    { value: "semua", label: "Semua Kabupaten/Kota" },
    ...(optionsData.value?.kota ?? []).map((item) => ({
      value: String(item.id),
      label: item.nama,
    })),
  ]);

  const kecamatanOptions = computed(() => {
    const kotaId = Number(filters.kabupatenKota);
    const items = optionsData.value?.kecamatan ?? [];
    const scoped = Number.isInteger(kotaId) && kotaId > 0
      ? items.filter((item) => item.kotaId === kotaId)
      : items;
    return [
      { value: "semua", label: "Semua Kecamatan" },
      ...scoped.map((item) => ({ value: String(item.id), label: item.nama })),
    ];
  });

  const kegiatanOptions = computed(() => [
    { value: "semua", label: "Semua Kegiatan Usaha" },
    ...(optionsData.value?.kategori ?? []).map((item) => ({ value: item, label: item })),
  ]);

  const kbliOptions = computed(() => {
    const items: TabularKbliOption[] = optionsData.value?.kbli ?? [];
    const scoped = filters.kegiatanUsaha === "semua"
      ? items
      : items.filter((item) => item.kategori === filters.kegiatanUsaha);
    return [
      { value: "semua", label: "Semua Kode KBLI" },
      ...scoped.map((item) => ({ value: item.kode, label: item.kode })),
    ];
  });

  const kelurahanCache = new Map<string, TabularKelurahanItem[]>();
  const desaKelurahanOptions = ref([{ value: "semua", label: "Semua Desa/Kelurahan" }]);

  const syncKelurahanOptions = (kecamatanId: string) => {
    const items = kecamatanId === "semua" ? [] : (kelurahanCache.get(kecamatanId) ?? []);
    desaKelurahanOptions.value = [
      { value: "semua", label: "Semua Desa/Kelurahan" },
      ...items.map((item) => ({ value: String(item.id), label: item.nama })),
    ];
  };

  const loadKelurahan = async (kecamatanId: string) => {
    try {
      const items = await directus.request(
        endpoint<TabularKelurahanItem[]>("/v1/analytics/tabular/kelurahan", { query: { kecamatan: kecamatanId } }),
      );
      kelurahanCache.set(kecamatanId, items ?? []);
    } catch {
      kelurahanCache.set(kecamatanId, []);
    } finally {
      if (filters.kecamatan === kecamatanId) syncKelurahanOptions(kecamatanId);
    }
  };

  watch(() => filters.kabupatenKota, () => {
    filters.kecamatan = "semua";
  });

  watch(() => filters.kecamatan, (value) => {
    filters.desaKelurahan = "semua";
    if (value === "semua") return syncKelurahanOptions(value);
    if (kelurahanCache.has(value)) return syncKelurahanOptions(value);
    syncKelurahanOptions("semua");
    void loadKelurahan(value);
  });

  watch(() => filters.kegiatanUsaha, (value) => {
    if (value === "semua" || filters.kodeKbli === "semua") return;
    const items = optionsData.value?.kbli ?? [];
    if (!items.some((item) => item.kategori === value && item.kode === filters.kodeKbli)) {
      filters.kodeKbli = "semua";
    }
  });

  const activeFilterCount = computed(() =>
    Object.values(appliedFilters).filter((value) => value !== "semua").length,
  );

  const applyFilters = () => Object.assign(appliedFilters, filters);
  const resetFilters = () => {
    Object.assign(filters, defaultTabularFilters());
    Object.assign(appliedFilters, defaultTabularFilters());
  };

  return {
    filters,
    appliedFilters,
    filterOpen,
    lockedKota,
    optionsError,
    kabupatenOptions,
    kecamatanOptions,
    desaKelurahanOptions,
    kegiatanOptions,
    kbliOptions,
    activeFilterCount,
    applyFilters,
    resetFilters,
  };
}
