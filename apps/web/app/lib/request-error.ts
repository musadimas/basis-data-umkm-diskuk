type DirectusErrorItem = { message?: string; extensions?: { code?: string } };

/**
 * Error shapes this app can see: the Directus SDK's `RequestError`
 * (`{ response: Response, errors: [...] }`) and ofetch/`useAsyncData` errors
 * (`{ status | statusCode, data: { errors: [...] } }`).
 */
type RequestErrorPayload = {
  name?: unknown;
  status?: unknown;
  statusCode?: unknown;
  response?: { status?: unknown } | null;
  errors?: DirectusErrorItem[];
  data?: { errors?: DirectusErrorItem[] } | null;
};

function isRequestError<E>(error: E): error is E & RequestErrorPayload {
  return error !== null && typeof error === "object";
}

function isErrorNumber<T>(value: T): value is T & number {
  return typeof value === "number";
}

function isErrorCode<T>(value: T): value is T & string {
  return typeof value === "string";
}

export function requestStatus<E>(error: E): number | undefined {
  if (!isRequestError(error)) return undefined;
  if (isErrorNumber(error.response?.status)) return error.response.status;
  if (isErrorNumber(error.status)) return error.status;
  return isErrorNumber(error.statusCode) ? error.statusCode : undefined;
}

export function isUnauthorized<E>(error: E): boolean {
  return requestStatus(error) === 401;
}

export function isAbortError<E>(error: E): boolean {
  return isRequestError(error) && error.name === "AbortError";
}

/** Directus error code (`errors[0].extensions.code`) from an SDK or ofetch error, if any. */
export function requestErrorCode<E>(error: E): string | undefined {
  if (!isRequestError(error)) return undefined;
  const code = error.errors?.[0]?.extensions?.code ?? error.data?.errors?.[0]?.extensions?.code;
  return isErrorCode(code) ? code : undefined;
}
