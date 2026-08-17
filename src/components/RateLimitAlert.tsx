import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Key, AlertTriangle, X, Check } from 'lucide-react';

interface RateLimitAlertProps {
  retryAfterSeconds: number;
  message?: string;
  onRetry: () => void;
  onOpenKeyModal: () => void;
  onDismiss: () => void;
  autoRetry?: boolean;
}

export const RateLimitAlert: React.FC<RateLimitAlertProps> = ({
  retryAfterSeconds = 45,
  message,
  onRetry,
  onOpenKeyModal,
  onDismiss,
  autoRetry = true,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(Math.max(1, retryAfterSeconds));
  const [isAutoRetryEnabled, setIsAutoRetryEnabled] = useState<boolean>(autoRetry);

  useEffect(() => {
    setTimeLeft(Math.max(1, retryAfterSeconds));
  }, [retryAfterSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (isAutoRetryEnabled) {
        onRetry();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isAutoRetryEnabled, onRetry]);

  const percentage = Math.max(0, Math.min(100, (timeLeft / (retryAfterSeconds || 45)) * 100));

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl text-amber-950 shadow-md animate-in fade-in duration-300 relative overflow-hidden">
      {/* Top progress bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-amber-400/30 overflow-hidden"
      >
        <div
          className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          {/* Animated clock badge */}
          <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0 shadow-xs mt-0.5">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>تم بلوغ الحد المؤقت للطلبات (429 Rate Limit)</span>
              </h4>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full border border-amber-300">
                حصة مجانية
              </span>
            </div>

            <p className="text-xs sm:text-sm text-amber-900/90 leading-relaxed max-w-2xl">
              {message ||
                'تتجدد حصة التوليد المجانية لنماذج الصوت تلقائياً كل دقيقة. يمكنك الانتظار قليلاً أو إضافة مفتاح API خاص بك للحصول على معدل أسرع.'}
            </p>

            {/* Countdown Display */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-amber-200 text-xs sm:text-sm font-bold text-amber-900 shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span>
                  {timeLeft > 0 ? (
                    <>
                      إعادة المحاولة متاحة خلال:{' '}
                      <span className="text-amber-700 font-black text-sm sm:text-base">
                        {timeLeft} ثانية
                      </span>
                    </>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      الحصة جاهزة الآن للتوليد!
                    </span>
                  )}
                </span>
              </div>

              {/* Auto-retry checkbox */}
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAutoRetryEnabled}
                  onChange={(e) => setIsAutoRetryEnabled(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>إعادة المحاولة تلقائياً عند انتهاء العداد</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onRetry}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة الآن</span>
              </button>

              <button
                type="button"
                onClick={onOpenKeyModal}
                className="px-4 py-2 bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5 text-amber-700" />
                <span>إدخال / لصق مفتاح API خاص</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1.5 rounded-xl text-amber-600 hover:text-amber-900 hover:bg-amber-200/50 transition-colors shrink-0"
          title="إغلاق التنبيه"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
