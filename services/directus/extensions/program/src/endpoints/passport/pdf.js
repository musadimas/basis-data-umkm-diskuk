import { ProgramError, noStore, rows, sendError } from "../../lib/utils/http.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { pastikanUsaha } = cakupan;
import { loadLegalitas, loadUsahaSummary } from "../../lib/usaha.js";
import { uuidParam } from "../../lib/validate.js";
import dokumen from "../../../../../analytics-shared/dokumen.cjs";
import { qrModul } from "../../lib/qr.js";
import { NAIK_KELAS_AMBANG, talentIndexOf } from "./service.js";

const { renderDokumen, publicUrl } = dokumen;

async function resolveUsahaId(database, req, pemanggil) {
  let id = req.query?.usaha || req.params?.id || req.query?.id;
  if (!id && pemanggil?.peran === "umkm" && pemanggil?.usahaId) {
    id = pemanggil.usahaId;
  }
  if (!id) {
    throw new ProgramError(400, "USAHA_ID_REQUIRED", "Parameter 'usaha' diperlukan.");
  }
  const usahaId = uuidParam(id, "INVALID_USAHA_ID");
  await pastikanUsaha(database, pemanggil, usahaId);
  const usaha = await loadUsahaSummary(database, usahaId);
  return { pemanggil, usaha };
}

/**
 * GET /v1/program/passport/pdf/summary?usaha=...
 * Generates Executive Summary & Business Scorecard (PDF).
 */
export const exportSummaryPdf =
  ({ database, env, logger }) =>
  (req, res, pemanggil) =>
    (async () => {
      const { usaha } = await resolveUsahaId(database, req, pemanggil);
      const legalitas = await loadLegalitas(database, usaha.id);
      const passportRow = rows(
        await database.raw(
          `SELECT * FROM talent_passport WHERE usaha = ? AND status = 'aktif' ORDER BY diterbitkan_at DESC LIMIT 1`,
          [usaha.id],
        ),
      )[0];

      const baseUrl = publicUrl(env);
      // Tanpa passport aktif tidak ada QR maupun tautan `/passport/DRAFT` (B27): semua baris
      // verifikasi menyebut "Belum diterbitkan".
      const kode = passportRow?.kode || null;
      const verifikasiUrl = kode ? `${baseUrl}/passport/${kode}` : null;
      const skor = passportRow
        ? {
            finansial: Number(passportRow.skor_finansial) || 0,
            pasar: Number(passportRow.skor_pasar) || 0,
            legalitas: Number(passportRow.skor_legalitas) || 0,
            sdm: Number(passportRow.skor_sdm) || 0,
            kinerja: Number(passportRow.skor_kinerja) || 0,
            // Talent Index = rata-rata 4 pilar Scouting; kinerja program tidak masuk (B27).
            total: talentIndexOf({
              finansial: passportRow.skor_finansial,
              pasar: passportRow.skor_pasar,
              legalitas: passportRow.skor_legalitas,
              sdm: passportRow.skor_sdm,
            }),
          }
        : { finansial: 0, pasar: 0, legalitas: 0, sdm: 0, kinerja: 0, total: 0 };

      const certNames = [
        ...new Set(legalitas.filter((l) => l.status === "terbit").map((l) => l.jenis.toUpperCase())),
      ];

      const dimensi = [
        { nama: "1. Finansial & Akuntansi", nilai: skor.finansial },
        { nama: "2. Pasar & Pemasaran", nilai: skor.pasar },
        { nama: "3. Legalitas & Kepatuhan", nilai: skor.legalitas },
        { nama: "4. SDM & Operasional", nilai: skor.sdm },
        { nama: "5. Kinerja Program (di luar Talent Index)", nilai: skor.kinerja },
      ];

      const bagian = [
        {
          judul: "Identitas Usaha",
          baris: [
            `Nama Usaha: ${usaha.nama}`,
            `NIB: ${usaha.nib || "-"}`,
            `Nama Pemilik: ${usaha.pemilik.nama} (NIK: ${usaha.pemilik.nikMasked})`,
            `Skala Usaha: ${usaha.skala || "Mikro"}`,
            `Kabupaten/Kota: ${usaha.kota || "-"}`,
            `KBLI 5 Digit: ${usaha.kodeKbli ? usaha.kodeKbli + " - " + (usaha.kegiatanUtama || "") : "-"}`,
            `Omzet Tahunan: ${usaha.omzetTahunan !== null ? "Rp " + Number(usaha.omzetTahunan).toLocaleString("id-ID") : "Belum dilaporkan"}`,
            `Tenaga Kerja: ${usaha.tenagaKerja} orang`,
          ],
        },
        {
          judul: "Status Akreditasi & Kepatuhan",
          baris: [
            `Status Talenta: ${usaha.talentStatus || "Belum ada"}${usaha.talentBatch ? " (Batch " + usaha.talentBatch + ")" : ""}`,
            `Lencana Akreditasi: ${passportRow?.status_badge || "Belum ada"}`,
            `Produk Dalam Negeri (PDN): ${usaha.pdnTerverifikasi ? "Terverifikasi Dinas (100% PDN)" : "Deklarasi mandiri"}`,
            `Sertifikasi Legalitas: ${certNames.length > 0 ? certNames.join(", ") : "Belum ada sertifikasi terbit"}`,
          ],
        },
        {
          judul: "Talent Index Score (4 Pilar) & Business Scorecard",
          baris: [
            ...dimensi.map((d) => {
              const bars = "#".repeat(Math.round(d.nilai / 10));
              return `${d.nama}: ${d.nilai}/100 [${bars.padEnd(10, "-")}]`;
            }),
            `Skor Rata-rata Talent Index (4 pilar): ${skor.total}/100`,
            `Rekomendasi Tingkat: ${skor.total >= NAIK_KELAS_AMBANG ? "Siap Naik Kelas" : "Pembinaan & Inkubasi Berkala"}`,
          ],
        },
        {
          judul: "Verifikasi Keaslian & Tanda Tangan Digital",
          baris: [
            `Kode Talent Passport: ${kode || "Belum diterbitkan"}`,
            `Status Passport: ${passportRow?.status || "Belum diterbitkan"}`,
            `Diterbitkan Pada: ${passportRow?.diterbitkan_at instanceof Date ? passportRow.diterbitkan_at.toISOString() : passportRow?.diterbitkan_at || "Belum diterbitkan"}`,
            `Sidik Jari Kunci (KID): ${passportRow?.kid || "-"}`,
            `Signature: ${passportRow?.signature ? passportRow.signature.slice(0, 32) + "..." : "-"}`,
            `Tautan Verifikasi: ${verifikasiUrl || "Belum diterbitkan"}`,
          ],
        },
      ];

      const pdf = renderDokumen({
        judul: "Executive Summary & Business Scorecard",
        subjudul: usaha.nama,
        bagian,
        qr: verifikasiUrl ? { modul: qrModul(verifikasiUrl), ukuran: 100 } : null,
        meta: { generatedAt: new Date().toISOString().slice(0, 10) },
      });

      noStore(res);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="executive-summary-${kode || "draft"}.pdf"`,
      );
      res.end(pdf);
    })().catch((error) => sendError(res, logger, error));

/**
 * GET /v1/program/passport/pdf/katalog?usaha=...
 * Generates Katalog Ekspor Resmi (PDF).
 */
export const exportKatalogPdf =
  ({ database, env, logger }) =>
  (req, res, pemanggil) =>
    (async () => {
      const { usaha } = await resolveUsahaId(database, req, pemanggil);
      const passportRow = rows(
        await database.raw(
          `SELECT * FROM talent_passport WHERE usaha = ? AND status = 'aktif' ORDER BY diterbitkan_at DESC LIMIT 1`,
          [usaha.id],
        ),
      )[0];

      const produkList = rows(
        await database.raw(
          `SELECT * FROM produk WHERE usaha = ? AND status_kurasi IN ('tayang', 'rekomendasi_marketplace') ORDER BY date_created DESC`,
          [usaha.id],
        ),
      );

      const baseUrl = publicUrl(env);
      // Tanpa passport aktif: status "Belum diterbitkan" dan tanpa QR ke `/passport/DRAFT` (B27).
      const kode = passportRow?.kode || null;
      const verifikasiUrl = kode ? `${baseUrl}/passport/${kode}` : null;

      const bagian = [
        {
          judul: "Identitas Pelaku Usaha & Ekspor",
          baris: [
            `Nama Usaha: ${usaha.nama}`,
            `NIB: ${usaha.nib || "-"}`,
            `Pemilik: ${usaha.pemilik.nama}`,
            `Wilayah: ${usaha.kota || "-"}`,
            `KBLI: ${usaha.kodeKbli ? usaha.kodeKbli + " - " + (usaha.kegiatanUtama || "") : "-"}`,
            `Status Passport: ${passportRow ? `${passportRow.status} (${kode})` : "Belum diterbitkan"}`,
          ],
        },
      ];

      if (produkList.length > 0) {
        for (const p of produkList) {
          bagian.push({
            judul: `Produk: ${p.nama}`,
            baris: [
              `Kategori: ${p.kategori ? p.kategori.toUpperCase() : "-"}`,
              `Deskripsi: ${p.deskripsi || "-"}`,
              `Harga Retail: ${p.harga_retail ? "Rp " + Number(p.harga_retail).toLocaleString("id-ID") : "-"}`,
              `Harga Grosir/Ekspor: ${p.harga_grosir ? "Rp " + Number(p.harga_grosir).toLocaleString("id-ID") : "-"} (Min. Order: ${p.moq || 1})`,
              `Bahan Baku: ${p.bahan_baku || "-"} (Kandungan Lokal: ${p.persen_bahan_lokal ?? p.tkdn_persen ?? "-"}%)`,
              `Spesifikasi: Dimensi ${p.dimensi || "-"} · Berat ${p.berat || "-"} · Masa Simpan ${p.shelf_life || "-"}`,
              `Status Kurasi: ${p.status_kurasi === "rekomendasi_marketplace" ? "Rekomendasi Marketplace Global" : "Tayang Terverifikasi"}`,
            ],
          });
        }
      } else {
        bagian.push({
          judul: "Daftar Produk Ekspor",
          baris: ["Belum ada produk tayang di katalog ekspor."],
        });
      }

      bagian.push({
        judul: "Verifikasi Katalog Resmi",
        baris: [
          `Dokumen ini merupakan portofolio resmi binaan DISKUK Jawa Barat.`,
          `Kode Verifikasi: ${kode || "Belum diterbitkan"}`,
          `Tautan Verifikasi Katalog: ${verifikasiUrl || "Belum diterbitkan"}`,
        ],
      });

      const pdf = renderDokumen({
        judul: "Katalog Ekspor Resmi",
        subjudul: `Produk Unggulan - ${usaha.nama}`,
        bagian,
        qr: verifikasiUrl ? { modul: qrModul(verifikasiUrl), ukuran: 100 } : null,
        meta: { generatedAt: new Date().toISOString().slice(0, 10) },
      });

      noStore(res);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="katalog-ekspor-${kode || "draft"}.pdf"`,
      );
      res.end(pdf);
    })().catch((error) => sendError(res, logger, error));
