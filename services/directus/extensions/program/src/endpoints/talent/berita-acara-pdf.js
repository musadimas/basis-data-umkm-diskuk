import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import { uuidParam } from "../../lib/validate.js";
import { jakartaDate } from "../kpi/rules.js";
import dokumen from "../../../../../analytics-shared/dokumen.cjs";

const { renderDokumen } = dokumen;

/** Nama berkas unduhan: ganti karakter di luar [A-Za-z0-9_-] dengan "-", rapatkan tepi, beri ekstensi. */
export function namaBerkasBa(nomor) {
  const bersih = String(nomor ?? "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${bersih || "berita-acara"}.pdf`;
}

/** Tanggal BA (kolom DATE dibaca sebagai teks "YYYY-MM-DD") diformat tetap di UTC agar tidak bergeser lintas zona waktu. */
export function tanggalBa(tanggal) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${tanggal}T00:00:00Z`),
  );
}

/** Talent Index satu desimal; nilai kosong tampil "-". */
function formatSkor(nilai) {
  return nilai === null || nilai === undefined ? "-" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(nilai));
}

/** Model dokumen Berita Acara (dipisah dari `renderDokumen` supaya isinya dapat diuji tanpa PDF). */
export function modelBeritaAcara(ba, items) {
  return {
    judul: "Berita Acara Kurasi Talent Scouting",
    subjudul: `Nomor ${ba.nomor}`,
    bagian: [
      {
        judul: "Keterangan",
        baris: [
          `Nomor: ${ba.nomor}`,
          `Tanggal: ${tanggalBa(ba.tanggal)}`,
          `Disetujui oleh: ${ba.penyetuju || "-"}`,
          `Jumlah usaha: ${items.length}`,
          `Catatan: ${ba.catatan || "-"}`,
        ],
      },
      {
        judul: "Daftar usaha yang masuk Talent Pool",
        baris: items.length
          ? items.map(
              (r, i) =>
                `${i + 1}. ${r.nama} - NIB ${r.nib || "-"} - ${r.kota_nama || "-"} - Talent Index ${formatSkor(r.skor_total)}`,
            )
          : ["Tidak ada pengajuan yang terhubung."],
      },
      {
        judul: "Keterangan penilaian",
        baris: [
          "Usaha di atas disetujui masuk Talent Pool berdasarkan kurasi Talent Scouting Dinas Koperasi dan Usaha Kecil Provinsi Jawa Barat.",
          ...(items.some((r) => r.rubrik_versi === "placeholder-v0")
            ? ["Skor dihitung dengan rubrik sementara (placeholder-v0); rubrik resmi DISKUK belum tersedia."]
            : []),
        ],
      },
    ],
    meta: { generatedAt: jakartaDate(), sumber: "Kurasi Talent Scouting" },
    qr: null,
  };
}

/** GET /berita-acara/:id/pdf — BUG-011: PDF Berita Acara dibangkitkan saat diminta, tidak disimpan ke `berkas`. */
export const exportBeritaAcaraPdf =
  ({ database, logger }) =>
  (req, res) =>
    (async () => {
      const id = uuidParam(req.params?.id);
      const ba = rows(
        await database.raw(
          `SELECT b.id, b.nomor, to_char(b.tanggal, 'YYYY-MM-DD') AS tanggal, b.catatan,
                  NULLIF(BTRIM(CONCAT_WS(' ', du.first_name, du.last_name)), '') AS penyetuju
             FROM talent_berita_acara b
             LEFT JOIN directus_users du ON du.id = b.disetujui_oleh
            WHERE b.id = ?`,
          [id],
        ),
      )[0];
      if (!ba) throw new ProgramError(404, "BERITA_ACARA_NOT_FOUND", "The Berita Acara was not found.");
      const items = rows(
        await database.raw(
          `SELECT u.nama, u.nib, t.kota_nama, p.skor_total, p.rubrik_versi
             FROM talent_pengajuan p
             JOIN usaha u ON u.id = p.usaha
             LEFT JOIN usaha_tabular t ON t.id = p.usaha
            WHERE p.berita_acara = ?
            ORDER BY u.nama`,
          [id],
        ),
      );
      const pdf = renderDokumen(modelBeritaAcara(ba, items));
      noStore(res);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${namaBerkasBa(ba.nomor)}"`);
      res.end(pdf);
    })().catch((error) => sendError(res, logger, error));
