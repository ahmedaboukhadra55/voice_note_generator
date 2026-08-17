import React from 'react';
import { X, BookOpen, Check, Clock, Building2, ShieldAlert, Wrench, MessageSquare, Zap } from 'lucide-react';
import { SCRIPT_TEMPLATES } from '../data/templates';
import { ScriptTemplate } from '../types';

interface ScriptTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ScriptTemplate) => void;
  currentScript: string;
}

export const ScriptTemplatesModal: React.FC<ScriptTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  currentScript,
}) => {
  if (!isOpen) return null;

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="w-5 h-5 text-emerald-600" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'Wrench':
        return <Wrench className="w-5 h-5 text-blue-600" />;
      case 'MessageSquareCheck':
      case 'MessageSquare':
        return <MessageSquare className="w-5 h-5 text-amber-600" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-500" />;
      default:
        return <BookOpen className="w-5 h-5 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                نماذج رسائل مبيعات شركة 2N الجاهزة
              </h3>
              <p className="text-xs text-slate-500">
                اختر قالباً تسويقياً مكتوباً بعناية باللهجة المصرية وفقاً لاحتياج عميلك
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5 divide-y divide-slate-100">
          {SCRIPT_TEMPLATES.map((tmpl) => {
            const isCurrent = currentScript.trim() === tmpl.script.trim();

            return (
              <div
                key={tmpl.id}
                className="pt-3.5 first:pt-0 group"
              >
                <div className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-slate-100 group-hover:bg-emerald-100 transition-colors">
                        {getCategoryIcon(tmpl.iconName)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {tmpl.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                            {tmpl.category}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-emerald-700">
                            <Clock className="w-3 h-3" />
                            {tmpl.durationEstimate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onSelectTemplate(tmpl);
                        onClose();
                      }}
                      className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 shrink-0 ${
                        isCurrent
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>القالب الحالي</span>
                        </>
                      ) : (
                        <span>استخدام هذا النموذج</span>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-3 leading-relaxed mt-2 font-normal">
                    {tmpl.script}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
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
