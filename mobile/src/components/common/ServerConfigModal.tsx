import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  resetApiBaseUrl,
  DEFAULT_LAN_IP,
  DEFAULT_PORT,
} from '../../config/api';
import { Server, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react-native';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (newUrl: string) => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  onClose,
  onSaved,
}) => {
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (visible) {
      getApiBaseUrl().then((url) => {
        setCurrentUrl(url);
        setInputUrl(url);
        setTestResult(null);
      });
    }
  }, [visible]);

  const testConnection = async (urlToTest: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const clean = urlToTest.trim().replace(/\/+$/, '');
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${clean}/api/products`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Connected successfully to FreshCart backend & MySQL!',
        });
      } else {
        setTestResult({
          success: false,
          message: `Server responded with HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.name === 'AbortError' ? 'Connection timed out' : err.message || 'Cannot reach server',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const clean = inputUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Please include http:// or https://');
      return;
    }
    await setApiBaseUrl(clean);
    setCurrentUrl(clean);
    if (onSaved) onSaved(clean);
    Alert.alert('Saved', `API Base URL updated to:\n${clean}`);
    onClose();
  };

  const handleSetPreset = (presetUrl: string) => {
    setInputUrl(presetUrl);
    testConnection(presetUrl);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Server size={22} color="#006b2c" />
              <Text style={styles.title}>Backend API Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Connect the mobile app to your existing FreshCart server and shared MySQL database.
          </Text>

          {/* Input */}
          <Text style={styles.label}>Server Base URL</Text>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://192.168.1.X:3000"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Quick presets */}
          <Text style={styles.label}>Quick Presets:</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetBadge}
              onPress={() => handleSetPreset(`http://${DEFAULT_LAN_IP}:${DEFAULT_PORT}`)}
            >
              <Text style={styles.presetText}>LAN WiFi ({DEFAULT_LAN_IP})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBadge}
              onPress={() => handleSetPreset(`http://localhost:${DEFAULT_PORT}`)}
            >
              <Text style={styles.presetText}>Localhost</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBadge}
              onPress={() => handleSetPreset(`http://10.0.2.2:${DEFAULT_PORT}`)}
            >
              <Text style={styles.presetText}>Android Emul (10.0.2.2)</Text>
            </TouchableOpacity>
          </View>

          {/* Test connection result */}
          {testResult && (
            <View
              style={[
                styles.resultBox,
                testResult.success ? styles.resultSuccess : styles.resultError,
              ]}
            >
              {testResult.success ? (
                <CheckCircle2 size={18} color="#006b2c" />
              ) : (
                <AlertCircle size={18} color="#d32f2f" />
              )}
              <Text
                style={[
                  styles.resultText,
                  testResult.success ? styles.resultTextSuccess : styles.resultTextError,
                ]}
              >
                {testResult.message}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.testBtn]}
              onPress={() => testConnection(inputUrl)}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#006b2c" />
              ) : (
                <>
                  <RefreshCw size={16} color="#006b2c" />
                  <Text style={styles.testBtnText}>Test Ping</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save & Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#f9f9f9',
    marginBottom: 14,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  presetBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  presetText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  resultSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  resultError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  resultText: {
    fontSize: 12,
    flex: 1,
  },
  resultTextSuccess: {
    color: '#15803d',
    fontWeight: '500',
  },
  resultTextError: {
    color: '#b91c1c',
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  testBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#006b2c',
  },
  testBtnText: {
    color: '#006b2c',
    fontWeight: '600',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#006b2c',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
