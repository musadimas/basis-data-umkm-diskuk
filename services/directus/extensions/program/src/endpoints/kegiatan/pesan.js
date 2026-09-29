// Template pesan pengingat agenda (Y07). Dirender saat langganan jatuh tempo (keputusan 4), lalu
// diserahkan ke outbox: pengiriman email/WhatsApp ada di lib/outbox/adapters, bukan di sini.
import { escapeHtml } from "../../lib/utils/http.js";

export function waktuJakarta(value) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value instanceof Date ? value : new Date(value));
}

/** Public page of the reminder's unsubscribe token, at the address the recipient can open. */
export function tautanBatal(env, token) {
  const base = typeof env.PUBLIC_URL === "string" ? env.PUBLIC_URL.replace(/\/+$/, "") : "";
  return base ? `${base}/v1/program/kegiatan/pengingat/${token}` : null;
}

/**
 * Pesan pengingat dari baris langganan + kegiatan. Teks admin (judul, lokasi) dan tautan di-escape
 * di HTML email; `params` adalah muatan datar untuk gateway WhatsApp.
 */
export function pesanPengingat(row, env = {}) {
  const tempat = row.lokasi || (row.metode === "daring" ? "Daring (lihat tautan kegiatan)" : "Lokasi menyusul");
  const batal = tautanBatal(env, row.token);
  const waktu = waktuJakarta(row.tanggal_mulai);
  const teks = [
    `Pengingat kegiatan: ${row.judul}`,
    "",
    `Waktu: ${waktu} WIB`,
    `Tempat: ${tempat}`,
    "",
    "Pesan ini dikirim karena Anda meminta pengingat pada agenda UMKM Jawa Barat.",
    batal ? `Bila tidak ingin diingatkan lagi, buka: ${batal}` : "",
  ].filter((line) => line !== "").join("\n");
  const html = [
    `<p>Pengingat kegiatan: <strong>${escapeHtml(row.judul)}</strong></p>`,
    `<p>Waktu: ${escapeHtml(waktu)} WIB<br>Tempat: ${escapeHtml(tempat)}</p>`,
    "<p>Pesan ini dikirim karena Anda meminta pengingat pada agenda UMKM Jawa Barat.</p>",
    batal ? `<p>Bila tidak ingin diingatkan lagi, <a href="${escapeHtml(batal)}">batalkan pengingat</a>.</p>` : "",
  ].join("\n");
  const subject = `Pengingat kegiatan: ${row.judul}`;
  return {
    subject,
    text: teks,
    html,
    params: { judul: row.judul, subjek: subject, waktu, tempat: row.lokasi ?? null, metode: row.metode },
  };
}
