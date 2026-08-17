import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Check,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  VolumeX,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { VOICE_OPTIONS } from '../data/templates';
import { VoiceOption } from '../types';
import { pcm16Base64ToWav } from '../utils/audio';

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  customApiKey?: string;
  onRequireKey?: () => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoiceId,
  onSelectVoice,
  customApiKey,
  onRequireKey,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [errorVoiceId, setErrorVoiceId] = useState<{ id: string; msg: string } | null>(null);
  const [previewBlobs, setPreviewBlobs] = useState<Record<string, string>>({});
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const handleTogglePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation(); // prevent card selection on preview click if desired, or let card still select

    // If currently playing this voice -> pause it
    if (playingVoiceId === voice.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoiceId(null);
      return;
    }

    // Stop any other voice currently playing
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingVoiceId(null);
    setErrorVoiceId(null);

    // If we already cached the preview audio for this voice, play directly
    if (previewBlobs[voice.id]) {
      playCachedAudio(previewBlobs[voice.id], voice.id);
      return;
    }

    // Otherwise, fetch preview from server
    setLoadingVoiceId(voice.id);

    try {
      const res = await fetch('/api/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.audioBase64) {
        let msg = data.error || 'تعذر تحميل معاينة الصوت.';
        if (res.status === 401 || msg.includes('401') || msg.includes('مفتاح')) {
          onRequireKey?.();
        }
        throw new Error(msg);
      }

      const sampleRate = data.sampleRate || 24000;
      const wavBlob = pcm16Base64ToWav(data.audioBase64, sampleRate);
      const blobUrl = URL.createObjectURL(wavBlob);

      setPreviewBlobs((prev) => ({ ...prev, [voice.id]: blobUrl }));
      playCachedAudio(blobUrl, voice.id);
    } catch (err: any) {
      console.warn('Voice preview error:', err);
      setErrorVoiceId({
        id: voice.id,
        msg: err.message || 'تعذر تشغيل المعاينة',
      });
      setTimeout(() => setErrorVoiceId(null), 4000);
    } finally {
      setLoadingVoiceId(null);
    }
  };

  const playCachedAudio = (blobUrl: string, voiceId: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = blobUrl;
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);

    audio
      .play()
      .then(() => {
        setPlayingVoiceId(voiceId);
      })
      .catch((e) => {
        console.warn('Audio play prevented:', e);
        setPlayingVoiceId(null);
      });
  };

  return (
    <div className="space-y-3">
      {/* Hidden audio element for preview playback */}
      <audio ref={audioRef} className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-600" />
          <span>اختر صوت المعلق / مسؤولة المبيعات:</span>
        </label>
        <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>اضغط على زر "معاينة الصوت" للاستماع لنبرة كل معلق</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {VOICE_OPTIONS.map((voice: VoiceOption) => {
          const isSelected = selectedVoiceId === voice.id;
          const isPlaying = playingVoiceId === voice.id;
          const isLoading = loadingVoiceId === voice.id;
          const hasError = errorVoiceId?.id === voice.id;

          return (
            <div
              key={voice.id}
              onClick={() => onSelectVoice(voice.id)}
              className={`text-right p-4 rounded-3xl border-2 transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group ${
                isSelected
                  ? 'bg-gradient-to-b from-emerald-50/90 to-white border-emerald-600 shadow-md shadow-emerald-600/10 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/70 shadow-xs'
              }`}
            >
              {/* Top Tag & Selection Indicator */}
              <div className="flex items-center justify-between w-full mb-2.5">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : voice.recommended
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {voice.tag}
                </span>

                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 bg-white text-transparent group-hover:border-emerald-400'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              {/* Voice Name & Gender info */}
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{voice.arabicName}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {voice.description}
                </p>
              </div>

              {/* Spoken preview snippet quote (visible when selected or playing) */}
              {voice.sampleSnippet && (
                <div
                  className={`mt-2 p-2 rounded-xl text-[11px] leading-relaxed transition-all ${
                    isPlaying
                      ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300 font-medium'
                      : isSelected
                      ? 'bg-slate-100/80 text-slate-700 border border-slate-200/60'
                      : 'bg-slate-50 text-slate-500 border border-slate-100'
                  }`}
                >
                  <span className="font-bold ml-1">نموذج الإلقاء:</span>
                  «{voice.sampleSnippet}»
                </div>
              )}

              {/* Error indicator if preview failed */}
              {hasError && (
                <div className="mt-2 p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errorVoiceId.msg}</span>
                </div>
              )}

              {/* Interactive Audio Preview Button & Waveform Footer */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => handleTogglePreview(e, voice)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                    isPlaying
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/40 animate-pulse'
                      : isLoading
                      ? 'bg-slate-100 text-slate-500 cursor-wait'
                      : isSelected
                      ? 'bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 border border-emerald-200'
                      : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200'
                  }`}
                  title="استمع إلى نبرة هذا المعلق"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>جارٍ التوليد...</span>
                    </>
                  ) : isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>إيقاف المعاينة</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
                      <span>معاينة الصوت</span>
                    </>
                  )}
                </button>

                {/* Animated wave bars when playing or static info */}
                {isPlaying ? (
                  <div className="flex items-center gap-0.5 h-4 px-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="w-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                    <span className="w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                    <span className="w-1 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.45s] h-2" />
                    <span className="w-1 bg-teal-500 rounded-full animate-bounce [animation-delay:-0.2s] h-3.5" />
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 font-mono font-medium">
                    {voice.gender === 'female' ? 'أنثى' : 'ذكر'} • {voice.name}
                  </span>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
