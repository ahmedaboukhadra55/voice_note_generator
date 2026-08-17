export interface VoiceOption {
  id: string;
  name: string;
  arabicName: string;
  gender: 'female' | 'male';
  tag: string;
  description: string;
  sampleSnippet?: string;
  recommended?: boolean;
}

export interface ToneOption {
  id: string;
  label: string;
  description: string;
  iconName: string;
}

export interface ScriptTemplate {
  id: string;
  title: string;
  category: string;
  iconName: string;
  description: string;
  script: string;
  durationEstimate: string;
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  title: string;
  scriptText: string;
  voiceName: string;
  tone: string;
  blobUrl: string;
  durationSeconds: number;
  sampleRate: number;
}
