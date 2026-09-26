import { routeGuard } from "../../lib/utils/http.js";
import {
  createBeritaAcara,
  createPengajuan,
  listBeritaAcara,
  listPengajuan,
  readUsaha,
  rejectPengajuan,
  scorePengajuan,
  updatePengajuan,
} from "./service.js";

// Talent Scouting (Brief Fitur Modul 4), all authenticated:
//   GET   /v1/program/talent/usaha/:usahaId           SIDT data (masked NIK), certificates, latest submission
//   GET   /v1/program/talent/pengajuan?status=         submissions for the curation panel
//   POST  /v1/program/talent/pengajuan                 open a submission
//   PATCH /v1/program/talent/pengajuan/:id             edit an open submission (clears its score)
//   POST  /v1/program/talent/pengajuan/:id/hitung-skor score on the server
//   POST  /v1/program/talent/pengajuan/:id/tolak       reject
//   GET   /v1/program/talent/berita-acara              issued Berita Acara
//   POST  /v1/program/talent/berita-acara              approve scored submissions into the talent pool
export default (router, context) => {
  const guarded = (handler) => (req, res, next) => routeGuard(req, next) && handler(context)(req, res);
  router.get("/usaha/:usahaId", guarded(readUsaha));
  router.get("/pengajuan", guarded(listPengajuan));
  router.post("/pengajuan", guarded(createPengajuan));
  router.patch("/pengajuan/:id", guarded(updatePengajuan));
  router.post("/pengajuan/:id/hitung-skor", guarded(scorePengajuan));
  router.post("/pengajuan/:id/tolak", guarded(rejectPengajuan));
  router.get("/berita-acara", guarded(listBeritaAcara));
  router.post("/berita-acara", guarded(createBeritaAcara));
};
