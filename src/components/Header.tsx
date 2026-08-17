import React from 'react';
import { Mic, Sparkles, Key, CheckCircle2, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  hasServerKey: boolean;
  hasCustomKey: boolean;
  onOpenKeyModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hasServerKey,
  hasCustomKey,
  onOpenKeyModal,
}) => {
  const isKeyActive = hasServerKey || hasCustomKey;

  return (
    <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-lg border-b border-emerald-600/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner shrink-0 text-emerald-300">
              <Mic className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-400/30 tracking-wider">
                  2N TRADING & AGENCIES
                </span>
                <span className="flex items-center gap-1 text-xs text-emerald-200/90 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  Gemini TTS الذكي
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                مُولد الرسائل الصوتية (فويس نوت مبيعات)
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 font-normal">
                تسجيلات صوتية احترافية باللهجة المصرية لخدمات التوريد والتركيب والوكالات العالمية
              </p>
            </div>
          </div>

          {/* Status & Key Settings */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={onOpenKeyModal}
              id="open-key-settings-btn"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm border ${
                isKeyActive
                  ? 'bg-emerald-900/50 hover:bg-emerald-900/80 text-emerald-100 border-emerald-500/40'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400/40'
              }`}
            >
              {isKeyActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>الخدمة مفعلة وجاهزة</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 text-amber-300" />
                  <span>ضبط مفتاح API</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
