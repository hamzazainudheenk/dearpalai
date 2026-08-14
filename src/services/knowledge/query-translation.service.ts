import axios from 'axios';
import { logger } from '@utils/logger';
import { aiConfig } from '@config/ai';

export interface TranslationResult {
  translatedText: string;
  originalText: string;
  sourceLanguage: 'en' | 'ml' | 'mixed';
  isTranslated: boolean;
  durationMs?: number;
}

/**
 * Common Manglish (Malayalam written in Latin script) keyword patterns
 */
const MANGLISH_PATTERNS = [
  /\b(undakumo|undakum|undo|undu|ille|illa|aano|aanengil|enikk|enikku|thonnunnu|thonnunno)\b/i,
  /\b(cheyyanam|cheyyaam|cheyyenda|entha|enthaanu|engane|enganeanu|nallathano|nallathanoo)\b/i,
  /\b(varumo|pattam|pattumo|karanamaano|preshnam|preshnangal|laksanam|laksanamano)\b/i,
];

export class QueryTranslationService {
  /**
   * Detects the language category of the user query text.
   * Uses practical script regex and word pattern checks without making additional LLM calls.
   */
  detectLanguage(text: string): 'en' | 'ml' | 'mixed' {
    const trimmed = text.trim();

    // Check for Malayalam Unicode script (\u0D00-\u0D7F)
    const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(trimmed);
    const hasLatinLetters = /[a-zA-Z]/.test(trimmed);

    if (hasMalayalamScript) {
      return hasLatinLetters ? 'mixed' : 'ml';
    }

    // Check for Manglish patterns in Latin script
    const isManglish = MANGLISH_PATTERNS.some((pattern) => pattern.test(trimmed));
    if (isManglish) {
      return 'mixed';
    }

    // Check if purely English Latin ASCII
    const isPureEnglish = /^[a-zA-Z0-9\s.,?!'"()\--]+$/.test(trimmed);
    if (isPureEnglish) {
      return 'en';
    }

    // Default fallback for ambiguous non-English text
    return 'mixed';
  }

  /**
   * Translates non-English (Malayalam / Manglish / Mixed) queries into clear English for vector search.
   * If query is purely English or if translation fails, returns the original query.
   */
  async translateToEnglish(text: string): Promise<TranslationResult> {
    const startTime = Date.now();
    const originalText = text?.trim() || '';
    if (!originalText) {
      return {
        translatedText: '',
        originalText: '',
        sourceLanguage: 'en',
        isTranslated: false,
        durationMs: 0,
      };
    }

    const sourceLanguage = this.detectLanguage(originalText);

    // Pure English queries do not require translation
    if (sourceLanguage === 'en' || !aiConfig.translation.enabled) {
      return {
        translatedText: originalText,
        originalText,
        sourceLanguage: 'en',
        isTranslated: false,
        durationMs: Date.now() - startTime,
      };
    }

    const apiKey = process.env.SARVAM_API_KEY || aiConfig.sarvam.apiKey;
    if (!apiKey || apiKey.trim() === '') {
      logger.warn('SARVAM_API_KEY missing, skipping translation and falling back to original query');
      return {
        translatedText: originalText,
        originalText,
        sourceLanguage,
        isTranslated: false,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const response = await axios.post(
        aiConfig.translation.apiUrl,
        {
          input: originalText,
          source_language_code: 'ml-IN',
          target_language_code: 'en-IN',
          mode: 'formal',
          model: aiConfig.translation.model,
        },
        {
          headers: {
            'api-subscription-key': apiKey.trim(),
            'Content-Type': 'application/json',
          },
          timeout: aiConfig.sarvam.timeoutMs || 15000,
        }
      );

      const durationMs = Date.now() - startTime;
      const rawTranslated = response.data?.translated_text?.trim() || '';

      if (!rawTranslated) {
        throw new Error('Empty translation output received from Sarvam Translate API');
      }

      logger.info('Query translation completed', {
        sourceLanguage,
        isTranslated: true,
        originalTextLength: originalText.length,
        retrievalTextLength: rawTranslated.length,
        durationMs,
      });

      return {
        translatedText: rawTranslated,
        originalText,
        sourceLanguage,
        isTranslated: true,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      logger.warn('Query translation failed, falling back to original query', {
        sourceLanguage,
        error: err?.message || 'Sarvam translate request error',
        durationMs,
      });

      // Safe fallback to original text if translation API fails
      return {
        translatedText: originalText,
        originalText,
        sourceLanguage,
        isTranslated: false,
        durationMs,
      };
    }
  }
}
