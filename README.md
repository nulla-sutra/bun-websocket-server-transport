# @nulla-sutra/bun-websocket-server-transport

Bun-only WebSocket **server** transport for the TypeScript MCP SDK (`@modelcontextprotocol/sdk`).

This package implements the MCP `Transport` interface on top of Bun's `ServerWebSocket`.
It is intended for Bun servers using `Bun.serve({ websocket: ... })`.

## Requirements

- Bun (uses `ServerWebSocket`)
- `@modelcontextprotocol/sdk` (peer dependency)

## Install

```bash
bun add https://github.com/nulla-sutra/bun-websocket-server-transport
```

## Usage

Wire the transport to Bun's websocket lifecycle events:

```ts
import type { ServerWebSocket } from "bun";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketServerTransport } from "@nulla-sutra/bun-websocket-server-transport";

type WsData = { transport?: WebSocketServerTransport; mcp?: McpServer };

Bun.serve<WsData>({
	port: 3333,
	fetch(req, server) {
		if (server.upgrade(req, { data: {} as WsData })) return;
		return new Response("upgrade required", { status: 426 });
	},
	websocket: {
		open(ws: ServerWebSocket<WsData>) {
			const transport = new WebSocketServerTransport();
			const mounted = transport.mount(ws);
			if (mounted.isErr()) {
				ws.close(1011, "mount failed");
				return;
			}

			const mcp = new McpServer({ name: "bun-ws-mcp", version: "0.0.0" });
			ws.data.transport = transport;
			ws.data.mcp = mcp;

			void mcp.connect(transport).catch(() => ws.close(1011, "connect failed"));
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
```

See `examples/bun-ws-server.ts` for a runnable example.

## Notes

- `send()` currently sends **pretty-printed JSON** (with indentation/newlines) over the wire.
- `send()` reports errors via `onerror` and also throws.
