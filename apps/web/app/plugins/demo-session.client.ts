import { clearPrivateClientState } from "~/lib";

/** A demo role change invalidates private state in every open tab of this origin. */
export default defineNuxtPlugin((nuxtApp) => {
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel("diskuk-demo-session");
  channel.onmessage = async (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type !== "switch") return;
    await clearPrivateClientState(nuxtApp.$queryClient);
    window.location.replace("/sign-in?demo=switch");
  };
});
