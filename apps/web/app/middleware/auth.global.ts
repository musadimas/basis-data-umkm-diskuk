import { dashboardRedirect } from "~/constants/ROLES";
import { safeDashboardReturnTo, useAuth } from "~/composables/useAuth";

export default defineNuxtRouteMiddleware(async (to) => {
  const protectedRoute = to.path === "/dashboard" || to.path.startsWith("/dashboard/");
  if (!protectedRoute) return;
  const auth = useAuth();
  // `user.role` adalah UUID role Directus; kunci role aplikasi ada di `user.app_role`.
  if (auth.status.value === "authenticated") {
    const user = auth.user.value;
    if (!user) return;
    const target = dashboardRedirect(user.app_role, to.path);
    return target ? navigateTo(target) : undefined;
  }
  const current = await auth.currentUser();
  if (current) {
    const target = dashboardRedirect(current.app_role, to.path);
    return target ? navigateTo(target) : undefined;
  }
  const returnTo = safeDashboardReturnTo(`${to.path}${to.fullPath.includes("?") ? `?${to.fullPath.split("?")[1]}` : ""}`);
  return navigateTo({ path: "/sign-in", query: { returnTo } });
});
