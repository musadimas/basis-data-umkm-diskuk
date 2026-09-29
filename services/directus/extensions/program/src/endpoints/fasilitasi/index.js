import { listFasilitasi, perbaruiTerisi } from "./service.js";
import cakupan from "../../../../../analytics-shared/cakupan.cjs";
const { publik, terjaga } = cakupan;
export default (router, ctx) => {
  router.get("/", publik(listFasilitasi)(ctx));
  // Kuota terisi dinaikkan lewat kurasi staf provinsi (tabel tanpa dimensi kota),
  // bukan lewat form permohonan publik yang belum diminta fase ini.
  router.patch("/:id/terisi", terjaga({ peran: ["provinsi"] }, perbaruiTerisi)(ctx));
};
