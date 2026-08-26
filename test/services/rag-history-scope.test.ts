/**
 * Phase 2 (Chat Bridge) — verifies RAGService's scoped conversation-history
 * loading: a patient's turns and a caretaker's turns never bleed into each
 * other's context, and the WhatsApp phoneNumber path only ever sees rows
 * explicitly tagged conversation_scope='whatsapp' (the safe additive filter
 * added alongside the new scoped path). No network calls: English input
 * skips translation, and vector search is stubbed to return no chunks, so
 * this only exercises the history-loading branch under test.
 */
import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { RAGService } from '@services/knowledge/rag.service';
import { VectorSearchService } from '@services/knowledge/vector-search.service';
import { IChatService } from '@services/ai/interfaces';

function seedConversation(overrides: Record<string, unknown>) {
  const table = fakeClient.table('conversations');
  table.rows.push({
    id: `conv-${table.rows.length + 1}`,
    conversation_scope: 'whatsapp',
    direction: 'inbound',
    content: '',
    transcript: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  });
}

describe('RAGService scoped conversation history (Phase 2)', () => {
  let capturedUserPrompt = '';
  let fakeChatService: IChatService;

  beforeEach(() => {
    fakeClient.reset();
    capturedUserPrompt = '';

    jest.spyOn(VectorSearchService.prototype, 'searchSimilarChunks').mockResolvedValue([]);

    fakeChatService = {
      generateResponse: jest.fn(async () => 'unused'),
      generateCustomCompletion: jest.fn(async (_system: string, userMessage: string) => {
        capturedUserPrompt = userMessage;
        return 'A grounded reply.';
      }),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it("only loads the patient's own patient-scoped history, never caretaker-scoped rows for the same patient", async () => {
    seedConversation({
      patient_id: 'patient-1',
      conversation_scope: 'patient',
      direction: 'inbound',
      content: 'I have been feeling low this week.',
    });
    seedConversation({
      patient_id: 'patient-1',
      caretaker_id: 'caretaker-1',
      conversation_scope: 'caretaker',
      direction: 'inbound',
      content: 'How can I help her sleep better?',
    });

    const rag = new RAGService(fakeChatService);
    await rag.generateAnswer('How are you feeling today', {
      conversationScope: 'patient',
      patientId: 'patient-1',
      audience: 'patient',
    });

    expect(capturedUserPrompt).toContain('I have been feeling low this week.');
    expect(capturedUserPrompt).not.toContain('How can I help her sleep better?');
  });

  it("only loads the caretaker's own caretaker-scoped history, never the linked patient's patient-scoped rows", async () => {
    seedConversation({
      patient_id: 'patient-1',
      conversation_scope: 'patient',
      direction: 'inbound',
      content: 'A private thing the patient told Dear Pal.',
    });
    seedConversation({
      patient_id: 'patient-1',
      caretaker_id: 'caretaker-1',
      conversation_scope: 'caretaker',
      direction: 'inbound',
      content: 'What if she misses a dose?',
    });

    const rag = new RAGService(fakeChatService);
    await rag.generateAnswer('Any general tips for supporting her', {
      conversationScope: 'caretaker',
      caretakerId: 'caretaker-1',
      patientId: 'patient-1',
      audience: 'caretaker',
    });

    expect(capturedUserPrompt).toContain('What if she misses a dose?');
    expect(capturedUserPrompt).not.toContain('A private thing the patient told Dear Pal.');
  });

  it('a different caretaker never sees this caretaker\'s conversation history', async () => {
    seedConversation({
      patient_id: 'patient-1',
      caretaker_id: 'caretaker-1',
      conversation_scope: 'caretaker',
      direction: 'inbound',
      content: 'Caretaker-1 only content.',
    });

    const rag = new RAGService(fakeChatService);
    await rag.generateAnswer('General question', {
      conversationScope: 'caretaker',
      caretakerId: 'caretaker-2',
      patientId: 'patient-1',
      audience: 'caretaker',
    });

    expect(capturedUserPrompt).not.toContain('Caretaker-1 only content.');
  });

  it('WhatsApp history stays scoped to conversation_scope=whatsapp even when a patient/caretaker row shares the same phone number', async () => {
    seedConversation({
      phone_number: '9999999999',
      conversation_scope: 'whatsapp',
      direction: 'inbound',
      content: 'WhatsApp message content.',
    });
    seedConversation({
      phone_number: '9999999999',
      patient_id: 'patient-1',
      conversation_scope: 'patient',
      direction: 'inbound',
      content: 'App chat message content.',
    });

    const rag = new RAGService(fakeChatService);
    await rag.generateAnswer('Hello', { phoneNumber: '9999999999' });

    expect(capturedUserPrompt).toContain('WhatsApp message content.');
    expect(capturedUserPrompt).not.toContain('App chat message content.');
  });
});
