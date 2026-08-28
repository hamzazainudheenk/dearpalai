import OpenAI from 'openai';
import { logger } from '@utils/logger';
import { aiConfig } from '@config/ai';

export type CanonicalSymptom =
  | 'Sleep trouble'
  | 'Low mood'
  | 'Anxiety or restlessness'
  | 'Racing thoughts'
  | 'Appetite change'
  | 'Side effects'
  | 'Tiredness'
  | 'Irritability';

export type SymptomSeverity = 'Mild' | 'Moderate' | 'Severe';

export interface ExtractedSymptom {
  name: CanonicalSymptom;
  level: SymptomSeverity;
}

const CANONICAL_SYMPTOMS: CanonicalSymptom[] = [
  'Sleep trouble',
  'Low mood',
  'Anxiety or restlessness',
  'Racing thoughts',
  'Appetite change',
  'Side effects',
  'Tiredness',
  'Irritability',
];

interface SymptomPattern {
  name: CanonicalSymptom;
  patterns: RegExp[];
}

const SYMPTOM_PATTERNS: SymptomPattern[] = [
  {
    name: 'Sleep trouble',
    patterns: [
      /ഉറക്ക[ം്]/i,
      /ഉറങ്ങാൻ\s*പറ്റുന്നില്ല/i,
      /ഉറക്കം\s*വരുന്നില്ല/i,
      /ഉറക്കം\s*കിട്ടുന്നില്ല/i,
      /sleep|insomnia|wake\s*up|nightmare|can'?t\s*sleep|urakkam|urangana/i,
    ],
  },
  {
    name: 'Low mood',
    patterns: [
      /സങ്കട[ം്]/i,
      /വിഷമ[ം്]/i,
      /മടുപ്പ്/i,
      /കരച്ചിൽ/i,
      /ഒരു\s*താൽപ്പര്യവുമില്ല/i,
      /depress|sad|hopeless|crying|down|low\s*mood|vishamam|sankadam|maduppu/i,
    ],
  },
  {
    name: 'Anxiety or restlessness',
    patterns: [
      /പേടി/i,
      /ഭയം/i,
      /പരിഭ്രമ[ം്]/i,
      /നെഞ്ചിടിപ്പ്/i,
      /വെപ്രാള[ം്]/i,
      /anxious|anxiety|panic|nervous|worry|restless|palpitation|pedi|bhayam|vepralam/i,
    ],
  },
  {
    name: 'Racing thoughts',
    patterns: [
      /ചിന്തകൾ/i,
      /ആലോചനകൾ/i,
      /തലയിൽ\s*ഒരുപാട്/i,
      /തല\s*പുകയുന്നു/i,
      /overthink|racing\s*thoughts|racing\s*mind|too\s*many\s*thoughts|chinthakal|alochana/i,
    ],
  },
  {
    name: 'Appetite change',
    patterns: [
      /വിശപ്പില്ല/i,
      /ഭക്ഷണം\s*കഴിക്കാൻ\s*തോന്നുന്നില്ല/i,
      /വിശപ്പ്/i,
      /appetite|eating|not\s*eating|lost\s*appetite|vishapp/i,
    ],
  },
  {
    name: 'Side effects',
    patterns: [
      /ഗുളിക/i,
      /മരുന്ന്/i,
      /തലകറക്ക[ം്]/i,
      /ഛർദ്ദി/i,
      /side\s*effect|nausea|dizzy|drowsy|tremor|gulika|marunnu|thalakarakkam/i,
    ],
  },
  {
    name: 'Tiredness',
    patterns: [
      /ക്ഷീണ[ം്]/i,
      /തളർച്ച/i,
      /ഒരു\s*ഊർജ്ജവുമില്ല/i,
      /tired|fatigue|exhausted|no\s*energy|weak|ksheenam|thalarcha/i,
    ],
  },
  {
    name: 'Irritability',
    patterns: [
      /ദേഷ്യ[ം്]/i,
      /അസ്വസ്ഥത/i,
      /ദേഷ്യം\s*വരുന്നു/i,
      /angry|irritat|temper|annoy|deshyam|aswasthatha/i,
    ],
  },
];

export class SymptomExtractorService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    if (this.client) return this.client;
    const apiKey = process.env.OPENAI_API_KEY || aiConfig.openai.apiKey;
    if (apiKey && apiKey.trim() !== '' && !apiKey.includes('your_openai_api_key_here')) {
      this.client = new OpenAI({ apiKey: apiKey.trim() });
      return this.client;
    }
    return null;
  }

  /**
   * Fast regex-based extractor for instant matching without network calls.
   */
  private extractByPatterns(text: string): ExtractedSymptom[] {
    const results: ExtractedSymptom[] = [];
    const matchedNames = new Set<CanonicalSymptom>();

    // Detect severity markers
    let level: SymptomSeverity = 'Mild';
    if (/ഭയങ്കര|വല്ലാതെ|വളരെ|കൂടുതൽ|തീരെ|severe|very|intense|terrible|extreme|unbearable/i.test(text)) {
      level = 'Severe';
    } else if (/കുറച്ച്|ഇടയ്ക്കിടെ|moderate|quite|fairly/i.test(text)) {
      level = 'Moderate';
    }

    for (const item of SYMPTOM_PATTERNS) {
      if (matchedNames.has(item.name)) continue;
      for (const pattern of item.patterns) {
        if (pattern.test(text)) {
          matchedNames.add(item.name);
          results.push({ name: item.name, level });
          break;
        }
      }
    }

    return results;
  }

  /**
   * Extracts symptoms mentioned by the patient from their chat message.
   * Runs pattern matching first, and uses OpenAI if text is ambiguous.
   */
  async extractSymptoms(messageText: string): Promise<ExtractedSymptom[]> {
    const trimmed = (messageText || '').trim();
    if (!trimmed) return [];

    // 1. Fast heuristic pattern check
    const patternResults = this.extractByPatterns(trimmed);
    if (patternResults.length > 0) {
      return patternResults;
    }

    // 2. If no pattern matched, but message has substance (> 3 words), use LLM
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) return [];

    const openai = this.getClient();
    if (!openai) return [];

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || aiConfig.openai.model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a clinical symptom detector for psychiatric outpatient care in Kerala.
Analyze the user's message (which may be Malayalam in Malayalam script, Manglish in Latin script, or English).
Extract any health / psychiatric symptoms mentioned.
Only pick from the allowed categories:
["Sleep trouble", "Low mood", "Anxiety or restlessness", "Racing thoughts", "Appetite change", "Side effects", "Tiredness", "Irritability"]

Assign severity: "Mild", "Moderate", or "Severe".
If no symptoms are present, return an empty array.
Return JSON ONLY in format:
{"symptoms": [{"name": "...", "level": "..."}]}`,
          },
          {
            role: 'user',
            content: trimmed,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 150,
      });

      const rawJson = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawJson);
      const items: ExtractedSymptom[] = [];

      if (Array.isArray(parsed.symptoms)) {
        for (const s of parsed.symptoms) {
          if (CANONICAL_SYMPTOMS.includes(s.name)) {
            const lvl = ['Mild', 'Moderate', 'Severe'].includes(s.level) ? s.level : 'Mild';
            items.push({ name: s.name as CanonicalSymptom, level: lvl as SymptomSeverity });
          }
        }
      }

      return items;
    } catch (err) {
      logger.warn('LLM symptom extraction failed; falling back to empty', {
        error: (err as Error).message,
      });
      return [];
    }
  }
}
