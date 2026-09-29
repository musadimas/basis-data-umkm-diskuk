/** Browser-only presentation state. The KPI report still uses the normal IndexedDB outbox. */
export function useDemoConnection() {
  const config = useRuntimeConfig();
  const auth = useAuth();
  const simulatedOffline = useState<boolean>("demo:simulated-offline", () => false);
  const enabled = computed(() =>
    config.public.demoMode === true && auth.user.value?.email?.startsWith("dummy_") === true,
  );
  watch(enabled, (value) => { if (!value) simulatedOffline.value = false; });
  return { enabled, simulatedOffline };
}
