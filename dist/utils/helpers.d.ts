/**
 * Helper Utilities
 *
 * Parsing and validation functions for webhook payloads
 * and incoming WhatsApp messages.
 */
import { WebhookPayload, MessageType, ParsedMessage } from '../types/index';
/**
 * Parses a raw webhook payload into a normalized ParsedMessage.
 * Returns null if the payload does not contain a processable message.
 *
 * @param body - Raw webhook request body
 * @returns Parsed message or null
 */
export declare function parseIncomingMessage(body: WebhookPayload): ParsedMessage | null;
/**
 * Classifies a raw message type string into the MessageType enum.
 *
 * @param type - Raw message type from WhatsApp API
 * @returns Classified MessageType
 */
export declare function classifyMessageType(type: string): MessageType;
/**
 * Validates that a webhook payload has the required structure.
 *
 * @param body - Raw webhook request body
 * @returns True if the payload is valid
 */
export declare function validateWebhookPayload(body: unknown): body is WebhookPayload;
/**
 * Generates a unique conversation ID using UUID v4.
 *
 * @returns A new UUID string
 */
export declare function generateConversationId(): string;
/**
 * Extracts the file extension from a MIME type.
 * Used when saving downloaded media files.
 *
 * @param mimeType - MIME type string (e.g., 'audio/ogg; codecs=opus')
 * @returns File extension (e.g., 'ogg')
 */
export declare function getExtensionFromMimeType(mimeType: string): string;
//# sourceMappingURL=helpers.d.ts.map