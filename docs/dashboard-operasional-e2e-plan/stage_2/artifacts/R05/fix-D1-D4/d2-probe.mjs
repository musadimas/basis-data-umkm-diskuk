// D2 probe on the disposable clone (r04-directus :8156): Friday rule for KPI reports over real HTTP.
import { randomUUID } from "node:crypto";
const B = "http://127.0.0.1:8156";
const login = await fetch(`${B}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dummy_wawan.leathercraft@gmail.com", password: "R04-uji-Pass#2026" }) }).then((r) => r.json());
const H = { authorization: `Bearer ${login.data.access_token}`, "content-type": "application/json" };
const peserta = (await fetch(`${B}/v1/program/kpi/peserta`, { headers: H }).then((r) => r.json())).data[0];
const detail = (await fetch(`${B}/v1/program/kpi/peserta/${peserta.id}`, { headers: H }).then((r) => r.json())).data;
const sudah = new Set(detail.laporan.map((l) => l.mingguKe));
const minggu = Number(process.env.MINGGU) || [...Array(peserta.mingguBerjalan).keys()].map((i) => i + 1).reverse().find((w) => !sudah.has(w));
const hari = (d) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "long" }).format(d);
let jumat = new Date(Date.now() - 60_000); while (hari(jumat) !== "Friday") jumat = new Date(jumat - 86_400_000);
console.log(`now=${new Date().toISOString()} (${hari(new Date())} WIB), peserta mingguBerjalan=${peserta.mingguBerjalan}, open week=${minggu}, laporan=${detail.laporan.length}`);
const kirim = async (label, patch) => {
  const body = { mingguKe: minggu, realisasiOmzet: 1_250_000, jumlahTransaksi: 12, kendala: null, bukti: [], clientUuid: randomUUID(), ...patch };
  const r = await fetch(`${B}/v1/program/kpi/peserta/${peserta.id}/laporan`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  console.log(`${label}: ${r.status} ${j.errors?.[0]?.extensions?.code ?? ""}${j.data ? ` id=${j.data.id} dibuatPadaKlien=${j.data.dibuatPadaKlien}` : ""}`);
  return { body, status: r.status, data: j.data };
};
const langsung = await kirim("direct send today", {});
await kirim("offline draft dated today (not Friday)", { dibuatPada: new Date().toISOString() });
await kirim("device clock 10 min ahead", { dibuatPada: new Date(Date.now() + 600_000).toISOString() });
await kirim("Friday 8 days ago", { dibuatPada: new Date(jumat.getTime() - 8 * 86_400_000).toISOString() });
const off = await kirim(`offline draft last Friday ${jumat.toISOString()}`, { dibuatPada: jumat.toISOString() });
const replay = await kirim("replay same clientUuid", { ...off.body });
await kirim("second new report same week", { dibuatPada: jumat.toISOString() });
console.log(JSON.stringify({ langsung: langsung.status, offline: off.status, replay: replay.status, sameId: replay.data?.id === off.data?.id, id: off.data?.id }));
