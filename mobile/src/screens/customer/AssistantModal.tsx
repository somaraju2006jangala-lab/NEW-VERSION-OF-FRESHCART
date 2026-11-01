import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import {
  X,
  Send,
  Sparkles,
  ShoppingCart,
  Plus,
  Tag,
  Bot,
  User,
  ShoppingBag,
  CornerDownLeft,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { assistantApi, AssistantChatResponse } from '../../services/apiClient';
import { Product } from '../../types';

interface AssistantModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToCart?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'assistant';
  text: string;
  timestamp: string;
  products?: any[];
  coupons?: any[];
  quickReplies?: string[];
}

const QUICK_ACTIONS = [
  'Show All Products',
  'Fresh Vegetables',
  'Fresh Fruits',
  'Dairy & Eggs',
  'Bakery & Bread',
  'Beverages',
  'Best Offers',
  'View Cart',
];

export const AssistantModal: React.FC<AssistantModalProps> = ({
  visible,
  onClose,
  onNavigateToCart,
}) => {
  const { currentCustomer, customerToken } = useAuth();
  const { addToCart } = useCart();

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollViewRef = useRef<any>(null);

  // Initialize greeting on first launch
  useEffect(() => {
    if (messages.length === 0) {
      const name = currentCustomer?.name ? `, ${currentCustomer.name}` : '';
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hello${name}! 👋 I am your FreshCart AI Shopping Assistant.\n\nI can help you find fresh groceries, compare prices, discover current deals, or add items to your cart. How can I help you today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: QUICK_ACTIONS,
        },
      ]);
    }
  }, [currentCustomer, messages.length]);

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || inputMessage).trim();
    if (!messageText || isLoading) return;

    if (messageText.toLowerCase() === 'view cart' && onNavigateToCart) {
      onClose();
      onNavigateToCart();
      return;
    }

    const customerMsg: ChatMessage = {
      id: `cust-${Date.now()}`,
      sender: 'customer',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, customerMsg]);
    setInputMessage('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 100);

    try {
      const customerId = currentCustomer?.id || 'guest_mobile';
      const token = customerToken || customerId;

      const res: AssistantChatResponse = await assistantApi.chat({
        message: messageText,
        customerId,
        token,
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.message || 'I found some items for you:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        products: Array.isArray(res.products) ? res.products : undefined,
        coupons: Array.isArray(res.coupons) ? res.coupons : undefined,
        quickReplies: Array.isArray(res.quickReplies) && res.quickReplies.length > 0 ? res.quickReplies : QUICK_ACTIONS,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'I could not connect to the FreshCart server right now. Please check that the server is running and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: QUICK_ACTIONS,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      }, 150);
    }
  };

  const handleAddProduct = (item: any) => {
    const product: Product = {
      id: item.id || item.product_id,
      title: item.title || item.name,
      price: Number(item.price) || 0,
      unit: item.unit || '1 unit',
      stock: Number(item.stock ?? 50),
      sku: item.sku || `SKU-${item.id || item.product_id || 'PROD'}`,
      badge: item.badge || '',
      image: item.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
      category: item.category || 'produce',
      supplier: item.supplier || 'FreshCart Farm Direct',
      isOrganic: Boolean(item.isOrganic),
    };
    addToCart(product, 1);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <Bot size={22} color="#006b2c" />
                <View style={styles.statusDot} />
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>FreshCart AI</Text>
                  <View style={styles.aiBadge}>
                    <Sparkles size={11} color="#006b2c" />
                    <Text style={styles.aiBadgeText}>Assistant</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>Smart Grocery Shopping & Recommendations</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Chat Messages */}
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
                      <Bot size={14} color="#006b2c" />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isCust ? styles.custBubble : styles.asstBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isCust ? styles.custText : styles.asstText,
                      ]}
                    >
                      {msg.text}
                    </Text>

                    {/* Product Cards Carousel / Grid if assistant returned products */}
                    {msg.products && msg.products.length > 0 && (
                      <View style={styles.productsContainer}>
                        <Text style={styles.productSectionTitle}>Recommended Products:</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.productsScroll}
                        >
                          {msg.products.map((item, idx) => (
                            <View key={`${item.id || idx}`} style={styles.productCard}>
                              {item.image ? (
                                <Image source={{ uri: item.image }} style={styles.productImg} />
                              ) : (
                                <View style={[styles.productImg, styles.productImgPlaceholder]}>
                                  <ShoppingBag size={24} color="#94a3b8" />
                                </View>
                              )}
                              <View style={styles.productInfo}>
                                <Text style={styles.productTitle} numberOfLines={2}>
                                  {item.title || item.name}
                                </Text>
                                <Text style={styles.productUnit}>{item.unit || 'per unit'}</Text>
                                <View style={styles.productBottom}>
                                  <Text style={styles.productPrice}>₹{item.price}</Text>
                                  <TouchableOpacity
                                    style={styles.addCartBtn}
                                    onPress={() => handleAddProduct(item)}
                                  >
                                    <Plus size={12} color="#fff" />
                                    <Text style={styles.addCartBtnText}>Add</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Coupons returned by assistant */}
                    {msg.coupons && msg.coupons.length > 0 && (
                      <View style={styles.couponsContainer}>
                        {msg.coupons.map((c, idx) => (
                          <View key={`${c.code || idx}`} style={styles.couponCard}>
                            <Tag size={16} color="#006b2c" />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={styles.couponCode}>{c.code}</Text>
                              <Text style={styles.couponDesc}>
                                {c.description || `${c.discountPercentage}% OFF on minimum ₹${c.minOrderAmount}`}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text
                      style={[
                        styles.timestamp,
                        isCust ? styles.custTimestamp : styles.asstTimestamp,
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Thinking / Loading indicator */}
            {isLoading && (
              <View style={[styles.messageRow, styles.asstRow]}>
                <View style={styles.asstIconCircle}>
                  <Bot size={14} color="#006b2c" />
                </View>
                <View style={[styles.messageBubble, styles.asstBubble, styles.loadingBubble]}>
                  <ActivityIndicator size="small" color="#006b2c" />
                  <Text style={styles.thinkingText}>FreshCart AI is thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick Reply Chips */}
          <View style={styles.quickActionsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsScroll}
            >
              {QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action}
                  style={styles.quickChip}
                  onPress={() => handleSend(action)}
                  disabled={isLoading}
                >
                  <Text style={styles.quickChipText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bottom Chat Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask about groceries, recipes, deals..."
              placeholderTextColor="#94a3b8"
              value={inputMessage}
              onChangeText={setInputMessage}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputMessage.trim() || isLoading) && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!inputMessage.trim() || isLoading}
            >
              <Send size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#22c55e',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 3,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006b2c',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  custRow: {
    justifyContent: 'flex-end',
  },
  asstRow: {
    justifyContent: 'flex-start',
  },
  asstIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  custBubble: {
    backgroundColor: '#006b2c',
    borderBottomRightRadius: 4,
  },
  asstBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  thinkingText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  custText: {
    color: '#ffffff',
  },
  asstText: {
    color: '#1e293b',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  custTimestamp: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  asstTimestamp: {
    color: '#94a3b8',
    textAlign: 'left',
  },
  productsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  productSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  productsScroll: {
    gap: 10,
    paddingRight: 10,
  },
  productCard: {
    width: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  productImg: {
    width: '100%',
    height: 90,
    backgroundColor: '#f1f5f9',
  },
  productImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 8,
  },
  productTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 30,
  },
  productUnit: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  productBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
  },
  addCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#006b2c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addCartBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  couponsContainer: {
    marginTop: 8,
    gap: 6,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 8,
  },
  couponCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#006b2c',
  },
  couponDesc: {
    fontSize: 10,
    color: '#166534',
    marginTop: 1,
  },
  quickActionsWrap: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingVertical: 8,
  },
  quickActionsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
});
