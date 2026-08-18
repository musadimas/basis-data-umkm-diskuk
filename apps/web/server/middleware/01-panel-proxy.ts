import { defineEventHandler, getRequestURL } from "h3";
import { proxyToDirectus } from "../utils/directus-proxy";

export default defineEventHandler(async (event) => {
  if (!getRequestURL(event).pathname.startsWith("/panel")) return;
  await proxyToDirectus(event);
});
