import { noStore, sendError } from "../../lib/utils/http.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";
import { createKatalog } from "./service.js";

const { publik, terjaga } = cakupan;

// Katalog (Brief Fitur Modul 7.1). Public catalogue reads use the Directus Public policy
// (ADR-006); these routes cover writes, curation and the public letter-of-intent form:
//   GET   /v1/program/katalog/usaha?q=            businesses the caller may manage products for
//   GET   /v1/program/katalog/produk?usaha=       products of one business (any status)
//   POST  /v1/program/katalog/produk              create (waits for curation)
//   PATCH /v1/program/katalog/produk/:id          edit (back to curation)
//   GET   /v1/program/katalog/kurasi?status=      curation queue
//   POST  /v1/program/katalog/produk/:id/kurasi   publish / recommend / reject
//   GET   /v1/program/katalog/foto/:fileId        photo bytes (curator or owning business)
//   GET   /v1/program/katalog/produk/:id/pdf      PUBLIC spec sheet of a published product
//   GET   /v1/program/katalog/loi                 letters of intent (curator or owner)
//   PATCH /v1/program/katalog/loi/:id             curator marks follow-up (baru → ditindaklanjuti → ditutup)
//   POST  /v1/program/katalog/loi                 PUBLIC, captcha: send a letter of intent
// Kandidat 01: kelola = provinsi/umkm, kurasi = provinsi saja,
// lembar spesifikasi dan LOI publik lewat publik() (captcha tetap di use case).
const KELOLA = { peran: ["provinsi", "umkm"] };
const KURASI = { peran: ["provinsi"] };

export default (router, context) => {
  const { database, logger, services, getSchema } = context;
  const katalog = createKatalog({
    db: database,
    env: context.env,
    assets: {
      getAsset: async (fileId) => new services.AssetsService({ knex: database, schema: await getSchema() }).getAsset(fileId),
    },
  });
  // `terjaga`/`publik` memberi (req, res, pemanggil); kegagalan use case dipetakan sendError.
  const http = (aksi) => () => (req, res, pemanggil) => aksi(req, res, pemanggil).catch((error) => sendError(res, logger, error));
  const kirim = (res, data, status = 200) => {
    noStore(res);
    res.status(status).json({ data });
  };
  const jalur = (aturan, aksi) => terjaga(aturan, http(aksi))(context);
  const terbuka = (aksi) => publik(http(aksi))(context);

  router.get("/usaha", jalur(KELOLA, async (req, res, p) => kirim(res, await katalog.cariUsaha(p, req.query?.q))));
  router.get("/produk", jalur(KELOLA, async (req, res, p) => kirim(res, await katalog.daftarProduk(p, req.query?.usaha))));
  router.post("/produk", jalur(KELOLA, async (req, res, p) => kirim(res, await katalog.buatProduk(p, req.body), 201)));
  router.patch("/produk/:id", jalur(KELOLA, async (req, res, p) => kirim(res, await katalog.editProduk(p, req.params?.id, req.body))));
  router.get("/kurasi", jalur(KURASI, async (req, res, p) => kirim(res, await katalog.daftarKurasi(p, req.query?.status))));
  router.post("/produk/:id/kurasi", jalur(KURASI, async (req, res, p) => kirim(res, await katalog.kurasiProduk(p, req.params?.id, req.body))));
  router.get(
    "/foto/:fileId",
    jalur(KELOLA, async (req, res, p) => {
      const foto = await katalog.fotoProduk(p, req.params?.fileId);
      noStore(res);
      res.setHeader("Content-Type", foto.contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      foto.stream.pipe(res);
    }),
  );
  router.get(
    "/produk/:id/pdf",
    terbuka(async (req, res) => {
      const { pdf, berkas } = await katalog.lembarSpesifikasi(req.params?.id);
      noStore(res);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${berkas}"`);
      res.end(pdf);
    }),
  );
  router.get("/loi", jalur(KELOLA, async (req, res, p) => kirim(res, await katalog.daftarLoi(p))));
  router.patch("/loi/:id", jalur(KURASI, async (req, res, p) => kirim(res, await katalog.ubahStatusLoi(p, req.params?.id, req.body))));
  router.post(
    "/loi",
    terbuka(async (req, res) => {
      const hasil = await katalog.kirimLoi(req.body, { ip: req.ip ?? req.socket?.remoteAddress ?? req.connection?.remoteAddress });
      kirim(res, hasil, hasil.duplikat ? 200 : 201);
    }),
  );
};
