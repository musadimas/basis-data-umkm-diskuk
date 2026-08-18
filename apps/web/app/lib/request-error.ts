type RequestErrorShape = {
  name?: unknown
  status?: unknown
  statusCode?: unknown
}

function asRequestError(error: unknown): RequestErrorShape | undefined {
  return typeof error === "object" && error !== null ? error as RequestErrorShape : undefined
}

export function requestStatus(error: unknown) {
  const candidate = asRequestError(error)
  if (typeof candidate?.status === "number")
    return candidate.status
  return typeof candidate?.statusCode === "number" ? candidate.statusCode : undefined
}

export function isUnauthorized(error: unknown) {
  return requestStatus(error) === 401
}

export function isAbortError(error: unknown) {
  return asRequestError(error)?.name === "AbortError"
}
