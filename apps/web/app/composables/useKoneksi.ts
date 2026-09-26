// Y03 — status koneksi PWA: gabungan kondisi browser + hasil request aktual.
// Jangan menganggap navigator.onLine saja sebagai bukti server terjangkau:
// banner offline tampil bila browser offline ATAU request terakhir gagal
// jaringan; kembali online hanya setelah request sukses.

export function useKoneksi() {
  const browserOnline = useState("koneksi:browser-online", () =>
    import.meta.client ? window.navigator.onLine : true,
  );
  const requestGagal = useState("koneksi:request-gagal", () => false);
  const online = computed(() => browserOnline.value && !requestGagal.value);

  function tandaiSukses() {
    requestGagal.value = false;
  }

  function tandaiGagalJaringan() {
    requestGagal.value = true;
  }

  if (import.meta.client) {
    const sync = () => {
      browserOnline.value = window.navigator.onLine;
    };
    onMounted(() => {
      sync();
      window.addEventListener("online", sync);
      window.addEventListener("offline", sync);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    });
  }

  return { browserOnline, requestGagal, online, tandaiSukses, tandaiGagalJaringan };
}
