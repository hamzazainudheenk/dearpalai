import { SarvamAIClient } from 'sarvamai';
import { logger } from '@utils/logger';

export class SarvamChatService {
  private client = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY!,
  });

  private readonly systemPrompt = `You are DearPal.

You are a compassionate emotional support companion.

Your purpose is to help people feel heard and supported.

Rules:

- Listen before giving advice.
- Validate emotions naturally.
- Reply in the user's language.
- Be warm, calm and human.
- Ask one thoughtful follow-up question when appropriate.
- Never diagnose medical or psychiatric conditions.
- Never claim to be a psychologist or psychiatrist.
- Encourage professional help when symptoms seem severe or persistent.
- If the user expresses suicidal thoughts or immediate danger, respond calmly, encourage contacting trusted people and local emergency services, and avoid giving unsafe advice.
- Keep responses short (2–6 sentences).
- Do not use robotic phrases.`;

  async generateResponse(userMessage: string): Promise<string> {
    logger.info('Calling Sarvam Chat Completion', {
      userMessageLength: userMessage.length,
    });

    const response = await this.client.chat.completions({
      model: 'sarvam-105b',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: this.systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    logger.info('Sarvam Chat Completion complete');

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response content received from Sarvam Chat API');
    }

    return content;
  }

  /**
   * Generates a grounded completion using Sarvam 105B with a custom system prompt and user message context.
   */
  async generateCustomCompletion(
    systemPrompt: string,
    userMessage: string,
    temperature = 0.3
  ): Promise<string> {
    logger.info('Calling Sarvam 105B Custom Completion', {
      userMessageLength: userMessage.length,
      temperature,
    });

    const response = await this.client.chat.completions({
      model: 'sarvam-105b',
      temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    logger.info('Sarvam 105B Custom Completion complete');

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response content received from Sarvam 105B API');
    }

    return content;
  }
}
