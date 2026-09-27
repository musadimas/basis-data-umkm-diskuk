import { describe, expect, it } from "vitest";
import { DEFAULT_KATALOG_FILTERS, hargaRange, katalogFilter, katalogSort, sertifikasiList, whatsappLink, youtubeEmbed } from "../../app/lib/katalog";

describe("katalogFilter", () => {
  it("is empty without active filters", () => {
    expect(katalogFilter(DEFAULT_KATALOG_FILTERS)).toEqual({});
  });

  it("combines sidebar filters with AND and matches whole certificate names", () => {
    expect(
      katalogFilter({
        ...DEFAULT_KATALOG_FILTERS,
        kategori: "makanan",
        kota: 7,
        skala: ["micro", "small"],
        talent: true,
        sertifikasi: ["halal", "pirt"],
        pdn: true,
        ramahDisabilitas: true,
      }),
    ).toEqual({
      _and: [
        { kategori: { _eq: "makanan" } },
        { usaha_kota: { _eq: 7 } },
        { usaha_skala: { _in: ["micro", "small"] } },
        { usaha_talent_status: { _in: ["talent_pool", "accelerator", "champion"] } },
        { usaha_sertifikasi: { _contains: ",halal," } },
        { usaha_sertifikasi: { _contains: ",pirt," } },
        { _or: [{ pdn_deklarasi: { _eq: true } }, { usaha_pdn: { _eq: true } }] },
        { usaha_ramah_disabilitas: { _eq: true } },
      ],
    });
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

  it("builds WhatsApp links in international form", () => {
    expect(whatsappLink("0812-3456-7890", "Halo")).toBe("https://wa.me/6281234567890?text=Halo");
    expect(whatsappLink("6281234567890", "a b")).toBe("https://wa.me/6281234567890?text=a%20b");
    expect(whatsappLink("123", "x")).toBeNull();
  });

  it("embeds only YouTube links, through youtube-nocookie", () => {
    expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(youtubeEmbed("https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
