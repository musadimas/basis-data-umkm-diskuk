"use strict";

class OperasionalError extends Error {
  constructor(statusCode, code, message = "Permintaan tidak dapat diproses.", details = undefined) {
    super(message);
    this.name = "OperasionalError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.extensions = { code, status: statusCode };
  }
}

function validationFailed(fields, message = "Validasi gagal") {
  const error = new OperasionalError(400, "VALIDATION_FAILED", message);
  error.fields = fields;
  error.extensions = { code: "VALIDATION_FAILED", status: 400, fields };
  return error;
}

function sendOperasionalError(res, error, requestId) {
  const safe =
    error instanceof OperasionalError
      ? error
      : error && typeof error === "object" && error.statusCode
        ? new OperasionalError(error.statusCode, error.code || "INTERNAL_SERVER_ERROR", error.message)
        : new OperasionalError(500, "INTERNAL_SERVER_ERROR");
  res.setHeader?.("Cache-Control", "private, no-store");
  if (requestId) res.setHeader?.("X-Request-Id", requestId);
  const extensions = { code: safe.code, status: safe.statusCode };
  if (requestId) extensions.requestId = requestId;
  if (safe.fields) extensions.fields = safe.fields;
  if (safe.extensions?.ids) extensions.ids = safe.extensions.ids;
  res.status(safe.statusCode).json({
    errors: [{ message: safe.message, extensions }],
  });
}

module.exports = { OperasionalError, validationFailed, sendOperasionalError };
