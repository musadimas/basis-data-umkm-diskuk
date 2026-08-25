export function formatAnalyticsNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(value || 0));
}
export function formatAnalyticsPercent(value: number | null | undefined) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(Number(value || 0))}%`;
}
export function formatAnalyticsCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
export function formatAnalyticsMetricValue(
  value: number | null | undefined,
  unit: "usaha" | "IDR" = "usaha",
  compact = false,
) {
  if (unit !== "IDR") return formatAnalyticsNumber(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value || 0));
}
export function formatAnalyticsWib(value: string | Date | null | undefined) {
  if (!value) return "Belum tersedia";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum tersedia";
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(".", ":");
  return `${map.day} ${map.month} ${map.year}, ${time.replace(":", ".")} WIB`;
}
