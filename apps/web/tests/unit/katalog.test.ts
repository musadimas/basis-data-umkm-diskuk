import { describe, expect, it } from "vitest";
import {
  BELUM_TERSEDIA,
  DEFAULT_KATALOG_FILTERS,
  KATALOG_CHIPS,
  KATALOG_MAX_LIMIT,
  KATALOG_TALENT,
  hargaRange,
  katalogFilter,
  katalogFiltersFromQuery,
  katalogQueryFromFilters,
  katalogSort,
  kontakPenjualan,
  sertifikasiList,
  specPdfUrl,
  teksAtauBelum,
  usahaLegalitas,
  whatsappLink,
  youtubeEmbed,
} from "../../app/lib/katalog";

describe("katalogFilter", () => {
  it("is empty without active filters", () => {
    expect(katalogFilter(DEFAULT_KATALOG_FILTERS)).toEqual({});
  });

  it("turns a quick chip into one kategori _in clause", () => {
    expect(katalogFilter({ ...DEFAULT_KATALOG_FILTERS, kategori: "kuliner" })).toEqual({
      _and: [{ kategori: { _in: ["makanan", "minuman"] } }],
    });
    expect(katalogFilter({ ...DEFAULT_KATALOG_FILTERS, kategori: "fesyen" })).toEqual({
      _and: [{ kategori: { _in: ["fashion"] } }],
    });
  });

  it("searches product name, business name and KBLI on the server", () => {
    expect(katalogFilter({ ...DEFAULT_KATALOG_FILTERS, q: "  keripik " })).toEqual({
      _and: [
        {
          _or: [
            { nama: { _icontains: "keripik" } },
            { usaha_nama: { _icontains: "keripik" } },
            { kbli: { _contains: "keripik" } },
          ],
        },
      ],
    });
  });

  it("caps the keyword length so a shared URL cannot send an unbounded query", () => {
    // SAFETY: uji ini membaca bentuk filter yang dibangun `katalogFilter` untuk pencarian teks.
    const filter = katalogFilter({ ...DEFAULT_KATALOG_FILTERS, q: "x".repeat(200) }) as { _and: { _or: { nama: { _icontains: string } }[] }[] };
    expect(filter._and[0]._or[0].nama._icontains).toHaveLength(80);
  });

  it("combines every dimension with AND and matches whole certificate names", () => {
    expect(
      katalogFilter({
        ...DEFAULT_KATALOG_FILTERS,
        q: "10794",
        kategori: "kerajinan",
        kota: 7,
        skala: ["micro", "small"],
        talent: ["champion", "talent_pool"],
        sertifikasi: ["halal", "pirt"],
        pdn: true,
        ramahDisabilitas: true,
      }),
    ).toEqual({
      _and: [
        { _or: [{ nama: { _icontains: "10794" } }, { usaha_nama: { _icontains: "10794" } }, { kbli: { _contains: "10794" } }] },
        { kategori: { _in: ["kerajinan"] } },
        { usaha_kota: { _eq: 7 } },
        { usaha_skala: { _in: ["micro", "small"] } },
        { usaha_talent_status: { _in: ["champion", "talent_pool"] } },
        { usaha_sertifikasi: { _contains: ",halal," } },
        { usaha_sertifikasi: { _contains: ",pirt," } },
        { _or: [{ pdn_deklarasi: { _eq: true } }, { usaha_pdn: { _eq: true } }] },
        { usaha_ramah_disabilitas: { _eq: true } },
      ],
    });
  });
});

describe("shareable URL state", () => {
  it("round-trips the active filters", () => {
    const filters = {
      ...DEFAULT_KATALOG_FILTERS,
      q: "batik",
      kategori: "fesyen",
      kota: 9,
      skala: ["small"],
      talent: ["accelerator"],
      sertifikasi: ["hki" as const],
      pdn: true,
      ramahDisabilitas: true,
      sort: "harga-tinggi" as const,
    };
    const query = katalogQueryFromFilters(filters);
    expect(query).toEqual({
      q: "batik",
      kategori: "fesyen",
      kota: "9",
      skala: "small",
      talent: "accelerator",
      sertifikasi: "hki",
      pdn: "1",
      disabilitas: "1",
      sort: "harga-tinggi",
    });
    expect(katalogFiltersFromQuery(query)).toEqual(filters);
  });

  it("writes nothing for default values", () => {
    expect(katalogQueryFromFilters(DEFAULT_KATALOG_FILTERS)).toEqual({});
    expect(katalogFiltersFromQuery({})).toEqual(DEFAULT_KATALOG_FILTERS);
  });

  it("drops unknown or malformed query values", () => {
    expect(
      katalogFiltersFromQuery({
        kategori: "rahasia",
        kota: "bukan-angka",
        skala: "micro,raksasa",
        talent: "champion,dewa",
        sertifikasi: "halal,nik",
        sort: "drop-table",
        pdn: "yes",
      }),
    ).toEqual({
      ...DEFAULT_KATALOG_FILTERS,
      skala: ["micro"],
      talent: ["champion"],
      sertifikasi: ["halal"],
    });
  });

  it("keeps the five chips of the brief", () => {
    expect(KATALOG_CHIPS.map((chip) => chip.label)).toEqual([
      "Kuliner & Makanan Olahan",
      "Fesyen & Tekstil",
      "Kerajinan",
      "Kecantikan & Herbal",
      "Agribisnis",
    ]);
  });
});

describe("catalogue formatting", () => {
  it("sorts by price with newest as tie-breaker", () => {
    expect(katalogSort("harga-rendah")).toEqual(["harga_retail", "-date_created"]);
    expect(katalogSort("terbaru")).toEqual(["-date_created"]);
  });

  it("formats a price range from wholesale to retail", () => {
    expect(hargaRange({ harga_grosir: 12000, harga_retail: 15000 })).toBe("Rp12.000 – Rp15.000");
    expect(hargaRange({ harga_grosir: null, harga_retail: 15000 })).toBe("Rp15.000");
    expect(hargaRange({ harga_grosir: null, harga_retail: null })).toBeNull();
  });

  it("parses the stored certificate list", () => {
    expect(sertifikasiList(",halal,pirt,")).toEqual(["halal", "pirt"]);
    expect(sertifikasiList("")).toEqual([]);
  });

  it("reads the public legality copy of a product", () => {
    expect(usahaLegalitas([{ jenis: "halal", nomor: "ID3210000123456", berlakuHingga: null }])).toHaveLength(1);
    expect(usahaLegalitas('[{"jenis":"pirt","nomor":null,"berlakuHingga":null}]')).toEqual([{ jenis: "pirt", nomor: null, berlakuHingga: null }]);
    expect(usahaLegalitas("bukan-json")).toEqual([]);
    expect(usahaLegalitas(null)).toEqual([]);
  });

  it("says a missing field is missing instead of inventing one", () => {
    expect(teksAtauBelum(null)).toBe(BELUM_TERSEDIA);
    expect(teksAtauBelum("")).toBe(BELUM_TERSEDIA);
    expect(teksAtauBelum("250 g")).toBe("250 g");
  });

  it("builds WhatsApp links in international form", () => {
    expect(whatsappLink("0812-3456-7890", "Halo")).toBe("https://wa.me/6281234567890?text=Halo");
    expect(whatsappLink("6281234567890", "a b")).toBe("https://wa.me/6281234567890?text=a%20b");
    expect(whatsappLink("123", "x")).toBeNull();
  });

  it("creates no WhatsApp link before curation approves the contact", () => {
    const base = { usaha_whatsapp: "081234567890", status_kurasi: "tayang" as const };
    expect(kontakPenjualan(base, "Halo")).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(kontakPenjualan({ ...base, status_kurasi: "menunggu" }, "Halo")).toBeNull();
    expect(kontakPenjualan({ ...base, status_kurasi: "ditolak" }, "Halo")).toBeNull();
    expect(kontakPenjualan({ ...base, usaha_whatsapp: null }, "Halo")).toBeNull();
  });

  it("points the spec sheet at the public katalog PDF route", () => {
    expect(specPdfUrl("66666666-6666-4666-8666-000000000001")).toBe("/panel/v1/program/katalog/produk/66666666-6666-4666-8666-000000000001/pdf");
    expect(KATALOG_MAX_LIMIT).toBeGreaterThanOrEqual(24);
  });

  it("embeds only YouTube links, through youtube-nocookie", () => {
    expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbed("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("label talenta B38 (ikut rekomendasi K21: Talent Pool/Akselerator)", () => {
  it("memakai istilah server BADGE, bukan Talent Lab/Accelerator", () => {
    expect(KATALOG_TALENT.find((item) => item.value === "talent_pool")?.label).toBe("Talent Pool");
    expect(KATALOG_TALENT.find((item) => item.value === "accelerator")?.label).toBe("Akselerator");
  });
});
