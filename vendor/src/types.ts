export const languages = ['Bisaya', 'Tagalog', 'English', 'Mixed'] as const;
export type Language = typeof languages[number];
export type Scope = Language | 'All';
export interface Recording {
  id: string; filename: string; createdAt: number; duration: number;
  mediaKind?: 'audio' | 'video';
  source?: 'local' | 'drive' | 'folder'; drive?: { fileId: string; resourceKey?: string };
  folder?: { key: string; hasMedia: boolean; mediaVersion?: string; videoVersion?: string; listeningVersion?: string; timingsVersion?: string; audioStatus?: 'ready' | 'preparing' | 'error'; audioMessage?: string };
}
export interface AudioFile { id: string; blob: Blob }
export interface Transcript {
  id: string; body: string; language: Language; status: 'draft' | 'complete' | 'review';
  updatedAt: number; position: number; speed: number; revision: number;
  textChangedAt?: number;
}
export interface ReferenceDocument { id: string; name: string; text: string; createdAt: number }
export interface Decision {
  id: string; date: string; situation: string; preferred: string; variants: string[];
  language: Scope; explanation: string; author: string; revision: number; updatedAt: number;
}
export interface DecisionRevision { id: string; decisionId: string; snapshot: Decision; changedAt: number }
export interface SpellingRule { id: string; preferred: string; variants: string[]; language: Scope; explanation: string; exactCase?: boolean }
export interface Finding { id: string; from: number; to: number; severity: 'error' | 'hint'; rule: string; message: string; replacement?: string }
export interface DriveConfig { clientId: string; apiKey: string; projectNumber: string }
export interface Settings { id: 'settings'; theme: 'light' | 'dark'; jump: number; volume: number; lastRecording?: string; drive?: DriveConfig; syncEnabled?: boolean }
