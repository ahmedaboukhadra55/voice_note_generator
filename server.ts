import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
import multer from 'multer';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const app = express();
const PORT = 3000;

// Configure multer for in-memory file uploads (max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json({ limit: '15mb' }));

// Helper to get or initialize Google Gen AI instance
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const key = (customApiKey || process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!key) {
    throw new Error('لم يتم العثور على مفتاح Gemini API. يرجى إدخال مفتاحك في إعدادات التطبيق أو عبر متغير البيئة GEMINI_API_KEY.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

/**
 * Intelligent error parser for Gemini API responses
 * Cleans raw JSON blobs and extracts actionable quota & retry info
 */
function parseGeminiError(err: any): {
  isQuota: boolean;
  isTransient: boolean;
  isAuth: boolean;
  retryAfterSeconds: number;
  userMessage: string;
} {
  const rawMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err || ''));
  let isQuota = false;
  let isTransient = false;
  let isAuth = false;
  let retryAfterSeconds = 0;

  // Extract retry delay from error string / JSON / details
  const retrySecMatch =
    rawMsg.match(/retry (?:in )?([0-9.]+)\s*s/i) ||
    rawMsg.match(/"retryDelay":\s*"([0-9]+)s"/i) ||
    rawMsg.match(/retry after ([0-9]+)/i);

  if (retrySecMatch) {
    retryAfterSeconds = Math.ceil(parseFloat(retrySecMatch[1])) || 30;
  }

  if (
    rawMsg.includes('429') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('Quota exceeded') ||
    rawMsg.includes('rate-limit') ||
    rawMsg.includes('rate_limit')
  ) {
    isQuota = true;
    if (retryAfterSeconds === 0) retryAfterSeconds = 45;
  }

  if (
    rawMsg.includes('503') ||
    rawMsg.includes('UNAVAILABLE') ||
    rawMsg.includes('high demand') ||
    rawMsg.includes('temporarily unavailable')
  ) {
    isTransient = true;
    if (retryAfterSeconds === 0) retryAfterSeconds = 15;
  }

  if (
    rawMsg.includes('401') ||
    rawMsg.includes('UNAUTHENTICATED') ||
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('invalid authentication') ||
    rawMsg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')
  ) {
    isAuth = true;
  }

  let userMessage = 'تعذر استكمال العملية بواسطة الذكاء الاصطناعي.';
  if (isAuth) {
    userMessage =
      'مفتاح Gemini API غير صالح أو غير معتمد. يرجى النقر على أيقونة المفتاح في أعلى الصفحة وإدخال مفتاح API سليم من Google AI Studio.';
  } else if (isQuota) {
    userMessage = `تم الوصول للحد المؤقت لطلبات النموذج المجانية (429 Quota Exceeded). يرجى الانتظار ${retryAfterSeconds} ثانية لتجديد الحصة أو استخدام مفتاح API مخصص.`;
  } else if (isTransient) {
    userMessage =
      'خدمة الذكاء الاصطناعي تشهد ضغطاً مؤقتاً في الوقت الحالي (503 High Demand). يرجى المحاولة بعد لحظات.';
  }

  return {
    isQuota,
    isTransient,
    isAuth,
    retryAfterSeconds,
    userMessage,
  };
}

// Resilient Gemini generateContent helper with automatic retry and model fallback
async function generateContentWithRetry(
  ai: GoogleGenAI,
  request: {
    contents: any;
    config?: any;
    model?: string;
  },
  candidateModels: string[] = ['gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']
) {
  let lastError: any = null;

  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...request,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const parsed = parseGeminiError(err);

        console.warn(
          `Gemini API warning [model: ${modelName}, attempt ${attempt}]: ${parsed.userMessage} (raw: ${err?.message?.slice(0, 120)})`
        );

        if (parsed.isTransient || (parsed.isQuota && parsed.retryAfterSeconds <= 5)) {
          const waitTime = Math.min(parsed.retryAfterSeconds * 1000 || 1500 * attempt, 5000);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          // Break to next candidate model if available
          break;
        }
      }
    }
  }

  throw lastError || new Error('تعذر الاتصال بنموذج الذكاء الاصطناعي بسبب الضغط المؤقت على الخدمة.');
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Validate API Key endpoint (tests Gemini SDK with lightweight ping)
app.post('/api/validate-key', async (req: Request, res: Response) => {
  try {
    const { customApiKey } = req.body;
    const key = (customApiKey || process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

    if (!key) {
      return res.status(400).json({
        valid: false,
        error: 'لم يتم توفير مفتاح API للفحص. يرجى لصق المفتاح أولاً.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // Test connectivity using lightweight fast model
    try {
      await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: 'ping',
      });
    } catch (testErr: any) {
      const parsed = parseGeminiError(testErr);

      // If error is 429 Quota Exceeded or 503, the key IS valid and authenticated by Google!
      if (parsed.isQuota) {
        return res.json({
          valid: true,
          isQuota: true,
          retryAfterSeconds: parsed.retryAfterSeconds,
          message: `المفتاح سليم ومطابق تماماً، لكنه يمر بفترة انتظار مؤقتة لتجديد الحصة (${parsed.retryAfterSeconds} ثانية). يمكنك استخدامه بشكل طبيعي.`,
          hasServerKey: Boolean(process.env.GEMINI_API_KEY),
        });
      }

      if (parsed.isTransient) {
        return res.json({
          valid: true,
          isTransient: true,
          message: 'المفتاح سليم وفعال، ويوجد ضغط مؤقت على الخوادم (503).',
          hasServerKey: Boolean(process.env.GEMINI_API_KEY),
        });
      }

      if (parsed.isAuth) {
        return res.status(401).json({
          valid: false,
          error: 'المفتاح غير صالح أو غير معتمد (401 Unauthenticated). تأكد من نسخ المفتاح كاملاً من Google AI Studio دون مسافات إضافية.',
        });
      }

      throw testErr;
    }

    return res.json({
      valid: true,
      message: 'مفتاح Gemini API صالح وفعال ويعمل بنجاح!',
      testedModel: 'gemini-flash-latest',
      hasServerKey: Boolean(process.env.GEMINI_API_KEY),
    });
  } catch (err: any) {
    console.error('Validation error:', err);
    const parsed = parseGeminiError(err);
    return res.status(400).json({
      valid: false,
      error: parsed.userMessage,
    });
  }
});

// In-memory voice preview cache
const voicePreviewCache = new Map<string, { audioBase64: string; mimeType: string; sampleRate: number; snippetText: string }>();

/**
 * Applies phonetic pronunciation rules for Gemini Text-To-Speech
 * Rule 1: "Mehta Tubes Limited" -> "Meh-ta Tubes Limited"
 * Rule 2: "Max Flow" / "MaxFlow" -> "Macks Flow" (ensure two distinct words to fix stress and pace)
 */
function applyTtsPronunciationRules(text: string): string {
  if (!text) return text;
  let processed = text;

  // 1. Mehta Tubes Limited pronunciation rules
  processed = processed.replace(/\bMehta\s+Tubes\s+Limited\b/gi, 'Meh-ta Tubes Limited');
  processed = processed.replace(/\bMehta\s+Tubes\b/gi, 'Meh-ta Tubes');
  processed = processed.replace(/\bMehta\b/gi, 'Meh-ta');
  processed = processed.replace(/ميهتا\s*تيوبس\s*ليمتد/gi, 'ميه-تا تيوبس ليمتد (Meh-ta Tubes Limited)');
  processed = processed.replace(/ميهتا\s*تيوبس/gi, 'ميه-تا تيوبس (Meh-ta Tubes)');
  processed = processed.replace(/ميهتا/gi, 'ميه-تا');

  // 2. Max Flow pronunciation rules (two distinct words to fix stress and pace)
  processed = processed.replace(/\bMax\s*Flow\b/gi, 'Macks Flow');
  processed = processed.replace(/\bMaxflow\b/gi, 'Macks Flow');
  processed = processed.replace(/\bMax-Flow\b/gi, 'Macks Flow');
  processed = processed.replace(/ماكس\s*فلو/gi, 'ماكس فلو (Macks Flow)');
  processed = processed.replace(/ماكسفلو/gi, 'ماكس فلو (Macks Flow)');

  return processed;
}

const VOICE_PREVIEW_SNIPPETS: Record<string, { text: string; isMale: boolean }> = {
  Kore: {
    text: 'أهلاً بحضرتك يا فندم، معاكِ سارة من مبيعات شركة تو إن. بنوفر لك أفضل حلول التوريد والتركيب.',
    isMale: false,
  },
  Zephyr: {
    text: 'مساء الخير يا فندم! بنقدملك أحدث عروض شركة تو إن للوكالات العالمية ومعدات الأمن الصناعي.',
    isMale: false,
  },
  Puck: {
    text: 'أهلاً يا فندم، معاك أحمد مهندس المبيعات بشركة تو إن، جاهز لمساعدتك في مواصفات المواسير والمحابس.',
    isMale: true,
  },
  Fenrir: {
    text: 'مساء الخير يا فندم، بنوفر لحضرتك كافة توريدات المشاريع الكبرى والمناقصات الصناعية بمواصفات عالمية معتمدة.',
    isMale: true,
  },
  Charon: {
    text: 'أهلاً بحضرتك، شركة تو إن للتجارة والتوكيلات، الوكيل المعتمد لكبرى المصانع العالمية في قطاع البترول والمواسير.',
    isMale: true,
  },
};

// Voice Preview Endpoint for Instant Sample Playback
app.post('/api/preview-voice', async (req: Request, res: Response) => {
  try {
    const { voiceId = 'Kore', customApiKey } = req.body;
    const voiceKey = voiceId in VOICE_PREVIEW_SNIPPETS ? voiceId : 'Kore';
    const previewData = VOICE_PREVIEW_SNIPPETS[voiceKey];

    const cacheKey = `${voiceKey}_${customApiKey ? (customApiKey as string).slice(-6) : 'default'}`;
    if (voicePreviewCache.has(cacheKey)) {
      const cached = voicePreviewCache.get(cacheKey)!;
      return res.json({
        ...cached,
        voiceId: voiceKey,
      });
    }

    const ai = getGeminiClient(customApiKey);
    const vocalDirection = previewData.isMale
      ? `You are an authentic Egyptian male sales engineer speaking naturally in Egyptian Arabic dialect (لهجة مصرية). Clear, friendly, professional.`
      : `You are a polished Egyptian sales businesswoman speaking in an authentic, pleasant, confident Egyptian Arabic dialect (لهجة مصرية أصيلة). Clear, warm, natural.`;

    const fullPrompt = `${vocalDirection}\n\nPlease speak this short Egyptian introduction naturally:\n"${previewData.text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceKey,
            },
          },
        },
      },
    });

    let base64Audio = '';
    let mimeType = 'audio/pcm;rate=24000';
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts.length > 0) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
      }
    }

    if (!base64Audio) {
      return res.status(500).json({ error: 'تعذر توليد مقطع معاينة الصوت.' });
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    const result = {
      audioBase64: base64Audio,
      mimeType,
      sampleRate,
      snippetText: previewData.text,
    };

    voicePreviewCache.set(cacheKey, result);

    return res.json({
      ...result,
      voiceId: voiceKey,
    });
  } catch (err: any) {
    console.error('Preview voice error:', err);
    const parsed = parseGeminiError(err);
    const statusCode = parsed.isQuota ? 429 : parsed.isAuth ? 401 : 400;
    return res.status(statusCode).json({
      error: parsed.userMessage,
      isQuota: parsed.isQuota,
      isTransient: parsed.isTransient,
      retryAfterSeconds: parsed.retryAfterSeconds,
    });
  }
});

// Voice generation endpoint using official @google/genai SDK & gemini-3.1-flash-tts-preview
app.post('/api/generate-voice', async (req: Request, res: Response) => {
  try {
    const {
      scriptText,
      voiceName = 'Aoede',
      tone = 'friendly_sales',
      customApiKey,
    } = req.body;

    if (!scriptText || typeof scriptText !== 'string' || !scriptText.trim()) {
      return res.status(400).json({ error: 'الرجاء إدخال النص المطلوب تحويله إلى صوت.' });
    }

    const ai = getGeminiClient(customApiKey);

    // Clean script text from markdown formatting, emojis, or symbols that might disrupt audio flow
    const sanitizedScript = scriptText
      .replace(/[*#_`~>•]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    // Apply strict phonetic pronunciation rules for TTS (e.g. Meh-ta Tubes Limited, Macks Flow)
    const cleanScript = applyTtsPronunciationRules(sanitizedScript);

    // Map voice name to valid Gemini TTS prebuilt voices
    const validVoices = ['Aoede', 'Kore', 'Zephyr', 'Fenrir', 'Puck', 'Charon'];
    const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const isMaleVoice = selectedVoice === 'Puck' || selectedVoice === 'Charon' || selectedVoice === 'Fenrir';

    let vocalDirection = '';
    if (isMaleVoice) {
      vocalDirection = `You are an Egyptian male sales engineer speaking in an authentic, friendly, confident Egyptian Arabic dialect (لهجة مصرية). Speak naturally as a professional sales executive at 2N Trading & Agencies.`;
    } else {
      // Default: Authentic Egyptian Woman Voice
      vocalDirection = `You are a warm, polished, and charming Egyptian businesswoman (سيدة مبيعات مصرية لبقة ومقنعة) speaking in an authentic, fluent Egyptian Arabic dialect (لهجة مصرية أصيلة وودودة).
Your voice must be 100% female, clear, pleasant, expressive, and confident.
Delivery Guidelines:
- Speak naturally and cheerfully with genuine Egyptian conversational intonation ("يا فندم"، "حضرتك"، "مساء الخير").
- Speak in a smooth, engaging conversational cadence as if recording a high-quality WhatsApp voice note for a valued client.
- Pronounce technical terms and brands naturally in Egyptian Arabic (مثل: شركة تو إن للتجارة والتوكيلات، دي بي جيندال، نافكو، سيملس، إي آر دبليو، سبلاي وأبلاي، محابس، مواسير، أمن صناعي).
- Do not sound robotic, monotone, or overly fast.`;
    }

    if (tone === 'corporate') {
      vocalDirection += '\nTone: Professional, prestigious, and polished B2B corporate tone.';
    } else if (tone === 'urgent_offer') {
      vocalDirection += '\nTone: Energetic, enthusiastic, and compelling sales tone highlighting exclusive commercial opportunities.';
    } else if (tone === 'customer_care') {
      vocalDirection += '\nTone: Gentle, courteous, caring, and reassuring client follow-up tone.';
    } else {
      vocalDirection += '\nTone: Warm, friendly, welcoming, and persuasive sales pitch.';
    }

    const fullPrompt = `${vocalDirection}\n\nPlease read this Egyptian Arabic script naturally in Egyptian dialect:\n"${cleanScript}"`;

    let lastTtsError: any = null;
    let base64Audio = '';
    let mimeType = 'audio/pcm;rate=24000';

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: [{ parts: [{ text: fullPrompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (parts && parts.length > 0) {
          for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
              base64Audio = part.inlineData.data;
              mimeType = part.inlineData.mimeType || mimeType;
              break;
            }
          }
        }

        if (base64Audio) {
          break;
        } else {
          console.warn(`TTS attempt ${attempt} returned no audio part:`, JSON.stringify(response.candidates));
          lastTtsError = new Error('لم يتم استلام مقطع صوتي صالح من الخادم.');
        }
      } catch (err: any) {
        lastTtsError = err;
        const parsed = parseGeminiError(err);
        console.warn(`TTS attempt ${attempt} warning: ${parsed.userMessage}`);
        
        if (attempt < 2 && (parsed.isTransient || (parsed.isQuota && parsed.retryAfterSeconds <= 5))) {
          const waitMs = Math.min(parsed.retryAfterSeconds * 1000 || 2000, 5000);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        } else {
          break;
        }
      }
    }

    if (!base64Audio) {
      const parsed = parseGeminiError(lastTtsError);
      const statusCode = parsed.isQuota ? 429 : parsed.isAuth ? 401 : 500;
      return res.status(statusCode).json({
        error: parsed.userMessage,
        isQuota: parsed.isQuota,
        isTransient: parsed.isTransient,
        isAuth: parsed.isAuth,
        retryAfterSeconds: parsed.retryAfterSeconds,
      });
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType,
      sampleRate,
      voiceName: selectedVoice,
    });
  } catch (err: any) {
    console.error('Error generating voice:', err);
    const parsed = parseGeminiError(err);
    const statusCode = parsed.isQuota ? 429 : parsed.isAuth ? 401 : 500;
    return res.status(statusCode).json({
      error: parsed.userMessage,
      isQuota: parsed.isQuota,
      isTransient: parsed.isTransient,
      isAuth: parsed.isAuth,
      retryAfterSeconds: parsed.retryAfterSeconds,
    });
  }
});

// AI Script Polish & Rewrite Endpoint
app.post('/api/enhance-script', async (req: Request, res: Response) => {
  try {
    const {
      scriptText,
      goal = 'polish', // 'polish', 'shorten', 'expand', 'make_egyptian'
      customApiKey,
    } = req.body;

    if (!scriptText || !scriptText.trim()) {
      return res.status(400).json({ error: 'الرجاء إدخال نص لتحسينه.' });
    }

    const ai = getGeminiClient(customApiKey);

    let systemPrompt = `أنت خبير كتابة نصوص مبيعات وصوتيات تسويقية (Sales Copywriter & Voice Note Specialist) لشركة "2N للتجارة والتوكيلات" (2N Trading & Agencies) بمصر.
الشركة متخصصة في تمثيل كبرى الشركات العالمية في مجالات:
- قطاع المواسير: سيملس (Seamless)، إي آر دبليو (ERW Line Pipes API Specs)، مواسير التغليف والحفر (Casing & Tubing)، ومواسير الغلايات (Boiler Tubes).
- قطاع المحابس: محابس الصلب الكربوني والسبائك، ومواسير ووصلات البولي إيثيلين (HDPE).
- وكالات عالمية كبرى مثل: دي بي جيندال جروب (DP Jindal Group)، نافكو فلو كنترول (NAFCO Flow Control)، موكشي إندستريز (Mokshi Industries)، ميه-تا تيوبس ليمتد (Meh-ta Tubes Limited)، ماكس فلو (Macks Flow)، فلوفل فالفز (Flovel Valves).
- قطاع الحريق والأمن الصناعي: توريد وتركيب معدات مكافحة الحريق، سيارات الإطفاء، سيارات الإسعاف والوحدات الطبية المتنقلة.
- ميزة "Supply & Apply" (التوريد والتركيب المتكامل).

المطلوب:
صياغة النص المرفق ليكون فويس نوت مبيعات حقيقية وطبيعية 100% باللهجة المصرية الراقية والودودة (Egyptian Arabic Sales Voice Note).
القواعد الإلزامية:
1. قواعد النطق الصوتي (Pronunciation Rules for Text-to-Speech):
   - كلما ذكرت "Mehta Tubes Limited" أو "Mehta Tubes"، يجب كتابتها بالهجاء الصوتي: "Meh-ta Tubes Limited" أو "ميه-تا تيوبس ليمتد (Meh-ta Tubes Limited)".
   - كلما ذكرت "Max Flow" أو "MaxFlow"، يجب كتابتها ككلمتين منفصلتين تماماً: "Macks Flow" أو "ماكس فلو (Macks Flow)" لضبط النبرة والسرعة.
2. اكتب الكلمات الأجنبية بالهجاء العربي الصوتي كما تُنطق (مثل: سيملس، نافكو، جيندال، إي آر دبليو، سبلاي وأبلاي).
3. اجعل الأسلوب جذاباً ومريحاً للأذن مع استخدام ألفاظ الاحترام مثل (يا فندم، حضرتك، معاليك).
4. أعد فقط النص الجاهز للإلقاء الصوتي بدون أي مقدمات أو شروحات إضافية.`;

    if (goal === 'shorten') {
      systemPrompt += '\n\nالمطلوب الإضافي: اجعل الفويس نوت سريعة وموجزة جداً (30-45 ثانية) تناسب واتساب سريع.';
    } else if (goal === 'expand') {
      systemPrompt += '\n\nالمطلوب الإضافي: اجعل الفويس نوت شاملة وتغطي كافة قطاعات الشركة ومميزاتها بالتفصيل.';
    }

    const response = await generateContentWithRetry(ai, {
      contents: scriptText.trim(),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const rawEnhanced = response.text?.trim() || scriptText;
    const enhancedText = applyTtsPronunciationRules(rawEnhanced);
    res.json({ enhancedText });
  } catch (err: any) {
    console.error('Error enhancing script:', err);
    const parsed = parseGeminiError(err);
    const statusCode = parsed.isQuota ? 429 : parsed.isAuth ? 401 : 500;
    res.status(statusCode).json({
      error: parsed.userMessage,
      isQuota: parsed.isQuota,
      isTransient: parsed.isTransient,
      retryAfterSeconds: parsed.retryAfterSeconds,
    });
  }
});

// Document Upload & Text Extraction Endpoint (.pdf, .docx, .doc, .txt, images)
app.post('/api/extract-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { convertToVoiceScript, customApiKey } = req.body;
    const isVoiceConversion = convertToVoiceScript === 'true' || convertToVoiceScript === true;

    if (!file) {
      return res.status(400).json({ error: 'الرجاء اختيار ملف Word أو PDF أو صورة لرفعها.' });
    }

    const fileName = file.originalname || 'document';
    const mimeType = file.mimetype || '';
    const fileExtension = path.extname(fileName).toLowerCase();

    let extractedText = '';

    // Helper to check if text contains meaningful words/letters
    const isMeaningfulText = (txt: string) => {
      if (!txt) return false;
      const clean = txt.replace(/[\s\r\n\t\-_.,;:()0-9\/\\]+/g, '');
      return clean.length >= 6;
    };

    // 1. Process Word document (.docx)
    if (
      fileExtension === '.docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const mammothResult = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = mammothResult.value || '';
      } catch (docErr) {
        console.warn('Mammoth docx extraction warning:', docErr);
      }

      // Fallback: If mammoth returned little to no text (e.g. text in textboxes/tables), inspect XML
      if (!isMeaningfulText(extractedText)) {
        try {
          const rawBufferStr = file.buffer.toString('utf-8');
          const wtMatches = rawBufferStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
          if (wtMatches && wtMatches.length > 0) {
            extractedText = wtMatches
              .map((tag) => tag.replace(/<[^>]+>/g, ''))
              .join(' ');
          }
        } catch (xmlErr) {
          console.warn('XML fallback warning:', xmlErr);
        }
      }
    }
    // 2. Process PDF document (.pdf)
    else if (fileExtension === '.pdf' || mimeType === 'application/pdf') {
      try {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const textResult = await parser.getText();
        extractedText = textResult?.text || '';
        await parser.destroy().catch(() => {});
      } catch (pdfErr) {
        console.warn('PDFParse getText warning:', pdfErr);
      }

      // If PDFParse yielded insufficient text (scanned PDF, images, custom fonts), use Gemini OCR
      if (!isMeaningfulText(extractedText)) {
        try {
          const ai = getGeminiClient(customApiKey);
          const base64Pdf = file.buffer.toString('base64');
          const geminiDocRes = await generateContentWithRetry(ai, {
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Pdf,
                    },
                  },
                  {
                    text: 'استخرج كافة النصوص والبيانات والمعلومات المكتوبة في هذا المستند بدقة عالية باللغة العربية والإنجليزية، مع التركيز على أسماء المنتجات والشركات والمواصفات. لا تضف أي تعليقات أو هوامش خارجية.',
                  },
                ],
              },
            ],
          });
          const geminiExtracted = geminiDocRes.text?.trim() || '';
          if (isMeaningfulText(geminiExtracted)) {
            extractedText = geminiExtracted;
          }
        } catch (geminiPdfErr: any) {
          console.warn('Gemini PDF multimodal fallback warning:', geminiPdfErr?.message);
        }
      }

      // If still empty, attempt raw text stream extraction
      if (!isMeaningfulText(extractedText)) {
        const rawString = file.buffer.toString('latin1');
        const textBlocks: string[] = [];
        const regex = /\(([^)]+)\)\s*T[jJ]/g;
        let match;
        while ((match = regex.exec(rawString)) !== null) {
          if (match[1] && match[1].length > 1) {
            textBlocks.push(match[1]);
          }
        }
        if (textBlocks.length > 3) {
          extractedText = textBlocks.join(' ');
        }
      }
    }
    // 3. Process Images (.png, .jpg, .jpeg, .webp, .bmp)
    else if (
      ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'].includes(fileExtension) ||
      mimeType.startsWith('image/')
    ) {
      try {
        const ai = getGeminiClient(customApiKey);
        const imageMime = mimeType && mimeType.startsWith('image/')
          ? mimeType
          : fileExtension === '.png'
          ? 'image/png'
          : fileExtension === '.webp'
          ? 'image/webp'
          : 'image/jpeg';

        const geminiImgRes = await generateContentWithRetry(ai, {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: imageMime,
                    data: file.buffer.toString('base64'),
                  },
                },
                {
                  text: 'قم باستخراج جميع النصوص والمعلومات المكتوبة في هذه الصورة بدقة باللغتين العربية والإنجليزية. اكتب النص المستخرج فقط دون أي مقدمات.',
                },
              ],
            },
          ],
        });
        extractedText = geminiImgRes.text?.trim() || '';
      } catch (imgErr: any) {
        console.warn('Image OCR extraction warning:', imgErr?.message);
      }
    }
    // 4. Process Plain Text (.txt, .md, .csv, .rtf)
    else if (
      ['.txt', '.md', '.csv', '.tsv', '.rtf'].includes(fileExtension) ||
      mimeType.startsWith('text/')
    ) {
      extractedText = file.buffer.toString('utf-8');
    }
    // 5. Other formats (legacy .doc, etc.)
    else {
      // Try Gemini multimodal first
      try {
        const ai = getGeminiClient(customApiKey);
        const geminiRes = await generateContentWithRetry(ai, {
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'application/octet-stream',
                    data: file.buffer.toString('base64'),
                  },
                },
                {
                  text: 'قم بقراءة هذا المستند واستخراج كافة النصوص والمعلومات منه بدقة باللغة العربية.',
                },
              ],
            },
          ],
        });
        extractedText = geminiRes.text?.trim() || '';
      } catch {
        // Fallback ASCII / Arabic string regex from binary
        const decoded = file.buffer.toString('utf-8');
        const arabicAndLatin = decoded.match(/[\u0600-\u06FF\u0750-\u077F\w\s.,;:!?()-]{4,}/g);
        if (arabicAndLatin && arabicAndLatin.length > 0) {
          extractedText = arabicAndLatin.join(' ');
        }
      }
    }

    // Clean up extracted text formatting
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!extractedText || !isMeaningfulText(extractedText)) {
      return res.status(400).json({
        error: 'لم نتمكن من العثور على نص واضح داخل هذا الملف. يرجى التأكد من أن الملف ليس فارغاً أو محمي بكلمة مرور، أو يمكنك لصق النص مباشرة في مساحة الكتابة.',
      });
    }

    // If the user requested intelligent conversion to 2N Sales Voice Note
    if (isVoiceConversion) {
      try {
        const ai = getGeminiClient(customApiKey);
        const conversionPrompt = `أنت خبير كتابة نصوص صوتية تسويقية لمسؤولي مبيعات شركة "2N للتجارة والتوكيلات" في مصر.
تم استخراج المحتوى التالي من مستند/عرض أسعار/كتالوج/مواصفات:
"""
${extractedText.slice(0, 8000)}
"""

المطلوب:
تحويل هذا المحتوى إلى نص فويس نوت (Voice Note Script) احترافي، ودود، وجذاب باللهجة المصرية للمبيعات.
الشروط الإلزامية:
1. قواعد النطق الصوتي (Pronunciation Rules for Text-to-Speech):
   - كلما ذكرت "Mehta Tubes Limited" أو "Mehta Tubes"، يجب كتابتها بالهجاء الصوتي: "Meh-ta Tubes Limited".
   - كلما ذكرت "Max Flow" أو "MaxFlow"، يجب كتابتها ككلمتين منفصلتين تماماً: "Macks Flow" لضبط النبرة والسرعة.
2. التحدث بأسلوب مسؤولة/مسؤول مبيعات راقٍ في شركة 2N (يا فندم، حضرتك).
3. كتابة أسماء التوكيلات والمنتجات الأجنبية صوتياً بالحروف العربية (مثل: دي بي جيندال، نافكو، سيملس، إي آر دبليو، سبلاي وأبلاي).
4. إبراز النقاط الجوهرية والمنتجات والخدمات المطلوبة بإيجاز دون إطالة مملة (بين 1 إلى 2 دقيقة قراءة).
5. إخراج النص النهائي مباشرة بدون أي عناوين فرعية أو تعليقات خارجية.`;

        const voiceRes = await generateContentWithRetry(ai, {
          contents: conversionPrompt,
          config: {
            temperature: 0.7,
          },
        });

        const rawConverted = voiceRes.text?.trim() || extractedText;
        const scriptReadyText = applyTtsPronunciationRules(rawConverted);

        return res.json({
          fileName,
          extractedText,
          convertedScript: scriptReadyText,
          isConverted: true,
          charCount: scriptReadyText.length,
          wordCount: scriptReadyText.split(/\s+/).length,
        });
      } catch (convErr) {
        console.warn('Conversion to voice script failed, returning raw extracted text:', convErr);
      }
    }

    return res.json({
      fileName,
      extractedText,
      isConverted: false,
      charCount: extractedText.length,
      wordCount: extractedText.split(/\s+/).length,
    });
  } catch (err: any) {
    console.error('Error extracting document text:', err);
    res.status(500).json({
      error: err.message || 'حدث خطأ أثناء قراءة المستند واستخراج النص.',
    });
  }
});

// Setup Vite / Static handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`2N Voice Note Generator Server is running on port ${PORT}`);
  });
}

startServer();
