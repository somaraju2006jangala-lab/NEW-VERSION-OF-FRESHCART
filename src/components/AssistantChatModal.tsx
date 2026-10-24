import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ShoppingCart,
  Plus,
  Check,
  AlertCircle,
  Tag,
  ArrowRight,
  Globe,
  Radio,
  Square,
  RotateCcw,
} from 'lucide-react';
import { Product, CartItem } from '../types';
import {
  AssistantMessage,
  AssistantProductCard,
  AssistantCouponCard,
  sendAssistantMessage,
  VoiceRecognitionManager,
  speakAssistantResponse,
  stopAssistantSpeaking,
} from '../services/assistantService';

interface AssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToken?: string;
  customerName?: string;
  onAddToCart: (product: Product, quantity: number, packSize?: string, packPrice?: number) => void;
  onUpdateCartQty: (productId: string, delta: number, packSize?: string) => void;
  onRemoveCartItem: (productId: string, packSize?: string) => void;
  onClearCart: () => void;
  onNavigateToCart: () => void;
  onSyncCartFromBackend?: (items: CartItem[]) => void;
  sessionMessages: AssistantMessage[];
  setSessionMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>;
}

const QUICK_ACTIONS = [
  'Show All Products',
  'View Vegetables',
  'View Fruits',
  'View Deals',
  'View Cart',
];

const LANGUAGE_OPTIONS = [
  { code: 'en-IN', label: 'English', short: 'EN' },
  { code: 'hi-IN', label: 'हिन्दी', short: 'HI' },
  { code: 'te-IN', label: 'తెలుగు', short: 'TE' },
];

export const AssistantChatModal: React.FC<AssistantChatModalProps> = ({
  isOpen,
  onClose,
  customerToken,
  customerName,
  onAddToCart,
  onUpdateCartQty,
  onRemoveCartItem,
  onClearCart,
  onNavigateToCart,
  onSyncCartFromBackend,
  sessionMessages,
  setSessionMessages,
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Voice States
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [liveVoiceState, setLiveVoiceState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceManagerRef = useRef<VoiceRecognitionManager | null>(null);
  const isLiveVoiceModeRef = useRef(false);
  const isMutedRef = useRef(false);

  // Keep refs in sync with state for callbacks
  useEffect(() => {
    isLiveVoiceModeRef.current = isLiveVoiceMode;
  }, [isLiveVoiceMode]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize Speech Recognition Manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      voiceManagerRef.current = new VoiceRecognitionManager();
    }
    return () => {
      stopAssistantSpeaking();
      voiceManagerRef.current?.stop();
    };
  }, []);

  // Update recognition language whenever language changes
  useEffect(() => {
    voiceManagerRef.current?.setLanguage(selectedLanguage);
  }, [selectedLanguage]);

  // Initial welcome message for current session if empty
  useEffect(() => {
    if (sessionMessages.length === 0) {
      const welcomeName = customerName ? `, ${customerName}` : '';
      setSessionMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: `Hello${welcomeName}! Welcome to FreshCart. I am your Gemini Live Voice & Shopping Assistant. You can speak naturally or type:
• "Add 2 kg tomatoes to my cart"
• "Show fresh vegetables"
• "Prepare a grocery list under ₹500"
• "Show my cart and calculate total"
• "Apply coupon SAVE10"`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: QUICK_ACTIONS,
        },
      ]);
    }
  }, [customerName, sessionMessages.length, setSessionMessages]);

  // Auto-scroll chat area
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sessionMessages, isLoading, isOpen, isMinimized, interimTranscript]);

  // Cleanup on close or minimize
  useEffect(() => {
    if (!isOpen) {
      handleStopLiveVoice();
      stopAssistantSpeaking();
    }
  }, [isOpen]);

  // Stop Live Voice Mode cleanly
  const handleStopLiveVoice = useCallback(() => {
    setIsLiveVoiceMode(false);
    setLiveVoiceState('IDLE');
    setInterimTranscript('');
    voiceManagerRef.current?.stop();
    stopAssistantSpeaking();
  }, []);

  // Starts continuous listening in the live turn-taking loop
  const startContinuousListening = useCallback(() => {
    if (!voiceManagerRef.current?.isSupported) {
      setVoiceError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      );
      setIsLiveVoiceMode(false);
      setLiveVoiceState('IDLE');
      return;
    }

    if (isMutedRef.current) {
      setLiveVoiceState('IDLE');
      return;
    }

    setVoiceError(null);
    setLiveVoiceState('LISTENING');

    voiceManagerRef.current.start(
      (transcript, isFinal) => {
        if (!isLiveVoiceModeRef.current || isMutedRef.current) return;

        setInterimTranscript(transcript);

        if (isFinal && transcript.trim().length > 0) {
          setInterimTranscript('');
          // Trigger conversational turn
          handleSendVoiceUtterance(transcript.trim());
        }
      },
      () => {
        setLiveVoiceState('LISTENING');
        setVoiceError(null);
      },
      () => {
        // If live mode is still active and we're not speaking/thinking, keep state aligned
        if (isLiveVoiceModeRef.current && liveVoiceState === 'LISTENING' && !isMutedRef.current) {
          // Continuous loop managed by manager's safeRestart
        }
      },
      (errorMsg) => {
        if (!isLiveVoiceModeRef.current) return;
        setVoiceError(errorMsg);
        if (errorMsg.includes('denied')) {
          setIsLiveVoiceMode(false);
          setLiveVoiceState('IDLE');
        }
      },
      true // continuous mode
    );
  }, [liveVoiceState]);

  // Toggle Live Voice Mode ON / OFF
  const handleToggleLiveVoiceMode = () => {
    setVoiceError(null);

    if (isLiveVoiceMode) {
      handleStopLiveVoice();
      return;
    }

    if (!voiceManagerRef.current?.isSupported) {
      setVoiceError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.'
      );
      return;
    }

    setIsLiveVoiceMode(true);
    setIsMuted(false);
    isMutedRef.current = false;
    isLiveVoiceModeRef.current = true;
    startContinuousListening();
  };

  // Toggle Mute during Live Conversation
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (nextMuted) {
      voiceManagerRef.current?.stop();
      setLiveVoiceState('IDLE');
      setInterimTranscript('');
    } else {
      if (isLiveVoiceMode) {
        startContinuousListening();
      }
    }
  };

  // Process voice utterance in real-time
  const handleSendVoiceUtterance = async (transcript: string) => {
    if (!transcript.trim()) return;

    // Temporarily halt listening while processing & speaking
    voiceManagerRef.current?.stop();
    setLiveVoiceState('THINKING');

    // Append customer message
    const customerMsg: AssistantMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: transcript,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessionMessages((prev) => [...prev, customerMsg]);

    try {
      const response = await sendAssistantMessage(
        transcript,
        customerToken,
        pendingAction,
        selectedLanguage
      );

      // Reset pending action
      setPendingAction(response.requiresConfirmation ? response.pendingAction : null);

      // Synchronize cart state if cart was updated on backend
      if (response.cartUpdated && Array.isArray(response.cartItems) && onSyncCartFromBackend) {
        onSyncCartFromBackend(response.cartItems);
      } else if (response.intent === 'CLEAR_CART' && response.actionExecuted) {
        onClearCart();
      }

      // Convert products to AssistantProductCard
      const products: AssistantProductCard[] | undefined = Array.isArray(response.products)
        ? response.products.map((p: any) => ({
            id: p.id || p.product_id,
            title: p.title || p.name,
            price: Number(p.price),
            unit: p.unit || '1 unit',
            stock: Number(p.stock ?? p.quantity ?? 0),
            image: p.image,
            category: p.category,
            badge: p.badge,
            isOrganic: Boolean(p.isOrganic),
            packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
          }))
        : undefined;

      // Convert coupons
      const coupons: AssistantCouponCard[] | undefined = Array.isArray(response.coupons)
        ? response.coupons.map((c: any) => ({
            id: String(c.id),
            code: c.code || c.coupon_code,
            discountPercentage: Number(c.discountPercentage || c.discount_percentage),
            minOrderAmount: Number(c.minOrderAmount || c.minimum_order_amount),
            description: c.description,
          }))
        : undefined;

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message || 'I have processed your request.',
        spokenMessage: response.spokenMessage || response.message,
        language: response.language || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products,
        coupons,
        quickReplies:
          response.quickReplies ||
          (products && products.length > 0 ? ['View Cart', 'Show Vegetables'] : undefined),
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction,
        cartSummary: response.cartSummary,
      };

      setSessionMessages((prev) => [...prev, assistantMsg]);

      // Speak response aloud
      const textToSpeak = response.spokenMessage || response.message;
      const speechLang = response.language || selectedLanguage;

      if (textToSpeak) {
        setLiveVoiceState('SPEAKING');
        setSpeakingMessageId(assistantMsg.id);

        speakAssistantResponse(
          textToSpeak,
          speechLang,
          () => {
            // Once speaking finishes, resume listening automatically if Live Voice Mode is active!
            setSpeakingMessageId(null);
            if (isLiveVoiceModeRef.current && !isMutedRef.current) {
              setLiveVoiceState('LISTENING');
              setTimeout(() => {
                if (isLiveVoiceModeRef.current && !isMutedRef.current) {
                  startContinuousListening();
                }
              }, 400);
            } else {
              setLiveVoiceState('IDLE');
            }
          },
          () => {
            setLiveVoiceState('SPEAKING');
          }
        );
      } else {
        if (isLiveVoiceModeRef.current && !isMutedRef.current) {
          startContinuousListening();
        } else {
          setLiveVoiceState('IDLE');
        }
      }
    } catch {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessionMessages((prev) => [...prev, errorMsg]);

      if (isLiveVoiceModeRef.current && !isMutedRef.current) {
        startContinuousListening();
      } else {
        setLiveVoiceState('IDLE');
      }
    }
  };

  // Typed Chat Send Handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    // Append customer message
    const customerMsg: AssistantMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text,
      language: selectedLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSessionMessages((prev) => [...prev, customerMsg]);
    setInputText('');
    setIsLoading(true);
    setVoiceError(null);

    try {
      const response = await sendAssistantMessage(
        text,
        customerToken,
        pendingAction,
        selectedLanguage
      );

      setPendingAction(response.requiresConfirmation ? response.pendingAction : null);

      if (response.cartUpdated && Array.isArray(response.cartItems) && onSyncCartFromBackend) {
        onSyncCartFromBackend(response.cartItems);
      } else if (response.intent === 'CLEAR_CART' && response.actionExecuted) {
        onClearCart();
      }

      const products: AssistantProductCard[] | undefined = Array.isArray(response.products)
        ? response.products.map((p: any) => ({
            id: p.id || p.product_id,
            title: p.title || p.name,
            price: Number(p.price),
            unit: p.unit || '1 unit',
            stock: Number(p.stock ?? p.quantity ?? 0),
            image: p.image,
            category: p.category,
            badge: p.badge,
            isOrganic: Boolean(p.isOrganic),
            packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
          }))
        : undefined;

      const coupons: AssistantCouponCard[] | undefined = Array.isArray(response.coupons)
        ? response.coupons.map((c: any) => ({
            id: String(c.id),
            code: c.code || c.coupon_code,
            discountPercentage: Number(c.discountPercentage || c.discount_percentage),
            minOrderAmount: Number(c.minOrderAmount || c.minimum_order_amount),
            description: c.description,
          }))
        : undefined;

      const assistantMsg: AssistantMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.message || 'I have processed your request.',
        spokenMessage: response.spokenMessage || response.message,
        language: response.language || selectedLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products,
        coupons,
        quickReplies:
          response.quickReplies ||
          (products && products.length > 0 ? ['View Cart', 'Show Vegetables'] : undefined),
        requiresConfirmation: response.requiresConfirmation,
        pendingAction: response.pendingAction,
        cartSummary: response.cartSummary,
      };

      setSessionMessages((prev) => [...prev, assistantMsg]);

      // Speak response if voice responses are enabled or in live voice mode
      if ((voiceResponseEnabled || isLiveVoiceMode) && (response.spokenMessage || response.message)) {
        setSpeakingMessageId(assistantMsg.id);
        speakAssistantResponse(
          response.spokenMessage || response.message,
          response.language || selectedLanguage,
          () => {
            setSpeakingMessageId(null);
            if (isLiveVoiceModeRef.current && !isMutedRef.current) {
              startContinuousListening();
            }
          }
        );
      }
    } catch {
      const errorMsg: AssistantMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setSessionMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Speak a specific message item on demand
  const handleSpeakMessage = (msgId: string, text: string, lang?: string) => {
    if (speakingMessageId === msgId) {
      stopAssistantSpeaking();
      setSpeakingMessageId(null);
      return;
    }
    setSpeakingMessageId(msgId);
    speakAssistantResponse(text, lang || selectedLanguage, () => {
      setSpeakingMessageId(null);
    });
  };

  // Add Product to Cart from Chat Product Card
  const handleCardAddToCart = (p: AssistantProductCard) => {
    const fullProduct: Product = {
      id: p.id,
      title: p.title,
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      image: p.image || '',
      category: p.category || 'produce',
      categoryLabel: p.category || 'Fruits & Veggies',
      supplier: 'FreshCart Harvest',
      sku: `SKU-${p.id}`,
      badge: p.badge || '',
      isOrganic: p.isOrganic,
      packSizes: p.packSizes,
    };

    onAddToCart(fullProduct, 1, p.unit, p.price);
    handleSendMessage(`Add 1 ${p.unit} ${p.title} to my cart`);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-out shadow-2xl flex flex-col ${
        isMinimized
          ? 'bottom-6 right-6 w-84 h-16 rounded-2xl bg-[#0b1420]/95 border border-emerald-500/40 backdrop-blur-xl'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[480px] h-[85vh] sm:h-[700px] max-h-[92vh] rounded-3xl bg-[#070d14]/95 border border-white/15 backdrop-blur-2xl overflow-hidden'
      }`}
      style={{
        boxShadow: isLiveVoiceMode
          ? '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.35)'
          : '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 107, 44, 0.25)',
      }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] backdrop-blur-md select-none">
        <div className="flex items-center gap-3">
          {/* Avatar with live status indicator */}
          <div className="relative">
            <img
              src="/assets/ai-avatar.jpg"
              alt="FreshCart AI Assistant"
              className={`w-10 h-10 rounded-full object-cover ring-2 shadow-lg transition-all ${
                isLiveVoiceMode
                  ? 'ring-emerald-400 shadow-emerald-500/40'
                  : 'ring-emerald-500/60 shadow-emerald-500/20'
              }`}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Live pulsing dot */}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#070d14] rounded-full shadow-xs ${
                isLiveVoiceMode ? 'bg-cyan-400' : 'bg-emerald-400'
              }`}
            >
              <span
                className={`absolute inset-0 rounded-full animate-ping opacity-75 ${
                  isLiveVoiceMode ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}
              />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-white tracking-wide flex items-center gap-1.5">
                FreshCart AI Assistant
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
            </div>
            <p className="text-[11px] text-emerald-300/80 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Gemini Live Voice Partner
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-1.5 text-slate-300">
          {/* Live Voice Toggle Pill */}
          <button
            type="button"
            id="ai-assistant-live-voice-toggle"
            onClick={handleToggleLiveVoiceMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isLiveVoiceMode
                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/20'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
            }`}
            title={isLiveVoiceMode ? 'Stop Live Voice Conversation' : 'Start Google Gemini Live Voice'}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveVoiceMode ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">{isLiveVoiceMode ? 'Stop Live Voice' : 'Live Voice'}</span>
          </button>

          {/* Language Selector */}
          <div className="relative group">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs font-semibold text-emerald-300 flex items-center gap-1 cursor-pointer"
              title="Select Conversation Language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.short}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-[#0b1726] border border-white/15 rounded-xl shadow-xl overflow-hidden py-1 z-30 min-w-32">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`px-3 py-1.5 text-left text-xs transition-colors hover:bg-emerald-500/20 cursor-pointer ${
                    selectedLanguage === lang.code ? 'text-emerald-300 font-bold' : 'text-slate-300'
                  }`}
                >
                  {lang.label} ({lang.short})
                </button>
              ))}
            </div>
          </div>

          {/* Voice Audio Toggle */}
          <button
            type="button"
            onClick={() => {
              if (voiceResponseEnabled) {
                stopAssistantSpeaking();
              }
              setVoiceResponseEnabled(!voiceResponseEnabled);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              voiceResponseEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'hover:bg-white/10 text-slate-400'
            }`}
            title={voiceResponseEnabled ? 'Voice Responses Enabled' : 'Voice Responses Muted'}
          >
            {voiceResponseEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Minimize / Maximize */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chat Body (hidden if minimized) */}
      {!isMinimized && (
        <>
          {/* Active Live Voice Mode Ribbon Banner */}
          {isLiveVoiceMode && (
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/70 via-[#06241a]/80 to-teal-950/70 border-b border-emerald-500/30 flex items-center justify-between gap-3 text-xs shadow-inner">
              <div className="flex items-center gap-3">
                {/* Dynamic Sound Wave Bars */}
                <div className="flex items-center gap-0.5 h-6 px-1">
                  <span
                    className={`w-1 rounded-full bg-emerald-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-5 [animation-delay:-0.4s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-teal-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-6 [animation-delay:-0.2s]'
                        : 'h-2 opacity-50'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-cyan-400 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-4 [animation-delay:0s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-emerald-300 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-5 [animation-delay:0.2s]'
                        : 'h-2 opacity-50'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-teal-300 transition-all ${
                      liveVoiceState === 'LISTENING' || liveVoiceState === 'SPEAKING'
                        ? 'animate-bounce h-4 [animation-delay:0.4s]'
                        : 'h-1.5 opacity-40'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    {liveVoiceState === 'LISTENING' && (
                      <span className="text-emerald-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Listening continuously... Speak now
                      </span>
                    )}
                    {liveVoiceState === 'THINKING' && (
                      <span className="text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Thinking with Gemini Live...
                      </span>
                    )}
                    {liveVoiceState === 'SPEAKING' && (
                      <span className="text-purple-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        FreshCart speaking response...
                      </span>
                    )}
                    {liveVoiceState === 'IDLE' && (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        {isMuted ? 'Microphone Muted' : 'Standby'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-emerald-200/60 font-medium">
                    Language: {LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage)?.label} • Hands-free continuous dialogue
                  </p>
                </div>
              </div>

              {/* Dedicated Stop & Mute Controls */}
              <div className="flex items-center gap-1.5">
                {/* Mute Mic */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'bg-white/10 hover:bg-white/20 text-slate-200'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                {/* Stop Voice Conversation */}
                <button
                  type="button"
                  id="ai-assistant-stop-live-voice-btn"
                  onClick={handleStopLiveVoice}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                  title="Stop Live Voice Conversation"
                >
                  <Square className="w-3 h-3 fill-rose-300" />
                  <span>Stop</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Interim Transcript Bubble */}
          {isLiveVoiceMode && interimTranscript && (
            <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/25 flex items-center gap-2 text-xs text-emerald-200 animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="italic">"{interimTranscript}"</span>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {sessionMessages.map((msg) => {
              const isCust = msg.sender === 'customer';
              const isSpeaking = speakingMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCust ? 'items-end' : 'items-start'} transition-all`}
                >
                  <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
                    {!isCust && (
                      <img
                        src="/assets/ai-avatar.jpg"
                        alt="AI"
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-emerald-500/40 mb-1 shrink-0"
                      />
                    )}

                    <div
                      className={`relative px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed transition-all shadow-md ${
                        isCust
                          ? 'bg-emerald-700/90 text-white rounded-br-xs border border-emerald-500/30'
                          : 'bg-[#0f1b2b]/95 text-slate-100 rounded-bl-xs border border-white/10 shadow-emerald-950/30'
                      }`}
                    >
                      {/* Message Content */}
                      <div className="whitespace-pre-line break-words">{msg.text}</div>

                      {/* Attached Product Cards */}
                      {msg.products && msg.products.length > 0 && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-white/10">
                          {msg.products.slice(0, 4).map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt={p.title}
                                    className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                                    <ShoppingCart className="w-5 h-5 text-emerald-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-xs font-semibold text-white truncate">
                                    {p.title}
                                  </h4>
                                  <p className="text-[11px] text-emerald-300 font-bold">
                                    ₹{p.price}{' '}
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      / {p.unit}
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCardAddToCart(p)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Attached Coupon Cards */}
                      {msg.coupons && msg.coupons.length > 0 && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-white/10">
                          {msg.coupons.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25"
                            >
                              <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div>
                                  <span className="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                    {c.code}
                                  </span>
                                  <p className="text-[10px] text-slate-300 mt-0.5">
                                    {c.discountPercentage}% OFF on orders ₹{c.minOrderAmount}+
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSendMessage(`Apply coupon ${c.code}`)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold cursor-pointer transition-colors"
                              >
                                Apply
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Confirmation Action Buttons (e.g. Clear Cart Confirm) */}
                      {msg.requiresConfirmation && (
                        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendMessage('yes confirm clear')}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage('no cancel')}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Footer: Timestamp & Read Aloud Speaker */}
                      <div className="flex items-center justify-end gap-2 mt-1.5 text-[10px] text-slate-400 select-none">
                        <span>{msg.timestamp}</span>
                        {!isCust && (
                          <button
                            type="button"
                            onClick={() =>
                              handleSpeakMessage(
                                msg.id,
                                msg.spokenMessage || msg.text,
                                msg.language
                              )
                            }
                            className={`p-0.5 rounded transition-colors cursor-pointer ${
                              isSpeaking
                                ? 'text-emerald-400 bg-emerald-500/20'
                                : 'hover:text-slate-200'
                            }`}
                            title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                          >
                            <Volume2
                              className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Chips attached to message */}
                  {msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                      {msg.quickReplies.map((qr, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (qr === 'View Cart') {
                              onNavigateToCart();
                            } else {
                              handleSendMessage(qr);
                            }
                          }}
                          className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                        >
                          {qr}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing / Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <img
                  src="/assets/ai-avatar.jpg"
                  alt="AI"
                  className="w-6 h-6 rounded-full ring-1 ring-emerald-500/40 object-cover"
                />
                <div className="flex items-center gap-1.5 bg-[#111e2f] px-3.5 py-2.5 rounded-2xl rounded-bl-xs border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-emerald-300/80 font-medium ml-1">
                    FreshCart Assistant thinking...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Error Banner */}
          {voiceError && (
            <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30 text-red-300 text-[11.5px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{voiceError}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleLiveVoiceMode}
                  className="text-red-300 hover:text-white underline text-[11px] font-semibold cursor-pointer"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-red-300 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Action Chips Bar */}
          <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {QUICK_ACTIONS.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (action === 'View Cart') {
                    onNavigateToCart();
                  } else {
                    handleSendMessage(action);
                  }
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-medium text-slate-300 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/40 whitespace-nowrap transition-all cursor-pointer"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Chat Input Controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-white/10 bg-[#08111c] flex items-center gap-2"
          >
            {/* Microphone Button (Starts/Stops Live Voice or single shot) */}
            <button
              type="button"
              id="ai-assistant-mic-btn"
              onClick={handleToggleLiveVoiceMode}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative shrink-0 ${
                isLiveVoiceMode
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/40 ring-2 ring-rose-400'
                  : 'bg-white/10 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-white/10'
              }`}
              title={isLiveVoiceMode ? 'Stop Live Voice Mode' : 'Start Google Gemini Live Voice Conversation'}
            >
              {isLiveVoiceMode ? (
                <MicOff className="w-4 h-4 animate-pulse" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Text Input */}
            <input
              type="text"
              id="ai-assistant-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask e.g. 'Add 2 kg tomatoes' or speak with mic..."
              disabled={isLoading}
              className="flex-1 px-3.5 py-2.5 bg-white/[0.05] border border-white/15 focus:border-emerald-500/60 rounded-xl text-white placeholder-slate-400 text-[13px] outline-none transition-all"
            />

            {/* Send Button */}
            <button
              type="submit"
              id="ai-assistant-send-btn"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-emerald-600/30 cursor-pointer shrink-0"
              title="Send Command"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
