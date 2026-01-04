import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerWebSocket } from "bun";
import { TransportError } from "../src/error.ts";
import { WebSocketServerTransport } from "../src/index.ts";

type WsData = {
    transport: WebSocketServerTransport;
    mcp: McpServer;
};

Bun.serve<WsData>({
    port: 3333,
    fetch(req, server) {
        const upgraded = server.upgrade(req, {
            data: {} as WsData
        });

        if (upgraded) {
            return;
        }

        return new Response("MCP WebSocket server: upgrade required", {
            status: 426
        });
    },
    websocket: {
        open(ws: ServerWebSocket<WsData>) {
            const transport = new WebSocketServerTransport();
            const mounted = transport.mount(ws);
            if (mounted.isErr()) {
                ws.close(1011, "Failed to bind transport");
                return;
            }

            const mcp = new McpServer({
                name: "bun-ws-mcp",
                version: "0.0.0"
            });

            ws.data.transport = transport;
            ws.data.mcp = mcp;

            void mcp.connect(transport).catch((err) => {
                transport.onerror?.(
                    TransportError.UNKNOWN("MCP connect failed").with({
                        cause: err
                    })
                );
                ws.close(1011, "MCP connect failed");
            });
        },
        message(ws, message) {
            ws.data.transport?.handleMessage(message);
        },
        close(ws) {
            ws.data.transport?.handleClose();
            void ws.data.mcp?.close();
        }
    }
});

console.log("MCP WS server listening on ws://localhost:3333");
