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
import { SerializationError, TransportError, WebsocketError } from "./error";
import { isJSONRPCMessage } from "./utils";

export class WebSocketServerTransport implements Transport {
    protected ws?: ServerWebSocket<{ transport: WebSocketServerTransport }>;
    protocolVersion?: string;

    mount(
        ws: Exclude<WebSocketServerTransport["ws"], undefined>
    ): Result<void, ThatError<typeof WebsocketError, "ILLEGAL_REBIND">> {
        if (this.ws && this.ws !== ws) {
            return err(WebsocketError.ILLEGAL_REBIND(this.ws, ws));
        }

        this.ws = ws;
        ws.data.transport = this;
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

    private reportError(error: Error): void {
        this.onerror?.(error);
    }

    /**
     * Feed an incoming Bun websocket message into the MCP transport.
     * Call this from `websocket.message(ws, message)`.
     */
    handleMessage(
        message: string | Uint8Array,
        extra?: MessageExtraInfo
    ): void {
        const text =
            typeof message === "string"
                ? message
                : new TextDecoder().decode(message);

        fromThrowable(
            () => JSON.parse(text) as unknown,
            (cause) => SerializationError.MALFORMED_JSON().with({ cause })
        )()
            .andThen((value) =>
                isJSONRPCMessage(value)
                    ? ok(value)
                    : err(
                          SerializationError.MCP_SPEC_VIOLATION().with({
                              cause: value
                          })
                      )
            )
            .match(
                (msg) => {
                    this.onmessage?.(msg, extra);
                },
                (error) => {
                    this.reportError(error);
                }
            );
    }

    /** Call this from Bun's `websocket.close` handler. */
    handleClose(): void {
        const ws = this.ws;
        this.ws = undefined;

        if (!ws) {
            return;
        }

        this.onclose?.();
    }

    /** Call this from Bun's `websocket.error` handler (if you use it). */
    handleError(cause: unknown): void {
        this.reportError(
            TransportError.UNKNOWN("websocket error").with({ cause })
        );
    }

    // #region Transport interface
    async start(): Promise<void> {
        const ensured = this.ensure();
        if (ensured.isErr()) {
            throw ensured.error;
        }

        this.sessionId ??= globalThis.crypto.randomUUID();
    }

    async send(
        message: JSONRPCMessage,
        _options?: TransportSendOptions
    ): Promise<void> {
        const result = this.ensure()
            .andThen((ws) =>
                fromThrowable(
                    () => JSON.stringify(message, null, 2),
                    (cause) =>
                        // biome-ignore format: keep `.with({ cause })` single-line
                        SerializationError.ENCODE_FAILED(message).with({ cause })
                )().map((payload) => ({ ws, payload }))
            )
            .andThen(({ ws, payload }) =>
                fromThrowable(
                    () => ws.send(payload),
                    (cause) =>
                        WebsocketError.TRANSMIT_FAILED(payload).with({ cause })
                )()
            );

        if (result.isErr()) {
            this.reportError(result.error);
            throw result.error;
        }
    }

    async close(): Promise<void> {
        const ensured = this.ensure();
        this.ws = undefined;

        ensured
            .andThen((ws) =>
                fromThrowable(
                    () => ws.close(),
                    (cause) =>
                        TransportError.UNKNOWN("websocket close failed").with({
                            cause
                        })
                )()
            )
            .mapErr((error) => {
                // Calling close() when already closed (or never mounted) is not exceptional.
                if (
                    error.is(WebsocketError.SOCKET_DEAD) ||
                    error.is(WebsocketError.CONNECT_MISSING)
                ) {
                    return;
                }

                this.reportError(error);
            });

        this.onclose?.();
    }

    onclose?: (() => void) | undefined;
    onerror?: ((error: Error) => void) | undefined;
    onmessage?: <T extends JSONRPCMessage>(
        message: T,
        extra?: MessageExtraInfo
    ) => void;
    sessionId?: string | undefined;
    setProtocolVersion = (version: string) => {
        this.protocolVersion = version;
    };
    // #endregion
}
