import { createWebSocketProxy } from "crossws";
import { WebSocket as NodeWebSocket } from "ws";

const upstream = `${(process.env.PANEL_URL ?? "http://directus:8055").replace(/^http/, "ws")}/websocket`;

export default defineWebSocketHandler(
  createWebSocketProxy({
    target: upstream,
    WebSocket: NodeWebSocket as unknown as typeof WebSocket,
    headers: (peer) => ({
      cookie: peer.request.headers.get("cookie") ?? "",
    }),
  }) as unknown as Parameters<typeof defineWebSocketHandler>[0],
);
