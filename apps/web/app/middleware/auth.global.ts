import { safeDashboardReturnTo, useAuth } from "~/composables/useAuth";

export default defineNuxtRouteMiddleware(async (to) => {
  const protectedRoute = to.path === "/dashboard" || to.path.startsWith("/dashboard/");
  if (!protectedRoute) return;
  const auth = useAuth();
  if (auth.status.value === "authenticated") return;
  const current = await auth.currentUser();
  if (current) return;
  const returnTo = safeDashboardReturnTo(`${to.path}${to.fullPath.includes("?") ? `?${to.fullPath.split("?")[1]}` : ""}`);
  return navigateTo({ path: "/sign-in", query: { returnTo } });
});
