import React, { useState } from 'react';
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
} from 'react-native';
import { User, Mail, Lock, Phone, MapPin, X, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/apiClient';

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

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setMobile('');
    setAddress('');
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
      setErrorMessage(res.error || 'Invalid credentials.');
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
    });
    setIsLoading(false);
    if (res.success) {
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(res.error || 'Registration failed.');
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
        setErrorMessage(res.error || 'Failed requesting password reset.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Error sending reset request.');
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

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleRegister}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Create Account</Text>
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
});
