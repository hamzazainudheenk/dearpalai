import { FakeSupabaseClient } from '../support/fake-supabase';

const fakeClient = new FakeSupabaseClient();
jest.mock('@config/supabase', () => ({ supabaseAdmin: fakeClient }));

import { ChatService } from '@services/chat.service';
import { RAGService } from '@services/knowledge/rag.service';
import { ISpeechService, ITextToSpeechService } from '@services/ai/interfaces';
import { ChatIdentity } from '@middleware/auth.middleware';

function makeRagStub(answer = 'A grounded reply.') {
  return {
    generateAnswer: jest.fn(async () => ({ answer, sources: [], hasEscalationFlag: false })),
  } as unknown as RAGService;
}

const patientIdentity: ChatIdentity = { type: 'patient', patientId: 'patient-1', mobile: '9876543210' };
const caretakerIdentity: ChatIdentity = {
  type: 'caretaker',
  caretakerId: 'caretaker-1',
  mobile: '9123456780',
  linkedPatientId: 'patient-1',
};

describe('ChatService.sendMessage', () => {
  beforeEach(() => fakeClient.reset());

  it('rejects an empty message without calling the RAG service', async () => {
    const rag = makeRagStub();
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    await expect(service.sendMessage(patientIdentity, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect((rag.generateAnswer as jest.Mock)).not.toHaveBeenCalled();
  });

  it('patient message calls RAGService with conversationScope=patient and the patient id, and returns the reply', async () => {
    const rag = makeRagStub('Here to listen.');
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    const result = await service.sendMessage(patientIdentity, 'I feel anxious today');

    expect(result.reply).toBe('Here to listen.');
    expect(rag.generateAnswer).toHaveBeenCalledWith(
      'I feel anxious today',
      expect.objectContaining({ conversationScope: 'patient', patientId: 'patient-1', audience: 'patient' }),
    );
  });

  it("patient conversation persists both turns tagged conversation_scope='patient' and restorable by patient_id", async () => {
    const rag = makeRagStub('Reply text.');
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    await service.sendMessage(patientIdentity, 'Hello Dear Pal');

    const rows = fakeClient.table('conversations').rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.conversation_scope === 'patient')).toBe(true);
    expect(rows.every((r) => r.patient_id === 'patient-1')).toBe(true);
    expect(rows.find((r) => r.direction === 'inbound')?.content).toBe('Hello Dear Pal');
    expect(rows.find((r) => r.direction === 'outbound')?.content).toBe('Reply text.');
  });

  it('caretaker message calls RAGService with conversationScope=caretaker and the caretaker id (never the linked patient id as caretakerId)', async () => {
    const rag = makeRagStub('Caretaker guidance.');
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    const result = await service.sendMessage(caretakerIdentity, 'How can I help her sleep?');

    expect(result.reply).toBe('Caretaker guidance.');
    expect(rag.generateAnswer).toHaveBeenCalledWith(
      'How can I help her sleep?',
      expect.objectContaining({ conversationScope: 'caretaker', caretakerId: 'caretaker-1', audience: 'caretaker' }),
    );
  });

  it("caretaker conversation persists separately, tagged conversation_scope='caretaker' and caretaker_id", async () => {
    const rag = makeRagStub('Reply text.');
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    await service.sendMessage(caretakerIdentity, 'What if she misses a dose?');

    const rows = fakeClient.table('conversations').rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.conversation_scope === 'caretaker')).toBe(true);
    expect(rows.every((r) => r.caretaker_id === 'caretaker-1')).toBe(true);
  });

  it('a patient conversation and a caretaker conversation for the same patient never share rows', async () => {
    const rag = makeRagStub('Reply text.');
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    await service.sendMessage(patientIdentity, 'Patient message');
    await service.sendMessage(caretakerIdentity, 'Caretaker message');

    const rows = fakeClient.table('conversations').rows;
    const patientRows = rows.filter((r) => r.conversation_scope === 'patient');
    const caretakerRows = rows.filter((r) => r.conversation_scope === 'caretaker');

    expect(patientRows).toHaveLength(2);
    expect(caretakerRows).toHaveLength(2);
    expect(patientRows.some((r) => r.content === 'Caretaker message')).toBe(false);
    expect(caretakerRows.some((r) => r.content === 'Patient message')).toBe(false);
  });

  it('maps a RAG failure to a safe generic error, never the underlying error message', async () => {
    const rag = {
      generateAnswer: jest.fn(async () => {
        throw new Error('OpenAI API key invalid: sk-verysecret123');
      }),
    } as unknown as RAGService;
    const service = new ChatService(rag, {} as ISpeechService, {} as ITextToSpeechService);

    await expect(service.sendMessage(patientIdentity, 'Hello')).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
    await expect(service.sendMessage(patientIdentity, 'Hello')).rejects.not.toMatchObject({
      message: expect.stringContaining('sk-verysecret123'),
    });
  });
});

describe('ChatService.sendVoiceMessage', () => {
  beforeEach(() => fakeClient.reset());

  it('transcribes via the speech service, generates a reply via RAG, and extracts symptoms', async () => {
    const rag = makeRagStub('Spoken reply.');
    const speech: ISpeechService = { transcribe: jest.fn(async () => ({ text: 'എനിക്ക് ഉറക്കം വരുന്നില്ല', confidence: 1, language: 'ml', durationSeconds: 2 })) };

    const service = new ChatService(rag, speech);
    const result = await service.sendVoiceMessage(patientIdentity, Buffer.from('fake-input-audio'), 'audio/m4a');

    expect(result.transcript).toBe('എനിക്ക് ഉറക്കം വരുന്നില്ല');
    expect(result.reply).toBe('Spoken reply.');
    expect(result.detectedSymptoms).toBeDefined();
    expect(result.detectedSymptoms?.length).toBeGreaterThan(0);
    expect(result.detectedSymptoms?.[0].name).toBe('Sleep trouble');
    expect(rag.generateAnswer).toHaveBeenCalledWith('എനിക്ക് ഉറക്കം വരുന്നില്ല', expect.objectContaining({ conversationScope: 'patient' }));
  });

  it('delivers clean text reply for voice messages', async () => {
    const rag = makeRagStub('Spoken reply.');
    const speech: ISpeechService = { transcribe: jest.fn(async () => ({ text: 'Hello', confidence: 1, language: 'en', durationSeconds: 1 })) };

    const service = new ChatService(rag, speech);
    const result = await service.sendVoiceMessage(patientIdentity, Buffer.from('audio'), 'audio/m4a');

    expect(result.reply).toBe('Spoken reply.');
    expect(result.audioBase64).toBeUndefined();
  });

  it('rejects with a safe error when STT fails', async () => {
    const rag = makeRagStub();
    const speech: ISpeechService = { transcribe: jest.fn(async () => { throw new Error('Sarvam STT down'); }) };
    const tts: ITextToSpeechService = { textToSpeech: jest.fn(async () => Buffer.from('x')) };

    const service = new ChatService(rag, speech, tts);
    await expect(service.sendVoiceMessage(patientIdentity, Buffer.from('audio'), 'audio/m4a')).rejects.toMatchObject({
      code: 'STT_UNAVAILABLE',
    });
  });

  it('rejects when the transcription is empty', async () => {
    const rag = makeRagStub();
    const speech: ISpeechService = { transcribe: jest.fn(async () => ({ text: '', confidence: 0, language: 'en', durationSeconds: 0 })) };
    const tts: ITextToSpeechService = { textToSpeech: jest.fn(async () => Buffer.from('x')) };

    const service = new ChatService(rag, speech, tts);
    await expect(service.sendVoiceMessage(patientIdentity, Buffer.from('audio'), 'audio/m4a')).rejects.toMatchObject({
      code: 'EMPTY_TRANSCRIPT',
    });
  });
});
