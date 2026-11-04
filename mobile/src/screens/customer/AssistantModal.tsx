import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import {
  X,
  Send,
  Sparkles,
  ShoppingCart,
  Plus,
  Minus,
  Tag,
  Bot,
  User,
  ShoppingBag,
  ArrowRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Camera,
  Check,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { assistantApi, customerApi, AssistantChatResponse } from '../../services/apiClient';
import { Product } from '../../types';

interface AssistantModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToCart?: () => void;
  onSelectProduct?: (product: Product) => void;
  catalogProducts?: Product[];
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'assistant';
  text: string;
  timestamp: string;
  image?: string;
  products?: any[];
  isImageRecognitionResult?: boolean;
  coupons?: any[];
  quickReplies?: string[];
  cartSummary?: {
    itemCount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
  };
  groceryListReview?: {
    listId: string;
    totalItems: number;
    matchedCount: number;
    estimatedSubtotal: number;
    items: any[];
  };
}

export const PRODUCT_CATEGORIES = [
  'Show All Products',
  'Produce & Fruit',
  'Dairy & Eggs',
  'Bakery',
  'Beverages',
  'Snacks',
  'Rice & Grains',
  'Pantry',
  'View Cart',
] as const;

/**
 * Converts common plural grocery names to singular form (e.g. Bananas -> Banana, Tomatoes -> Tomato)
 */
function toSingularItemName(name: string): string {
  const irregulars: Record<string, string> = {
    tomatoes: 'Tomato',
    potatoes: 'Potato',
    mangoes: 'Mango',
    berries: 'Berry',
    strawberries: 'Strawberry',
    blueberries: 'Blueberry',
    cherries: 'Cherry',
    leaves: 'Leaf',
  };
  const lower = name.toLowerCase();
  if (irregulars[lower]) return irregulars[lower];
  if (lower.endsWith('ies') && lower.length > 4) {
    return name.slice(0, -3) + 'y';
  }
  if (lower.endsWith('oes') && lower.length > 4) {
    return name.slice(0, -2);
  }
  const nonPlurals = ['hummus', 'citrus', 'asparagus', 'couscous'];
  if (nonPlurals.includes(lower)) return name;
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    return name.slice(0, -1);
  }
  return name;
}

/**
 * Formats mobile AI Assistant image-analysis response to strictly return
 * only the identified grocery item name or comma-separated item names.
 * If unclear or non-grocery, returns "Unable to identify item".
 */
export function formatMobileImageAnalysisResponse(rawText?: string | null): string {
  if (!rawText || !rawText.trim()) {
    return 'Unable to identify item';
  }

  let text = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();

  // If already "Unable to identify item" or indicates unclear
  if (
    /unable\s+to\s+identify/i.test(text) ||
    /cannot\s+identify/i.test(text) ||
    /not\s+(?:a\s+)?grocer(?:y|ies)/i.test(text) ||
    /unclear/i.test(text) ||
    /no\s+(?:grocery|food|items?)\s+(?:found|detected|visible)/i.test(text)
  ) {
    return 'Unable to identify item';
  }

  // Remove common LLM intro/outro boilerplate if present
  text = text
    .replace(/^(?:this\s+)?(?:the\s+)?(?:image\s+)?(?:shows?|contains?|features?|depicts?|has)\s*:\s*/i, '')
    .replace(/^(?:i\s+can\s+see|i\s+see|this\s+is|these\s+are)\s*:\s*/i, '')
    .replace(/^(?:identified\s+items?|items?)\s*:\s*/i, '')
    .trim();

  // Strip trailing period or punctuation
  text = text.replace(/[.]+$/, '').trim();

  // If JSON, parse
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.items && Array.isArray(parsed.items)) {
        text = parsed.items.join(', ');
      } else if (parsed.itemName) {
        text = String(parsed.itemName);
      } else if (parsed.name) {
        text = String(parsed.name);
      }
    } catch {}
  }

  // Split by commas, newlines, or bullets
  const parts = text
    .split(/[\n,;•\-]+/)
    .map((s) => s.trim().replace(/^[\d+.)\s]+/, '').trim())
    .filter((s) => s.length > 0 && !/^(and|or|with|a|an|the)$/i.test(s));

  if (parts.length === 0) {
    return 'Unable to identify item';
  }

  // Clean each part into standard Title Case grocery name
  const cleanedItems: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    // If any part looks like a full descriptive sentence (more than 4 words), skip it
    if (part.split(/\s+/).length > 4) {
      continue;
    }
    // Clean to Title Case: "banana" -> "Banana", "green apple" -> "Green Apple"
    let titleCased = part
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();

    titleCased = toSingularItemName(titleCased);

    const lower = titleCased.toLowerCase();
    if (lower && !seen.has(lower) && lower !== 'unable to identify item') {
      seen.add(lower);
      cleanedItems.push(titleCased);
    }
  }

  if (cleanedItems.length === 0) {
    return 'Unable to identify item';
  }

  return `**${cleanedItems.join(', ')}**`;
}

/**
 * Matches recognized grocery item names against the live FreshCart database products.
 * Uses exact match, keyword containment, word matching, and grocery aliases.
 */
export function matchRecognizedItemsToProducts(
  itemNamesStr: string,
  catalog: Product[]
): Product[] {
  if (!itemNamesStr || !catalog || catalog.length === 0) return [];

  // If unclear or error, no products matched
  if (/unable\s+to\s+identify/i.test(itemNamesStr)) return [];

  // Clean and split recognized item names (comma, newline, or semicolons)
  const names = itemNamesStr
    .replace(/\*\*/g, '')
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && !/^(and|or|with|a|an|the)$/i.test(s));

  if (names.length === 0) return [];

  const matchedMap = new Map<string, Product>();

  // Multilingual & common grocery alias dictionary
  const ALIAS_MAP: Record<string, string[]> = {
    banana: ['banana', 'bananas', 'kela'],
    egg: ['egg', 'eggs', 'anda'],
    milk: ['milk', 'dairy', 'doodh', 'cow milk'],
    apple: ['apple', 'apples', 'seb'],
    tomato: ['tomato', 'tomatoes', 'tamatar'],
    potato: ['potato', 'potatoes', 'aloo'],
    carrot: ['carrot', 'carrots', 'gajar'],
    spinach: ['spinach', 'palak'],
    bread: ['bread', 'sourdough', 'loaf'],
    rice: ['rice', 'basmati', 'chawal'],
    juice: ['juice', 'orange juice', 'valencia'],
    orange: ['orange', 'juice', 'valencia'],
    oil: ['oil', 'cooking oil'],
  };

  for (const rawName of names) {
    const clean = rawName.replace(/[^a-z0-9\s]/g, '').trim();
    if (!clean) continue;

    // 1. Exact match on title, name, or id
    let match = catalog.find((p) => {
      const pTitle = (p.title || '').toLowerCase().trim();
      return pTitle === clean;
    });

    // 2. Keyword contains in title
    if (!match) {
      match = catalog.find((p) => {
        const pTitle = (p.title || '').toLowerCase();
        return pTitle.includes(clean) || clean.includes(pTitle);
      });
    }

    // 3. Word match against title or category
    if (!match) {
      const words = clean.split(/\s+/).filter((w) => w.length > 2);
      match = catalog.find((p) => {
        const pTitle = (p.title || '').toLowerCase();
        const pCat = (p.category || '').toLowerCase();
        return words.some((w) => pTitle.includes(w) || pCat.includes(w));
      });
    }

    // 4. Grocery alias mapping
    if (!match) {
      for (const [key, aliases] of Object.entries(ALIAS_MAP)) {
        if (aliases.some((a) => clean.includes(a)) || clean.includes(key)) {
          match = catalog.find((p) => {
            const pTitle = (p.title || '').toLowerCase();
            return aliases.some((a) => pTitle.includes(a)) || pTitle.includes(key);
          });
          if (match) break;
        }
      }
    }

    if (match && !matchedMap.has(match.id)) {
      matchedMap.set(match.id, match);
    }
  }

  return Array.from(matchedMap.values());
}

/**
 * Helper to render bold markdown **text** cleanly in React Native Text.
 */
function renderFormattedText(text: string, baseStyle: any) {
  if (!text) return null;
  if (!text.includes('**')) {
    return <Text style={baseStyle}>{text}</Text>;
  }
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[baseStyle, { fontWeight: '800', color: '#f8fafc' }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

/**
 * Compact product card inside AI chat for recognized items.
 * Shows product image, title, price, unit, and direct Add to Cart button.
 */
const CompactProductCard: React.FC<{
  item: any;
  isSingle?: boolean;
  onPress: () => void;
  onAddToCart: () => void;
}> = ({ item, isSingle, onPress, onAddToCart }) => {
  const [imgError, setImgError] = useState(false);
  const rawImage = typeof item.image === 'string' ? item.image.trim() : '';
  const hasValidImage = Boolean(rawImage.length > 0 && !imgError);

  return (
    <TouchableOpacity
      style={[styles.compactProductCard, isSingle && styles.singleProductCard]}
      activeOpacity={0.88}
      onPress={onPress}
      accessibilityLabel={`View details for ${item.title || item.name}`}
    >
      {/* Product Image or Clean Placeholder */}
      <View style={[styles.compactImgWrapper, isSingle && styles.singleImgWrapper]}>
        {hasValidImage ? (
          <Image
            source={{ uri: rawImage }}
            style={styles.compactProductImg}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.compactImgPlaceholder}>
            <ShoppingBag size={24} color="#64748b" />
            <Text style={styles.noImgText}>No image</Text>
          </View>
        )}
        {Boolean(item.badge || item.isOrganic) && (
          <View style={styles.compactProductBadge}>
            <Text style={styles.compactProductBadgeText}>
              {item.badge || 'Organic'}
            </Text>
          </View>
        )}
      </View>

      {/* Product Info: Name, Unit, Price, and Add Button */}
      <View style={styles.compactProductInfo}>
        <Text style={styles.compactProductTitle} numberOfLines={2}>
          {item.title || item.name}
        </Text>
        <Text style={styles.compactProductUnit}>{item.unit || '1 unit'}</Text>

        <View style={styles.compactProductBottom}>
          <Text style={styles.compactProductPrice}>₹{item.price}</Text>
          <TouchableOpacity
            style={styles.compactAddBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onAddToCart();
            }}
            activeOpacity={0.8}
            accessibilityLabel={`Add ${item.title || item.name} to cart`}
          >
            <Plus size={12} color="#000000" strokeWidth={3} />
            <Text style={styles.compactAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const AssistantModal: React.FC<AssistantModalProps> = ({
  visible,
  onClose,
  onNavigateToCart,
  onSelectProduct,
  catalogProducts,
}) => {
  const { currentCustomer, customerToken } = useAuth();
  const { cart, addToCart, syncCart, itemCount, subtotal } = useCart();

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Responsive dimensions: 50-55% on larger screens, 80-85% on mobile screens, height 55-70%
  const isLargeScreen = screenWidth >= 768;
  const modalWidth = isLargeScreen
    ? Math.min(Math.round(screenWidth * 0.52), 520)
    : Math.min(Math.round(screenWidth * 0.84), 420);
  const modalHeight = Math.min(Math.max(Math.round(screenHeight * 0.65), 440), 680);

  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localCatalog, setLocalCatalog] = useState<Product[]>(catalogProducts || []);
  const scrollViewRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Keep local catalogue updated for instant matching of recognized items
  useEffect(() => {
    if (catalogProducts && catalogProducts.length > 0) {
      setLocalCatalog(catalogProducts);
    } else {
      customerApi
        .getProducts()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setLocalCatalog(data);
          }
        })
        .catch(() => {});
    }
  }, [catalogProducts]);

  // Category click handler: opens cart or sends category query
  const handleCategoryClick = (category: string) => {
    if (category === 'View Cart') {
      if (onNavigateToCart) {
        onClose();
        onNavigateToCart();
      } else {
        handleSend('Show my cart and calculate total');
      }
      return;
    }

    handleSend(category);
  };

  // Initialize greeting matching the customer portal theme
  useEffect(() => {
    if (messages.length === 0) {
      const name = currentCustomer?.name ? `, ${currentCustomer.name}` : '';
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hello${name}! 👋 I am your FreshCart AI Shopping Assistant.\n\nI can help you search farm-fresh produce, prepare grocery lists under your budget, inspect your live cart, and apply savings coupons. How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: [...PRODUCT_CATEGORIES],
        },
      ]);
    }
  }, [currentCustomer, messages.length]);

  // Clean up speech on close
  useEffect(() => {
    if (!visible) {
      Speech.stop();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setIsListening(false);
    }
  }, [visible]);

  // Handle Speech Output (TTS)
  const speakText = (text: string) => {
    if (!isVoiceActive) return;
    try {
      Speech.stop();
      // Clean markdown stars/bullets for clean spoken audio
      const clean = text
        .replace(/\*\*/g, '')
        .replace(/•/g, '')
        .replace(/₹/g, 'rupees ')
        .replace(/#/g, '');
      Speech.speak(clean, {
        language: 'en-IN',
        pitch: 1.0,
        rate: 1.0,
      });
    } catch (err) {
      console.warn('Speech playback error:', err);
    }
  };

  // Toggle voice output mute
  const toggleVoice = () => {
    if (isVoiceActive) {
      Speech.stop();
      setIsVoiceActive(false);
    } else {
      setIsVoiceActive(true);
    }
  };

  // Web Speech Recognition for microphone
  const toggleListening = () => {
    if (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) {
      if (isListening) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
        }
        setIsListening(false);
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
          setIsListening(false);
          handleSend(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setIsListening(false);
      }
    } else {
      Alert.alert(
        'Voice Input',
        'Please speak your grocery query or use the microphone on your keyboard.'
      );
    }
  };

  // Image capture / selection for grocery lists or products
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : null;
        if (!base64Data && asset.uri) {
          try {
            const b64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            base64Data = `data:${asset.mimeType || 'image/jpeg'};base64,${b64}`;
          } catch {
            base64Data = asset.uri;
          }
        }
        setSelectedImage(base64Data);
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open photo library. Please try again.');
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend !== undefined ? textToSend : inputMessage).trim();
    const imageToSend = selectedImage;

    if ((!messageText && !imageToSend) || isLoading) return;

    if (messageText.toLowerCase() === 'view cart' && onNavigateToCart) {
      onClose();
      onNavigateToCart();
      return;
    }

    const isImageQuery = Boolean(imageToSend);

    const customerMsg: ChatMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: messageText || 'Sent photo for analysis',
      image: imageToSend || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, customerMsg]);
    setInputMessage('');
    setSelectedImage(null);
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 80);

    try {
      const customerId = currentCustomer?.id || 'guest_mobile';
      const token = customerToken || customerId;

      const res: AssistantChatResponse = await assistantApi.chat({
        message: messageText,
        customerId,
        token,
        extraPayload: imageToSend
          ? {
              image: imageToSend,
              isMobileImageAnalysis: true,
              mode: 'mobile_image_analysis',
            }
          : undefined,
      });

      // Synchronize cart state if backend cart was updated
      if (res.cartUpdated && Array.isArray(res.cartItems)) {
        syncCart(res.cartItems);
      }

      // If customer uploaded an image, identify item and respond with only its item name
      const replyText = isImageQuery
        ? formatMobileImageAnalysisResponse(res.message)
        : (res.message || 'Here is what I found for you:');

      // Resolve matching products from database for recognized grocery items
      let matchedProducts: any[] = [];
      if (isImageQuery) {
        if (Array.isArray(res.products) && res.products.length > 0) {
          matchedProducts = res.products;
        } else if (replyText && !/unable\s+to\s+identify/i.test(replyText)) {
          matchedProducts = matchRecognizedItemsToProducts(replyText, localCatalog);
        }
      } else if (Array.isArray(res.products) && res.products.length > 0) {
        matchedProducts = res.products;
      }

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products: matchedProducts.length > 0 ? matchedProducts : undefined,
        isImageRecognitionResult: isImageQuery,
        coupons: isImageQuery ? undefined : (Array.isArray(res.coupons) ? res.coupons : undefined),
        groceryListReview: isImageQuery ? undefined : res.groceryListReview,
        quickReplies: isImageQuery
          ? []
          : (Array.isArray(res.quickReplies) && res.quickReplies.length > 0
              ? res.quickReplies
              : [...PRODUCT_CATEGORIES]),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Speak assistant response aloud (speaks only the item name for image query)
      speakText(isImageQuery ? replyText.replace(/\*\*/g, '') : (res.spokenMessage || replyText));
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: isImageQuery
          ? 'Unable to identify item'
          : 'I could not connect to the FreshCart server right now. Please check that the server is running and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: isImageQuery ? [] : [...PRODUCT_CATEGORIES],
      };
      setMessages((prev) => [...prev, errorMsg]);
      if (isImageQuery) {
        speakText('Unable to identify item');
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }, 150);
    }
  };

  // Add individual product card from chat to cart
  const handleAddProduct = (item: any) => {
    const product: Product = {
      id: String(item.id || item.product_id),
      title: item.title || item.name,
      price: Number(item.price) || 0,
      unit: item.unit || '1 unit',
      stock: Number(item.stock ?? 50),
      sku: item.sku || `SKU-${item.id || item.product_id || 'PROD'}`,
      badge: item.badge || '',
      image: item.image || '',
      category: item.category || 'produce',
      supplier: item.supplier || 'FreshCart Farm Direct',
      isOrganic: Boolean(item.isOrganic),
      packSizes: item.packSizes,
    };

    addToCart(product, 1);
    Alert.alert('Cart Updated', `Added "${product.title}" to your cart.`);
  };

  // Select product to view details
  const handleProductPress = (item: any) => {
    if (onSelectProduct) {
      const product: Product = {
        id: String(item.id || item.product_id),
        title: item.title || item.name,
        price: Number(item.price) || 0,
        unit: item.unit || '1 unit',
        stock: Number(item.stock ?? 50),
        sku: item.sku || `SKU-${item.id || item.product_id || 'PROD'}`,
        badge: item.badge || '',
        image: item.image || '',
        category: item.category || 'produce',
        supplier: item.supplier || 'FreshCart Farm Direct',
        isOrganic: Boolean(item.isOrganic),
        packSizes: item.packSizes,
      };
      onClose();
      onSelectProduct(product);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={[styles.chatCard, { width: modalWidth, height: modalHeight }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header - Fixed at the top */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <Bot size={18} color="#00e676" />
                <View style={styles.statusDot} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    FreshCart AI
                  </Text>
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  Smart Shopping Assistant
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Voice toggle */}
              <TouchableOpacity
                style={[styles.headerIconBtn, !isVoiceActive && styles.headerIconBtnDimmed]}
                onPress={toggleVoice}
                accessibilityLabel="Toggle voice speech"
              >
                {isVoiceActive ? (
                  <Volume2 size={16} color="#00e676" />
                ) : (
                  <VolumeX size={16} color="#64748b" />
                )}
              </TouchableOpacity>

              {/* Minimize button */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={onClose}
                accessibilityLabel="Minimize assistant"
              >
                <Minus size={16} color="#94a3b8" />
              </TouchableOpacity>

              {/* Close button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityLabel="Close assistant"
              >
                <X size={17} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat Messages Scroll View - Independently Scrollable */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isCust = msg.sender === 'customer';
              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isCust ? styles.custRow : styles.asstRow]}
                >
                  {!isCust && (
                    <View style={styles.asstIconCircle}>
                      <Bot size={15} color="#00e676" />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isCust ? styles.custBubble : styles.asstBubble,
                      Boolean(msg.products && msg.products.length > 0 && msg.isImageRecognitionResult) &&
                        styles.messageBubbleWithProducts,
                    ]}
                  >
                    {/* User-attached image thumbnail */}
                    {Boolean(msg.image) && (
                      <Image source={{ uri: msg.image }} style={styles.attachedImagePreview} />
                    )}

                    {renderFormattedText(
                      msg.text,
                      [styles.messageText, isCust ? styles.custText : styles.asstText]
                    )}

                    {/* Real Recommended Products from MySQL Catalog */}
                    {msg.products && msg.products.length > 0 && (
                      <View style={styles.productsContainer}>
                        {msg.isImageRecognitionResult ? (
                          msg.products.length > 1 ? (
                            <View style={styles.productsGrid}>
                              {msg.products.map((item, idx) => (
                                <CompactProductCard
                                  key={`${item.id || item.product_id || idx}`}
                                  item={item}
                                  onPress={() => handleProductPress(item)}
                                  onAddToCart={() => handleAddProduct(item)}
                                />
                              ))}
                            </View>
                          ) : (
                            (() => {
                              const singleItem = msg.products[0];
                              return (
                                <View style={styles.singleProductWrapper}>
                                  <CompactProductCard
                                    item={singleItem}
                                    isSingle
                                    onPress={() => handleProductPress(singleItem)}
                                    onAddToCart={() => handleAddProduct(singleItem)}
                                  />
                                </View>
                              );
                            })()
                          )
                        ) : (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.productsScroll}
                          >
                            {msg.products.map((item, idx) => (
                              <TouchableOpacity
                                key={`${item.id || item.product_id || idx}`}
                                style={styles.productCard}
                                activeOpacity={0.88}
                                onPress={() => handleProductPress(item)}
                              >
                                {item.image ? (
                                  <Image source={{ uri: item.image }} style={styles.productImg} />
                                ) : (
                                  <View style={[styles.productImg, styles.productImgPlaceholder]}>
                                    <ShoppingBag size={24} color="#64748b" />
                                  </View>
                                )}

                                {Boolean(item.badge || item.isOrganic) && (
                                  <View style={styles.productBadge}>
                                    <Text style={styles.productBadgeText}>
                                      {item.badge || 'Organic'}
                                    </Text>
                                  </View>
                                )}

                                <View style={styles.productInfo}>
                                  <Text style={styles.productTitle} numberOfLines={2}>
                                    {item.title || item.name}
                                  </Text>
                                  <Text style={styles.productUnit}>{item.unit || '1 unit'}</Text>

                                  <View style={styles.productBottom}>
                                    <Text style={styles.productPrice}>₹{item.price}</Text>
                                    <TouchableOpacity
                                      style={styles.addCartBtn}
                                      onPress={(e) => {
                                        e.stopPropagation?.();
                                        handleAddProduct(item);
                                      }}
                                      activeOpacity={0.8}
                                    >
                                      <Plus size={13} color="#000000" />
                                      <Text style={styles.addCartBtnText}>Add</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}

                    {/* Real Coupons from Database */}
                    {msg.coupons && msg.coupons.length > 0 && (
                      <View style={styles.couponsContainer}>
                        {msg.coupons.map((c, idx) => (
                          <View key={`${c.code || idx}`} style={styles.couponCard}>
                            <View style={styles.couponIconCircle}>
                              <Tag size={16} color="#00e676" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.couponCode}>{c.code}</Text>
                              <Text style={styles.couponDesc}>
                                {c.description || `${c.discountPercentage}% OFF on orders ₹${c.minOrderAmount}+`}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.applyCouponBtn}
                              onPress={() => handleSend(`Apply coupon ${c.code}`)}
                            >
                              <Text style={styles.applyCouponBtnText}>Apply</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Product Category Suggestions - Displayed below every AI reply */}
                    {!isCust && (
                      <View style={styles.categoriesContainer}>
                        <View style={styles.categoriesHeader}>
                          <Sparkles size={11} color="#00e676" />
                          <Text style={styles.categoriesHeaderTitle}>
                            Product Categories:
                          </Text>
                        </View>
                        <View style={styles.categoriesGrid}>
                          {PRODUCT_CATEGORIES.map((cat) => {
                            const isCart = cat === 'View Cart';
                            const isAll = cat === 'Show All Products';
                            return (
                              <TouchableOpacity
                                key={cat}
                                style={[
                                  styles.categoryBtn,
                                  isCart && styles.categoryBtnCart,
                                  isAll && styles.categoryBtnAll,
                                ]}
                                onPress={() => handleCategoryClick(cat)}
                                disabled={isLoading}
                                activeOpacity={0.75}
                              >
                                {isAll && (
                                  <Sparkles size={11} color="#00e676" style={styles.catBtnIcon} />
                                )}
                                {isCart && (
                                  <ShoppingCart size={11} color="#00e676" style={styles.catBtnIcon} />
                                )}
                                <Text
                                  style={[
                                    styles.categoryBtnText,
                                    isCart && styles.categoryBtnCartText,
                                    isAll && styles.categoryBtnAllText,
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Timestamp & Speaker Replay */}
                    <View style={styles.messageFooterRow}>
                      <Text
                        style={[
                          styles.timestamp,
                          isCust ? styles.custTimestamp : styles.asstTimestamp,
                        ]}
                      >
                        {msg.timestamp}
                      </Text>
                      {!isCust && (
                        <TouchableOpacity
                          style={styles.replaySpeakerBtn}
                          onPress={() => speakText(msg.text)}
                          accessibilityLabel="Replay message audio"
                        >
                          <Volume2 size={12} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Thinking / Typing indicator */}
            {isLoading && (
              <View style={[styles.messageRow, styles.asstRow]}>
                <View style={styles.asstIconCircle}>
                  <Bot size={15} color="#00e676" />
                </View>
                <View style={[styles.messageBubble, styles.asstBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#00e676" />
                  <Text style={styles.thinkingText}>FreshCart AI is thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Image Selected Preview Banner */}
          {Boolean(selectedImage) && (
            <View style={styles.selectedImageBanner}>
              <Image source={{ uri: selectedImage! }} style={styles.selectedImageThumb} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.selectedImageTitle}>Photo attached for grocery analysis</Text>
                <Text style={styles.selectedImageSubtitle}>Ready to send with your message</Text>
              </View>
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setSelectedImage(null)}
              >
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Listening Indicator */}
          {isListening && (
            <View style={styles.listeningBar}>
              <View style={styles.pulseDot} />
              <Text style={styles.listeningText}>Listening... Speak your grocery query</Text>
              <TouchableOpacity style={styles.stopListeningBtn} onPress={toggleListening}>
                <Text style={styles.stopListeningText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Chat Input Bar */}
          <View style={styles.inputContainer}>
            {/* 1. Microphone Button */}
            <TouchableOpacity
              style={[styles.mediaBtn, isListening && styles.mediaBtnActive]}
              onPress={toggleListening}
              disabled={isLoading}
              accessibilityLabel="Voice search"
            >
              {isListening ? (
                <MicOff size={19} color="#ef4444" />
              ) : (
                <Mic size={19} color="#00e676" />
              )}
            </TouchableOpacity>

            {/* 2. Text Input Field */}
            <TextInput
              style={styles.input}
              placeholder="Ask about vegetables, lists, deals..."
              placeholderTextColor="#64748b"
              value={inputMessage}
              onChangeText={setInputMessage}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={!isLoading}
            />

            {/* 3. Camera / Photo Button */}
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={handlePickImage}
              disabled={isLoading}
              accessibilityLabel="Attach photo or grocery list"
            >
              <Camera size={19} color="#00e676" />
            </TouchableOpacity>

            {/* 4. Submit / Send Button */}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputMessage.trim() && !selectedImage) || isLoading
                  ? styles.sendBtnDisabled
                  : styles.sendBtnActive,
              ]}
              onPress={() => handleSend()}
              disabled={(!inputMessage.trim() && !selectedImage) || isLoading}
              activeOpacity={0.8}
            >
              <Send size={16} color="#000000" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  chatCard: {
    backgroundColor: '#030712',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    overflow: 'hidden',
    shadowColor: '#00e676',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  // Header matching Customer Portal dark theme
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#070d14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderWidth: 1.5,
    borderColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    position: 'relative',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e676',
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1.5,
    borderColor: '#070d14',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    gap: 2,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00e676',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 9.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconBtnDimmed: {
    opacity: 0.5,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#00e676',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000000',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Chat Area
  chatArea: {
    flex: 1,
    backgroundColor: '#030712',
  },
  chatContent: {
    padding: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  asstRow: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  custRow: {
    justifyContent: 'flex-end',
  },
  asstIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0b1f2e',
    borderWidth: 1,
    borderColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 18,
    padding: 12,
  },
  asstBubble: {
    backgroundColor: '#0b1622',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderTopLeftRadius: 4,
    maxWidth: '90%',
  },
  messageBubbleWithProducts: {
    maxWidth: '96%',
    width: '96%',
  },
  custBubble: {
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: '#059669',
    borderTopRightRadius: 4,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  thinkingText: {
    fontSize: 12,
    color: '#00e676',
    fontWeight: '600',
  },
  attachedImagePreview: {
    width: 180,
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  asstText: {
    color: '#f1f5f9',
  },
  custText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  messageFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
  },
  timestamp: {
    fontSize: 10,
  },
  asstTimestamp: {
    color: '#64748b',
  },
  custTimestamp: {
    color: '#a7f3d0',
  },
  replaySpeakerBtn: {
    padding: 2,
  },
  // Responsive two-column grid for recognized items
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  singleProductWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  compactProductCard: {
    width: '48.5%',
    backgroundColor: '#07121e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.28)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  singleProductCard: {
    width: '100%',
    maxWidth: 240,
    marginBottom: 4,
  },
  compactImgWrapper: {
    width: '100%',
    height: 96,
    backgroundColor: '#0f1f33',
    position: 'relative',
    overflow: 'hidden',
  },
  singleImgWrapper: {
    height: 110,
  },
  compactProductImg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f1f33',
  },
  compactImgPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f1f33',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  noImgText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  compactProductBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: '#00e676',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  compactProductBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#00e676',
  },
  compactProductInfo: {
    padding: 7,
  },
  compactProductTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#f8fafc',
    minHeight: 28,
    lineHeight: 14.5,
  },
  compactProductUnit: {
    fontSize: 9.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  compactProductBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  compactProductPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00e676',
  },
  compactAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#00e676',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  compactAddBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#000000',
  },
  // Products Container & Cards
  productsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  productsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  productSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00e676',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  productsScroll: {
    gap: 10,
    paddingRight: 8,
  },
  productCard: {
    width: 132,
    backgroundColor: '#091420',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: 82,
    backgroundColor: '#0f172a',
    resizeMode: 'cover',
  },
  productImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: '#00e676',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  productBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#00e676',
  },
  productInfo: {
    padding: 6,
  },
  productTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc',
    minHeight: 28,
  },
  productUnit: {
    fontSize: 9.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  productBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productPrice: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#00e676',
  },
  addCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#00e676',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addCartBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  // Coupons container
  couponsContainer: {
    marginTop: 10,
    gap: 8,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#091522',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
  },
  couponIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00e676',
    letterSpacing: 0.5,
  },
  couponDesc: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  applyCouponBtn: {
    backgroundColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  applyCouponBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  // Product Category Suggestions below each AI response
  categoriesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 7,
  },
  categoriesHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#14b8a6',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.35)',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginBottom: 2,
  },
  categoryBtnAll: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderColor: 'rgba(0, 230, 118, 0.45)',
  },
  categoryBtnCart: {
    backgroundColor: 'rgba(0, 230, 118, 0.18)',
    borderColor: '#00e676',
  },
  categoryBtnText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  categoryBtnAllText: {
    color: '#00e676',
    fontWeight: '600',
  },
  categoryBtnCartText: {
    color: '#00e676',
    fontWeight: '700',
  },
  catBtnIcon: {
    marginRight: 4,
  },
  // Selected image preview banner
  selectedImageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1928',
    padding: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 230, 118, 0.3)',
  },
  selectedImageThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#000',
  },
  selectedImageTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#00e676',
  },
  selectedImageSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  removeImageBtn: {
    padding: 6,
  },
  // Listening bar
  listeningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#042217',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#00e676',
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00e676',
    marginRight: 8,
  },
  listeningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#00e676',
  },
  stopListeningBtn: {
    backgroundColor: '#00e676',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  stopListeningText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  // Input Container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#070d14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  mediaBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    height: 38,
    backgroundColor: '#0d1826',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    color: '#ffffff',
    fontSize: 12.5,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#00e676',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.4,
  },
});
