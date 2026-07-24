/**
 * Configurable Message Templates
 *
 * All user-facing reply messages are defined here.
 * This prevents hardcoded strings throughout the codebase
 * and allows easy replacement with RAG-generated responses
 * in Phase 2 without modifying processors or controllers.
 */

export const MessageTemplates = {
  /** Reply sent after receiving a text message */
  TEXT_RECEIVED: 'Message received successfully.',

  /** Reply sent after receiving a voice message */
  VOICE_RECEIVED: 'Voice message received successfully.',

  /** Reply sent when an unsupported message type is received */
  UNSUPPORTED_TYPE: 'This message type is not supported yet.',

  /** Reply sent when an error occurs during processing */
  PROCESSING_ERROR: 'Sorry, something went wrong while processing your message. Please try again.',

  /** Reply sent when rate limit is exceeded */
  RATE_LIMITED: 'You are sending messages too quickly. Please wait a moment and try again.',

  /** Reply sent when the service is temporarily unavailable */
  SERVICE_UNAVAILABLE: 'Our service is temporarily unavailable. Please try again later.',
} as const;

export type MessageTemplateKey = keyof typeof MessageTemplates;
