import { describe, expect, it } from "vitest"
import { formatAnalyticsCurrency, formatAnalyticsNumber, formatAnalyticsPercent, formatAnalyticsWib } from "~/lib/analytics-format"
describe("analytics formatting",()=>{it("uses Indonesian numbers",()=>{expect(formatAnalyticsNumber(1234567)).toBe("1.234.567");expect(formatAnalyticsPercent(12.34)).toBe("12,3%");expect(formatAnalyticsCurrency(1500000)).toContain("Rp")});it("uses fixed WIB independent of process timezone",()=>{expect(formatAnalyticsWib("2026-08-16T23:30:00Z")).toBe("17 Agustus 2026, 06.30 WIB")})})
