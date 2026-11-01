import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { User, Phone, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react-native';
import { Header } from '../../components/common/Header';

export interface RecipientInfo {
  fullName: string;
  phone: string;
  email: string;
}

interface RecipientDetailsScreenProps {
  initialRecipient: RecipientInfo;
  onContinue: (recipient: RecipientInfo) => void;
  onBack: () => void;
}

export const RecipientDetailsScreen: React.FC<RecipientDetailsScreenProps> = ({
  initialRecipient,
  onContinue,
  onBack,
}) => {
  const [fullName, setFullName] = useState(initialRecipient.fullName || '');
  const [phone, setPhone] = useState(initialRecipient.phone || '');
  const [email, setEmail] = useState(initialRecipient.email || '');

  // Synchronize state when navigating backward or editing
  React.useEffect(() => {
    if (initialRecipient.fullName) setFullName(initialRecipient.fullName);
    if (initialRecipient.phone) setPhone(initialRecipient.phone);
    if (initialRecipient.email) setEmail(initialRecipient.email);
  }, [initialRecipient.fullName, initialRecipient.phone, initialRecipient.email]);

  const [errors, setErrors] = useState<{ fullName?: string; phone?: string; email?: string }>({});

  const validate = (): boolean => {
    const newErrors: { fullName?: string; phone?: string; email?: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Recipient full name is required.';
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      newErrors.phone = 'Valid 10-digit mobile number is required.';
    }

    if (!email.trim() || !email.includes('@')) {
      newErrors.email = 'Valid email address is required for order updates.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) {
      Alert.alert('Required Information', 'Please complete all recipient fields before proceeding.');
      return;
    }

    onContinue({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Checkout" subtitle="Step 1 of 4: Recipient Details" showBack onBack={onBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Progress Indicator - 4 Steps */}
          <View style={styles.stepProgressRow}>
            <View style={[styles.stepBadge, styles.stepActive]}>
              <Text style={styles.stepNumberActive}>1</Text>
              <Text style={styles.stepLabelActive}>Recipient</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepLabel}>Address</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepLabel}>Payment</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepLabel}>Confirm</Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <User size={20} color="#006b2c" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Who is receiving this order?</Text>
                <Text style={styles.cardSubtitle}>
                  We will send dispatch alerts and delivery updates to these details.
                </Text>
              </View>
            </View>

            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Recipient Full Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, errors.fullName ? styles.inputBoxError : null]}>
                <User size={18} color="#94a3b8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                />
              </View>
              {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
            </View>

            {/* Mobile Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Mobile Phone Number <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, errors.phone ? styles.inputBoxError : null]}>
                <Phone size={18} color="#94a3b8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                />
              </View>
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email Address (for invoices & receipt) <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={[styles.inputBox, errors.email ? styles.inputBoxError : null]}>
                <Mail size={18} color="#94a3b8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. rahul@freshcart.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>
          </View>

          {/* Privacy Guarantee Note */}
          <View style={styles.guaranteeBox}>
            <ShieldCheck size={18} color="#006b2c" />
            <Text style={styles.guaranteeText}>
              Your contact details are encrypted and only used for order delivery notifications.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Next Action */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>Next</Text>
            <ArrowRight size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  stepBadge: {
    alignItems: 'center',
    gap: 4,
  },
  stepActive: {
    transform: [{ scale: 1.05 }],
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '700',
  },
  stepNumberActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#006b2c',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '800',
  },
  stepLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  stepLabelActive: {
    fontSize: 11,
    color: '#006b2c',
    fontWeight: '800',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    maxWidth: 240,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#ef4444',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputBoxError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500',
  },
  guaranteeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 12,
    color: '#065f46',
    lineHeight: 16,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 50,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
