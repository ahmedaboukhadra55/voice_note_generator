import React from 'react';
import { History, Play, Download, Trash2, Clock, Volume2 } from 'lucide-react';
import { GenerationHistoryItem } from '../types';
import { formatTime } from '../utils/audio';

interface GenerationHistoryProps {
  history: GenerationHistoryItem[];
  onSelectHistoryItem: (item: GenerationHistoryItem) => void;
  onClearHistory: () => void;
}

export const GenerationHistory: React.FC<GenerationHistoryProps> = ({
  history,
  onSelectHistoryItem,
  onClearHistory,
}) => {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-base">
            سجل التسجيلات السابقة ({history.length})
          </h3>
        </div>
        <button
          onClick={onClearHistory}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1 font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          مسح السجل
        </button>
      </div>

      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                onClick={() => onSelectHistoryItem(item)}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95"
                title="استماع لهذا التسجيل"
              >
                <Play className="w-4 h-4 fill-current translate-x-[-1px]" />
              </button>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-800 truncate">
                    {item.voiceName} • {item.tone}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate max-w-sm sm:max-w-md mt-0.5">
                  {item.scriptText}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={item.blobUrl}
                download={`2N_${item.voiceName}_${item.id}.wav`}
                className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-white transition-colors border border-transparent hover:border-slate-200"
                title="تحميل الملف الصوتي"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
