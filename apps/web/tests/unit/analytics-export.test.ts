import { describe, expect, it } from "vitest";
import { exportRequestBody } from "~/lib/analytics-export";
import { defaultAnalysis } from "~/lib/analytics-query";

describe("export request body (B26)", () => {
  it("sends the filled title with surrounding spaces removed", () => {
    const body = exportRequestBody("aggregate_pdf", defaultAnalysis, {
      title: "  Laporan Triwulan III  ",
    });
    expect(body).toEqual({
      exportType: "aggregate_pdf",
      config: defaultAnalysis,
      title: "Laporan Triwulan III",
    });
  });

  it("omits the title when empty and the profileId when not requested", () => {
    const body = exportRequestBody("aggregate_png", defaultAnalysis);
    expect("title" in body).toBe(false);
    expect("profileId" in body).toBe(false);
    expect(
      exportRequestBody("aggregate_png", defaultAnalysis, { title: "   " }).title,
    ).toBeUndefined();
  });

  it("sends the profileId for a business profile export", () => {
    const body = exportRequestBody("profile_pdf", defaultAnalysis, {
      profileId: "11111111-1111-4111-8111-000000000001",
    });
    expect(body.profileId).toBe("11111111-1111-4111-8111-000000000001");
  });
});
