export const FOLDER_OPERASIONAL = "fa57be17-82ba-480c-b77c-536d42a124d4";

const TIPE_DITERIMA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAKS_10MB = 10 * 1024 * 1024;

export function validateBerkas(file: File): string | null {
  if (!TIPE_DITERIMA.has(file.type)) return "Format berkas harus JPG, PNG, WEBP, atau PDF.";
  if (file.size > MAKS_10MB) return "Ukuran berkas maksimal 10 MB.";
  return null;
}

export function useBerkasUpload() {
  const mengunggah = ref(false);
  const galat = ref<string | null>(null);

  const uploadBerkas = async (file: File, title: string): Promise<{ id: string }> => {
    const masalah = validateBerkas(file);
    if (masalah) {
      galat.value = masalah;
      throw new Error(masalah);
    }
    mengunggah.value = true;
    galat.value = null;
    try {
      const body = new FormData();
      body.set("folder", FOLDER_OPERASIONAL);
      body.set("title", title);
      body.set("file", file);
      const res = await $fetch<{ data: { id: string } }>("/panel/files", {
        method: "POST",
        body,
      });
      return { id: res.data.id };
    } catch (error) {
      galat.value = "Unggah gagal.";
      throw error;
    } finally {
      mengunggah.value = false;
    }
  };

  return { mengunggah, galat, uploadBerkas, validateBerkas };
}
