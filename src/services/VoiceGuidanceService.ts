import Tts from 'react-native-tts';
import { Platform } from 'react-native';

export type VoiceLanguage = 'en' | 'ta';

export interface VoiceInstructionLog {
  id: string;
  text: string;
  language: VoiceLanguage;
  timestamp: number;
  checkpointId?: string;
}

class VoiceGuidanceService {
  private isInitialized = false;
  private currentLanguage: VoiceLanguage = 'en';
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private speechQueue: string[] = [];
  private isSpeaking = false;
  private instructionLogs: VoiceInstructionLog[] = [];
  private isMuted: boolean = false;

  constructor() {
    this.init();
  }

  async init() {
    if (this.isInitialized) return;
    try {
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.0);

      Tts.addEventListener('tts-start', () => {
        this.isSpeaking = true;
      });

      Tts.addEventListener('tts-finish', () => {
        this.isSpeaking = false;
        this.processQueue();
      });

      Tts.addEventListener('tts-cancel', () => {
        this.isSpeaking = false;
        this.processQueue();
      });

      await this.setLanguage('en');
      this.isInitialized = true;
    } catch (e) {
      console.warn('[VoiceGuidanceService] TTS Initialization warning:', e);
    }
  }

  async setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
    try {
      if (lang === 'ta') {
        const tamilCode = Platform.OS === 'ios' ? 'ta-IN' : 'ta_IN';
        await Tts.setDefaultLanguage(tamilCode);
      } else {
        const enCode = Platform.OS === 'ios' ? 'en-US' : 'en_US';
        await Tts.setDefaultLanguage(enCode);
      }
    } catch (err) {
      console.warn(`[VoiceGuidanceService] Language ${lang} not fully supported by TTS engine, falling back to default`, err);
    }
  }

  getLanguage(): VoiceLanguage {
    return this.currentLanguage;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      Tts.stop();
      this.speechQueue = [];
    }
  }

  isVoiceMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Speak a voice prompt with de-duplication (minimum 8s debounce for same instruction)
   */
  speak(text: string, options?: { checkpointId?: string; force?: boolean; language?: VoiceLanguage }) {
    if (this.isMuted || !text) return;

    const now = Date.now();
    const lang = options?.language || this.currentLanguage;

    // Prevent repeated prompts within 8 seconds unless forced
    if (!options?.force && this.lastSpokenText === text && now - this.lastSpokenTime < 8000) {
      return;
    }

    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    // Log the instruction
    this.instructionLogs.push({
      id: `${now}_${Math.random().toString(36).substring(2, 7)}`,
      text,
      language: lang,
      timestamp: now,
      checkpointId: options?.checkpointId,
    });

    if (this.isSpeaking) {
      this.speechQueue.push(text);
    } else {
      this.executeSpeak(text);
    }
  }

  private executeSpeak(text: string) {
    try {
      this.isSpeaking = true;
      Tts.speak(text);
    } catch (e) {
      console.warn('[VoiceGuidanceService] Speech error:', e);
      this.isSpeaking = false;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.speechQueue.length > 0 && !this.isSpeaking && !this.isMuted) {
      const nextText = this.speechQueue.shift();
      if (nextText) {
        this.executeSpeak(nextText);
      }
    }
  }

  stop() {
    try {
      Tts.stop();
      this.speechQueue = [];
      this.isSpeaking = false;
    } catch (e) {}
  }

  getLogs(): VoiceInstructionLog[] {
    return [...this.instructionLogs];
  }

  clearLogs() {
    this.instructionLogs = [];
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;
  }
}

export default new VoiceGuidanceService();
