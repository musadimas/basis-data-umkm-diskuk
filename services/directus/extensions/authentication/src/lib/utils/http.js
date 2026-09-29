import cakupan from "../../../../../analytics-shared/cakupan.cjs";

const { sanitizeError } = cakupan;

export { sanitizeError };

export function noStore(res) {
  res.setHeader("Cache-Control", "private, no-store");
}

export function sendError(res, logger, error) {
  noStore(res);
  if (error?.name === "DirectusError" && Number.isInteger(error.status)) {
    if (error.status >= 500) logger.error(sanitizeError(error), "Auth endpoint failed");
    res.status(error.status).json({ errors: [{ message: error.message, extensions: { code: error.code } }] });
    return;
  }
  logger.error(sanitizeError(error), "Auth endpoint failed");
  res.status(500).json({ errors: [{ message: "The request could not be processed.", extensions: { code: "INTERNAL_SERVER_ERROR" } }] });
}
