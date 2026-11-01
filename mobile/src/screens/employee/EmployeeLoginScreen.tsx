import React, { useState } from 'react';
import {
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
import { Truck, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';

interface EmployeeLoginScreenProps {
  onBackToSelection: () => void;
}

export const EmployeeLoginScreen: React.FC<EmployeeLoginScreenProps> = ({ onBackToSelection }) => {
  const { loginEmployee } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!identifier.trim()) {
      setErrorMessage('Please enter your Employee ID or email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await loginEmployee(identifier.trim(), password);
    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Access denied: Invalid employee credentials.');
    }
  };

  const fillDemoEmployee = () => {
    setIdentifier('employee@freshcart.com');
    setPassword('FreshCartEmployee2026!');
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="FreshCart" subtitle="Employee Portal" showBack onBack={onBackToSelection} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Shield Header */}
          <View style={styles.topHeader}>
            <View style={styles.truckBadge}>
              <Truck size={36} color="#0284c7" />
            </View>
            <Text style={styles.title}>Delivery Staff Portal</Text>
            <Text style={styles.subtitle}>
              Sign in with your authorized FreshCart employee ID to access assigned delivery orders
            </Text>
          </View>

          {/* Error notice */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Employee Email or User ID</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="EMP-XXXX or staff@freshcart.com"
                placeholderTextColor="#9ca3af"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 40 }]}
                placeholder="Assigned staff password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#6b7280" />
                ) : (
                  <Eye size={18} color="#6b7280" />
                )}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Sign In to Staff Portal</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            {/* Quick Demo Fill */}
            <TouchableOpacity style={styles.demoBtn} onPress={fillDemoEmployee}>
              <KeyRound size={15} color="#0284c7" />
              <Text style={styles.demoBtnText}>Fill Demo Staff (employee@freshcart.com)</Text>
            </TouchableOpacity>
          </View>

          {/* Return link */}
          <TouchableOpacity style={styles.backLink} onPress={onBackToSelection}>
            <ArrowLeft size={16} color="#64748b" />
            <Text style={styles.backLinkText}>Back to Portal Selection</Text>
          </TouchableOpacity>
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  topHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  truckBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  loginBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    backgroundColor: '#f0f9ff',
  },
  demoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
