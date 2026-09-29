import { describe, expect, it } from "vitest";
import {
  ALL_ROLES,
  APP_ROLE_BADGES,
  DATA_ROLES,
  ROLE_HOME,
  ROLE_ROUTES,
  hasRouteAccess,
  isRoleKey,
  lockedKotaId,
} from "../../app/constants/ROLES";
import { ATRIBUT_JABAR } from "../../app/constants/OPERASIONAL";
import { NAVIGATION_LINKS } from "../../app/constants/NAVIGATION";

describe("matriks role Y01", () => {
  it("empat role fungsional dengan badge berbeda", () => {
    expect([...ALL_ROLES]).toEqual(["provinsi", "kabkota", "pendamping", "umkm"]);
    expect(APP_ROLE_BADGES.provinsi.label).toBe("Provinsi");
    expect(new Set(Object.values(APP_ROLE_BADGES).map((badge) => badge.className)).size).toBe(4);
  });

  it("akses route: talent scouting tertutup untuk pendamping/umkm", () => {
    expect(hasRouteAccess("provinsi", "/dashboard/talent/kurasi")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/talent/ajukan/123")).toBe(true);
    expect(hasRouteAccess("pendamping", "/dashboard/talent/kurasi")).toBe(false);
    expect(hasRouteAccess("umkm", "/dashboard/talent/kurasi")).toBe(false);
    expect(hasRouteAccess("kabkota", "/dashboard/data-lapangan/abc")).toBe(true);
    expect(hasRouteAccess(null, "/dashboard")).toBe(false);
  });
});

describe("konstanta operasional Y02", () => {
  it("15 atribut Jabar dengan key unik", () => {
    expect(ATRIBUT_JABAR).toHaveLength(15);
    expect(new Set(ATRIBUT_JABAR.map((a) => a.key)).size).toBe(15);
    expect(ATRIBUT_JABAR.map((a) => a.key)).toContain("qris");
  });

  it("route talent scouting untuk peran data", () => {
    expect(DATA_ROLES).toEqual(["provinsi", "kabkota"]);
    expect(ROLE_ROUTES.provinsi).toContain("/dashboard/talent");
    expect(ROLE_ROUTES.kabkota).toContain("/dashboard/talent");
  });
});

describe("matriks hasRouteAccess Y01", () => {
  it("provinsi mengakses dashboard data, bukan beranda role lain", () => {
    expect(hasRouteAccess("provinsi", "/dashboard")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/analitik")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/tabular")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/spasial")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/umkm/11111111-1111-4111-8111-000000000001")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/akun")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/pendampingan")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/katalog/kurasi")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/klinik")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/usaha/passport")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/usaha")).toBe(false);
  });

  it("kabkota mengakses dashboard data final (phase 3)", () => {
    expect(hasRouteAccess("kabkota", "/dashboard")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/analitik")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/tabular")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/spasial")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/umkm")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/akun")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/pendampingan")).toBe(true);
    // Server: kab/kota adalah petugas klinik untuk tiket usaha di kotanya.
    expect(hasRouteAccess("kabkota", "/dashboard/klinik")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/katalog/kurasi")).toBe(false);
    expect(hasRouteAccess("kabkota", "/dashboard/usaha")).toBe(false);
  });

  it("pendamping hanya pendampingan + klinik + akun", () => {
    expect(hasRouteAccess("pendamping", "/dashboard/pendampingan")).toBe(true);
    expect(hasRouteAccess("pendamping", "/dashboard/pendampingan/123")).toBe(true);
    expect(hasRouteAccess("pendamping", "/dashboard/klinik")).toBe(true);
    expect(hasRouteAccess("pendamping", "/dashboard/akun")).toBe(true);
    expect(hasRouteAccess("pendamping", "/dashboard")).toBe(false);
    expect(hasRouteAccess("pendamping", "/dashboard/analitik")).toBe(false);
    expect(hasRouteAccess("pendamping", "/dashboard/tabular")).toBe(false);
  });

  it("umkm hanya modul usaha + klinik + akun", () => {
    expect(hasRouteAccess("umkm", "/dashboard/usaha")).toBe(true);
    expect(hasRouteAccess("umkm", "/dashboard/usaha/produk")).toBe(true);
    expect(hasRouteAccess("umkm", "/dashboard/usaha/passport")).toBe(true);
    expect(hasRouteAccess("umkm", "/dashboard/klinik")).toBe(true);
    expect(hasRouteAccess("umkm", "/dashboard/akun")).toBe(true);
    expect(hasRouteAccess("umkm", "/dashboard")).toBe(false);
    expect(hasRouteAccess("umkm", "/dashboard/analitik")).toBe(false);
    expect(hasRouteAccess("umkm", "/dashboard/pendampingan")).toBe(false);
  });

  it("entri /dashboard hanya cocok persis dan tidak menelan sub-path mirip", () => {
    expect(hasRouteAccess("provinsi", "/dashboard/analitik")).toBe(true);
    expect(hasRouteAccess("provinsi", "/dashboard/analitikx")).toBe(false);
    expect(hasRouteAccess("kabkota", "/dashboard/spasialx")).toBe(false);
    expect(hasRouteAccess("pendamping", "/dashboardx")).toBe(false);
  });

  it("role tidak dikenal atau null ditolak", () => {
    expect(hasRouteAccess("mandor", "/dashboard")).toBe(false);
    expect(hasRouteAccess(null, "/dashboard")).toBe(false);
    expect(hasRouteAccess(undefined, "/dashboard")).toBe(false);
  });

  it("beranda setiap role diizinkan untuk role itu sendiri", () => {
    for (const role of ALL_ROLES) {
      expect(hasRouteAccess(role, ROLE_HOME[role])).toBe(true);
    }
  });

  it("kabkota adalah petugas klinik seperti di server (B16)", () => {
    expect(hasRouteAccess("kabkota", "/dashboard/klinik")).toBe(true);
    expect(hasRouteAccess("kabkota", "/dashboard/klinik/abc")).toBe(true);
  });

  it("setiap menu sidebar lolos penjaga rutenya untuk semua peran (B16)", () => {
    for (const role of ALL_ROLES) {
      for (const section of NAVIGATION_LINKS[role]) {
        for (const item of section.items) {
          expect(hasRouteAccess(role, item.to)).toBe(true);
        }
      }
    }
  });
});

describe("konstanta role Y01", () => {
  it("route program akselerasi + usaha", () => {
    expect(ROLE_ROUTES.provinsi).toContain("/dashboard/pendampingan");
    expect(ROLE_ROUTES.umkm).toContain("/dashboard/usaha");
  });
  it("warna badge solid M1-03 per role", () => {
    expect(APP_ROLE_BADGES).toEqual({
      provinsi: { label: "Provinsi", className: "bg-blue-900 text-white" },
      kabkota: { label: "Kab/Kota", className: "bg-sky-300 text-sky-950" },
      pendamping: { label: "Pendamping", className: "bg-emerald-600 text-white" },
      umkm: { label: "UMKM", className: "bg-amber-400 text-amber-950" },
    });
  });

  it("ROLE_HOME memetakan empat role ke berandanya", () => {
    expect(ROLE_HOME).toEqual({
      provinsi: "/dashboard",
      kabkota: "/dashboard",
      pendamping: "/dashboard/pendampingan",
      umkm: "/dashboard/usaha",
    });
  });

  it("lockedKotaId hanya mengunci kabkota dengan kota", () => {
    // Bentuk kanonik pasca-merge: app_role + kota angka (useAuth.ts).
    expect(lockedKotaId({ app_role: "kabkota", kota: 7 })).toBe("7");
    expect(lockedKotaId({ app_role: "kabkota", kota: "7" })).toBe("7");
    expect(lockedKotaId({ app_role: "kabkota", kota: { id: 7 } })).toBe("7");
    expect(lockedKotaId({ app_role: "kabkota", kota: null })).toBe(null);
    expect(lockedKotaId({ app_role: "kabkota" })).toBe(null);
    expect(lockedKotaId({ app_role: "provinsi", kota: 7 })).toBe(null);
    expect(lockedKotaId({ app_role: "umkm", kota: 7 })).toBe(null);
    expect(lockedKotaId(null)).toBe(null);
    // Kompatibilitas lama: role kunci + kota objek (E2E pra-merge).
    expect(lockedKotaId({ role: "kabkota", kota: { id: 7 } })).toBe("7");
    expect(lockedKotaId({ role: "provinsi", kota: { id: 7 } })).toBe(null);
  });

  it("isRoleKey mengenali empat role", () => {
    expect(isRoleKey("provinsi")).toBe(true);
    expect(isRoleKey("kabkota")).toBe(true);
    expect(isRoleKey("pendamping")).toBe(true);
    expect(isRoleKey("umkm")).toBe(true);
    expect(isRoleKey("mandor")).toBe(false);
    expect(isRoleKey("")).toBe(false);
    expect(isRoleKey(null)).toBe(false);
    expect(isRoleKey(undefined)).toBe(false);
  });
});
