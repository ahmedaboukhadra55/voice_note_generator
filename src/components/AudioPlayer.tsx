import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Check,
  Share2,
  Sparkles,
  Layers,
  Clock,
} from 'lucide-react';
import { formatTime } from '../utils/audio';

interface AudioPlayerProps {
  audioBlobUrl: string | null;
  scriptText: string;
  voiceName: string;
  sampleRate?: number;
  onRegenerate?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBlobUrl,
  scriptText,
  voiceName,
  sampleRate = 24000,
  onRegenerate,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize or reset audio when blobUrl changes
  useEffect(() => {
    if (audioRef.current && audioBlobUrl) {
      audioRef.current.src = audioBlobUrl;
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);

      // Autoplay with safe catch
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay policy prevented playback, normal user interaction will play
            setIsPlaying(false);
          });
      }
    }
  }, [audioBlobUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Play failed:', e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMute = !isMuted;
    setIsMuted(newMute);
    audioRef.current.muted = newMute;
  };

  const handleReplay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!audioBlobUrl) return null;

  // Visualizer bar heights simulator
  const barCount = 36;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="voice-note-result-card"
      className="bg-gradient-to-br from-emerald-50 via-teal-50/70 to-slate-50 border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-7 shadow-xl shadow-emerald-950/5 transition-all animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-emerald-200/60">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
            <span>الفويس نوت جاهزة للاستماع والتحميل</span>
          </h2>
          <span className="bg-emerald-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {voiceName}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium">
          <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            {formatTime(duration || currentTime)}
          </span>
          <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
            WAV 16-bit ({sampleRate / 1000} kHz)
          </span>
        </div>
      </div>

      {/* Sound Waves & Visualizer */}
      <div className="my-5 bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-sm">
        <div className="flex items-end justify-between gap-1 h-16 sm:h-20 px-2 select-none">
          {Array.from({ length: barCount }).map((_, index) => {
            const barProgress = (index / barCount) * 100;
            const isPassed = barProgress <= progressPercent;
            // Generate distinct heights based on sine wave pattern
            const baseHeight = 25 + Math.sin(index * 0.45) * 35 + (index % 4) * 8;
            const liveHeight = isPlaying
              ? Math.min(100, Math.max(15, baseHeight + Math.sin(Date.now() / 150 + index) * 20))
              : baseHeight;

            return (
              <div
                key={index}
                onClick={() => {
                  const targetTime = (index / barCount) * duration;
                  if (audioRef.current) {
                    audioRef.current.currentTime = targetTime;
                    setCurrentTime(targetTime);
                  }
                }}
                className={`w-full rounded-full transition-all duration-150 cursor-pointer ${
                  isPassed
                    ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-xs'
                    : 'bg-slate-200 hover:bg-emerald-200'
                }`}
                style={{
                  height: `${Math.min(100, Math.max(12, liveHeight))}%`,
                }}
              />
            );
          })}
        </div>

        {/* Progress Slider */}
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
          />
          <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Left Side: Playback buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={togglePlayPause}
            id="audio-play-pause-btn"
            className="w-13 h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-all font-bold"
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-[-1px]" />
            )}
          </button>

          <button
            onClick={handleReplay}
            id="audio-replay-btn"
            className="p-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            title="إعادة التشغيل من البداية"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-xs">
            {[1, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  playbackRate === rate
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume & Mute */}
        <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
          <button
            onClick={toggleMute}
            className="text-slate-600 hover:text-emerald-700 transition-colors"
            title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
        </div>

        {/* Action: Copy Script & Download */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopyScript}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs sm:text-sm transition-all shadow-xs"
            title="نسخ نص الفويس نوت"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">تم النسخ</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>نسخ النص</span>
              </>
            )}
          </button>

          <a
            href={audioBlobUrl}
            download={`2N_VoiceNote_${voiceName}_${Date.now()}.wav`}
            id="download-wav-btn"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/25 transition-all"
          >
            <Download className="w-5 h-5 stroke-[2.2]" />
            <span>تحميل المقطع (WAV)</span>
          </a>
        </div>

      </div>

      {/* Script snippet preview */}
      <div className="mt-4 pt-3 border-t border-emerald-200/50 flex items-center justify-between text-xs text-emerald-900/80">
        <span className="truncate max-w-md">
          <span className="font-semibold ml-1">النص المسجل:</span>
          {scriptText.slice(0, 70)}...
        </span>
        <span className="shrink-0 text-slate-500 font-medium">
          جاهز للمشاركة عبر الواتساب ومواقع التواصل
        </span>
      </div>
    </div>
  );
};
