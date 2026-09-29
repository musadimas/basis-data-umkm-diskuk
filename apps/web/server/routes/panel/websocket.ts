import { createWebSocketProxy } from "crossws";
import { WebSocket as NodeWebSocket } from "ws";

const upstream = `${(process.env.PANEL_URL ?? "http://directus:8055").replace(/^http/, "ws")}/websocket`;

/**
 * Jembatan tipe satu arah: `ws` menyediakan implementasi WebSocket untuk Node, tetapi tipe
 * konstruktornya tidak identik dengan WebSocket global yang diharapkan crossws.
 */
const NodeWebSocketBridge: unknown = NodeWebSocket;

// SAFETY: crossws hanya memakai konstruktor ini untuk membuka koneksi upstream di Node, tempat `ws` kompatibel saat runtime.
const proxy = createWebSocketProxy({
  target: upstream,
  WebSocket: NodeWebSocketBridge as typeof WebSocket,
  headers: (peer) => ({
    cookie: peer.request.headers.get("cookie") ?? "",
  }),
});

// SAFETY: kontrak handler createWebSocketProxy sama dengan defineWebSocketHandler; assertion hanya menyatakan bentuk itu.
export default defineWebSocketHandler(proxy as Parameters<typeof defineWebSocketHandler>[0]);
