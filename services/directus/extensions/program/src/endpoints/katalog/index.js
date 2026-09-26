import { routeGuard } from "../../lib/utils/http.js";
import {
  createProduk,
  kurasiProduk,
  listKurasi,
  listLoi,
  listProdukUsaha,
  searchUsaha,
  submitLoi,
  updateProduk,
} from "./service.js";

// Katalog (Brief Fitur Modul 7.1). Public catalogue reads use the Directus Public policy
// (ADR-006); these routes cover writes, curation and the public letter-of-intent form:
//   GET   /v1/program/katalog/usaha?q=            businesses the caller may manage products for
//   GET   /v1/program/katalog/produk?usaha=       products of one business (any status)
//   POST  /v1/program/katalog/produk              create (waits for curation)
//   PATCH /v1/program/katalog/produk/:id          edit (back to curation)
//   GET   /v1/program/katalog/kurasi?status=      curation queue
//   POST  /v1/program/katalog/produk/:id/kurasi   publish / recommend / reject
//   GET   /v1/program/katalog/loi                 letters of intent
//   POST  /v1/program/katalog/loi                 PUBLIC, captcha: send a letter of intent
export default (router, context) => {
  const guarded = (handler) => (req, res, next) => routeGuard(req, next) && handler(context)(req, res);
  router.get("/usaha", guarded(searchUsaha));
  router.get("/produk", guarded(listProdukUsaha));
  router.post("/produk", guarded(createProduk));
  router.patch("/produk/:id", guarded(updateProduk));
  router.get("/kurasi", guarded(listKurasi));
  router.post("/produk/:id/kurasi", guarded(kurasiProduk));
  router.get("/loi", guarded(listLoi));
  router.post("/loi", submitLoi(context));
};
