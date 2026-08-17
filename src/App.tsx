/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Sparkles,
  BookOpen,
  Wand2,
  AlertCircle,
  RefreshCw,
  Info,
  CheckCircle2,
  Building,
  Flame,
  Volume2,
  RotateCcw,
  Layers,
  Copy,
  Upload,
  FileText,
  Check,
} from 'lucide-react';
import { Header } from './components/Header';
import { VoiceSelector } from './components/VoiceSelector';
import { ToneSelector } from './components/ToneSelector';
import { AudioPlayer } from './components/AudioPlayer';
import { ScriptTemplatesModal } from './components/ScriptTemplatesModal';
import { AiEnhancerModal } from './components/AiEnhancerModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { GenerationHistory } from './components/GenerationHistory';
import { RateLimitAlert } from './components/RateLimitAlert';
import { SCRIPT_TEMPLATES } from './data/templates';
import { ScriptTemplate, GenerationHistoryItem } from './types';
import { pcm16Base64ToWav, estimateReadingTime } from './utils/audio';

export default function App() {
  // Default script is the comprehensive 2N company intro from user request
  const defaultScript = SCRIPT_TEMPLATES[0].script;

  const [scriptText, setScriptText] = useState<string>(defaultScript);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('Kore');
  const [selectedToneId, setSelectedToneId] = useState<string>('friendly_sales');

  // API Key state
  const [serverKeyAvailable, setServerKeyAvailable] = useState<boolean>(true);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('2n_custom_gemini_key') || '';
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  // Modals state
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [isAiEnhancerOpen, setIsAiEnhancerOpen] = useState<boolean>(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState<boolean>(false);
  const [docUploadSuccess, setDocUploadSuccess] = useState<string | null>(null);

  // Audio Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitState, setRateLimitState] = useState<{
    isRateLimited: boolean;
    retryAfterSeconds: number;
    message: string;
  } | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioSampleRate, setAudioSampleRate] = useState<number>(24000);
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);

  // Check health and server API key presence on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setServerKeyAvailable(Boolean(data.hasServerApiKey));
      })
      .catch(() => {
        setServerKeyAvailable(false);
      });
  }, []);

  const handleSaveCustomKey = (key: string) => {
    setCustomApiKey(key);
    if (key) {
      localStorage.setItem('2n_custom_gemini_key', key);
    } else {
      localStorage.removeItem('2n_custom_gemini_key');
    }
  };

  const handleSelectTemplate = (template: ScriptTemplate) => {
    setScriptText(template.script);
  };

  const handleApplyExtractedText = (text: string, mode: 'replace' | 'append') => {
    if (mode === 'append' && scriptText.trim()) {
      setScriptText((prev) => `${prev.trim()}\n\n${text}`);
      setDocUploadSuccess('تمت إضافة النص المستخرج إلى نهاية الفويس نوت بنجاح.');
    } else {
      setScriptText(text);
      setDocUploadSuccess('تم استبدال نص الفويس نوت بالنص المستخرج من المستند بنجاح.');
    }

    setTimeout(() => {
      setDocUploadSuccess(null);
    }, 6000);
  };

  const handleGenerateVoice = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('الرجاء كتابة النص المراد تحويله إلى صوت أولاً.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setRateLimitState(null);

    try {
      const response = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: scriptText.trim(),
          voiceName: selectedVoiceId,
          tone: selectedToneId,
          customApiKey: customApiKey || undefined,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = {};

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const rawText = await response.text();
        throw new Error(`استجابة غير متوقعة من الخادم (${response.status}): ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        if (response.status === 429 || data.isQuota) {
          setRateLimitState({
            isRateLimited: true,
            retryAfterSeconds: data.retryAfterSeconds || 45,
            message:
              data.error ||
              'تم بلوغ الحد المؤقت للطلبات المجانية (429 Quota Exceeded). تتجدد الحصة تلقائياً خلال ثوانٍ.',
          });
          return;
        }
        throw new Error(data.error || `خطأ في الخادم (${response.status})`);
      }

      if (data.audioBase64) {
        const sampleRate = data.sampleRate || 24000;
        setAudioSampleRate(sampleRate);

        const wavBlob = pcm16Base64ToWav(data.audioBase64, sampleRate);
        const newBlobUrl = URL.createObjectURL(wavBlob);
        setAudioBlobUrl(newBlobUrl);

        // Add to history
        const historyItem: GenerationHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          title: `تسجيل ${selectedVoiceId}`,
          scriptText: scriptText.trim(),
          voiceName: selectedVoiceId,
          tone: selectedToneId,
          blobUrl: newBlobUrl,
          durationSeconds: 0,
          sampleRate,
        };

        setHistory((prev) => [historyItem, ...prev.slice(0, 9)]);

        // Smooth scroll to player on mobile
        setTimeout(() => {
          document.getElementById('voice-note-result-card')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 150);
      } else {
        throw new Error('لم يتم استلام أي بيانات صوتية صالحة من النموذج.');
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
      setErrorMessage(
        err.message || 'حدث خطأ أثناء توليد الفويس نوت. تأكد من إعدادات المفتاح أو حاول مرة أخرى.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const { words, seconds, textFormatted } = estimateReadingTime(scriptText);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-['Tajawal',sans-serif] text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Header */}
      <Header
        hasServerKey={serverKeyAvailable}
        hasCustomKey={Boolean(customApiKey)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        
        {/* Brand Highlights Card */}
        <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-3xl p-4 sm:p-5 shadow-sm border border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-emerald-100">
                شركة 2N للتجارة والتوكيلات - وكلاء كبرى المصانع العالمية
              </h2>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                دي بي جيندال • نافكو • موكشي • ميهتا تيوبس • فلوفل فالفز • حلول التوريد والتركيب (Supply & Apply)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => setIsDocModalOpen(true)}
              id="header-upload-doc-btn"
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 shadow-xs"
            >
              <Upload className="w-4 h-4 text-emerald-200" />
              <span>رفع ملف Word / PDF</span>
            </button>
            <button
              onClick={() => setIsTemplatesModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/15"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>نماذج جاهزة للشركة</span>
            </button>
          </div>
        </div>

        {/* Main Generator Form Card */}
        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/60 border border-slate-200/80 p-5 sm:p-8 space-y-6">
          
          {/* Step 1: Voice Choice with Audio Preview */}
          <VoiceSelector
            selectedVoiceId={selectedVoiceId}
            onSelectVoice={setSelectedVoiceId}
            customApiKey={customApiKey}
            onRequireKey={() => setIsKeyModalOpen(true)}
          />

          {/* Step 2: Tone Choice */}
          <ToneSelector
            selectedToneId={selectedToneId}
            onSelectTone={setSelectedToneId}
          />

          {/* Step 3: Script Area */}
          <div className="space-y-2.5 pt-2">
            
            {/* Success message banner when text was loaded from document */}
            {docUploadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{docUploadSuccess}</span>
                </div>
                <button
                  onClick={() => setDocUploadSuccess(null)}
                  className="text-emerald-600 hover:text-emerald-900 text-xs underline"
                >
                  إخفاء
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="scriptText"
                className="text-sm font-bold text-slate-800 flex items-center gap-2"
              >
                <Mic className="w-4 h-4 text-emerald-600" />
                <span>نص الفويس نوت المراد تسجيله:</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {/* Upload Word / PDF Button */}
                <button
                  type="button"
                  onClick={() => setIsDocModalOpen(true)}
                  id="upload-doc-script-btn"
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-all flex items-center gap-1.5 shadow-2xs"
                  title="رفع ملف Word أو PDF لاستخراج النص وتضمينه في الفويس نوت"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>رفع مستند Word / PDF</span>
                </button>

                {/* AI Script Polish */}
                <button
                  type="button"
                  onClick={() => setIsAiEnhancerOpen(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all flex items-center gap-1.5 shadow-2xs"
                  title="تحسين النص باللهجة المصرية وصياغة أسماء الشركات صوتياً"
                >
                  <Wand2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تحسين الصياغة بـ Gemini</span>
                </button>

                {/* Reset default text */}
                <button
                  type="button"
                  onClick={() => setScriptText(defaultScript)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center gap-1"
                  title="إعادة النص الافتراضي لشركة 2N"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة النص الأصلي</span>
                </button>
              </div>
            </div>

            {/* Script Textarea with Drop Target */}
            <div
              className="relative group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  setIsDocModalOpen(true);
                }
              }}
            >
              <textarea
                id="scriptText"
                rows={7}
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="اكتب النص التسويقي هنا باللهجة المصرية، أو اسحب وأفلت ملف Word أو PDF..."
                className="w-full p-4 sm:p-5 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 leading-relaxed text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-inner resize-y"
              />
            </div>

            {/* Helper Info & Word Counts */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
              <div className="flex items-center gap-3">
                <span>
                  عدد الكلمات: <strong className="text-slate-800">{words}</strong>
                </span>
                <span>•</span>
                <span>
                  الوقت التقديري: <strong className="text-emerald-700">{textFormatted} دقيقة</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>نصيحة: اكتب أسماء الشركات الأجنبية بالهجاء العربي الصوتي لنطق دقيق (مثل: نافكو، جيندال).</span>
              </div>
            </div>
          </div>

          {/* Rate Limit Alert Banner */}
          {rateLimitState?.isRateLimited && (
            <RateLimitAlert
              retryAfterSeconds={rateLimitState.retryAfterSeconds}
              message={rateLimitState.message}
              onRetry={handleGenerateVoice}
              onOpenKeyModal={() => setIsKeyModalOpen(true)}
              onDismiss={() => setRateLimitState(null)}
              autoRetry={true}
            />
          )}

          {/* Error Banner */}
          {errorMessage && !rateLimitState?.isRateLimited && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-800 text-sm flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">تعذر تسجيل الفويس نوت:</p>
                <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
                <div className="pt-1">
                  <button
                    onClick={() => setIsKeyModalOpen(true)}
                    className="text-xs font-bold text-red-900 underline hover:text-red-950"
                  >
                    تغيير أو إدخال مفتاح API في الإعدادات
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Generate Button */}
          <div>
            <button
              onClick={handleGenerateVoice}
              disabled={isGenerating}
              id="generate-voice-note-btn"
              className={`w-full py-4 sm:py-5 px-6 rounded-2xl font-black text-white text-base sm:text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg ${
                isGenerating
                  ? 'bg-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-600/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-white" />
                  <span>جاري تسجيل الفويس نوت بالذكاء الاصطناعي...</span>
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6 stroke-[2.5]" />
                  <span>
                    {audioBlobUrl ? 'إعادة تسجيل الفويس نوت' : 'تسجيل الفويس نوت الآن'}
                  </span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Generated Audio Player Result */}
        <AudioPlayer
          audioBlobUrl={audioBlobUrl}
          scriptText={scriptText}
          voiceName={selectedVoiceId}
          sampleRate={audioSampleRate}
          onRegenerate={handleGenerateVoice}
        />

        {/* Previous Generations History */}
        <GenerationHistory
          history={history}
          onSelectHistoryItem={(item) => {
            setAudioBlobUrl(item.blobUrl);
            setScriptText(item.scriptText);
            setSelectedVoiceId(item.voiceName);
            setSelectedToneId(item.tone);
          }}
          onClearHistory={() => setHistory([])}
        />

      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 text-xs py-6 border-t border-slate-700/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div>
            <p className="font-semibold text-slate-300">
              شركة 2N للتجارة والتوكيلات - جميع الحقوق محفوظة © {new Date().getFullYear()}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              مُولد الرسائل الصوتية الذكي للمبيعات B2B مدعوم بنماذج Google Gemini Voice TTS
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTemplatesModalOpen(true)}
              className="hover:text-emerald-400 transition-colors"
            >
              النماذج
            </button>
            <span>•</span>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="hover:text-emerald-400 transition-colors"
            >
              مفتاح الـ API
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ScriptTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        currentScript={scriptText}
      />

      <AiEnhancerModal
        isOpen={isAiEnhancerOpen}
        onClose={() => setIsAiEnhancerOpen(false)}
        currentScript={scriptText}
        onApplyEnhancedText={(newText) => setScriptText(newText)}
        customApiKey={customApiKey || undefined}
      />

      <DocumentUploadModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        onApplyExtractedText={handleApplyExtractedText}
        customApiKey={customApiKey || undefined}
      />

      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        serverKeyAvailable={serverKeyAvailable}
        customApiKey={customApiKey}
        onSaveCustomKey={handleSaveCustomKey}
      />

    </div>
  );
}
