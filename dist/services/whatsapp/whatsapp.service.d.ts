/**
 * WhatsApp Cloud API Service
 *
 * Pure API client for the Meta WhatsApp Cloud API.
 * Handles sending messages, retrieving media URLs, and downloading media.
 *
 * This service contains NO business logic — it is a transport layer only.
 * Business decisions are made by the processing layer and AI pipeline.
 */
import { SendMessageResponse } from '../../types/index';
/**
 * WhatsApp Cloud API client.
 *
 * Provides methods to:
 * - Send text messages
 * - Retrieve media download URLs
 * - Download media files
 * - Verify webhook tokens
 */
export declare class WhatsAppService {
    private readonly client;
    private readonly mediaClient;
    constructor();
    /**
     * Sends a text message to a WhatsApp user.
     *
     * Includes a single retry with 1-second delay on network failures.
     *
     * @param phoneNumber - Recipient phone number (international format)
     * @param message - Text message body
     * @returns API response with message ID
     */
    sendTextMessage(phoneNumber: string, message: string): Promise<SendMessageResponse>;
    /**
   * Sends an approved WhatsApp template message.
   *
   * @param phoneNumber - Recipient phone number
   * @param patientName - Patient name for the template variable
   */
    sendTemplateMessage(phoneNumber: string, patientName: string): Promise<SendMessageResponse>;
    /**
     * Retrieves the temporary download URL for a media file.
     *
     * @param mediaId - WhatsApp media ID
     * @returns Temporary download URL
     */
    getMediaUrl(mediaId: string): Promise<string>;
    /**
     * Downloads a media file and stores it in the temp directory.
     *
     * @param mediaId - WhatsApp media ID
     * @param mimeType - MIME type of the media (used for file extension)
     * @returns Local file path where the media was saved
     */
    downloadMedia(mediaId: string, mimeType?: string): Promise<string>;
    /**
     * Verifies a webhook verification request from Meta.
     *
     * @param mode - hub.mode query parameter (should be 'subscribe')
     * @param token - hub.verify_token query parameter
     * @param challenge - hub.challenge query parameter
     * @returns The challenge string if verification succeeds, null otherwise
     */
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    /** Simple delay utility for retry logic */
    private delay;
}
//# sourceMappingURL=whatsapp.service.d.ts.map