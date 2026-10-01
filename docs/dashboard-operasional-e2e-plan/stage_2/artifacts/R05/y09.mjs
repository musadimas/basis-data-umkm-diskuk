import fs from "node:fs";
import { api, login, eq, rec, sql, USAHA, rows, BASE } from "./lib.mjs";
import { solveChallenge, pbkdf2 } from "/Users/fabhiantomaoludyo/development/basis-data-umkm-diskuk/services/directus/extensions/program/node_modules/.pnpm/altcha@3.2.3/node_modules/altcha/dist/lib/index.js";

const T = {};
for (const k of ["provinsi", "kabSubang", "kabSumedang", "pendamping", "pendamping2", "umkm1", "umkm2", "umkm6"]) T[k] = await login(k);
const uid = (email) => sql(`select id from directus_users where email='${email}'`);
const P1 = uid("dummy_coach.pendamping@jabarprov.go.id"), P2 = uid("r04_pendamping2@example.com");

async function captcha() {
  const c = await (await fetch(`${BASE}/v1/auth/captcha/challenge`)).json();
  const s = await solveChallenge({ challenge: c, deriveKey: pbkdf2.deriveKey });
  return Buffer.from(JSON.stringify({ challenge: { parameters: c.parameters, signature: c.signature }, solution: { counter: s.counter, derivedKey: s.derivedKey, time: s.time } })).toString("base64");
}
const dates = []; { const d = new Date(); d.setUTCDate(d.getUTCDate() + 8); while (dates.length < 12) { if (![0, 6].includes(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } }
let di = 0;
async function buat(token, over = {}, { withFile = false, cap } = {}) {
  const payload = { namaUsaha: "Usaha Manual Y49", namaKontak: "Kontak Y49", whatsapp: "081234567890", email: "kontak@example.com", poli: 1, deskripsi: "Deskripsi konsultasi Y49 yang cukup panjang.", moda: "daring", tanggal: dates[di], slot: "09:00", consent: true, ...over };
  const f = new FormData();
  f.append("payload", JSON.stringify(payload));
  f.append("captcha", cap ?? (await captcha()));
  if (withFile) f.append("lampiran", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], { type: "image/png" }), "bukti.png");
  return { r: await api(token, "POST", "/v1/program/klinik/tiket", f), payload };
}
const code = (r) => r.json?.errors?.[0]?.extensions?.code;

// ---- create tickets (public/session)
const made = {};
let x = await buat(T.umkm1, { poli: 1, tanggal: dates[0], whatsapp: "081111111111" }, { withFile: true });
eq("umkm1 (Subang, SIDT) books ticket with attachment", 201, x.r.status); made.s1 = x.r.json.data.nomor; eq("ticket bound to SIDT (sumberIdentitas)", "sidt", x.r.json.data.sumberIdentitas);
x = await buat(T.umkm6, { poli: 2, tanggal: dates[0], whatsapp: "081666666666" }); eq("umkm6 (Subang) books ticket", 201, x.r.status); made.s6 = x.r.json.data.nomor;
x = await buat(T.umkm2, { poli: 1, tanggal: dates[1], whatsapp: "082222222222" }, { withFile: true }); eq("umkm2 (Sumedang) books ticket with attachment", 201, x.r.status); made.m2 = x.r.json.data.nomor;
x = await buat(T.umkm2, { poli: 3, tanggal: dates[1], whatsapp: "082222222222" }); eq("umkm2 second ticket", 201, x.r.status); made.m2b = x.r.json.data.nomor;
x = await buat(null, { poli: 10, tanggal: dates[2], whatsapp: "083333333333", namaUsaha: "Warung Anonim Y49" }); eq("anonymous books ticket (manual identity)", 201, x.r.status); made.anon = x.r.json.data.nomor;
eq("anonymous ticket sumberIdentitas manual", "manual", x.r.json?.data?.sumberIdentitas);
// captcha + slot
const cap = await captcha();
x = await buat(null, { tanggal: dates[3], poli: 1 }, { cap }); eq("captcha first use", 201, x.r.status);
x = await buat(null, { tanggal: dates[4], poli: 1 }, { cap }); eq("captcha replay -> 400 CAPTCHA_INVALID", "400 CAPTCHA_INVALID", `${x.r.status} ${code(x.r)}`);
x = await buat(null, { tanggal: dates[4], poli: 1 }, { cap: "garbage" }); eq("captcha garbage -> 400", 400, x.r.status);
const race = await Promise.all([buat(null, { tanggal: dates[5], poli: 1, slot: "13:00" }), buat(null, { tanggal: dates[5], poli: 1, slot: "13:00" })]);
eq("same slot race -> 201 + 409 SLOT_PENUH", "201,409", race.map((z) => z.r.status).sort().join(","));
eq("SQL: one active ticket in that slot", 1, sql(`select count(*) from konsultasi_tiket where poli=1 and jadwal_tanggal='${dates[5]}' and jadwal_slot='13:00' and status<>'batal'`));
x = await buat(null, { tanggal: "2020-01-01" }); eq("past date -> 400 TANGGAL_DI_LUAR_RENTANG", "400 TANGGAL_DI_LUAR_RENTANG", `${x.r.status} ${code(x.r)}`);
const sat = new Date(); while (sat.getUTCDay() !== 6 || sat.getTime() < Date.now() + 86400e3 * 2) sat.setUTCDate(sat.getUTCDate() + 1);
x = await buat(null, { tanggal: sat.toISOString().slice(0, 10) }); eq("weekend -> 400 TANGGAL_AKHIR_PEKAN", "400 TANGGAL_AKHIR_PEKAN", `${x.r.status} ${code(x.r)}`);
x = await buat(null, { tanggal: dates[6], deskripsi: "pendek" }); eq("short description -> 400", 400, x.r.status);
x = await buat(null, { tanggal: dates[6], usaha: USAHA(6), namaUsaha: "Rename" });
eq("anonymous body.usaha is ignored (stays manual, no SIDT link)", "manual|", x.r.status === 201 ? sql(`select sumber_identitas||'|'||coalesce(usaha::text,'') from konsultasi_tiket where nomor='${x.r.json.data.nomor}'`) : `status ${x.r.status}`);

// ---- kanban scope
const dbCount = (cond) => Number(sql(`select count(*) from konsultasi_tiket t left join usaha_tabular ut on ut.id=t.usaha where t.status<>'batal' and ${cond}`));
const list = async (who, q = "") => api(T[who], "GET", `/v1/program/klinik/tiket${q}`);
let l = await list("provinsi");
eq("provinsi kanban == all non-batal tickets (SQL)", dbCount("true"), l.json?.data?.length);
l = await list("kabSubang");
eq("kabkota Subang kanban == SQL (usaha in kota 1)", dbCount("ut.kota_id=1"), l.json?.data?.length);
eq("kabkota Subang sees no Sumedang / manual ticket", false, [made.m2, made.m2b, made.anon].some((n) => JSON.stringify(l.json).includes(n)));
eq("kabkota Subang sees umkm1+umkm6 tickets", true, [made.s1, made.s6].every((n) => JSON.stringify(l.json).includes(n)));
l = await list("kabSumedang");
eq("kabkota Sumedang kanban == SQL (kota 2)", dbCount("ut.kota_id=2"), l.json?.data?.length);
eq("kabkota Sumedang sees only its two", true, [made.m2, made.m2b].every((n) => JSON.stringify(l.json).includes(n)) && !JSON.stringify(l.json).includes(made.s1));
l = await list("pendamping");
eq("pendamping kanban == assigned to self + unassigned pool (SQL)", dbCount(`(t.pendamping='${P1}' or t.pendamping is null)`), l.json?.data?.length);
l = await list("umkm1"); eq("umkm kanban -> 403", 403, l.status);
l = await api(null, "GET", "/v1/program/klinik/tiket"); eq("anonymous kanban -> 401", 401, l.status);
l = await list("provinsi", "?status=bogus"); eq("bogus status filter -> 400", 400, l.status);
sql(`update directus_users set kota_scope=null where email='r04_kab.sumedang@example.com'`);
l = await list("kabSumedang"); eq("kabkota without kota_scope -> 403 KOTA_NOT_ASSIGNED", "403 KOTA_NOT_ASSIGNED", `${l.status} ${code(l)}`);
sql(`update directus_users set kota_scope=2 where email='r04_kab.sumedang@example.com'`);
const tk = async (nomor) => { const r = await list("provinsi"); return r.json.data.find((t) => t.nomor === nomor); };
const tS1 = await tk(made.s1), tS6 = await tk(made.s6), tM2 = await tk(made.m2), tAnon = await tk(made.anon), tM2b = await tk(made.m2b);
const patch = (who, t, body, versi = t.versi) => api(who ? T[who] : null, "PATCH", `/v1/program/klinik/tiket/${t.id}`, { versi, ...body });
const ver = async (nomor) => sql(`select to_char(date_updated at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from konsultasi_tiket where nomor='${nomor}'`);

// ---- assignment authz
let r = await patch("kabSubang", tM2, { pendamping: P1 }); eq("kabkota Subang assigns Sumedang ticket -> 403", 403, r.status);
r = await patch("kabSubang", tAnon, { pendamping: P1 }); eq("kabkota assigns manual (no city) ticket -> 403", 403, r.status);
r = await patch("kabSumedang", tS1, { pendamping: P1 }); eq("kabkota Sumedang assigns Subang ticket -> 403", 403, r.status);
r = await patch("umkm1", tS1, { status: "batal" }); eq("umkm patches own ticket -> 403", 403, r.status);
r = await patch(null, tS1, { status: "batal" }); eq("anonymous patch -> 401", 401, r.status);
r = await patch("provinsi", { id: "00000000-0000-4000-8000-000000000000" }, { status: "batal" }, "2026-01-01T00:00:00.000000Z"); eq("patch unknown ticket -> 404", 404, r.status);
r = await patch("provinsi", { id: "x" }, { status: "batal" }); eq("patch bad id -> 400", 400, r.status);
r = await api(T.provinsi, "PATCH", `/v1/program/klinik/tiket/${tS1.id}`, { status: "dijadwalkan" }); eq("patch without versi -> 400 (optimistic lock is mandatory)", 400, r.status);
r = await patch("provinsi", tS1, { status: "dijadwalkan" }, "not-a-version"); eq("patch malformed versi -> 400", 400, r.status);
eq("no writes from refused calls: ticket s1 still masuk/unassigned", "masuk|", sql(`select status||'|'||coalesce(pendamping::text,'') from konsultasi_tiket where nomor='${made.s1}'`));
eq("no audit rows from refused calls", 0, sql(`select count(*) from konsultasi_tiket_audit a join konsultasi_tiket t on t.id=a.tiket where t.nomor in ('${made.s1}','${made.m2}')`));
// pendamping rules
r = await patch("pendamping", tS1, { status: "dijadwalkan" }); eq("pendamping non-claim write on unassigned pool ticket -> 403", 403, r.status);
r = await patch("pendamping", tS1, { pendamping: P2 }); eq("pendamping assigns pool ticket to a colleague -> 403", 403, r.status);
r = await patch("pendamping", tS1, { pendamping: P1 }); eq("pendamping claims pool ticket", 200, r.status);
eq("claim readback pendamping", P1, r.json?.data?.pendamping);
r = await patch("pendamping2", { ...tS1 }, { status: "dijadwalkan" }, await ver(made.s1)); eq("pendamping2 edits ticket assigned to pendamping -> 403", 403, r.status);
l = await list("pendamping2"); eq("pendamping2 kanban excludes pendamping's ticket", false, JSON.stringify(l.json).includes(made.s1));
// transitions + version
let v = await ver(made.s1);
r = await patch("pendamping", tS1, { status: "berjalan" }, v); eq("masuk -> berjalan skips stage -> 409 TRANSISI_TIDAK_VALID", "409 TRANSISI_TIDAK_VALID", `${r.status} ${code(r)}`);
r = await patch("pendamping", tS1, { status: "selesai" }, v); eq("masuk -> selesai -> 409", 409, r.status);
r = await patch("pendamping", tS1, { status: "dijadwalkan", linkMeet: "http://insecure" }, v); eq("http link -> 400", 400, r.status);
r = await patch("pendamping", tS1, { status: "dijadwalkan", linkMeet: "https://meet.example.com/y49" }, v); eq("masuk -> dijadwalkan (+link)", 200, r.status);
const staleV = v; v = await ver(made.s1);
r = await patch("pendamping", tS1, { status: "berjalan" }, staleV); eq("STALE versi -> 409 TIKET_BERUBAH", "409 TIKET_BERUBAH", `${r.status} ${code(r)}`);
eq("stale write not applied", "dijadwalkan", sql(`select status from konsultasi_tiket where nomor='${made.s1}'`));
// concurrent same-version race
const raceP = await Promise.all([patch("pendamping", tS1, { status: "berjalan" }, v), patch("provinsi", tS1, { status: "berjalan" }, v)]);
eq("two officers same versi race -> 200 + 409 TIKET_BERUBAH", "200,409", raceP.map((z) => z.status).sort().join(","));
v = await ver(made.s1);
r = await patch("pendamping", tS1, { status: "berjalan", catatan: "no-op status" }, v); eq("same-status write is allowed (not a transition)", 200, r.status);
v = await ver(made.s1);
for (const st of ["tindak_lanjut", "selesai"]) { r = await patch("provinsi", tS1, { status: st, diagnosis: st === "tindak_lanjut" ? { legalitas: "NIB belum ada" } : undefined, rujukan: st === "tindak_lanjut" ? ["sarpras", "vokasi"] : undefined }, v); eq(`-> ${st}`, 200, r.status); v = await ver(made.s1); }
r = await patch("provinsi", tS1, { status: "dijadwalkan" }, v); eq("selesai -> dijadwalkan -> 409", 409, r.status);
r = await patch("provinsi", tS1, { status: "batal" }, v); eq("selesai -> batal -> 409 (closed is terminal)", 409, r.status);
// cancel + reopen on another ticket, priority, kabkota own-city ops
r = await patch("kabSubang", tS6, { pendamping: P2, prioritas: "tinggi" }); eq("kabkota Subang assigns own-city ticket + prioritas", 200, r.status);
v = await ver(made.s6);
r = await patch("kabSubang", tS6, { status: "dijadwalkan" }, v); eq("kabkota own-city transition", 200, r.status);
v = await ver(made.s6);
r = await patch("kabSubang", tS6, { status: "batal" }, v); eq("dijadwalkan -> batal", 200, r.status);
l = await list("provinsi"); eq("batal hidden from default kanban", false, JSON.stringify(l.json).includes(made.s6));
l = await list("provinsi", "?status=batal"); eq("?status=batal shows it", true, JSON.stringify(l.json).includes(made.s6));
v = await ver(made.s6);
r = await patch("kabSubang", tS6, { status: "dijadwalkan" }, v); eq("batal -> dijadwalkan reopen", 200, r.status);
// PMSE urgent flag
v = await ver(made.anon);
r = await patch("provinsi", tAnon, { prioritas: "mendesak" }, v); eq("advokasi + mendesak sets pmseMendesak", true, r.json?.data?.pmseMendesak);
r = await patch("provinsi", tM2b, { prioritas: "mendesak" }); eq("non-advokasi mendesak: pmseMendesak false", false, r.json?.data?.pmseMendesak);

// ---- audit readback
const aud = (nomor) => sql(`select string_agg(a.aksi||':'||coalesce(a.status_dari,'')||'>'||coalesce(a.status_ke,'')||':'||(a.aktor is not null)||':'||coalesce(a.aktor_nama,'-'),' ; ' order by a.date_created,a.id) from konsultasi_tiket_audit a join konsultasi_tiket t on t.id=a.tiket where t.nomor='${nomor}'`);
console.log("AUDIT s1:", aud(made.s1)); console.log("AUDIT s6:", aud(made.s6)); console.log("AUDIT anon:", aud(made.anon));
const a1 = aud(made.s1);
eq("audit s1 has claim(penugasan), 4 transitions in order, catatan rows", true,
  /penugasan.*transisi:masuk>dijadwalkan.*transisi:dijadwalkan>berjalan.*transisi:berjalan>tindak_lanjut.*transisi:tindak_lanjut>selesai/.test(a1));
eq("audit s1: exactly 4 transition rows (stale/refused/no-op not recorded)", 4, sql(`select count(*) from konsultasi_tiket_audit a join konsultasi_tiket t on t.id=a.tiket where t.nomor='${made.s1}' and aksi='transisi'`));
eq("audit rows all carry actor id", 0, sql(`select count(*) from konsultasi_tiket_audit where aktor is null and tiket in (select id from konsultasi_tiket where nomor in ('${made.s1}','${made.s6}','${made.anon}'))`));
eq("audit s6 records batal and reopen", true, /dijadwalkan>batal/.test(aud(made.s6)) && /batal>dijadwalkan/.test(aud(made.s6)));
const panel = await tk(made.s1); eq("API riwayat (kanban DTO) == audit rows (<=20)", Number(sql(`select count(*) from konsultasi_tiket_audit a join konsultasi_tiket t on t.id=a.tiket where t.nomor='${made.s1}'`)), panel.riwayat.length);
eq("kanban DTO carries no whatsapp-provider secrets (keys)", false, /token|secret/i.test(JSON.stringify(panel)));
const grants = sql(`select count(*) from directus_permissions where collection like 'konsultasi_tiket%' `);
console.log("directus_permissions rows on konsultasi_tiket*:", grants);

// ---- attachment scope
const fileId = sql(`select directus_files_id from konsultasi_tiket_lampiran l join konsultasi_tiket t on t.id=l.konsultasi_tiket_id where t.nomor='${made.s1}'`);
const fileM2 = sql(`select directus_files_id from konsultasi_tiket_lampiran l join konsultasi_tiket t on t.id=l.konsultasi_tiket_id where t.nomor='${made.m2}'`);
const att = async (who, id) => (await api(who ? T[who] : null, "GET", `/v1/program/klinik/lampiran/${id}`)).status;
eq("attachment: owner umkm1 reads own", 200, await att("umkm1", fileId));
eq("attachment: kabkota Subang reads own-city", 200, await att("kabSubang", fileId));
eq("attachment: provinsi reads", 200, await att("provinsi", fileId));
eq("attachment IDOR: kabkota Sumedang -> 404", 404, await att("kabSumedang", fileId));
eq("attachment IDOR: other owner umkm2 -> 404", 404, await att("umkm2", fileId));
eq("attachment IDOR: umkm6 (same city, other owner) -> 404", 404, await att("umkm6", fileId));
eq("attachment: anonymous -> 401", 401, await att(null, fileId));
eq("attachment: Sumedang ticket file readable by its kabkota", 200, await att("kabSumedang", fileM2));
eq("attachment: Subang kabkota cannot read Sumedang file -> 404", 404, await att("kabSubang", fileM2));
const direct = await api(null, "GET", `/assets/${fileId}`); eq("attachment via public /assets -> not 200", true, direct.status !== 200);
const directU = await api(T.umkm2, "GET", `/assets/${fileId}`); eq("attachment via /assets as other umkm -> not 200", true, directU.status !== 200);

// ---- PII in public / tracking endpoints
const track = async (nomor, wa, cap) => api(null, "POST", "/v1/program/klinik/tiket/lacak", { nomor, whatsapp: wa, captcha: cap ?? (await captcha()) });
let tr = await track(made.s1, "081111111111");
eq("track with number+matching WA -> 200", 200, tr.status);
console.log("TRACK KEYS", Object.keys(tr.json?.data ?? {}).join(","));
const leak = ["081111111111", "6281111111111", "kontak@example.com", "Deskripsi konsultasi", "Kontak Y49", P1, "meet.example.com", "NIB belum ada", "sarpras"].filter((s) => tr.text.includes(s));
eq("tracking response leaks no phone/email/description/contact/assignee/diagnosis", "", leak.join(","));
tr = await track(made.s1, "089999999999"); eq("track wrong WA -> 404 (same as unknown)", 404, tr.status);
const t404 = await track("KLN-2026-09-9999", "081111111111"); eq("track unknown number -> 404 identical body", tr.text, t404.text);
tr = await track(made.s1, "081111111111", "bad"); eq("track without valid captcha -> 400", 400, tr.status);
tr = await track(made.anon, "083333333333"); eq("anonymous ticket trackable by its owner WA", 200, tr.status);
tr = await track(made.s1, "0811-1111-1111"); eq("WA normalisation (dashes) accepted", 200, tr.status);
const pol = await api(null, "GET", "/v1/program/klinik/poli"); eq("public /poli 200, 6 desks", "200 6", `${pol.status} ${pol.json?.data?.length}`);
const slt = await api(null, "GET", `/v1/program/klinik/slot?poli=1&tanggal=${dates[0]}`); eq("public /slot 200", 200, slt.status);
eq("public /slot exposes only slot+tersedia", "slot,tersedia", Object.keys(slt.json.data[0]).join(","));
for (const path of ["/items/konsultasi_tiket", "/items/konsultasi_tiket_audit", "/items/konsultasi_tiket_lampiran", "/items/notifikasi_outbox", "/items/klinik_notifikasi", "/items/directus_users"]) {
  const a = await api(null, "GET", path); const u = await api(T.umkm1, "GET", path);
  rec(`direct Directus items ${path}: anonymous + umkm cannot read rows`, "no rows", `anon ${a.status}/${(a.json?.data?.length ?? "-")}, umkm ${u.status}/${(u.json?.data?.length ?? "-")}`, (!a.json?.data?.length) && (!u.json?.data?.length));
}
// WA: outbox state (no provider)
console.log("OUTBOX", sql(`select n.status||'/'||n.jenis||'/'||coalesce(n.last_error,'-') from notifikasi_outbox n join konsultasi_tiket t on t.id=n.tiket where t.nomor='${made.s1}' order by n.date_created`).replace(/\n/g, " | "));
const outboxRow = await tk(made.s1);
console.log("NOTIF label", JSON.stringify(outboxRow.notifikasi));
eq("no message claimed as terkirim without a provider", 0, sql(`select count(*) from notifikasi_outbox n join konsultasi_tiket t on t.id=n.tiket where n.status in ('terkirim','diterima') and t.nomor in ('${made.s1}','${made.s6}','${made.m2}')`));

fs.writeFileSync(new URL("./y09-made.json", import.meta.url), JSON.stringify(made));
fs.writeFileSync(new URL("./y09-results.json", import.meta.url), JSON.stringify(rows, null, 2));
console.log(`\n${rows.filter((z) => z.ok).length}/${rows.length} pass`);
