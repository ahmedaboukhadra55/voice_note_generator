import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Check,
  Info,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ClipboardPaste,
  Eye,
  EyeOff,
  Sparkles,
  Upload,
  FileInput,
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverKeyAvailable: boolean;
  customApiKey: string;
  onSaveCustomKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  serverKeyAvailable,
  customApiKey,
  onSaveCustomKey,
}) => {
  const [inputValue, setInputValue] = useState(customApiKey);
  const [showKey, setShowKey] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(customApiKey);
      setTestResult(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, customApiKey]);

  if (!isOpen) return null;

  const sanitizeKey = (text: string) => {
    return text.trim().replace(/^["'`]|["'`]$/g, '').replace(/[\r\n\t]/g, '');
  };

  const handleApplyKey = (rawText: string) => {
    const clean = sanitizeKey(rawText);
    setInputValue(clean);
    setTestResult(null);
    setPasteSuccess(true);
    setTimeout(() => setPasteSuccess(false), 2000);
  };

  const handleClipboardPaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          handleApplyKey(text);
          return;
        }
      }
    } catch (clipErr) {
      console.warn('Clipboard API read error:', clipErr);
    }

    // Fallback: prompt dialog which bypasses iframe clipboard restrictions
    try {
      const fallbackText = window.prompt('الصق مفتاح Gemini API هنا (Ctrl+V أو اضغط باستمرار للصق):');
      if (fallbackText && fallbackText.trim()) {
        handleApplyKey(fallbackText);
      }
    } catch (promptErr) {
      console.warn('Prompt fallback error:', promptErr);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.trim()) {
        handleApplyKey(content);
      }
    };
    reader.readAsText(file);
  };

  const handleTestKey = async () => {
    const keyToTest = sanitizeKey(inputValue) || customApiKey;
    if (!keyToTest && !serverKeyAvailable) {
      setTestResult({
        success: false,
        message: 'يرجى إدخال أو لصق مفتاح API أولاً لتجربته.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customApiKey: keyToTest || undefined }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setTestResult({
          success: true,
          message: data.message || 'المفتاح سليم ويعمل بنجاح مع نماذج Gemini وتوليد الصوت!',
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'تعذر التحقق من صحة المفتاح.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'فشل الاتصال بالخادم لاختبار المفتاح.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = sanitizeKey(inputValue);
    onSaveCustomKey(cleanKey);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setInputValue('');
    onSaveCustomKey('');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                إعدادات ولصق مفتاح Gemini API
              </h3>
              <p className="text-xs text-slate-500">
                طرق متعددة للصق وتفعيل المفتاح بكل سهولة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4">
          
          {/* Server status banner */}
          {serverKeyAvailable ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-emerald-800 mb-0.5">
                  تم الكشف عن مفتاح الخادم المدمج تلقائياً
                </strong>
                التطبيق مهيأ للتوليد مباشرة، أو يمكنك لصق مفتاحك المخصص أدناه.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-amber-800 mb-0.5">
                  مفتاح Gemini API مطلوب
                </strong>
                الصق مفتاحك أدناه (يبدأ بـ <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">AIzaSy...</code>) لتوليد الصوت وتحسين النصوص فوراً.
              </div>
            </div>
          )}

          {/* Quick link to generate key from Google AI Studio */}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl text-xs font-bold text-blue-900 hover:from-blue-100 hover:to-indigo-100 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                AI
              </span>
              <span>احصل على مفتاح مجاني من صفحة Google AI Studio (اضغط هنا)</span>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-600 group-hover:translate-x-[-2px] transition-transform" />
          </a>

          {/* Large Quick Paste & Text Area Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>حقل لصق المفتاح (Paste Area):</span>
              </label>

              {customApiKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح المفتاح</span>
                </button>
              )}
            </div>

            {/* Paste Action Buttons Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {/* Method 1: One-Click Paste Button */}
              <button
                type="button"
                onClick={handleClipboardPaste}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                {pasteSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>تم اللصق بنجاح!</span>
                  </>
                ) : (
                  <>
                    <ClipboardPaste className="w-4 h-4" />
                    <span>زر اللصق السريع</span>
                  </>
                )}
              </button>

              {/* Method 2: Open browser prompt paste */}
              <button
                type="button"
                onClick={() => {
                  try {
                    const val = window.prompt('الصق المفتاح هنا واضغط OK:');
                    if (val && val.trim()) handleApplyKey(val);
                  } catch (e) {}
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <FileInput className="w-3.5 h-3.5 text-slate-600" />
                <span>نافذة لصق خارجية</span>
              </button>

              {/* Method 3: Upload txt file with key */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>رفع ملف نصي</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* High-visibility Text Area */}
            <div className="relative mt-2">
              <textarea
                ref={inputRef}
                rows={2}
                value={showKey ? inputValue : inputValue.replace(/./g, '•')}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setTestResult(null);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData?.getData('text');
                  if (pasted) {
                    e.preventDefault();
                    handleApplyKey(pasted);
                  }
                }}
                placeholder="اضغط هنا والصق المفتاح (Ctrl+V أو بزر الماوس الأيمن > لصق)..."
                className="w-full p-3 bg-slate-50 border-2 border-slate-300 focus:border-emerald-500 rounded-2xl text-slate-800 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              />

              <div className="absolute left-2.5 bottom-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="px-2 py-1 bg-white/90 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 text-[11px] font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  {showKey ? (
                    <>
                      <EyeOff className="w-3 h-3 text-slate-500" />
                      <span>إخفاء</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-slate-500" />
                      <span>إظهار</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>* يمكنك الضغط على <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-sans font-bold text-slate-700">Ctrl + V</kbd> داخل الصندوق للصق مباشرة</span>
              {inputValue && (
                <span className="text-emerald-700 font-bold font-mono">
                  {inputValue.length} حرف
                </span>
              )}
            </div>
          </div>

          {/* Test Key Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold leading-relaxed">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={isTesting || (!inputValue.trim() && !customApiKey && !serverKeyAvailable)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
                  <span>جارٍ اختبار المفتاح...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>اختبار المفتاح الآن</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                إغلاق
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer active:scale-95 transition-all"
              >
                {showSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم الحفظ والتفعيل!</span>
                  </>
                ) : (
                  <span>حفظ وتفعيل</span>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
