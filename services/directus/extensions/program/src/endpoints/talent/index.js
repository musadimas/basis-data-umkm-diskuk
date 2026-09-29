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
import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { terjaga } = cakupan;

// Talent Scouting (Brief Fitur Modul 4):
//   GET   /v1/program/talent/usaha/:usahaId           SIDT data (masked NIK), certificates, latest submission
//   GET   /v1/program/talent/pengajuan?status=         submissions for the curation panel
//   POST  /v1/program/talent/pengajuan                 open a submission
//   PATCH /v1/program/talent/pengajuan/:id             edit an open submission (clears its score)
//   POST  /v1/program/talent/pengajuan/:id/hitung-skor score on the server
//   POST  /v1/program/talent/pengajuan/:id/tolak       reject
//   GET   /v1/program/talent/berita-acara              issued Berita Acara
//   POST  /v1/program/talent/berita-acara              approve scored submissions into the talent pool
// Kandidat 01: gate peran di adapter (kelola = provinsi/kabkota, BA = provinsi
// saja); scope usaha di service via pastikanUsaha (404 seragam, K1).
const KELOLA = { peran: ["provinsi", "kabkota"] };
const TERBIT_BA = { peran: ["provinsi"] };

export default (router, context) => {
  router.get("/usaha/:usahaId", terjaga(KELOLA, readUsaha)(context));
  router.get("/pengajuan", terjaga(KELOLA, listPengajuan)(context));
  router.post("/pengajuan", terjaga(KELOLA, createPengajuan)(context));
  router.patch("/pengajuan/:id", terjaga(KELOLA, updatePengajuan)(context));
  router.post("/pengajuan/:id/hitung-skor", terjaga(KELOLA, scorePengajuan)(context));
  router.post("/pengajuan/:id/tolak", terjaga(KELOLA, rejectPengajuan)(context));
  router.get("/berita-acara", terjaga(KELOLA, listBeritaAcara)(context));
  router.post("/berita-acara", terjaga(TERBIT_BA, createBeritaAcara)(context));
};
