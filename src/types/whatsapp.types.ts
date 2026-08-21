/**
 * WhatsApp Cloud API Type Definitions
 *
 * Types for incoming webhook payloads, outgoing messages,
 * and media operations from the Meta WhatsApp Cloud API.
 */

// ─── Enums ───────────────────────────────────────────────

/** Supported incoming message types */
export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  IMAGE = 'image',
  UNKNOWN = 'unknown',
}

// ─── Incoming Webhook Types ──────────────────────────────

/** Root webhook payload from Meta */
export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

/** Single entry in the webhook payload */
export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

/** A change within a webhook entry */
export interface WebhookChange {
  value: MessageValue;
  field: string;
}

/** The value object containing message data */
export interface MessageValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: IncomingMessage[];
  statuses?: WebhookStatus[];
}

/** Contact information from webhook */
export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

/** Status update from webhook (delivery receipts, etc.) */
export interface WebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

/** Incoming message from WhatsApp */
export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: TextMessageContent;
  audio?: AudioMessageContent;
  image?: ImageMessageContent;
}

/** Text message content */
export interface TextMessageContent {
  body: string;
}

/** Audio message content */
export interface AudioMessageContent {
  id: string;
  mime_type: string;
}

/** Image message content */
export interface ImageMessageContent {
  id: string;
  mime_type: string;
  sha256: string;
}

// ─── Outgoing Message Types ──────────────────────────────

/** Response from WhatsApp API after sending a message */
export interface SendMessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

/** Payload for sending a text message */
export interface SendTextMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    preview_url: boolean;
    body: string;
  };
}

/** Payload for sending an audio/voice message */
export interface SendAudioMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string;
  type: 'audio';
  audio: {
    id: string;
  };
}

// ─── Media Types ─────────────────────────────────────────

/** Response from the media URL endpoint */
export interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  messaging_product: string;
}

/** Response from the media upload endpoint */
export interface UploadMediaResponse {
  id: string;
}
