import React, { useState } from 'react';
import { X, Sparkles, Wand2, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface AiEnhancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScript: string;
  onApplyEnhancedText: (text: string) => void;
  customApiKey?: string;
}

export const AiEnhancerModal: React.FC<AiEnhancerModalProps> = ({
  isOpen,
  onClose,
  currentScript,
  onApplyEnhancedText,
  customApiKey,
}) => {
  const [goal, setGoal] = useState<'polish' | 'shorten' | 'expand'>('polish');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string>('');

  if (!isOpen) return null;

  const handleEnhance = async () => {
    if (!currentScript.trim()) {
      setError('الرجاء كتابة نص أولاً في المحرر قبل تشغيل التحسين.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/enhance-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: currentScript,
          goal,
          customApiKey,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        throw new Error(`استجابة غير متوقعة من الخادم (${res.status}): ${rawText.slice(0, 100)}`);
      }

      if (!res.ok) {
        if (res.status === 429 || data.isQuota) {
          throw new Error(
            data.error || `تم بلوغ الحد المؤقت للطلبات المجانية (429). يرجى الانتظار ${data.retryAfterSeconds || 30} ثانية ثم إعادة المحاولة.`
          );
        }
        throw new Error(data.error || 'حدث خطأ أثناء تحسين النص.');
      }

      setResultText(data.enhancedText);
    } catch (err: any) {
      let msg = err.message || 'فشل الاتصال بالذكاء الاصطناعي.';
      if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
        msg = 'تعذر الاتصال بالخادم (Failed to fetch). يرجى التحقق من اتصال الإنترنت.';
      } else if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
        msg = 'خدمة الذكاء الاصطناعي تشهد ضغطاً مؤقتاً في هذه اللحظة. يرجى النقر على زر إعادة المحاولة بعد بضع ثوانٍ.';
      } else if (msg.startsWith('{') && msg.includes('error')) {
        // Strip any unexpected JSON strings
        try {
          const parsed = JSON.parse(msg);
          msg = parsed?.error?.message || parsed?.error || msg;
        } catch {
          // ignore
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (resultText) {
      onApplyEnhancedText(resultText);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">مُحسِّن النصوص بالذكاء الاصطناعي (Gemini)</h3>
              <p className="text-xs text-emerald-100">
                إعادة صياغة النص باللهجة المصرية الطبيعية وكتابة أسماء الشركات صوتياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Objective choices */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              اختر هدف التحسين:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGoal('polish')}
                className={`p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all text-center ${
                  goal === 'polish'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                تلميع الصياغة المصرية
              </button>
              <button
                type="button"
                onClick={() => setGoal('shorten')}
                className={`p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all text-center ${
                  goal === 'shorten'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                تلخيص سريع (واتساب)
              </button>
              <button
                type="button"
                onClick={() => setGoal('expand')}
                className={`p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all text-center ${
                  goal === 'expand'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                توسيع وتفصيل شامل
              </button>
            </div>
          </div>

          {/* Original Text Preview */}
          <div>
            <span className="text-xs text-slate-500 font-semibold mb-1 block">
              النص الأصلي الحالي:
            </span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-h-28 overflow-y-auto leading-relaxed">
              {currentScript || 'لا يوجد نص حالياً.'}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate Button */}
          {!resultText && (
            <button
              onClick={handleEnhance}
              disabled={loading}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري التحسين والصياغة...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>بدء التحسين بالذكاء الاصطناعي</span>
                </>
              )}
            </button>
          )}

          {/* Enhanced Result Box */}
          {resultText && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  النص المحسن والجاهز للتسجيل:
                </span>
                <button
                  onClick={handleEnhance}
                  disabled={loading}
                  className="text-xs text-emerald-700 hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  إعادة المحاولة
                </button>
              </div>

              <textarea
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
                rows={5}
                className="w-full p-3.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-slate-800 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleApply}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>اعتماد النص ووضعه في مساحة التسجيل</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
