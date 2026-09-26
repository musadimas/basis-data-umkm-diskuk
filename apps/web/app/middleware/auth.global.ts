import { hasRouteAccess, ROLE_HOME } from "~/constants/ROLES";
import { safeDashboardReturnTo, useAuth } from "~/composables/useAuth";

export default defineNuxtRouteMiddleware(async (to) => {
  const protectedRoute = to.path === "/dashboard" || to.path.startsWith("/dashboard/");
  if (!protectedRoute) return;
  const auth = useAuth();
  if (auth.status.value === "authenticated") {
    const user = auth.user.value;
    if (!user || hasRouteAccess(user.role, to.path)) return;
    return navigateTo(ROLE_HOME[user.role] ?? "/dashboard");
  }
  const current = await auth.currentUser();
  if (current) {
    if (hasRouteAccess(current.role, to.path)) return;
    return navigateTo(ROLE_HOME[current.role] ?? "/dashboard");
  }
  const returnTo = safeDashboardReturnTo(`${to.path}${to.fullPath.includes("?") ? `?${to.fullPath.split("?")[1]}` : ""}`);
  return navigateTo({ path: "/sign-in", query: { returnTo } });
});
