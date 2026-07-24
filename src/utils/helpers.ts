/**
 * Helper Utilities
 *
 * Parsing and validation functions for webhook payloads
 * and incoming WhatsApp messages.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  WebhookPayload,
  IncomingMessage,
  MessageType,
  ParsedMessage,
} from '@app-types/index';

/**
 * Parses a raw webhook payload into a normalized ParsedMessage.
 * Returns null if the payload does not contain a processable message.
 *
 * @param body - Raw webhook request body
 * @returns Parsed message or null
 */
export function parseIncomingMessage(body: WebhookPayload): ParsedMessage | null {
  try {
    // Ensure we have the expected structure
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      return null;
    }

    const value = body.entry[0].changes[0].value;
    const message: IncomingMessage = value.messages![0];
    const contact = value.contacts?.[0];

    // Classify the message type
    const messageType = classifyMessageType(message.type);

    const parsed: ParsedMessage = {
      messageId: message.id,
      phoneNumber: message.from,
      timestamp: message.timestamp,
      messageType,
      senderName: contact?.profile?.name,
    };

    // Attach type-specific content
    switch (messageType) {
      case MessageType.TEXT:
        parsed.textContent = message.text?.body;
        break;
      case MessageType.AUDIO:
        parsed.mediaId = message.audio?.id;
        parsed.mimeType = message.audio?.mime_type;
        break;
      case MessageType.IMAGE:
        parsed.mediaId = message.image?.id;
        parsed.mimeType = message.image?.mime_type;
        break;
      default:
        break;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Classifies a raw message type string into the MessageType enum.
 *
 * @param type - Raw message type from WhatsApp API
 * @returns Classified MessageType
 */
export function classifyMessageType(type: string): MessageType {
  switch (type) {
    case 'text':
      return MessageType.TEXT;
    case 'audio':
      return MessageType.AUDIO;
    case 'image':
      return MessageType.IMAGE;
    default:
      return MessageType.UNKNOWN;
  }
}

/**
 * Validates that a webhook payload has the required structure.
 *
 * @param body - Raw webhook request body
 * @returns True if the payload is valid
 */
export function validateWebhookPayload(body: unknown): body is WebhookPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  if (payload.object !== 'whatsapp_business_account') return false;
  if (!Array.isArray(payload.entry)) return false;
  if (payload.entry.length === 0) return false;

  return true;
}

/**
 * Generates a unique conversation ID using UUID v4.
 *
 * @returns A new UUID string
 */
export function generateConversationId(): string {
  return uuidv4();
}

/**
 * Extracts the file extension from a MIME type.
 * Used when saving downloaded media files.
 *
 * @param mimeType - MIME type string (e.g., 'audio/ogg; codecs=opus')
 * @returns File extension (e.g., 'ogg')
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
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
