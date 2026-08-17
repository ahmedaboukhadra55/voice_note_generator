/**
 * Converts Base64 PCM16 raw audio data to a playable WAV Blob.
 */
export function pcm16Base64ToWav(base64: string, sampleRate: number = 24000): Blob {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Ensure 16-bit sample count
  const sampleCount = Math.floor(len / 2);
  const pcmData = new Int16Array(sampleCount);
  const dataViewIn = new DataView(bytes.buffer, bytes.byteOffset, len);
  for (let i = 0; i < sampleCount; i++) {
    pcmData[i] = dataViewIn.getInt16(i * 2, true);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = sampleCount * 2;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier 'RIFF'
  writeString(view, 0, 'RIFF');
  // file length minus RIFF identifier & file length (36 + dataSize)
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type 'WAVE'
  writeString(view, 8, 'WAVE');

  // format chunk identifier 'fmt '
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = raw PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);

  // data chunk identifier 'data'
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // write PCM samples
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Formats duration in seconds into MM:SS format.
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Estimates reading time in seconds based on Arabic spoken rate (~125-135 words/min).
 */
export function estimateReadingTime(text: string): { words: number; seconds: number; textFormatted: string } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  // ~2.1 words per second for standard deliberate sales voice note in Egyptian dialect
  const seconds = Math.max(1, Math.round(words / 2.1));
  const textFormatted = formatTime(seconds);
  return { words, seconds, textFormatted };
}
