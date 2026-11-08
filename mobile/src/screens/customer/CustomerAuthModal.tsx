import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Linking,
  Image,
  Alert,
} from 'react-native';
import {
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  X,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  CreditCard,
  QrCode,
  Copy,
  Check,
  UploadCloud,
  FileText,
  ExternalLink,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { authApi, customerApi, cleanErrorMessage } from '../../services/apiClient';

interface CustomerAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { loginCustomer, registerCustomer } = useAuth();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Registration UPI Payment Details
  const [upiId, setUpiId] = useState('somaraju2006jangala-3@okicici');
  const [merchantName, setMerchantName] = useState('FreshCart Store');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentProofBase64, setPaymentProofBase64] = useState<string | null>(null);
  const [paymentProofMime, setPaymentProofMime] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [paymentProofSize, setPaymentProofSize] = useState<number>(0);
  const [isPickingProof, setIsPickingProof] = useState(false);

  // Fetch shared UPI settings
  useEffect(() => {
    customerApi
      .getUpiSettings()
      .then((res) => {
        if (res.success && res.settings?.upiId) {
          setUpiId(res.settings.upiId);
          if (res.settings.merchantName) setMerchantName(res.settings.merchantName);
        } else if (res.upiId) {
          setUpiId(res.upiId);
          if (res.merchantName) setMerchantName(res.merchantName);
        }
      })
      .catch(() => {});
  }, []);

  // Standard UPI URI format
  const standardUpiUri = useMemo(() => {
    const cleanId = (upiId || '').trim();
    if (!cleanId) return '';
    const pa = encodeURIComponent(cleanId).replace(/%40/g, '@');
    const pn = encodeURIComponent(merchantName.trim() || 'FreshCart Store');
    return `upi://pay?pa=${pa}&pn=${pn}&am=199&cu=INR`;
  }, [upiId, merchantName]);

  // Generate QR Code
  useEffect(() => {
    if (!standardUpiUri) return;
    QRCode.toDataURL(standardUpiUri, {
      width: 180,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#050c18', light: '#ffffff' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [standardUpiUri]);

  // Handle Pay Now
  const handlePayNow = () => {
    if (!standardUpiUri) return;
    Linking.openURL(standardUpiUri).catch(() => {
      Alert.alert(
        'UPI App Not Found',
        `Unable to launch UPI app directly.\n\nOfficial UPI ID: ${upiId}\nPayable Amount: ₹199\n\nPlease use your UPI app (Google Pay, PhonePe, Paytm) to pay.`
      );
    });
  };

  // Handle Copy UPI ID
  const handleCopyUpiId = async () => {
    try {
      await Clipboard.setStringAsync(upiId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      Alert.alert('Copied', 'UPI ID copied to clipboard: ' + upiId);
    } catch {
      Alert.alert('Copy failed', 'UPI ID: ' + upiId);
    }
  };

  // Handle Pick Proof
  const handlePickProof = async () => {
    try {
      setIsPickingProof(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const fileSize = file.size || 0;
        const MAX_SIZE = 10 * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10 MB.');
          return;
        }

        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        const validExts = ['.jpg', '.jpeg', '.png', '.pdf'];
        if (!validExts.includes(ext)) {
          Alert.alert('Invalid Format', 'Accepted formats are JPG, JPEG, PNG, and PDF.');
          return;
        }

        const mime = file.mimeType || (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg');
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        setPaymentProofBase64(base64);
        setPaymentProofMime(mime);
        setPaymentProofName(file.name);
        setPaymentProofSize(fileSize);
      }
    } catch (err: any) {
      Alert.alert('File Selection Error', err?.message || 'Could not access file.');
    } finally {
      setIsPickingProof(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setMobile('');
    setAddress('');
    setTransactionRef('');
    setPaymentProofBase64(null);
    setPaymentProofName(null);
    setPaymentProofSize(0);
    setPaymentProofMime(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    const res = await loginCustomer(email.trim(), password);
    setIsLoading(false);
    if (res.success) {
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(cleanErrorMessage(res.error, 'Invalid credentials.'));
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!fullName.trim() || !email.trim() || !mobile.trim() || !password) {
      setErrorMessage('Full name, email, mobile, and password are required.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    const res = await registerCustomer({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      password,
      address: address.trim(),
      transactionRef: transactionRef.trim() || undefined,
      paymentProof: paymentProofBase64 || undefined,
      mimeType: paymentProofMime || undefined,
      fileName: paymentProofName || undefined,
    });
    setIsLoading(false);
    if (res.success) {
      Alert.alert(
        'Registration Submitted',
        paymentProofBase64
          ? 'Your registration and ₹199 payment proof have been submitted. Payment is pending admin verification.'
          : 'Account created successfully. Welcome to FreshCart!'
      );
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(cleanErrorMessage(res.error, 'Registration failed.'));
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage(
          res.message || 'Password reset link sent. Please check your email or proceed with token.'
        );
      } else {
        setErrorMessage(cleanErrorMessage(res.error, 'Failed requesting password reset.'));
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(cleanErrorMessage(err, 'Error sending reset request.'));
    }
  };

  const fillDemoCustomer = () => {
    setEmail('customer@freshcart.com');
    setPassword('FreshCart2026!');
    setErrorMessage(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: 'flex-end' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {tab === 'login'
                  ? 'Sign In to FreshCart'
                  : tab === 'register'
                  ? 'Create Customer Account'
                  : 'Reset Password'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabSwitcher}>
              <TouchableOpacity
                style={[styles.switchTab, tab === 'login' && styles.switchTabActive]}
                onPress={() => {
                  setTab('login');
                  setErrorMessage(null);
                }}
              >
                <Text style={[styles.switchTabText, tab === 'login' && styles.switchTabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.switchTab, tab === 'register' && styles.switchTabActive]}
                onPress={() => {
                  setTab('register');
                  setErrorMessage(null);
                }}
              >
                <Text style={[styles.switchTabText, tab === 'register' && styles.switchTabTextActive]}>
                  Register
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.switchTab, tab === 'forgot' && styles.switchTabActive]}
                onPress={() => {
                  setTab('forgot');
                  setErrorMessage(null);
                }}
              >
                <Text style={[styles.switchTabText, tab === 'forgot' && styles.switchTabTextActive]}>
                  Forgot
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error or Success notification */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* LOGIN TAB */}
              {tab === 'login' && (
                <View>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrap}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="customer@freshcart.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrap}>
                    <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { paddingRight: 40 }]}
                      placeholder="Password"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color="#94a3b8" />
                      ) : (
                        <Eye size={18} color="#94a3b8" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Sign In</Text>
                        <ArrowRight size={18} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.demoFillBtn} onPress={fillDemoCustomer}>
                    <KeyRound size={14} color="#006b2c" />
                    <Text style={styles.demoFillText}>Fill Demo Customer Credentials</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* REGISTER TAB */}
              {tab === 'register' && (
                <View>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrap}>
                    <User size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Priya Sharma"
                      placeholderTextColor="#94a3b8"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrap}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="priya@example.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Mobile Phone</Text>
                  <View style={styles.inputWrap}>
                    <Phone size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="+91 9876543210"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={mobile}
                      onChangeText={setMobile}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrap}>
                    <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="At least 6 characters"
                      placeholderTextColor="#94a3b8"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Delivery Address (Optional)</Text>
                  <View style={styles.inputWrap}>
                    <MapPin size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Flat, building, street, city, pin"
                      placeholderTextColor="#94a3b8"
                      value={address}
                      onChangeText={setAddress}
                    />
                  </View>

                  {/* REGISTRATION PAYMENT DETAILS */}
                  <View style={styles.paymentCard}>
                    <View style={styles.paymentCardHeader}>
                      <CreditCard size={18} color="#006b2c" />
                      <Text style={styles.paymentCardTitle}>Registration Fee: ₹199</Text>
                    </View>
                    <Text style={styles.paymentCardSubtitle}>
                      Complete your one-time ₹199 membership registration via UPI.
                    </Text>

                    {/* Merchant & UPI details */}
                    <View style={styles.paymentDetailsBox}>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Merchant:</Text>
                        <Text style={styles.paymentDetailValue}>{merchantName}</Text>
                      </View>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Payable Amount:</Text>
                        <Text style={[styles.paymentDetailValue, { color: '#006b2c', fontWeight: '800' }]}>₹199.00</Text>
                      </View>
                      <View style={styles.paymentDetailRow}>
                        <Text style={styles.paymentDetailLabel}>Official UPI ID:</Text>
                        <Text style={[styles.paymentDetailValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 }]}>
                          {upiId}
                        </Text>
                      </View>
                    </View>

                    {/* Actions: Pay Now & Copy UPI ID */}
                    <View style={styles.paymentActionRow}>
                      <TouchableOpacity style={styles.payNowBtn} onPress={handlePayNow}>
                        <ExternalLink size={16} color="#ffffff" />
                        <Text style={styles.payNowBtnText}>Pay Now</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.copyBtn, isCopied && styles.copyBtnSuccess]}
                        onPress={handleCopyUpiId}
                      >
                        {isCopied ? <Check size={16} color="#15803d" /> : <Copy size={16} color="#334155" />}
                        <Text style={[styles.copyBtnText, isCopied && styles.copyBtnTextSuccess]}>
                          {isCopied ? 'Copied' : 'Copy UPI ID'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Scannable QR Code */}
                    {qrCodeDataUrl ? (
                      <View style={styles.qrContainer}>
                        <View style={styles.qrFrame}>
                          <Image
                            source={{ uri: qrCodeDataUrl }}
                            style={{ width: 160, height: 160 }}
                            resizeMode="contain"
                          />
                        </View>
                        <Text style={styles.qrCaption}>Scan with Google Pay, PhonePe, Paytm, or BHIM</Text>
                      </View>
                    ) : null}

                    {/* Transaction Reference Input */}
                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Transaction Reference / UTR (Optional)</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. 12-digit UPI reference ID"
                        placeholderTextColor="#94a3b8"
                        value={transactionRef}
                        onChangeText={setTransactionRef}
                      />
                    </View>

                    {/* Payment Proof Upload */}
                    <Text style={styles.inputLabel}>Payment Proof (JPG, PNG, or PDF up to 10MB)</Text>
                    {paymentProofName ? (
                      <View style={styles.proofFileBadge}>
                        {paymentProofMime?.includes('pdf') ? (
                          <FileText size={20} color="#dc2626" />
                        ) : paymentProofBase64 ? (
                          <Image
                            source={{ uri: `data:${paymentProofMime || 'image/jpeg'};base64,${paymentProofBase64}` }}
                            style={styles.proofThumb}
                          />
                        ) : (
                          <FileText size={20} color="#006b2c" />
                        )}
                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <Text style={styles.proofFileName} numberOfLines={1}>
                            {paymentProofName}
                          </Text>
                          <Text style={styles.proofFileSize}>
                            {paymentProofSize ? `${(paymentProofSize / 1024).toFixed(1)} KB` : 'Ready to submit'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setPaymentProofBase64(null);
                            setPaymentProofName(null);
                            setPaymentProofMime(null);
                            setPaymentProofSize(0);
                          }}
                        >
                          <X size={18} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadProofBtn}
                        onPress={handlePickProof}
                        disabled={isPickingProof}
                      >
                        {isPickingProof ? (
                          <ActivityIndicator size="small" color="#006b2c" />
                        ) : (
                          <>
                            <UploadCloud size={18} color="#006b2c" />
                            <Text style={styles.uploadProofBtnText}>Upload Payment Receipt / Proof</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleRegister}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Complete Registration</Text>
                        <ArrowRight size={18} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* FORGOT PASSWORD TAB */}
              {tab === 'forgot' && (
                <View>
                  <Text style={styles.infoDesc}>
                    Enter your registered email address to receive a secure password reset link.
                  </Text>

                  <Text style={styles.inputLabel}>Registered Email</Text>
                  <View style={styles.inputWrap}>
                    <Mail size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="customer@freshcart.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleForgotPassword}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  switchTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  switchTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  switchTabTextActive: {
    color: '#006b2c',
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '500',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '600',
  },
  infoDesc: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  primaryBtn: {
    backgroundColor: '#006b2c',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  demoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: 10,
    marginBottom: 10,
  },
  demoFillText: {
    fontSize: 12,
    color: '#006b2c',
    fontWeight: '600',
  },
  paymentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginVertical: 12,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paymentCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  paymentCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  paymentDetailsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDetailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  paymentDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  paymentActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  payNowBtn: {
    flex: 1,
    backgroundColor: '#006b2c',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payNowBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyBtnSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  copyBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  copyBtnTextSuccess: {
    color: '#15803d',
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  qrFrame: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  qrCaption: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  uploadProofBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#86efac',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadProofBtnText: {
    color: '#006b2c',
    fontSize: 12,
    fontWeight: '600',
  },
  proofFileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  proofThumb: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  proofFileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  proofFileSize: {
    fontSize: 10,
    color: '#64748b',
  },
});
