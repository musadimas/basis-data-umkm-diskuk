import { createError, defineEventHandler, sendRedirect } from "h3";

/** Directus owns the OIDC/SAML state, callback, session and provider mapping. */
export default defineEventHandler((event) => {
  if (process.env.SSO_JABAR_ENABLED !== "true") {
    throw createError({ statusCode: 503, statusMessage: "SSO Jabar belum tersedia" });
  }
  const configuredOrigin = process.env.SSO_WEB_ORIGIN;
  if (!configuredOrigin) throw createError({ statusCode: 503, statusMessage: "SSO Jabar belum dikonfigurasi" });
  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
  } catch {
    throw createError({ statusCode: 503, statusMessage: "SSO Jabar belum dikonfigurasi" });
  }
  if (origin.pathname !== "/" || origin.search || origin.hash || (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1")) {
    throw createError({ statusCode: 503, statusMessage: "SSO Jabar belum dikonfigurasi" });
  }
  const callback = new URL("/sso-complete", origin).toString();
  return sendRedirect(event, `/panel/auth/login/jabar?redirect=${encodeURIComponent(callback)}`, 302);
});
