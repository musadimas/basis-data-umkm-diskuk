type RequestErrorPayload = {
  name?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function isRequestError<E>(error: E): error is E & RequestErrorPayload {
  return error !== null && typeof error === "object";
}

function isErrorNumber<T>(value: T): value is T & number {
  return typeof value === "number";
}

export function requestStatus<E>(error: E): number | undefined {
  if (!isRequestError(error)) return undefined;
  if (isErrorNumber(error.status)) return error.status;
  return isErrorNumber(error.statusCode) ? error.statusCode : undefined;
}

export function isUnauthorized<E>(error: E): boolean {
  return requestStatus(error) === 401;
}

export function isAbortError<E>(error: E): boolean {
  return isRequestError(error) && error.name === "AbortError";
}
