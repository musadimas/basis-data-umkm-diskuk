import crypto from "node:crypto";
import { api, login, eq, rec, sql, USAHA, rows, BASE } from "./lib.mjs";
import fs from "node:fs";

const KURASI = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f11";
const KATALOG = "6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const T = {};
for (const k of ["provinsi", "kabSubang", "kabSumedang", "umkm1", "umkm2", "umkm6"]) T[k] = await login(k);

async function upload(token, folder = KURASI, name = "y49.png", type = "image/png", bytes = PNG) {
  const f = new FormData();
  f.append("folder", folder);
  f.append("file", new Blob([bytes], { type }), name);
  return api(token, "POST", "/files", f);
}

// ---- A. product submit -> curate -> passport
const foto6 = await upload(T.umkm6);
eq("umkm6 uploads photo to Katalog Kurasi (directus /files)", 200, foto6.status);
const fotoId = foto6.json?.data?.id;
const anonPre = await api(null, "GET", `/assets/${fotoId}`);
rec("anonymous /assets of pre-curation photo denied", "401/403", anonPre.status, [401, 403].includes(anonPre.status));
const foto1 = await upload(T.umkm1); // owner 1's photo
const foto1Id = foto1.json?.data?.id;

const produkBody = { nama: "Madu Hutan Y49", deskripsi: "Madu hutan murni", kategori: "makanan", hargaRetail: 55000, moq: 10, foto: [fotoId], ujiLab: "Lab Y49 2026", persenBahanLokal: 100, pdnDeklarasi: true };
let r = await api(T.umkm6, "POST", "/v1/program/katalog/produk", { ...produkBody, usaha: USAHA(6) });
eq("umkm6 POST produk (own business)", 201, r.status);
const produkId = r.json?.data?.id;
eq("new product status_kurasi = menunggu", "menunggu", r.json?.data?.statusKurasi ?? r.json?.data?.status_kurasi);
console.log(JSON.stringify(r.json).slice(0, 300));
// IDOR: umkm1 tries to attach umkm6's photo, umkm1 tries to create product for usaha 6
r = await api(T.umkm1, "POST", "/v1/program/katalog/produk", { ...produkBody, usaha: USAHA(1), foto: [fotoId] });
eq("umkm1 references umkm6's photo -> 403", 403, r.status);
r = await api(T.umkm1, "POST", "/v1/program/katalog/produk", { ...produkBody, usaha: USAHA(6), foto: [foto1Id] });
rec("umkm1 creates product for usaha 6 -> refused (403/404), or forced to own usaha", "403/404 or not usaha 6", `${r.status} usaha=${r.json?.data?.usaha}`, [403, 404].includes(r.status) || (r.status === 201 && r.json?.data?.usaha !== USAHA(6)));
if (r.status === 201) console.log("NOTE umkm1 create ignored body.usaha ->", r.json?.data?.usaha);
r = await api(T.umkm1, "PATCH", `/v1/program/katalog/produk/${produkId}`, { ...produkBody, nama: "hijack", foto: [] });
rec("umkm1 PATCH umkm6's product -> 403/404", "403/404", r.status, [403, 404].includes(r.status));
r = await api(T.umkm2, "GET", `/v1/program/katalog/produk?usaha=${USAHA(6)}`);
rec("umkm2 lists usaha 6 products -> 403/404", "403/404", r.status, [403, 404].includes(r.status));
r = await api(T.umkm6, "GET", `/v1/program/katalog/kurasi`);
eq("umkm6 GET /kurasi (curator only) -> 403", 403, r.status);
r = await api(T.kabSubang, "GET", `/v1/program/katalog/kurasi`);
eq("kabkota GET /kurasi -> 403", 403, r.status);
r = await api(T.umkm6, "POST", `/v1/program/katalog/produk/${produkId}/kurasi`, { keputusan: "tayang" });
eq("umkm6 self-approves -> 403", 403, r.status);
r = await api(T.umkm1, "GET", `/v1/program/katalog/foto/${fotoId}`);
eq("umkm1 reads umkm6 pre-curation photo via proxy -> 403/404", true, [403, 404].includes(r.status));
r = await api(T.provinsi, "GET", `/v1/program/katalog/foto/${fotoId}`);
eq("curator reads pre-curation photo via proxy", 200, r.status);
eq("proxy content-type image/png", "image/png", r.headers.get("content-type"));
r = await api(T.provinsi, "GET", `/v1/program/katalog/kurasi?status=menunggu`);
eq("curator queue lists product", true, JSON.stringify(r.json).includes(produkId));
r = await api(T.provinsi, "POST", `/v1/program/katalog/produk/${produkId}/kurasi`, { keputusan: "ditolak" });
eq("reject without note -> 400 CATATAN_WAJIB", "400 CATATAN_WAJIB", `${r.status} ${r.json?.errors?.[0]?.extensions?.code}`);
r = await api(T.provinsi, "POST", `/v1/program/katalog/produk/${produkId}/kurasi`, { keputusan: "ditolak", catatan: "foto kurang jelas (probe)" });
eq("curator rejects with note", 200, r.status);
eq("SQL readback after reject", "ditolak|foto kurang jelas (probe)", sql(`select status_kurasi||'|'||catatan_kurasi from produk where id='${produkId}'`));
eq("photo folder after reject stays curation", KURASI, sql(`select f.folder from produk_foto pf join directus_files f on f.id=pf.directus_files_id where pf.produk_id='${produkId}'`));
r = await api(T.provinsi, "POST", `/v1/program/katalog/produk/${produkId}/kurasi`, { keputusan: "tayang" });
eq("curator approves (tayang)", 200, r.status);
eq("SQL readback approved + curator", "tayang|true", sql(`select status_kurasi||'|'||(dikurasi_oleh is not null) from produk where id='${produkId}'`));
eq("photo moved to public catalogue folder", KATALOG, sql(`select f.folder from produk_foto pf join directus_files f on f.id=pf.directus_files_id where pf.produk_id='${produkId}'`));
const anonPost = await api(null, "GET", `/assets/${fotoId}`);
eq("anonymous /assets after approval", 200, anonPost.status);
const pub = await api(null, "GET", `/items/produk?filter[id][_eq]=${produkId}&fields=id,nama,status_kurasi`);
eq("public catalogue lists the approved product", true, JSON.stringify(pub.json).includes(produkId));

// ---- B. passport
r = await api(T.umkm6, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
eq("umkm6 reads own passport state (eligible)", "200 true", `${r.status} ${r.json?.data?.eligible}`);
r = await api(T.umkm1, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
rec("IDOR umkm1 (other owner, same city) reads usaha 6 passport", "403/404", r.status, [403, 404].includes(r.status));
r = await api(T.umkm2, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
rec("IDOR umkm2 (other city) reads usaha 6 passport", "403/404", r.status, [403, 404].includes(r.status));
r = await api(T.kabSumedang, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
rec("IDOR kabkota Sumedang reads Subang usaha passport", "403/404", r.status, [403, 404].includes(r.status));
r = await api(T.kabSubang, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
eq("kabkota Subang reads own-city passport state", 200, r.status);
r = await api(null, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
eq("anonymous reads passport state -> 401", 401, r.status);
for (const [who, code] of [["umkm6", 403], ["kabSubang", 403], ["kabSumedang", 403], [null, 401]]) {
  r = await api(who ? T[who] : null, "POST", `/v1/program/passport`, { usaha: USAHA(6) });
  eq(`${who ?? "anonymous"} issues passport -> ${code}`, code, r.status);
}
eq("no passport rows created by refused calls", 0, sql(`select count(*) from talent_passport`));
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(1) });
eq("issue for non-talent usaha 1 -> 409 PASSPORT_BELUM_MEMENUHI", "409 PASSPORT_BELUM_MEMENUHI", `${r.status} ${r.json?.errors?.[0]?.extensions?.code}`);
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(5) });
eq("issue for champion usaha 5 with only 'dinilai' pengajuan -> 409", 409, r.status);
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: "not-a-uuid" });
eq("issue invalid usaha id -> 400", 400, r.status);
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(6) });
eq("provinsi issues passport", 201, r.status);
const pp = r.json?.data;
const kode = pp?.kode;
console.log("kode", kode, "kid", pp?.kid, "sig len", sql(`select length(signature) from talent_passport where kode='${kode}'`));
eq("qrTalentPassportCode === kode", kode, pp?.qrTalentPassportCode);
eq("SQL: 1 active passport for usaha 6", 1, sql(`select count(*) from talent_passport where usaha='${USAHA(6)}' and status='aktif'`));

// public verify
let v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("public verify (anonymous) valid", "200 true aktif", `${v.status} ${v.json?.data?.valid} ${v.json?.data?.status}`);
eq("verify returns qrTalentPassportCode = kode", kode, v.json?.data?.qrTalentPassportCode);
eq("verify includes public key kid", pp.kid, v.json?.data?.publicKey?.kid);
eq("verify portfolio contains approved product", true, JSON.stringify(v.json?.data?.portfolio).includes(produkId));
const badgeKeys = (v.json?.data?.passport?.badges ?? []).map((b) => `${b.key}:${b.terverifikasi}`);
console.log("badges", badgeKeys.join(","));
const lower = await api(null, "GET", `/v1/program/passport/verify/${kode.toLowerCase()}`);
eq("verify lowercase code normalised", true, lower.json?.data?.valid);
const pii = JSON.stringify(v.json);
const piiHits = [/\b\d{16}\b/, /@/, /\+?62\d{8,}/, /\b08\d{8,}\b/, /nik|telepon|whatsapp|omzet/i].filter((re) => re.test(pii));
rec("PII scan of public verify body (16-digit, e-mail, phone, nik/omzet keys)", "no hits", `${piiHits.length} hits`, piiHits.length === 0);
// independent verification with published JWK
const canon = (x) => Array.isArray(x) ? `[${x.map(canon).join(",")}]` : x && typeof x === "object" ? `{${Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(x[k])}`).join(",")}}` : JSON.stringify(x);
const rowDb = JSON.parse(sql(`select row_to_json(t) from (select kode,payload,payload_hash,signature from talent_passport where kode='${kode}') t`));
const hash = crypto.createHash("sha256").update(canon(v.json.data.passport)).digest("hex");
eq("third-party recomputed payload hash == stored payload_hash", rowDb.payload_hash, hash);
const pub2 = crypto.createPublicKey({ key: v.json.data.publicKey.jwk, format: "jwk" });
eq("third-party Ed25519 verify with published JWK", true, crypto.verify(null, Buffer.from(`${kode}.${hash}`), pub2, Buffer.from(rowDb.signature, "base64url")));
eq("third-party verify fails for altered message", false, crypto.verify(null, Buffer.from(`${kode}.${hash.replace(/^./, "0")}`), pub2, Buffer.from(rowDb.signature, "base64url")));
// unknown / malformed
for (const bad of ["TPZZZZZZZZZZ", "TP123", "../../etc/passwd", "TP0000000000"]) {
  const b = await api(null, "GET", `/v1/program/passport/verify/${encodeURIComponent(bad)}`);
  eq(`verify unknown/malformed '${bad}' -> 404`, 404, b.status);
}

// tamper 1: payload one value changed
sql(`update talent_passport set payload = jsonb_set(payload,'{skor,finansial}','99') where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("TAMPER payload (skor.finansial=99) -> valid:false tidak_valid", "false tidak_valid", `${v.json?.data?.valid} ${v.json?.data?.status}`);
eq("tampered verify leaks no payload", false, "passport" in (v.json?.data ?? {}));
// restore payload exactly
sql(`update talent_passport set payload = '${JSON.stringify(rowDb.payload).replace(/'/g, "''")}'::jsonb where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("payload restored -> valid again", true, v.json?.data?.valid);
// tamper 2: payload + hash recomputed by attacker (no private key) -> signature fails
const forged = { ...rowDb.payload, skor: { ...rowDb.payload.skor, finansial: 99 } };
const forgedHash = crypto.createHash("sha256").update(canon(forged)).digest("hex");
sql(`update talent_passport set payload='${JSON.stringify(forged)}'::jsonb, payload_hash='${forgedHash}' where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("TAMPER payload+hash recomputed (no key) -> signature fails", "false tidak_valid", `${v.json?.data?.valid} ${v.json?.data?.status}`);
sql(`update talent_passport set payload='${JSON.stringify(rowDb.payload).replace(/'/g, "''")}'::jsonb, payload_hash='${rowDb.payload_hash}' where kode='${kode}'`);
// tamper 3: signature flipped
const badSig = (rowDb.signature[0] === "A" ? "B" : "A") + rowDb.signature.slice(1);
sql(`update talent_passport set signature='${badSig}' where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("TAMPER signature first char -> tidak_valid", "false tidak_valid", `${v.json?.data?.valid} ${v.json?.data?.status}`);
sql(`update talent_passport set signature='${rowDb.signature}' where kode='${kode}'`);
// tamper 4: kid swapped
sql(`update talent_passport set kid='deadbeefdeadbeef' where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("TAMPER kid -> tidak_valid", "false tidak_valid", `${v.json?.data?.valid} ${v.json?.data?.status}`);
sql(`update talent_passport set kid='${pp.kid}' where kode='${kode}'`);
// signature borrowed from another passport is exercised in re-issue below
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("all restored -> valid", true, v.json?.data?.valid);

// concurrency on issue
const par = await Promise.all(Array.from({ length: 6 }, () => api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(6) })));
console.log("parallel issue statuses", par.map((p) => p.status).join(","));
eq("6 parallel issues all 201 (serialised by usaha row lock)", "201,201,201,201,201,201", par.map((p) => p.status).join(","));
eq("SQL: exactly 1 active passport after race", 1, sql(`select count(*) from talent_passport where usaha='${USAHA(6)}' and status='aktif'`));
eq("SQL: 7 rows total (1 original + 6), 6 revoked", "7|6", sql(`select count(*)||'|'||count(*) filter (where status='dicabut') from talent_passport where usaha='${USAHA(6)}'`));
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("old passport (superseded by re-issue) -> dicabut", "false dicabut", `${v.json?.data?.valid} ${v.json?.data?.status}`);
const activeRow = JSON.parse(sql(`select row_to_json(t) from (select id,kode from talent_passport where usaha='${USAHA(6)}' and status='aktif') t`));
// signature-transplant: put active passport's signature on the (revoked) old code... verify uses old kode message -> invalid
const sigActive = sql(`select signature from talent_passport where id='${activeRow.id}'`);
sql(`update talent_passport set signature='${sigActive}' where kode='${kode}'`);
v = await api(null, "GET", `/v1/program/passport/verify/${kode}`);
eq("signature transplanted from another passport -> tidak_valid (not just dicabut)", "false tidak_valid", `${v.json?.data?.valid} ${v.json?.data?.status}`);
sql(`update talent_passport set signature='${rowDb.signature}' where kode='${kode}'`);

// revoke
r = await api(T.umkm6, "POST", `/v1/program/passport/${activeRow.id}/cabut`, {});
eq("umkm6 revoke -> 403", 403, r.status);
r = await api(T.kabSubang, "POST", `/v1/program/passport/${activeRow.id}/cabut`, {});
eq("kabkota revoke -> 403", 403, r.status);
r = await api(null, "POST", `/v1/program/passport/${activeRow.id}/cabut`, {});
eq("anonymous revoke -> 401", 401, r.status);
r = await api(T.provinsi, "POST", `/v1/program/passport/00000000-0000-4000-8000-000000000000/cabut`, {});
eq("revoke unknown id -> 404", 404, r.status);
r = await api(T.provinsi, "POST", `/v1/program/passport/${activeRow.id}/cabut`, {});
eq("provinsi revokes active passport", 200, r.status);
r = await api(T.provinsi, "POST", `/v1/program/passport/${activeRow.id}/cabut`, {});
eq("second revoke -> 404", 404, r.status);
v = await api(null, "GET", `/v1/program/passport/verify/${activeRow.kode}`);
eq("verify after revoke -> valid:false dicabut + dicabutAt", "false dicabut true", `${v.json?.data?.valid} ${v.json?.data?.status} ${Boolean(v.json?.data?.dicabutAt)}`);
r = await api(T.umkm6, "GET", `/v1/program/passport?usaha=${USAHA(6)}`);
eq("owner state after revoke: no active passport", "null", String(r.json?.data?.passport));
// re-issue after revoke, leave one valid passport for the browser run
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(6) });
eq("re-issue after revoke -> 201", 201, r.status);

// badge honesty: PDN flag flip by dinas -> verified badge; declaration badge disappears
sql(`update usaha set pdn_terverifikasi=true where id='${USAHA(6)}'`);
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(6) });
const bk = (r.json?.data?.payload?.badges ?? []).map((b) => `${b.key}:${b.terverifikasi}`).join(",");
eq("pdn_terverifikasi=true + re-issue -> badge pdn:true (no pdn_deklarasi)", "pdn:true", bk);
sql(`update usaha set pdn_terverifikasi=false where id='${USAHA(6)}'`);
r = await api(T.provinsi, "POST", `/v1/program/passport`, { usaha: USAHA(6) });
const bk2 = (r.json?.data?.payload?.badges ?? []).map((b) => `${b.key}:${b.terverifikasi}`).join(",");
eq("pdn flag off + re-issue -> only declaration badge, terverifikasi:false", "pdn_deklarasi:false", bk2);
console.log("FINAL_KODE", r.json?.data?.kode);
fs.writeFileSync(new URL("./y04-final.json", import.meta.url), JSON.stringify({ kode: r.json?.data?.kode, produkId, fotoId }));
fs.writeFileSync(new URL("./y04-results.json", import.meta.url), JSON.stringify(rows, null, 2));
console.log(`\n${rows.filter((x) => x.ok).length}/${rows.length} pass`);
