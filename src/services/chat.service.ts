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
import { SymptomExtractorService, ExtractedSymptom } from '@services/ai/symptom-extractor.service';

export interface ChatMessageResult {
  reply: string;
  detectedSymptoms?: ExtractedSymptom[];
}

export interface ChatVoiceResult {
  transcript: string;
  reply: string;
  detectedSymptoms?: ExtractedSymptom[];
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

export interface ChatHistoryItem {
  id: string;
  speaker: 'me' | 'pal';
  body: string;
  isVoice: boolean;
  timestamp: string;
}

export class ChatService {
  private readonly symptomExtractor: SymptomExtractorService;

  constructor(
    private readonly ragService: RAGService,
    private readonly speechService: ISpeechService,
    private readonly ttsService?: ITextToSpeechService,
    symptomExtractor?: SymptomExtractorService,
  ) {
    this.symptomExtractor = symptomExtractor ?? new SymptomExtractorService();
  }

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
        row.phone_number = identity.mobile || '';
      } else {
        row.caretaker_id = identity.caretakerId;
        // Context only (which patient this caretaker is linked to) — never
        // read back to load the patient's own AI conversation. See the
        // scoped history query in rag.service.ts, which always filters by
        // conversation_scope + caretaker_id for caretaker turns, never by
        // this patient_id.
        row.patient_id = identity.linkedPatientId;
        row.phone_number = identity.mobile || '';
      }

      const { error } = await supabaseAdmin.from('conversations').insert(row);
      if (error) {
        logger.warn('Failed to persist chat turn', { error: error.message, scope: identity.type });
      }
    } catch (err) {
      logger.warn('Unexpected error persisting chat turn', { error: (err as Error).message });
    }
  }

  /**
   * Retrieves conversation history scoped to the caller's identity
   * (patient or caretaker) so the mobile app displays full message history.
   */
  async getHistory(identity: ChatIdentity, limit = 50): Promise<ChatHistoryItem[]> {
    try {
      let query = supabaseAdmin
        .from('conversations')
        .select('id, direction, message_type, content, transcript, timestamp')
        .eq('conversation_scope', identity.type);

      if (identity.type === 'patient') {
        query = query.eq('patient_id', identity.patientId);
      } else {
        query = query.eq('caretaker_id', identity.caretakerId);
      }

      const { data, error } = await query
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error || !data) {
        logger.warn('Failed to load chat history', { error: error?.message, scope: identity.type });
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        speaker: row.direction === 'inbound' ? 'me' : 'pal',
        body: row.transcript || row.content || '',
        isVoice: row.message_type === 'audio',
        timestamp: row.timestamp,
      }));
    } catch (err) {
      logger.warn('Unexpected error loading chat history', { error: (err as Error).message });
      return [];
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
    const [reply, detectedSymptoms] = await Promise.all([
      this.generateReply(identity, trimmed),
      identity.type === 'patient'
        ? this.symptomExtractor.extractSymptoms(trimmed).catch(() => [])
        : Promise.resolve([]),
    ]);
    await this.persistTurn(identity, 'outbound', reply, 'text');

    return {
      reply,
      ...(detectedSymptoms && detectedSymptoms.length > 0 && { detectedSymptoms }),
    };
  }

  /** POST /api/chat/voice — STT transcription + natural text reply with automatic symptom detection. */
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
      const [reply, detectedSymptoms] = await Promise.all([
        this.generateReply(identity, transcript),
        identity.type === 'patient'
          ? this.symptomExtractor.extractSymptoms(transcript).catch(() => [])
          : Promise.resolve([]),
      ]);
      await this.persistTurn(identity, 'outbound', reply, 'text');

      return {
        transcript,
        reply,
        ...(detectedSymptoms && detectedSymptoms.length > 0 && { detectedSymptoms }),
      };
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
