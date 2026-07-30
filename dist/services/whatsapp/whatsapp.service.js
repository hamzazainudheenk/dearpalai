"use strict";
/**
 * WhatsApp Cloud API Service
 *
 * Pure API client for the Meta WhatsApp Cloud API.
 * Handles sending messages, retrieving media URLs, and downloading media.
 *
 * This service contains NO business logic — it is a transport layer only.
 * Business decisions are made by the processing layer and AI pipeline.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
const helpers_1 = require("../../utils/helpers");
/**
 * WhatsApp Cloud API client.
 *
 * Provides methods to:
 * - Send text messages
 * - Retrieve media download URLs
 * - Download media files
 * - Verify webhook tokens
 */
class WhatsAppService {
    constructor() {
        // Axios client for the WhatsApp Business API
        this.client = axios_1.default.create({
            baseURL: index_1.config.whatsapp.apiBaseUrl,
            timeout: 30000,
            headers: {
                Authorization: `Bearer ${index_1.config.whatsapp.accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        // Separate Axios client for media downloads (binary responses)
        this.mediaClient = axios_1.default.create({
            timeout: 60000,
            headers: {
                Authorization: `Bearer ${index_1.config.whatsapp.accessToken}`,
            },
            responseType: 'arraybuffer',
        });
    }
    /**
     * Sends a text message to a WhatsApp user.
     *
     * Includes a single retry with 1-second delay on network failures.
     *
     * @param phoneNumber - Recipient phone number (international format)
     * @param message - Text message body
     * @returns API response with message ID
     */
    async sendTextMessage(phoneNumber, message) {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: {
                preview_url: false,
                body: message,
            },
        };
        const endpoint = `/${index_1.config.whatsapp.phoneNumberId}/messages`;
        try {
            const response = await this.client.post(endpoint, payload);
            logger_1.logger.info('Text message sent successfully', {
                phoneNumber,
                messageId: response.data.messages?.[0]?.id,
            });
            return response.data;
        }
        catch (error) {
            // Retry once on network errors
            logger_1.logger.warn('First attempt to send message failed, retrying...', {
                phoneNumber,
                error: error.message,
            });
            await this.delay(1000);
            try {
                const retryResponse = await this.client.post(endpoint, payload);
                logger_1.logger.info('Text message sent successfully on retry', {
                    phoneNumber,
                    messageId: retryResponse.data.messages?.[0]?.id,
                });
                return retryResponse.data;
            }
            catch (retryError) {
                logger_1.logger.error('Failed to send message after retry', {
                    phoneNumber,
                    error: retryError.message,
                    response: retryError.response?.data,
                });
                throw retryError;
            }
        }
    }
    /**
     * Retrieves the temporary download URL for a media file.
     *
     * @param mediaId - WhatsApp media ID
     * @returns Temporary download URL
     */
    async getMediaUrl(mediaId) {
        try {
            const response = await this.client.get(`/${mediaId}`);
            logger_1.logger.info('Media URL retrieved', { mediaId, url: response.data.url });
            return response.data.url;
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve media URL', {
                mediaId,
                error: error.message,
                response: error.response?.data,
            });
            throw error;
        }
    }
    /**
     * Downloads a media file and stores it in the temp directory.
     *
     * @param mediaId - WhatsApp media ID
     * @param mimeType - MIME type of the media (used for file extension)
     * @returns Local file path where the media was saved
     */
    async downloadMedia(mediaId, mimeType = 'audio/ogg') {
        try {
            // Step 1: Get the temporary download URL
            const mediaUrl = await this.getMediaUrl(mediaId);
            // Step 2: Download the file
            const response = await this.mediaClient.get(mediaUrl);
            // Step 3: Save to temp directory
            const extension = (0, helpers_1.getExtensionFromMimeType)(mimeType);
            const fileName = `${mediaId}.${extension}`;
            const filePath = path_1.default.join(process.cwd(), index_1.config.paths.temp, fileName);
            // Ensure temp directory exists
            const tempDir = path_1.default.join(process.cwd(), index_1.config.paths.temp);
            if (!fs_1.default.existsSync(tempDir)) {
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            }
            // Write the file
            fs_1.default.writeFileSync(filePath, Buffer.from(response.data));
            logger_1.logger.info('Media downloaded successfully', {
                mediaId,
                filePath,
                mimeType,
                fileSize: Buffer.from(response.data).length,
            });
            return filePath;
        }
        catch (error) {
            logger_1.logger.error('Failed to download media', {
                mediaId,
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * Verifies a webhook verification request from Meta.
     *
     * @param mode - hub.mode query parameter (should be 'subscribe')
     * @param token - hub.verify_token query parameter
     * @param challenge - hub.challenge query parameter
     * @returns The challenge string if verification succeeds, null otherwise
     */
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === index_1.config.whatsapp.verifyToken) {
            logger_1.logger.info('Webhook verification successful');
            return challenge;
        }
        logger_1.logger.warn('Webhook verification failed', { mode, tokenMatch: token === index_1.config.whatsapp.verifyToken });
        return null;
    }
    /** Simple delay utility for retry logic */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.WhatsAppService = WhatsAppService;
//# sourceMappingURL=whatsapp.service.js.map