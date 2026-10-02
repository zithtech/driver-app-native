import Tts from 'react-native-tts';
import { Platform } from 'react-native';

class AudioService {
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (!Tts) {
      console.error('❌ AudioService: react-native-tts module is null. Check native linking.');
      return;
    }

    try {
      await Tts.getInitStatus();
      this.initialized = true;
      
      if (Platform.OS === 'ios') {
        // Ensure voice is heard even if the physical silent switch is turned on
        Tts.setIgnoreSilentSwitch('ignore');
      } else if (Platform.OS === 'android') {
        Tts.setDefaultLanguage('en-US');
      }
      
      console.log('🎙️ AudioService (TTS) Initialized');
    } catch (error: any) {
      if (error && error.code === 'no_engine') {
        console.warn('⚠️ No TTS engine found. Attempting to install...');
        Tts.requestInstallEngine();
      } else {
        console.error('❌ TTS Initialization Failed:', error);
      }
    }
  }

  /**
   * Speak a message clearly
   * @param message Text to speak
   */
  public speak(message: string) {
    if (!Tts) return;

    if (!this.initialized) {
        // Retry initialization if it failed earlier
        this.init().then(() => {
            if (this.initialized) this.speak(message); // Recursively call to preserve settings
        });
        return;
    }

    try {
      Tts.stop(); // Stop any ongoing speech
      Tts.speak(message, {
        iosVoiceId: 'com.apple.ttsbundle.Samantha-compact', 
        rate: 0.5,
        androidParams: {
          KEY_PARAM_PAN: 0,
          KEY_PARAM_VOLUME: 1,
          KEY_PARAM_STREAM: 'STREAM_MUSIC',
        },
      });
      console.log('🗣️ Speaking:', message);
    } catch (error) {
      console.error('❌ Failed to speak message:', error);
    }
  }

  /**
   * Stop any ongoing speech
   */
  public stop() {
    if (Tts) Tts.stop();
  }
}

export default new AudioService();
