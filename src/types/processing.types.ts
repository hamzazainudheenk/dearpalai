/**
 * Processing Layer Type Definitions
 *
 * Types for the message processing pipeline, conversation metadata,
 * and AI service contracts.
 */

import { MessageType } from './whatsapp.types';

// ─── Parsed Message ──────────────────────────────────────

/** Normalized message after parsing the webhook payload */
export interface ParsedMessage {
  /** WhatsApp message ID */
  messageId: string;
  /** Sender phone number (international format) */
  phoneNumber: string;
  /** Message timestamp (Unix epoch string) */
  timestamp: string;
  /** Classified message type */
  messageType: MessageType;
  /** Text content (for text messages) */
  textContent?: string;
  /** Media ID (for audio/image messages) */
  mediaId?: string;
  /** MIME type of media (for audio/image messages) */
  mimeType?: string;
  /** Sender profile name, if available */
  senderName?: string;
}

// ─── Processing Result ───────────────────────────────────

/** Result of processing a message through the pipeline */
export interface ProcessingResult {
  /** Whether processing completed successfully */
  success: boolean;
  /** The reply message to send back */
  reply?: string;
  /** Processing source (e.g., 'static', 'ai-pipeline', 'error') */
  source: string;
  /** Processing metadata for logging and debugging */
  metadata?: Record<string, unknown>;
  /** Path to downloaded audio file, if applicable */
  audioFilePath?: string;
  /** Transcription result if voice message */
  transcription?: TranscriptionResult;
  /** Error details if processing failed */
  error?: string;
}

// ─── Conversation Record ─────────────────────────────────

/** Metadata record for conversation tracking */
export interface ConversationRecord {
  /** Unique conversation ID (UUID) */
  conversationId: string;
  /** WhatsApp message ID */
  messageId: string;
  /** Sender phone number */
  phoneNumber: string;
  /** Message timestamp */
  timestamp: string;
  /** Message type */
  messageType: MessageType;
  /** Text content or transcription */
  content?: string;
  /** Path to downloaded audio file */
  audioFilePath?: string;
  /** Processing result */
  processingResult?: ProcessingResult;
  /** When this record was created */
  createdAt: Date;
}

// ─── AI Service Result Types (Phase 2 Contracts) ────────

/** Result from Speech-to-Text service */
export interface TranscriptionResult {
  /** Transcribed text */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected language code */
  language: string;
  /** Duration of audio in seconds */
  durationSeconds?: number;
}

/** Result from Embedding service */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: number[];
  /** Model used for embedding */
  model: string;
  /** Number of tokens processed */
  tokenCount?: number;
}

/** Result from RAG retrieval */
export interface RagResult {
  /** Retrieved documents */
  documents: RagDocument[];
  /** Query that was used */
  query: string;
  /** Whether relevant results were found */
  hasRelevantResults: boolean;
}

/** Single document from RAG retrieval */
export interface RagDocument {
  /** Document content */
  content: string;
  /** Similarity score */
  score: number;
  /** Document metadata */
  metadata: Record<string, unknown>;
}

/** Result from Risk Assessment */
export interface RiskAssessmentResult {
  /** Risk level classification */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Risk score (0-1) */
  score: number;
  /** Specific risk flags detected */
  flags: string[];
  /** Whether immediate escalation is needed */
  requiresEscalation: boolean;
}

/** Result from Decision Engine */
export interface DecisionResult {
  /** Final reply to send to user */
  reply: string;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Source of the decision */
  source: 'mock' | 'rag' | 'ai' | 'fallback' | 'escalation';
  /** Whether to escalate to a human */
  shouldEscalate: boolean;
  /** Additional reasoning metadata */
  reasoning?: string;
}

// ─── AI Pipeline Types ───────────────────────────────────

/** Input to the AI Pipeline orchestrator */
export interface AIPipelineInput {
  /** The parsed incoming message */
  message: ParsedMessage;
  /** Path to audio file if this is a voice message */
  audioFilePath?: string;
  /** Conversation history for context */
  conversationHistory?: ConversationRecord[];
}

/** Output from the AI Pipeline orchestrator */
export interface AIPipelineOutput {
  /** Final reply message */
  reply: string;
  /** Transcription result (if voice message) */
  transcription?: TranscriptionResult;
  /** RAG retrieval result */
  ragResult?: RagResult;
  /** Risk assessment result */
  riskAssessment?: RiskAssessmentResult;
  /** Decision engine result */
  decision?: DecisionResult;
  /** Overall pipeline success */
  success: boolean;
  /** Pipeline processing source */
  source: string;
}

// ─── Processor Interface ─────────────────────────────────

/** Interface for message type processors */
export interface IMessageProcessor {
  process(message: ParsedMessage): Promise<ProcessingResult>;
}

// ─── Store Interface ─────────────────────────────────────

/** Interface for conversation data storage */
export interface IConversationStore {
  /** Store a conversation record */
  store(record: ConversationRecord): Promise<void>;
  /** Retrieve records by phone number */
  getByPhone(phoneNumber: string): Promise<ConversationRecord[]>;
  /** Retrieve a single record by conversation ID */
  getByConversationId(conversationId: string): Promise<ConversationRecord | null>;
  /** Retrieve a single record by message ID */
  getByMessageId(messageId: string): Promise<ConversationRecord | null>;
  /** Get recent conversation history for a phone number */
  getRecentHistory(phoneNumber: string, limit?: number): Promise<ConversationRecord[]>;
}
