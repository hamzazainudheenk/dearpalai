"use strict";
/**
 * WhatsApp Cloud API Type Definitions
 *
 * Types for incoming webhook payloads, outgoing messages,
 * and media operations from the Meta WhatsApp Cloud API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = void 0;
// ─── Enums ───────────────────────────────────────────────
/** Supported incoming message types */
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["AUDIO"] = "audio";
    MessageType["IMAGE"] = "image";
    MessageType["UNKNOWN"] = "unknown";
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=whatsapp.types.js.map