/**
 * WhatsApp Cloud API Service
 *
 * Pure API client for the Meta WhatsApp Cloud API.
 * Handles sending messages, retrieving media URLs, and downloading media.
 *
 * This service contains NO business logic — it is a transport layer only.
 * Business decisions are made by the processing layer and AI pipeline.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '@config/index';
import { logger } from '@utils/logger';
import { getExtensionFromMimeType } from '@utils/helpers';
import {
  SendMessageResponse,
  SendTextMessagePayload,
  MediaUrlResponse,
} from '@app-types/index';

/**
 * WhatsApp Cloud API client.
 *
 * Provides methods to:
 * - Send text messages
 * - Retrieve media download URLs
 * - Download media files
 * - Verify webhook tokens
 */
export class WhatsAppService {
  private readonly client: AxiosInstance;
  private readonly mediaClient: AxiosInstance;

  constructor() {
    // Axios client for the WhatsApp Business API
    this.client = axios.create({
      baseURL: config.whatsapp.apiBaseUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Separate Axios client for media downloads (binary responses)
    this.mediaClient = axios.create({
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
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
  async sendTextMessage(
    phoneNumber: string,
    message: string,
  ): Promise<SendMessageResponse> {
    const payload: SendTextMessagePayload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const endpoint = `/${config.whatsapp.phoneNumberId}/messages`;

    try {
      const response = await this.client.post<SendMessageResponse>(endpoint, payload);

      logger.info('Text message sent successfully', {
        phoneNumber,
        messageId: response.data.messages?.[0]?.id,
      });

      return response.data;
    } catch (error) {
      // Retry once on network errors
      logger.warn('First attempt to send message failed, retrying...', {
        phoneNumber,
        error: (error as AxiosError).message,
      });

      await this.delay(1000);

      try {
        const retryResponse = await this.client.post<SendMessageResponse>(endpoint, payload);

        logger.info('Text message sent successfully on retry', {
          phoneNumber,
          messageId: retryResponse.data.messages?.[0]?.id,
        });

        return retryResponse.data;
      } catch (retryError) {
        logger.error('Failed to send message after retry', {
          phoneNumber,
          error: (retryError as AxiosError).message,
          response: (retryError as AxiosError).response?.data,
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
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await this.client.get<MediaUrlResponse>(`/${mediaId}`);

      logger.info('Media URL retrieved', { mediaId, url: response.data.url });

      return response.data.url;
    } catch (error) {
      logger.error('Failed to retrieve media URL', {
        mediaId,
        error: (error as AxiosError).message,
        response: (error as AxiosError).response?.data,
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
  async downloadMedia(mediaId: string, mimeType = 'audio/ogg'): Promise<string> {
    try {
      // Step 1: Get the temporary download URL
      const mediaUrl = await this.getMediaUrl(mediaId);

      // Step 2: Download the file
      const response = await this.mediaClient.get(mediaUrl);

      // Step 3: Save to temp directory
      const extension = getExtensionFromMimeType(mimeType);
      const fileName = `${mediaId}.${extension}`;
      const filePath = path.join(process.cwd(), config.paths.temp, fileName);

      // Ensure temp directory exists
      const tempDir = path.join(process.cwd(), config.paths.temp);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(filePath, Buffer.from(response.data));

      logger.info('Media downloaded successfully', {
        mediaId,
        filePath,
        mimeType,
        fileSize: Buffer.from(response.data).length,
      });

      return filePath;
    } catch (error) {
      logger.error('Failed to download media', {
        mediaId,
        error: (error as AxiosError).message,
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
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      logger.info('Webhook verification successful');
      return challenge;
    }

    logger.warn('Webhook verification failed', { mode, tokenMatch: token === config.whatsapp.verifyToken });
    return null;
  }

  /** Simple delay utility for retry logic */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
