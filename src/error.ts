import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { That } from "@thaterror/core";
import type { ServerWebSocket } from "bun";
import { briefOf } from "./utils.ts";

export const TransportError = That({
    UNKNOWN: (message: string) => `Transport error: ${message}`
});

export const WebsocketError = That({
    ILLEGAL_REBIND: (
        current: ServerWebSocket<unknown>,
        incoming: ServerWebSocket<unknown>
    ) =>
        [
            "Illegal rebind rejected.",
            "",
            `Current peer: ${current.remoteAddress}`,
            `Incoming peer: ${incoming.remoteAddress}`,
            "",
            "Rule: one transport instance per connection."
        ].join("\n"),
    CONNECT_MISSING: () =>
        "WebSocket connection is missing (transport not mounted)",
    SOCKET_DEAD: (ws: ServerWebSocket<unknown>) =>
        [
            "WebSocket is not open.",
            "",
            `Peer: ${ws.remoteAddress}`,
            `readyState: ${ws.readyState}`
        ].join("\n"),
    TRANSMIT_FAILED: (payload: string) => {
        const maxChars = 4_000;
        const shown =
            payload.length > maxChars
                ? [
                      payload.slice(0, maxChars),
                      `... (${payload.length - maxChars} more chars)`
                  ].join("\n")
                : payload;

        return [
            "Failed to transmit message over WebSocket.",
            "",
            `payload (${payload.length} chars):`,
            shown
        ].join("\n");
    }
});

export const SerializationError = That({
    MALFORMED_JSON: () =>
        "Received malformed JSON (failed to parse incoming message)",
    MCP_SPEC_VIOLATION: () =>
        "Incoming message is not a valid JSON-RPC / MCP message",
    ENCODE_FAILED: (message: JSONRPCMessage) =>
        [
            "Failed to encode JSON-RPC message.",
            "",
            `Message: ${briefOf(message)}`,
            "",
            "Hint: this usually happens when the message contains non-serializable values (e.g. circular references)."
        ].join("\n")
});
