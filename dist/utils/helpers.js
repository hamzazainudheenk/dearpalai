"use strict";
/**
 * Helper Utilities
 *
 * Parsing and validation functions for webhook payloads
 * and incoming WhatsApp messages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIncomingMessage = parseIncomingMessage;
exports.classifyMessageType = classifyMessageType;
exports.validateWebhookPayload = validateWebhookPayload;
exports.generateConversationId = generateConversationId;
exports.getExtensionFromMimeType = getExtensionFromMimeType;
const uuid_1 = require("uuid");
const index_1 = require("../types/index");
/**
 * Parses a raw webhook payload into a normalized ParsedMessage.
 * Returns null if the payload does not contain a processable message.
 *
 * @param body - Raw webhook request body
 * @returns Parsed message or null
 */
function parseIncomingMessage(body) {
    try {
        // Ensure we have the expected structure
        if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            return null;
        }
        const value = body.entry[0].changes[0].value;
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        // Classify the message type
        const messageType = classifyMessageType(message.type);
        const parsed = {
            messageId: message.id,
            phoneNumber: message.from,
            timestamp: message.timestamp,
            messageType,
            senderName: contact?.profile?.name,
        };
        // Attach type-specific content
        switch (messageType) {
            case index_1.MessageType.TEXT:
                parsed.textContent = message.text?.body;
                break;
            case index_1.MessageType.AUDIO:
                parsed.mediaId = message.audio?.id;
                parsed.mimeType = message.audio?.mime_type;
                break;
            case index_1.MessageType.IMAGE:
                parsed.mediaId = message.image?.id;
                parsed.mimeType = message.image?.mime_type;
                break;
            default:
                break;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Classifies a raw message type string into the MessageType enum.
 *
 * @param type - Raw message type from WhatsApp API
 * @returns Classified MessageType
 */
function classifyMessageType(type) {
    switch (type) {
        case 'text':
            return index_1.MessageType.TEXT;
        case 'audio':
            return index_1.MessageType.AUDIO;
        case 'image':
            return index_1.MessageType.IMAGE;
        default:
            return index_1.MessageType.UNKNOWN;
    }
}
/**
 * Validates that a webhook payload has the required structure.
 *
 * @param body - Raw webhook request body
 * @returns True if the payload is valid
 */
function validateWebhookPayload(body) {
    if (!body || typeof body !== 'object')
        return false;
    const payload = body;
    if (payload.object !== 'whatsapp_business_account')
        return false;
    if (!Array.isArray(payload.entry))
        return false;
    if (payload.entry.length === 0)
        return false;
    return true;
}
/**
 * Generates a unique conversation ID using UUID v4.
 *
 * @returns A new UUID string
 */
function generateConversationId() {
    return (0, uuid_1.v4)();
}
/**
 * Extracts the file extension from a MIME type.
 * Used when saving downloaded media files.
 *
 * @param mimeType - MIME type string (e.g., 'audio/ogg; codecs=opus')
 * @returns File extension (e.g., 'ogg')
 */
function getExtensionFromMimeType(mimeType) {
    const mimeMap = {
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/amr': 'amr',
        'audio/aac': 'aac',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
    };
    // Handle MIME types with parameters (e.g., 'audio/ogg; codecs=opus')
    const baseMime = mimeType.split(';')[0].trim();
    return mimeMap[baseMime] || 'bin';
}
//# sourceMappingURL=helpers.js.map