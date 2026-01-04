import {
    isJSONRPCErrorResponse,
    isJSONRPCNotification,
    isJSONRPCRequest,
    isJSONRPCResultResponse,
    type JSONRPCMessage,
} from "@modelcontextprotocol/sdk/types.js";

export const briefOf = (msg: JSONRPCMessage) => {
    if (isJSONRPCRequest(msg)) {
        return `Request [${msg.id}]:(${msg.method})`;
    }

    if (isJSONRPCResultResponse(msg)) {
        return `Response Result [${msg.id}]`;
    }

    if (isJSONRPCErrorResponse(msg)) {
        return `Response Error [${msg.id}] ${msg.error.message}`;
    }

    if (isJSONRPCNotification(msg)) {
        return `Notification (${msg.method})`;
    }

    return `Unknown JSON-RPC message`;
};
