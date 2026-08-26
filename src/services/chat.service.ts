/**
 * Phase 2 (Chat Bridge) — connects authenticated Patient/Caretaker chat to
 * the SAME RAGService (GPT-4o + pgvector + Dear Pal system prompt) and
 * Sarvam STT/TTS services WhatsApp already uses. No second AI/RAG/voice
 * implementation — this file only orchestrates: persist inbound turn,
 * call the existing RAGService, persist outbound turn, (voice only)
 * transcribe/synthesize via the existing Sarvam services.
 *
 * Deliberately NOT built on `AIPipelineService` — that pipeline is shaped
 * around WhatsApp's `ParsedMessage`/risk-assessment/decision-engine/
 * escalation flow, none of which Phase 2 is in scope to touch. Calling
 * `RAGService.generateAnswer` directly is the smallest compatible change
 * that still reuses every actual AI/RAG component.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';
import { RAGService } from '@services/knowledge/rag.service';
import { ISpeechService, ITextToSpeechService } from '@services/ai/interfaces';
import { ChatIdentity } from '@middleware/auth.middleware';

export interface ChatMessageResult {
  reply: string;
}

export interface ChatVoiceResult {
  transcript: string;
  reply: string;
  /** Present only when Sarvam TTS succeeded — voice replies degrade to
   *  text-only rather than failing the whole request. */
  audioBase64?: string;
  audioMimeType?: string;
}

const MAX_MESSAGE_LENGTH = 4000;

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('webm')) return '.webm';
  return '.m4a';
}

export class ChatService {
  constructor(
    private readonly ragService: RAGService,
    private readonly speechService: ISpeechService,
    private readonly ttsService: ITextToSpeechService,
  ) {}

  /** Never throws — a failed persist must not fail the user-facing chat
   *  turn (same tolerance WhatsApp's own `syncToSupabase` has). */
  private async persistTurn(
    identity: ChatIdentity,
    direction: 'inbound' | 'outbound',
    content: string,
    messageType: 'text' | 'audio' = 'text',
  ): Promise<void> {
    try {
      const row: Record<string, unknown> = {
        conversation_scope: identity.type,
        direction,
        message_type: messageType,
        content,
        timestamp: new Date().toISOString(),
      };

      if (identity.type === 'patient') {
        row.patient_id = identity.patientId;
        row.phone_number = identity.mobile;
      } else {
        row.caretaker_id = identity.caretakerId;
        // Context only (which patient this caretaker is linked to) — never
        // read back to load the patient's own AI conversation. See the
        // scoped history query in rag.service.ts, which always filters by
        // conversation_scope + caretaker_id for caretaker turns, never by
        // this patient_id.
        row.patient_id = identity.linkedPatientId;
        row.phone_number = identity.mobile;
      }

      const { error } = await supabaseAdmin.from('conversations').insert(row);
      if (error) {
        logger.warn('Failed to persist chat turn', { error: error.message, scope: identity.type });
      }
    } catch (err) {
      logger.warn('Unexpected error persisting chat turn', { error: (err as Error).message });
    }
  }

  private async generateReply(identity: ChatIdentity, messageText: string): Promise<string> {
    try {
      const ragResponse = await this.ragService.generateAnswer(messageText, {
        audience: identity.type,
        conversationScope: identity.type,
        patientId: identity.type === 'patient' ? identity.patientId : identity.linkedPatientId ?? undefined,
        caretakerId: identity.type === 'caretaker' ? identity.caretakerId : undefined,
      });
      return ragResponse.answer;
    } catch (err) {
      logger.error('Chat RAG generation failed', { error: (err as Error).message, scope: identity.type });
      throw new AppError(
        'Dear Pal is having trouble responding right now. Please try again in a moment.',
        502,
        true,
        'AI_UNAVAILABLE',
      );
    }
  }

  /** POST /api/chat/message */
  async sendMessage(identity: ChatIdentity, message: string): Promise<ChatMessageResult> {
    const trimmed = (message || '').trim();
    if (!trimmed) {
      throw new AppError('Message is required.', 400, true, 'VALIDATION_ERROR');
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new AppError('Message is too long.', 400, true, 'VALIDATION_ERROR');
    }

    await this.persistTurn(identity, 'inbound', trimmed, 'text');
    const reply = await this.generateReply(identity, trimmed);
    await this.persistTurn(identity, 'outbound', reply, 'text');

    return { reply };
  }

  /** POST /api/chat/voice — reuses the exact same SarvamSpeechService /
   *  SarvamTextToSpeechService WhatsApp's voice.processor.ts uses. */
  async sendVoiceMessage(
    identity: ChatIdentity,
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<ChatVoiceResult> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new AppError('Audio file is required.', 400, true, 'VALIDATION_ERROR');
    }

    const tmpPath = path.join(os.tmpdir(), `chat-voice-${crypto.randomUUID()}${extensionFor(mimeType)}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    try {
      let transcript = '';
      try {
        const transcription = await this.speechService.transcribe(tmpPath, 'ml-IN');
        transcript = (transcription.text || '').trim();
      } catch (err) {
        logger.error('Chat voice STT failed', { error: (err as Error).message, scope: identity.type });
        throw new AppError('Could not understand the audio. Please try again.', 502, true, 'STT_UNAVAILABLE');
      }

      if (!transcript) {
        throw new AppError('Could not understand the audio. Please try again.', 400, true, 'EMPTY_TRANSCRIPT');
      }

      await this.persistTurn(identity, 'inbound', transcript, 'audio');
      const reply = await this.generateReply(identity, transcript);
      await this.persistTurn(identity, 'outbound', reply, 'text');

      let audioBase64: string | undefined;
      let audioMimeType: string | undefined;
      try {
        const ttsBuffer = await this.ttsService.textToSpeech(reply);
        audioBase64 = ttsBuffer.toString('base64');
        audioMimeType = 'audio/mpeg';
      } catch (err) {
        // Degrade to text-only rather than failing the whole request —
        // the reply itself is already generated and persisted.
        logger.warn('Chat voice TTS failed; returning text-only reply', {
          error: (err as Error).message,
          scope: identity.type,
        });
      }

      return { transcript, reply, audioBase64, audioMimeType };
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch (cleanupErr) {
        logger.warn('Failed to clean up chat voice temp file', {
          error: (cleanupErr as Error).message,
        });
      }
    }
  }
}
