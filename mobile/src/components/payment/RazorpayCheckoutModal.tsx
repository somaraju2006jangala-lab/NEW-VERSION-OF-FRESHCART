import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { X, ShieldCheck, Lock } from 'lucide-react-native';
import { RazorpayOrderResponse } from '../../types/payment';

interface RazorpayCheckoutModalProps {
  visible: boolean;
  orderData: RazorpayOrderResponse | null;
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
  onFailure: (error: any) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  visible,
  orderData,
  onSuccess,
  onDismiss,
  onFailure,
}) => {
  const insets = useSafeAreaInsets();

  if (!visible || !orderData) {
    return null;
  }

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel payment? You can retry checkout anytime.',
      [
        { text: 'Continue Payment', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: onDismiss,
        },
      ]
    );
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[RazorpayModal] Message from WebView:', data.event);

      if (data.event === 'success') {
        onSuccess({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_signature: data.razorpay_signature,
        });
      } else if (data.event === 'dismissed') {
        onDismiss();
      } else if (data.event === 'failed') {
        onFailure(data.error || { description: 'Payment failed' });
      } else if (data.event === 'error') {
        onFailure({ description: data.message || 'Payment checkout error' });
      }
    } catch (err: any) {
      console.warn('[RazorpayModal] Failed to parse message:', err.message);
    }
  };

  const amountInPaise = orderData.amount_in_paise || Math.round(orderData.amount * 100);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Razorpay Checkout</title>
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 24px;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          color: #0f172a;
          text-align: center;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e2e8f0;
          border-top: 4px solid #006b2c;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h3 {
          font-size: 17px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #0f172a;
        }
        p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .secure-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ecfdf5;
          color: #006b2c;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 999px;
          margin-top: 16px;
          border: 1px solid #a7f3d0;
        }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h3>Connecting to Razorpay</h3>
      <p>Please complete payment in the secure Razorpay window...</p>
      <div class="secure-badge">
        <span>🔒 256-bit Bank-Grade Encryption</span>
      </div>

      <script>
        function sendToApp(msg) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }
        }

        try {
          var options = {
            key: "${orderData.key_id}",
            amount: ${amountInPaise},
            currency: "${orderData.currency || 'INR'}",
            name: "FreshCart Grocery",
            description: "Order ${orderData.freshcart_order_id}",
            order_id: "${orderData.razorpay_order_id}",
            image: "https://freshkart.vercel.app/freshcart-logo.png",
            prefill: {
              name: "${orderData.customer?.name || 'Customer'}",
              email: "${orderData.customer?.email || 'customer@freshcart.com'}",
              contact: "${orderData.customer?.phone || '9999999999'}"
            },
            theme: {
              color: "#006b2c"
            },
            modal: {
              ondismiss: function() {
                sendToApp({ event: 'dismissed' });
              }
            },
            handler: function(response) {
              sendToApp({
                event: 'success',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              });
            }
          };

          var rzp = new Razorpay(options);

          rzp.on('payment.failed', function(resp) {
            sendToApp({
              event: 'failed',
              error: resp.error || { description: 'Payment authorization failed' }
            });
          });

          // Open the Razorpay checkout overlay immediately
          rzp.open();
        } catch (err) {
          sendToApp({ event: 'error', message: err.message || 'Initialization failed' });
        }
      </script>
    </body>
    </html>
  `;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        {/* In-App Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.secureIcon}>
              <Lock size={16} color="#006b2c" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Razorpay Secure Checkout</Text>
              <Text style={styles.headerSubtitle}>
                {orderData.freshcart_order_id} • ₹{orderData.amount}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close payment"
          >
            <X size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Security Banner */}
        <View style={styles.banner}>
          <ShieldCheck size={14} color="#006b2c" />
          <Text style={styles.bannerText}>
            Standard Razorpay Checkout • Cards, UPI, NetBanking & Wallets
          </Text>
        </View>

        {/* In-App WebView */}
        <View style={styles.webViewWrapper}>
          <WebView
            key={`${orderData.razorpay_order_id}-${orderData.freshcart_order_id}`}
            source={{ html: htmlContent, baseUrl: 'https://checkout.razorpay.com' }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#006b2c" />
                <Text style={styles.loadingText}>Opening Razorpay Payment Gateway...</Text>
              </View>
            )}
            style={styles.webView}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  webViewWrapper: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
