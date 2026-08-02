// Browser-only shim for SDK packages that import the Node "ws" package.
export const WebSocket = globalThis.WebSocket;
export default WebSocket;
