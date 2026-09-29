export interface RiskItem {
  pesertaId: string;
  usahaId: string;
  nama: string;
  kota: string | null;
  pendampingId: string | null;
  pendamping: string | null;
  mingguAkhir: number;
  latitude: number | null;
  longitude: number | null;
}

export interface ExecutiveMonitoring {
  kepatuhan: { terverifikasi: number; diharapkan: number; persen: number | null; targetLebihDari: number };
  kenaikanOmzet: { persen: number | null; pesertaDihitung: number; sumber: string };
  tren: Array<{ minggu: number; target: number; realisasi: number | null }>;
  atRisk: RiskItem[];
}

export interface InvestorItem {
  id: string;
  nama: string;
  jenama: string;
  domisili: string | null;
  kbli: string | null;
  kebutuhanModal: number;
  skema: string[];
}

export interface InvestorDeal extends InvestorItem {
  talentIndex: number | null;
  talentIndexSumber: string | null;
  pertumbuhanOmzetMingguan: number | null;
  pertumbuhanSumber: string | null;
  marginPersen: number | null;
  marginSumber: "deklarasi" | "terverifikasi";
  kapasitasPasok: string | null;
  produkId: string | null;
  pitchDeckTersedia: boolean;
}
