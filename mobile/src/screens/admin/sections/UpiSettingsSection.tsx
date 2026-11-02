import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  CreditCard,
  QrCode,
  Save,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
} from 'lucide-react-native';
import { adminApi } from '../../../services/apiClient';

interface UpiSettingsSectionProps {
  adminToken: string | null;
}

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/;

export const UpiSettingsSection: React.FC<UpiSettingsSectionProps> = ({
  adminToken,
}) => {
  const [upiId, setUpiId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUpiSettings();
      if (res.success && res.settings) {
        setUpiId(res.settings.upiId || '');
        setMerchantName(res.settings.merchantName || 'FreshCart Store');
        setIsEnabled(res.settings.enabled !== false);
      } else if (res.upiId) {
        setUpiId(res.upiId);
        setMerchantName(res.merchantName || 'FreshCart Store');
        setIsEnabled(true);
      }
    } catch (err: any) {
      console.warn('Could not load UPI settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const isValidFormat = !upiId.trim() || UPI_ID_REGEX.test(upiId.trim());

  const generatedUri = upiId.trim()
    ? `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(
        merchantName.trim() || 'FreshCart'
      )}&cu=INR`
    : '';

  const handleSave = async () => {
    if (!adminToken) {
      Alert.alert('Authentication Error', 'Admin token missing. Please sign in again.');
      return;
    }
    const cleanUpi = upiId.trim();
    if (!cleanUpi) {
      Alert.alert('Validation Error', 'Please enter a valid Merchant UPI ID.');
      return;
    }
    if (!UPI_ID_REGEX.test(cleanUpi)) {
      Alert.alert(
        'Invalid UPI ID',
        'UPI ID must follow the standard handle format (e.g. freshcart@okicici, merchant@upi).'
      );
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await adminApi.saveUpiSettings(adminToken, {
        upiId: cleanUpi,
        merchantName: merchantName.trim() || 'FreshCart Store',
        enabled: isEnabled,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'UPI payment configuration saved to MySQL database successfully!',
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update UPI settings.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Network error saving UPI settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.titleRow}>
          <CreditCard size={18} color="#10b981" />
          <Text style={styles.heading}>UPI Payment Configuration</Text>
        </View>
        <Text style={styles.subheading}>
          Configure direct merchant UPI VPA and Business Name for instant checkout QR codes and customer verification.
        </Text>
      </View>

      {/* Feedback Alert */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} color="#34d399" />
          ) : (
            <AlertTriangle size={16} color="#ef4444" />
          )}
          <Text
            style={[
              styles.feedbackText,
              feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
            ]}
          >
            {feedback.message}
          </Text>
        </View>
      )}

      {/* Configuration Form */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Merchant Account Credentials</Text>

        <Text style={styles.inputLabel}>Merchant UPI ID (VPA) *</Text>
        <TextInput
          style={[styles.input, !isValidFormat && styles.inputError]}
          value={upiId}
          onChangeText={setUpiId}
          placeholder="e.g. freshcart.store@icici or 9876543210@paytm"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />
        {!isValidFormat ? (
          <Text style={styles.validationError}>
            Invalid UPI ID format. Standard handle required (e.g. name@bank).
          </Text>
        ) : (
          <Text style={styles.inputHint}>
            Customers will pay directly to this Virtual Payment Address.
          </Text>
        )}

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>
          Merchant / Business Display Name *
        </Text>
        <TextInput
          style={styles.input}
          value={merchantName}
          onChangeText={setMerchantName}
          placeholder="e.g. FreshCart Daily Needs"
          placeholderTextColor="#64748b"
        />
        <Text style={styles.inputHint}>
          This name appears on the customer's UPI app (Google Pay, PhonePe, Paytm).
        </Text>

        {/* Enabled Toggle */}
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Enable Direct UPI Payments</Text>
            <Text style={styles.switchSub}>
              Display UPI QR Code and intent options on mobile checkout
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={setIsEnabled}
            trackColor={{ false: '#334155', true: '#006b2c' }}
            thumbColor={isEnabled ? '#10b981' : '#94a3b8'}
          />
        </View>

        {/* Live URI Preview */}
        {generatedUri ? (
          <View style={styles.uriBox}>
            <Text style={styles.uriLabel}>Generated Dynamic Payment URI:</Text>
            <Text style={styles.uriString} numberOfLines={2}>
              {generatedUri}
            </Text>
          </View>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Save size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save UPI Settings to MySQL</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Visual QR Code Info Card */}
      <View style={styles.card}>
        <View style={styles.qrHeader}>
          <QrCode size={18} color="#10b981" />
          <Text style={styles.cardTitle}>Dynamic Checkout QR Code</Text>
        </View>
        <Text style={styles.qrDescription}>
          FreshCart dynamically embeds the final payable amount and unique order reference into the generated QR code for every customer order.
        </Text>

        <View style={styles.qrMockBox}>
          <QrCode size={64} color="#10b981" />
          <Text style={styles.qrMockText}>
            {upiId || 'No UPI ID configured'}
          </Text>
          <Text style={styles.qrMockMerchant}>
            {merchantName || 'FreshCart Store'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subheading: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  feedbackError: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  feedbackTextSuccess: {
    color: '#34d399',
  },
  feedbackTextError: {
    color: '#fca5a5',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  validationError: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
  },
  inputHint: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  switchSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  uriBox: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  uriLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  uriString: {
    fontSize: 11,
    color: '#34d399',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 10,
    height: 44,
    marginTop: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrDescription: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
  qrMockBox: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  qrMockText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 10,
  },
  qrMockMerchant: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
