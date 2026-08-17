import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  FileType,
  FileCheck,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Check,
  Plus,
  Replace,
  Layers,
  ArrowRight,
  FileCode,
} from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExtractedText: (text: string, mode: 'replace' | 'append') => void;
  customApiKey?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onApplyExtractedText,
  customApiKey,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [smartConvert, setSmartConvert] = useState<boolean>(true);
  const [extractedResult, setExtractedResult] = useState<string | null>(null);
  const [convertedScript, setConvertedScript] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'smart' | 'raw'>('smart');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    const validExtensions = [
      '.docx',
      '.doc',
      '.pdf',
      '.txt',
      '.rtf',
      '.md',
      '.csv',
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.bmp',
    ];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setErrorMessage(`الملف (${file.name}) غير مدعوم. يرجى رفع ملفات Word (.docx/.doc) أو PDF أو صور/مستندات ممسوحة ضوئياً أو ملفات نصية.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('حجم الملف كبير جداً (أقصى حجم مسموح به هو 25 ميجابايت).');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setExtractedResult(null);
    setConvertedScript(null);
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // Fast-path client side reader for plain text files if needed
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    const isPlainText = ['.txt', '.md', '.csv', '.rtf'].includes(ext);

    try {
      let extracted = '';
      let converted: string | null = null;

      // If it's a plain text file, we can read it client-side immediately
      if (isPlainText && !smartConvert) {
        extracted = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => reject(new Error('فشل قراءة الملف النصي محلياً.'));
          reader.readAsText(selectedFile);
        });
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('convertToVoiceScript', String(smartConvert));
        if (customApiKey) {
          formData.append('customApiKey', customApiKey);
        }

        const response = await fetch('/api/extract-document', {
          method: 'POST',
          body: formData,
        });

        const contentType = response.headers.get('content-type') || '';
        let data: any = {};

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const rawText = await response.text();
          if (!response.ok) {
            throw new Error(`خطأ في استجابة الخادم (${response.status}): ${rawText.slice(0, 120)}`);
          }
          data = { extractedText: rawText };
        }

        if (!response.ok) {
          throw new Error(data.error || `تعذر معالجة الملف (${response.status}).`);
        }

        extracted = data.extractedText || '';
        converted = data.convertedScript || null;
      }

      if (!extracted.trim()) {
        throw new Error('لم يتم العثور على أي نص قابل للاستخراج داخل هذا المستند.');
      }

      setExtractedResult(extracted);
      if (converted) {
        setConvertedScript(converted);
        setActiveTab('smart');
      } else {
        setActiveTab('raw');
      }
    } catch (err: any) {
      console.error('Error processing file:', err);
      let userFriendlyMsg = err.message || 'حدث خطأ أثناء معالجة وقراءة المستند.';
      if (err.name === 'TypeError' && err.message?.includes('Failed to fetch')) {
        userFriendlyMsg = 'تعذر الاتصال بالخادم (Failed to fetch). يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.';
      }
      setErrorMessage(userFriendlyMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = (mode: 'replace' | 'append') => {
    const finalText = (activeTab === 'smart' && convertedScript) ? convertedScript : (extractedResult || '');
    if (finalText.trim()) {
      onApplyExtractedText(finalText.trim(), mode);
      handleResetAndClose();
    }
  };

  const handleResetAndClose = () => {
    setSelectedFile(null);
    setExtractedResult(null);
    setConvertedScript(null);
    setErrorMessage(null);
    setIsProcessing(false);
    onClose();
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="w-8 h-8 text-emerald-600" />;
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (ext === 'docx' || ext === 'doc') {
      return <FileType className="w-8 h-8 text-blue-600" />;
    }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext || '')) {
      return <Sparkles className="w-8 h-8 text-amber-500" />;
    }
    return <FileCode className="w-8 h-8 text-emerald-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-emerald-200 shrink-0">
              <Upload className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold">رفع مستند Word أو PDF أو صورة واستخراج النص</h3>
              <p className="text-xs text-emerald-100/90">
                استخراج محتوى العروض والمواصفات والكتالوجات وصياغتها كفويس نوت جاهز
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* File Drag & Drop Zone */}
          {!extractedResult && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept=".docx,.doc,.pdf,.txt,.md,.rtf,.csv,.png,.jpg,.jpeg,.webp,.bmp"
                className="hidden"
                id="doc-file-upload-input"
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50 scale-[0.99]'
                    : selectedFile
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                    {getFileIcon()}
                  </div>

                  {selectedFile ? (
                    <div>
                      <div className="flex items-center justify-center gap-2 font-bold text-slate-800 text-sm sm:text-base">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span>{selectedFile.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        الحجم: {(selectedFile.size / (1024 * 1024)).toFixed(2)} ميجابايت • انقر للتغيير
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-slate-800 text-sm sm:text-base">
                        اسحب وأفلت ملف الـ Word أو PDF أو صورة هنا، أو <span className="text-emerald-700 underline">تصفح جهازك</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        يدعم ملفات: Microsoft Word (.docx, .doc), Adobe PDF (.pdf), الصور (PNG, JPG), والنصوص (.txt)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Option Checkbox */}
              {selectedFile && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={smartConvert}
                      onChange={(e) => setSmartConvert(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded-lg text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                    />
                    <div>
                      <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        تحويل ذكي تلقائي إلى نص فويس نوت مبيعات لشركة 2N
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        يقوم الذكاء الاصطناعي بقراءة المستند وتلخيصه وصياغته بأسلوب تسويقي مصري جذاب مع ضبط الهجاء الصوتي لأسماء الشركات والمنتجات.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs sm:text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action to Process File */}
          {selectedFile && !extractedResult && (
            <button
              onClick={handleProcessFile}
              disabled={isProcessing}
              id="start-extract-btn"
              className={`w-full py-4 px-6 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2.5 shadow-md ${
                isProcessing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 active:scale-[0.99]'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري استخراج ومعالجة النص من الملف...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>استخراج المحتوى الآن</span>
                </>
              )}
            </button>
          )}

          {/* Result Tabs & Preview */}
          {extractedResult && (
            <div className="space-y-3.5">
              
              {/* Tabs Switcher (if smart conversion was done) */}
              {convertedScript ? (
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('smart')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'smart'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>النص المصاغ كفويس نوت (موصى به)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('raw')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'raw'
                        ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>النص الأصلي الخام المستخرج</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>تم استخراج النص من ({selectedFile?.name}) بنجاح:</span>
                </div>
              )}

              {/* Textarea Preview */}
              <div className="relative">
                <textarea
                  value={activeTab === 'smart' && convertedScript ? convertedScript : extractedResult}
                  onChange={(e) => {
                    if (activeTab === 'smart') {
                      setConvertedScript(e.target.value);
                    } else {
                      setExtractedResult(e.target.value);
                    }
                  }}
                  rows={8}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-slate-800 text-sm leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                />
              </div>

              {/* Action Buttons to Apply */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleApply('replace')}
                  id="replace-script-btn"
                  className="w-full sm:flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Replace className="w-4 h-4" />
                  <span>استبدال نص الفويس نوت الحالي</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApply('append')}
                  id="append-script-btn"
                  className="w-full sm:flex-1 py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-2xl text-sm transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>إضافة إلى نهاية النص الحالي</span>
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  onClick={() => {
                    setExtractedResult(null);
                    setConvertedScript(null);
                    setSelectedFile(null);
                  }}
                  className="text-xs text-slate-400 hover:text-emerald-700 underline"
                >
                  رفع مستند آخر
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={handleResetAndClose}
            className="px-5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
