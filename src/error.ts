import { That } from "@thaterror/core";
import type { ServerWebSocket } from "bun";

export const TransportError = That({
})

export const WebsocketError = That({
	ILLEGAL_REBIND: (current: ServerWebSocket<unknown>, incoming: ServerWebSocket<unknown>) =>
		`Illegal Rebind: Transport is already locked to Peer[${current.remoteAddress}]. ` +
    `Rejected attempt from Peer[${incoming.remoteAddress}]. ` +
    `Instances must be 1:1 with connections.`,
	CONNECT_MISSING: () => "Websocket connection is not valid",
	SOCKET_DEAD: (ws: ServerWebSocket<unknown>) => `Peer: ${ws.remoteAddress} connection is dead. State: ${ws.readyState}`,
	TRANSMIT_FAILED: () => `Failed to transmit message over websocket`,
})

export const SerializationError = That({
	MALFORMED_JSON: () => `Received malformed JSON message`,
	MCP_SPEC_VIOLATION: () => `Message does not conform to MCP specification`,
	ENCODE_FAILED: () => `Failed to encode message to JSON`,
})