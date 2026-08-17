import React from 'react';
import { Smile, Briefcase, Flame, HeartHandshake, SlidersHorizontal } from 'lucide-react';
import { TONE_OPTIONS } from '../data/templates';
import { ToneOption } from '../types';

interface ToneSelectorProps {
  selectedToneId: string;
  onSelectTone: (toneId: string) => void;
}

export const ToneSelector: React.FC<ToneSelectorProps> = ({
  selectedToneId,
  onSelectTone,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Smile':
        return <Smile className="w-4 h-4" />;
      case 'Briefcase':
        return <Briefcase className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'HeartHandshake':
        return <HeartHandshake className="w-4 h-4 text-rose-500" />;
      default:
        return <Smile className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
          <span>نبرة الإلقاء والأسلوب:</span>
        </label>
        <span className="text-xs text-slate-500">توجيه ذكي للهجة المصرية</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {TONE_OPTIONS.map((tone: ToneOption) => {
          const isSelected = selectedToneId === tone.id;

          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => onSelectTone(tone.id)}
              className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`p-1.5 rounded-lg ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {getIcon(tone.iconName)}
                </span>
                <span className="font-bold text-xs sm:text-sm leading-tight">
                  {tone.label}
                </span>
              </div>
              <p
                className={`text-[11px] leading-relaxed line-clamp-2 mt-1 ${
                  isSelected ? 'text-emerald-100' : 'text-slate-500'
                }`}
              >
                {tone.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
