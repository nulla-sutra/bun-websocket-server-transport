import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.d.ts";
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";
import type { ServerWebSocket } from "bun";
import { err, ok, Result } from 'neverthrow';
import { WebsocketError } from "./error";

export class ServerWebSocketTransport implements Transport {
	protected ws?: ServerWebSocket<{ transport: ServerWebSocketTransport }>;

	mount(ws: Exclude<ServerWebSocketTransport['ws'], undefined>) {
		if (this.ws && this.ws !== ws) {
			return err(WebsocketError.ILLEGAL_REBIND(this.ws, ws))
		}

		this.ws = ws;
	}

	protected ensure = () => {
		const { ws } = this;

		if (!ws) {
			return err(WebsocketError.CONNECT_MISSING());
		}

		if (ws.readyState !== 1) {
			return err(WebsocketError.SOCKET_DEAD(ws));
		}

		return ok(ws);
	}

	// #region Transport interface
	async start(): Promise<void> {
		if (!this.ws) {
			throw WebsocketError.CONNECT_MISSING();
		}
	}

	async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
	}

	async close(): Promise<void> {
		this.ws?.close();
		this.ws = undefined;
		this.onclose?.();
	}

	onclose?: (() => void) | undefined;
	onerror?: ((error: Error) => void) | undefined;
	onmessage?: (<T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void) | undefined;
	sessionId?: string | undefined;
	setProtocolVersion?: ((version: string) => void) | undefined;
	// #endregion
}

