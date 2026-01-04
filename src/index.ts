import type {
    Transport,
    TransportSendOptions
} from "@modelcontextprotocol/sdk/shared/transport.d.ts";
import type {
    JSONRPCMessage,
    MessageExtraInfo
} from "@modelcontextprotocol/sdk/types.js";
import type { ThatError } from "@thaterror/core";
import type { ServerWebSocket } from "bun";
import { err, fromThrowable, ok, type Result } from "neverthrow";
import { SerializationError, WebsocketError } from "./error";

export class WebSocketServerTransport implements Transport {
    protected ws?: ServerWebSocket<{ transport: WebSocketServerTransport }>;

    mount(
        ws: Exclude<WebSocketServerTransport["ws"], undefined>
    ): Result<void, ThatError<typeof WebsocketError, "ILLEGAL_REBIND">> {
        if (this.ws && this.ws !== ws) {
            return err(WebsocketError.ILLEGAL_REBIND(this.ws, ws));
        }

        this.ws = ws;
        return ok();
    }

    protected ensure = (): Result<
        Exclude<WebSocketServerTransport["ws"], undefined>,
        ThatError<typeof WebsocketError, "SOCKET_DEAD" | "CONNECT_MISSING">
    > => {
        if (!this.ws) {
            return err(WebsocketError.CONNECT_MISSING());
        }

        if (this.ws.readyState !== 1) {
            return err(WebsocketError.SOCKET_DEAD(this.ws));
        }

        return ok(this.ws);
    };

    // #region Transport interface
    async start(): Promise<void> {
        if (!this.ws) {
            throw WebsocketError.CONNECT_MISSING();
        }
    }

    async send(
        message: JSONRPCMessage,
        options?: TransportSendOptions
    ): Promise<void> {
        this.ensure()
            .andThen((ws) =>
                fromThrowable(
                    () => JSON.stringify(message),
                    (cause) =>
                        SerializationError.ENCODE_FAILED(message).with({
                            cause
                        })
                )().map((payload) => ({ ws, payload }))
            )
            .andThen(({ ws, payload }) =>
                fromThrowable(
                    () => ws.send(payload),
                    (cause) =>
                        WebsocketError.TRANSMIT_FAILED(payload).with({ cause })
                )()
            );
    }

    async close(): Promise<void> {
        this.ws?.close();
        this.ws = undefined;
        this.onclose?.();
    }

    onclose?: (() => void) | undefined;
    onerror?: ((error: Error) => void) | undefined;
    onmessage?: <T extends JSONRPCMessage>(
        message: T,
        extra?: MessageExtraInfo
    ) => void;
    sessionId?: string | undefined;
    setProtocolVersion?: ((version: string) => void) | undefined;
    // #endregion
}
