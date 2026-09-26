import { customEndpoint, withOptions } from "@directus/sdk";

type EndpointQuery = Record<string, string | number | boolean | null | undefined>;

export interface EndpointOptions<TBody> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: EndpointQuery;
  body?: TBody;
  signal?: AbortSignal;
}

/**
 * SDK command for a custom Directus extension endpoint, e.g.
 * `directus.request(endpoint<TabularOptions>("/v1/analytics/tabular/options"))`.
 * The SDK unwraps the response's top-level `data`, so extension responses keep
 * everything (including `meta`) inside `data`.
 */
export function endpoint<TOutput, TBody = never>(path: string, options: EndpointOptions<TBody> = {}) {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null) params[key] = value;
  }
  const command = customEndpoint<TOutput>({
    path,
    method: options.method ?? "GET",
    params,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return options.signal ? withOptions(command, { signal: options.signal }) : command;
}

/**
 * SDK command for a server-issued `/panel/...` URL, such as a signed export download link.
 * Non-JSON responses (e.g. `text/csv`) come back from the SDK as the raw `Response`.
 */
export function endpointFromPanelUrl<TOutput>(url: string) {
  const parsed = new URL(url, "http://panel.invalid");
  const path = parsed.pathname.replace(/^\/panel(?=\/)/, "");
  return endpoint<TOutput>(path, { query: Object.fromEntries(parsed.searchParams) });
}

/** Extension payload as the SDK returns it: the response `data` with `meta` inside. */
export type Enveloped<T extends { meta: object; data: object }> = T["data"] & { meta: T["meta"] };

/** Maps an SDK-unwrapped `{ ...data, meta }` payload back to the `{ meta, data }` view shape. */
export function fromEnvelope<T extends { meta: object; data: object }>(payload: Enveloped<T>): T {
  const { meta, ...data } = payload;
  // SAFETY: `payload` is `T["data"] & { meta: T["meta"] }`; removing `meta` leaves exactly `T["data"]`.
  return { meta, data } as T;
}
