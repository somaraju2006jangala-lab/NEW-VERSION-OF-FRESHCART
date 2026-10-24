import { Product } from '../types';

export interface AssistantProductCard {
  id: string;
  title: string;
  price: number;
  unit: string;
  stock: number;
  image?: string;
  category?: string;
  badge?: string;
  isOrganic?: boolean;
  packSizes?: { size: string; price: number; isAvailable?: boolean; stock?: number }[];
}

export interface AssistantCouponCard {
  id: string;
  code: string;
  discountPercentage: number;
  minOrderAmount: number;
  description?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'customer' | 'assistant';
  text: string;
  image?: string;
  spokenMessage?: string;
  timestamp: string;
  language?: string;
  products?: AssistantProductCard[];
  coupons?: AssistantCouponCard[];
  quickReplies?: string[];
  requiresConfirmation?: boolean;
  pendingAction?: any;
  cartSummary?: {
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    mostExpensiveItem?: any;
  };
}

export interface AssistantChatResponse {
  success: boolean;
  message: string;
  spokenMessage?: string;
  language?: string;
  intent: string;
  actionExecuted?: boolean;
  cartUpdated?: boolean;
  cartItems?: any[];
  products?: any[];
  coupons?: any[];
  cartSummary?: {
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    mostExpensiveItem?: any;
  };
  requiresConfirmation?: boolean;
  pendingAction?: any;
  quickReplies?: string[];
  error?: string;
}

/**
 * Sends a message or voice transcript to the FreshCart backend AI service
 */
export async function sendAssistantMessage(
  message: string,
  token?: string,
  pendingAction?: any,
  language: string = 'en-IN',
  extraPayload?: {
    productId?: string;
    quantity?: number;
    packSize?: string;
    price?: number;
  }
): Promise<AssistantChatResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        pendingAction,
        language,
        ...(extraPayload || {}),
      }),
    });

    if (res.status === 401) {
      return {
        success: false,
        message: 'Your session has expired. Please sign in to use the FreshCart AI Assistant.',
        intent: 'AUTH_REQUIRED',
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[AssistantClient] Chat API error:', err);
    return {
      success: false,
      message: 'Network error connecting to FreshCart Assistant. Please check your connection and try again.',
      intent: 'ERROR',
      error: err?.message,
    };
  }
}

/**
 * Checks AI Assistant server health and Gemini Live API configuration
 */
export async function fetchAssistantHealth(): Promise<{
  success: boolean;
  status: string;
  provider: string;
  geminiLiveModel?: string;
  verifiedLiveModels?: string[];
  contentModels?: string[];
  apiKeyConfigured: boolean;
  voiceRecognitionSupported: boolean;
  supportedLanguages?: string[];
}> {
  try {
    const res = await fetch('/api/assistant/health');
    if (!res.ok) {
      return {
        success: false,
        status: 'offline',
        provider: 'Google Gemini Live API',
        geminiLiveModel: 'gemini-3.1-flash-live-preview',
        apiKeyConfigured: false,
        voiceRecognitionSupported: true,
      };
    }
    return await res.json();
  } catch {
    return {
      success: false,
      status: 'offline',
      provider: 'Google Gemini Live API',
      geminiLiveModel: 'gemini-3.1-flash-live-preview',
      apiKeyConfigured: false,
      voiceRecognitionSupported: true,
    };
  }
}

/**
 * Browser Speech Recognition wrapper supporting English, Hindi, and Telugu
 * with both single-shot and continuous listening options.
 */
export class VoiceRecognitionManager {
  private recognition: any = null;
  public isSupported: boolean = false;
  private currentLanguage: string = 'en-IN';
  private isExplicitlyStopped: boolean = false;
  private continuousMode: boolean = false;

  private onResultCallback?: (transcript: string, isFinal: boolean) => void;
  private onErrorCallback?: (errorMsg: string) => void;
  private onEndCallback?: () => void;
  private onStartCallback?: () => void;

  constructor() {
    const SpeechRecognition =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;

    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = 'en-IN';

      this.recognition.onstart = () => {
        this.onStartCallback?.();
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = final || interim;
        this.onResultCallback?.(text.trim(), !!final);
      };

      this.recognition.onerror = (event: any) => {
        let msg = 'Speech recognition error.';
        if (event.error === 'not-allowed') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser settings (click lock icon in address bar).';
          this.onErrorCallback?.(msg);
          return;
        } else if (event.error === 'no-speech') {
          // In continuous mode, no-speech is normal silence — restart silently
          if (this.continuousMode && !this.isExplicitlyStopped) {
            this.safeRestart();
            return;
          }
          msg = 'No speech detected. Please speak closer to your microphone.';
        } else if (event.error === 'network') {
          msg = 'Voice network error. Please check your internet connection.';
        } else if (event.error === 'aborted') {
          return;
        }
        this.onErrorCallback?.(msg);
      };

      this.recognition.onend = () => {
        this.onEndCallback?.();
        if (this.continuousMode && !this.isExplicitlyStopped) {
          this.safeRestart();
        }
      };
    } else {
      this.isSupported = false;
    }
  }

  public setLanguage(langCode: string) {
    this.currentLanguage = langCode;
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public start(
    onResult: (text: string, isFinal: boolean) => void,
    onStart: () => void,
    onEnd: () => void,
    onError: (err: string) => void,
    continuous: boolean = false
  ) {
    if (!this.isSupported || !this.recognition) {
      onError('Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    this.isExplicitlyStopped = false;
    this.continuousMode = continuous;
    this.onResultCallback = onResult;
    this.onStartCallback = onStart;
    this.onEndCallback = onEnd;
    this.onErrorCallback = onError;

    try {
      this.recognition.start();
    } catch {
      try {
        this.recognition.stop();
        setTimeout(() => {
          if (!this.isExplicitlyStopped) {
            this.recognition.start();
          }
        }, 150);
      } catch {}
    }
  }

  private safeRestart() {
    if (this.isExplicitlyStopped || !this.recognition) return;
    try {
      setTimeout(() => {
        if (!this.isExplicitlyStopped) {
          try {
            this.recognition.start();
          } catch {}
        }
      }, 250);
    } catch {}
  }

  public stop() {
    this.isExplicitlyStopped = true;
    this.continuousMode = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }
}

/**
 * Text-to-Speech synthesis with natural phonetic normalization
 * for English, Hindi (हिन्दी), and Telugu (తెలుగు)
 */
export function speakAssistantResponse(
  text: string,
  lang: string = 'en-IN',
  onEnd?: () => void,
  onStart?: () => void
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel(); // stop previous speech

    // Format numbers and symbols naturally based on language
    let cleanSpeech = text
      .replace(/[*_#`~]/g, '')
      .replace(/•/g, '')
      .replace(/₹\s*(\d+)/g, (_, amt) => {
        if (lang === 'hi-IN') return `${amt} रुपये`;
        if (lang === 'te-IN') return `${amt} రూపాయలు`;
        return `${amt} rupees`;
      })
      .replace(/Rs\.?\s*(\d+)/gi, (_, amt) => {
        if (lang === 'hi-IN') return `${amt} रुपये`;
        if (lang === 'te-IN') return `${amt} రూపాయలు`;
        return `${amt} rupees`;
      })
      .trim();

    if (!cleanSpeech) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return null;

      // 1. Exact language match (e.g., 'hi-IN', 'te-IN', 'en-IN')
      let matched = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase());
      if (matched) return matched;

      // 2. Prefix match (e.g., 'hi', 'te', 'en')
      const prefix = lang.slice(0, 2).toLowerCase();
      matched = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
      if (matched) return matched;

      // 3. Fallback to any Indian voice or English voice
      return voices.find((v) => v.lang.includes('IN')) || voices[0];
    };

    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
    }

    let hasEnded = false;
    const finish = () => {
      if (!hasEnded) {
        hasEnded = true;
        onEnd?.();
      }
    };

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = finish;
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[AssistantTTS] utterance error:', e.error);
      }
      finish();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[AssistantTTS] Speech error:', err);
    onEnd?.();
  }
}

/**
 * Stops any active speech playback
 */
export function stopAssistantSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
