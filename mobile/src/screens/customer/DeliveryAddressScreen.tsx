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
import {
  MapPin,
  Home,
  Building,
  ArrowRight,
  CheckCircle2,
  Plus,
  Compass,
} from 'lucide-react-native';
import { Header } from '../../components/common/Header';

export interface DeliveryAddressInfo {
  houseNo: string;
  street: string;
  area?: string;
  city: string;
  state: string;
  pinCode: string;
  type?: 'Home' | 'Work' | 'Other';
}

interface DeliveryAddressScreenProps {
  initialAddress?: Partial<DeliveryAddressInfo>;
  savedAddresses?: DeliveryAddressInfo[];
  onContinue: (formattedAddress: string, details: DeliveryAddressInfo) => void;
  onBack: () => void;
}

export const DeliveryAddressScreen: React.FC<DeliveryAddressScreenProps> = ({
  initialAddress,
  savedAddresses = [],
  onContinue,
  onBack,
}) => {
  // Pre-fill or default
  const [houseNo, setHouseNo] = useState(initialAddress?.houseNo || '');
  const [street, setStreet] = useState(initialAddress?.street || '');
  const [area, setArea] = useState(initialAddress?.area || '');
  const [city, setCity] = useState(initialAddress?.city || 'Bengaluru');
  const [stateName, setStateName] = useState(initialAddress?.state || 'Karnataka');
  const [pinCode, setPinCode] = useState(initialAddress?.pinCode || '');
  const [addressType, setAddressType] = useState<'Home' | 'Work' | 'Other'>('Home');

  // Synchronize state when navigating backward or editing
  React.useEffect(() => {
    if (initialAddress) {
      if (initialAddress.houseNo !== undefined) setHouseNo(initialAddress.houseNo);
      if (initialAddress.street !== undefined) setStreet(initialAddress.street);
      if (initialAddress.area !== undefined) setArea(initialAddress.area);
      if (initialAddress.city !== undefined) setCity(initialAddress.city);
      if (initialAddress.state !== undefined) setStateName(initialAddress.state);
      if (initialAddress.pinCode !== undefined) setPinCode(initialAddress.pinCode);
      if (initialAddress.type !== undefined) setAddressType(initialAddress.type);
    }
  }, [initialAddress]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!houseNo.trim()) {
      errs.houseNo = 'House / Flat number is required.';
    }
    if (!street.trim()) {
      errs.street = 'Street or apartment name is required.';
    }
    if (!city.trim()) {
      errs.city = 'City is required.';
    }
    if (!stateName.trim()) {
      errs.state = 'State is required.';
    }
    const cleanPin = pinCode.replace(/[^0-9]/g, '');
    if (!cleanPin || cleanPin.length !== 6) {
      errs.pinCode = 'Valid 6-digit PIN code is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSelectSaved = (saved: DeliveryAddressInfo) => {
    setHouseNo(saved.houseNo);
    setStreet(saved.street);
    setArea(saved.area || '');
    setCity(saved.city);
    setStateName(saved.state);
    setPinCode(saved.pinCode);
    if (saved.type) setAddressType(saved.type);
    setErrors({});
  };

  const handleContinue = () => {
    if (!validate()) {
      Alert.alert('Incomplete Address', 'Please provide house number, street, city, state, and 6-digit PIN code.');
      return;
    }

    const formatted = `${houseNo.trim()}, ${street.trim()}, ${
      area.trim() ? area.trim() + ', ' : ''
    }${city.trim()}, ${stateName.trim()} - ${pinCode.trim()}`;

    const details: DeliveryAddressInfo = {
      houseNo: houseNo.trim(),
      street: street.trim(),
      area: area.trim(),
      city: city.trim(),
      state: stateName.trim(),
      pinCode: pinCode.trim(),
      type: addressType,
    };

    onContinue(formatted, details);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Checkout" subtitle="Step 2 of 4: Delivery Address" showBack onBack={onBack} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Progress Indicator - 4 Steps */}
          <View style={styles.stepProgressRow}>
            <View style={styles.stepBadge}>
              <View style={styles.stepDoneCircle}>
                <CheckCircle2 size={16} color="#ffffff" />
              </View>
              <Text style={styles.stepLabelDone}>Recipient</Text>
            </View>
            <View style={[styles.stepLine, styles.stepLineDone]} />
            <View style={[styles.stepBadge, styles.stepActive]}>
              <Text style={styles.stepNumberActive}>2</Text>
              <Text style={styles.stepLabelActive}>Address</Text>
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

          {/* Quick Saved Addresses Selection if any */}
          {savedAddresses && savedAddresses.length > 0 && (
            <View style={styles.savedSection}>
              <Text style={styles.sectionHeading}>Saved Addresses:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {savedAddresses.map((addr, idx) => {
                  const isCurrent =
                    houseNo === addr.houseNo &&
                    street === addr.street &&
                    pinCode === addr.pinCode;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.savedCard, isCurrent ? styles.savedCardActive : null]}
                      onPress={() => handleSelectSaved(addr)}
                    >
                      <View style={styles.savedCardHeader}>
                        {addr.type === 'Work' ? (
                          <Building size={14} color="#0284c7" />
                        ) : (
                          <Home size={14} color="#006b2c" />
                        )}
                        <Text style={styles.savedCardType}>{addr.type || 'Home'}</Text>
                      </View>
                      <Text style={styles.savedCardText} numberOfLines={2}>
                        {addr.houseNo}, {addr.street}, {addr.city} - {addr.pinCode}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <MapPin size={20} color="#006b2c" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Complete Delivery Address</Text>
                <Text style={styles.cardSubtitle}>
                  Direct dispatch to your doorstep from our fresh fulfillment pod.
                </Text>
              </View>
            </View>

            {/* Address Type Tag (Home / Work / Other) */}
            <View style={styles.typeSelectorRow}>
              {(['Home', 'Work', 'Other'] as const).map((type) => {
                const isSelected = addressType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typePill, isSelected ? styles.typePillActive : null]}
                    onPress={() => setAddressType(type)}
                  >
                    <Text style={[styles.typePillText, isSelected ? styles.typePillTextActive : null]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* House / Flat No */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                House / Flat / Block No. <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.houseNo ? styles.inputError : null]}
                placeholder="e.g. Flat 304, Block B"
                placeholderTextColor="#94a3b8"
                value={houseNo}
                onChangeText={(val) => {
                  setHouseNo(val);
                  if (errors.houseNo) setErrors((prev) => ({ ...prev, houseNo: '' }));
                }}
              />
              {errors.houseNo ? <Text style={styles.errorText}>{errors.houseNo}</Text> : null}
            </View>

            {/* Apartment / Street */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Apartment / Street / Road Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.street ? styles.inputError : null]}
                placeholder="e.g. Green Meadows, 100ft Main Road"
                placeholderTextColor="#94a3b8"
                value={street}
                onChangeText={(val) => {
                  setStreet(val);
                  if (errors.street) setErrors((prev) => ({ ...prev, street: '' }));
                }}
              />
              {errors.street ? <Text style={styles.errorText}>{errors.street}</Text> : null}
            </View>

            {/* Area / Landmark */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Area / Locality / Nearby Landmark</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Near Metro Station, Indiranagar"
                placeholderTextColor="#94a3b8"
                value={area}
                onChangeText={setArea}
              />
            </View>

            {/* City & State Row */}
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>
                  City <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, errors.city ? styles.inputError : null]}
                  placeholder="e.g. Bengaluru"
                  placeholderTextColor="#94a3b8"
                  value={city}
                  onChangeText={(val) => {
                    setCity(val);
                    if (errors.city) setErrors((prev) => ({ ...prev, city: '' }));
                  }}
                />
                {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.label}>
                  State <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, errors.state ? styles.inputError : null]}
                  placeholder="e.g. Karnataka"
                  placeholderTextColor="#94a3b8"
                  value={stateName}
                  onChangeText={(val) => {
                    setStateName(val);
                    if (errors.state) setErrors((prev) => ({ ...prev, state: '' }));
                  }}
                />
                {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
              </View>
            </View>

            {/* PIN Code */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                PIN Code <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, errors.pinCode ? styles.inputError : null]}
                placeholder="e.g. 560038"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={6}
                value={pinCode}
                onChangeText={(val) => {
                  setPinCode(val);
                  if (errors.pinCode) setErrors((prev) => ({ ...prev, pinCode: '' }));
                }}
              />
              {errors.pinCode ? <Text style={styles.errorText}>{errors.pinCode}</Text> : null}
            </View>
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
    marginBottom: 16,
    paddingVertical: 8,
  },
  stepBadge: {
    alignItems: 'center',
    gap: 4,
  },
  stepActive: {
    transform: [{ scale: 1.05 }],
  },
  stepDoneCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
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
  stepLabelDone: {
    fontSize: 11,
    color: '#006b2c',
    fontWeight: '700',
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
  stepLineDone: {
    backgroundColor: '#006b2c',
  },
  savedSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  savedCard: {
    width: 200,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  savedCardActive: {
    borderColor: '#006b2c',
    backgroundColor: '#f0fdf4',
  },
  savedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  savedCardType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  savedCardText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
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
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typePillActive: {
    backgroundColor: '#006b2c',
    borderColor: '#006b2c',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  typePillTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 14,
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
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontSize: 14,
    color: '#0f172a',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500',
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
