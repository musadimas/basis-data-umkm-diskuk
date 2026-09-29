import { describe, expect, it } from "vitest";
import { ALL_ROLES, ROLE_HOME, appRoleBadge, dashboardRedirect } from "../../app/constants/ROLES";

describe("dashboardRedirect", () => {
  it("lets every role open its own home", () => {
    for (const role of ALL_ROLES) expect(dashboardRedirect(role, ROLE_HOME[role])).toBeNull();
  });

  it("sends a role outside its routes back to its own home", () => {
    expect(dashboardRedirect("umkm", "/dashboard/tabular")).toBe("/dashboard/usaha");
  });

  it("sends an account without a valid role to sign-in instead of another dashboard route", () => {
    // A dashboard redirect here would be refused again by the same guard: an endless loop.
    for (const role of [null, undefined, "", "admin", "PROVINSI"]) {
      const target = dashboardRedirect(role, "/dashboard");
      expect(target).toBe("/sign-in?error=peran");
      expect(target?.startsWith("/dashboard")).toBe(false);
    }
  });
});

describe("appRoleBadge", () => {
  it("never shows an account without a role as Provinsi", () => {
    expect(appRoleBadge("kabkota").label).toBe("Kab/Kota");
    expect(appRoleBadge(null).label).toBe("Peran belum ditetapkan");
    expect(appRoleBadge("provinsi-palsu").label).toBe("Peran belum ditetapkan");
  });
});
