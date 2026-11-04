import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Truck,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Save,
  Check,
  AlertTriangle,
} from 'lucide-react-native';
import { DeliveryChargeRule } from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface DeliveryChargesSectionProps {
  adminToken: string | null;
}

const DEFAULT_DELIVERY_RULES: DeliveryChargeRule[] = [
  { id: 'rule-0', minOrderAmount: 0, deliveryCharge: 40 },
  { id: 'rule-500', minOrderAmount: 500, deliveryCharge: 30 },
  { id: 'rule-1000', minOrderAmount: 1000, deliveryCharge: 25 },
  { id: 'rule-1500', minOrderAmount: 1500, deliveryCharge: 12 },
  { id: 'rule-2000', minOrderAmount: 2000, deliveryCharge: 10 },
  { id: 'rule-2500', minOrderAmount: 2500, deliveryCharge: 5 },
  { id: 'rule-3000', minOrderAmount: 3000, deliveryCharge: 0 },
  { id: 'rule-5000', minOrderAmount: 5000, deliveryCharge: 0 },
];

export const DeliveryChargesSection: React.FC<DeliveryChargesSectionProps> = ({
  adminToken,
}) => {
  const [rules, setRules] = useState<DeliveryChargeRule[]>(DEFAULT_DELIVERY_RULES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Form
  const [minOrderInput, setMinOrderInput] = useState('');
  const [chargeInput, setChargeInput] = useState('');
  const [isFree, setIsFree] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getDeliverySettings();
      if (res.success && res.settings?.deliveryChargeRules?.length > 0) {
        setRules(res.settings.deliveryChargeRules);
      }
    } catch (err: any) {
      console.warn('Could not load delivery settings from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
  }, [rules]);

  const freeDeliveryThreshold = useMemo(() => {
    const free = sortedRules.find((r) => r.deliveryCharge === 0);
    return free ? free.minOrderAmount : null;
  }, [sortedRules]);

  const handleAddRule = () => {
    const minOrder = parseFloat(minOrderInput);
    if (isNaN(minOrder) || minOrder < 0) {
      Alert.alert('Validation Error', 'Please enter a valid Minimum Order Amount (₹).');
      return;
    }
    const charge = isFree ? 0 : parseFloat(chargeInput);
    if (isNaN(charge) || charge < 0) {
      Alert.alert('Validation Error', 'Please enter a valid Delivery Charge (₹).');
      return;
    }

    if (rules.some((r) => r.minOrderAmount === minOrder)) {
      Alert.alert(
        'Duplicate Rule',
        `A rule for minimum order amount ₹${minOrder} already exists. Please delete it first or edit.`
      );
      return;
    }

    const newRule: DeliveryChargeRule = {
      id: `rule-${minOrder}-${Date.now()}`,
      minOrderAmount: minOrder,
      deliveryCharge: charge,
    };

    setRules([...rules, newRule]);
    setMinOrderInput('');
    setChargeInput('');
    setIsFree(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (rules.length <= 1) {
      Alert.alert('Cannot Delete', 'At least one delivery charge rule is required.');
      return;
    }
    setRules(rules.filter((r) => r.id !== ruleId));
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Rules',
      'Reset all delivery charge tiers back to FreshCart recommended default rules?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setRules(DEFAULT_DELIVERY_RULES);
          },
        },
      ]
    );
  };

  const handleSaveToDatabase = async () => {
    if (!adminToken) {
      Alert.alert('Authentication Error', 'Admin token missing. Please sign in again.');
      return;
    }
    setIsSaving(true);
    setSaveSuccess(null);
    try {
      const res = await adminApi.updateDeliverySettings(adminToken, {
        deliveryChargeRules: sortedRules,
        deliveryCharges: sortedRules[0]?.deliveryCharge || 40,
      });

      if (res.success) {
        setSaveSuccess('Delivery charge rules saved successfully to MySQL database!');
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        Alert.alert('Save Failed', 'Server rejected settings update.');
      }
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Network error saving delivery charges.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBox}>
        <View style={styles.titleRow}>
          <Truck size={18} color="#10b981" />
          <Text style={styles.heading}>Delivery Charges Configuration</Text>
        </View>
        <Text style={styles.subheading}>
          Customer delivery fees are automatically computed based on cart subtotal tiers.
        </Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiBadge}>
            <Text style={styles.kpiLabel}>Active Rules:</Text>
            <Text style={styles.kpiValue}>{rules.length}</Text>
          </View>
          {freeDeliveryThreshold !== null && (
            <View style={[styles.kpiBadge, { borderColor: '#10b981' }]}>
              <Text style={styles.kpiLabel}>Free Delivery From:</Text>
              <Text style={[styles.kpiValue, { color: '#10b981' }]}>
                ₹{freeDeliveryThreshold}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Success Banner */}
      {saveSuccess && (
        <View style={styles.successBanner}>
          <CheckCircle2 size={16} color="#34d399" />
          <Text style={styles.successText}>{saveSuccess}</Text>
        </View>
      )}

      {/* Add New Rule Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add New Delivery Charge Rule</Text>

        <View style={styles.inputRow}>
          <View style={styles.inputCol}>
            <Text style={styles.fieldLabel}>Min Order (₹) *</Text>
            <TextInput
              style={styles.textInput}
              value={minOrderInput}
              onChangeText={setMinOrderInput}
              placeholder="e.g. 1500"
              keyboardType="numeric"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputCol}>
            <View style={styles.chargeLabelRow}>
              <Text style={styles.fieldLabel}>Delivery Charge (₹) *</Text>
              <TouchableOpacity
                onPress={() => {
                  const next = !isFree;
                  setIsFree(next);
                  if (next) setChargeInput('0');
                }}
              >
                <Text style={[styles.freeToggleText, isFree && styles.freeToggleActive]}>
                  {isFree ? '✓ Free' : 'Set Free'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.textInput, isFree && styles.textInputDisabled]}
              value={isFree ? '0' : chargeInput}
              onChangeText={setChargeInput}
              placeholder="e.g. 15"
              keyboardType="numeric"
              editable={!isFree}
              placeholderTextColor="#64748b"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.addRuleBtn} onPress={handleAddRule}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addRuleText}>Add Tier Rule</Text>
        </TouchableOpacity>
      </View>

      {/* Current Rules Table */}
      <View style={styles.card}>
        <View style={styles.rulesHeaderRow}>
          <Text style={styles.cardTitle}>Active Pricing Tiers ({sortedRules.length})</Text>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetToDefaults}
          >
            <RotateCcw size={12} color="#94a3b8" />
            <Text style={styles.resetBtnText}>Reset Defaults</Text>
          </TouchableOpacity>
        </View>

        {sortedRules.map((rule) => {
          const isFreeRule = rule.deliveryCharge === 0;
          return (
            <View key={rule.id} style={styles.ruleRow}>
              <View style={styles.ruleLeft}>
                <Text style={styles.ruleMinOrder}>
                  Orders ≥ ₹{rule.minOrderAmount}
                </Text>
                <Text style={styles.ruleSub}>
                  Cart subtotal reached tier threshold
                </Text>
              </View>

              <View style={styles.ruleRight}>
                <View
                  style={[
                    styles.chargeBadge,
                    isFreeRule ? styles.chargeBadgeFree : styles.chargeBadgePaid,
                  ]}
                >
                  <Text
                    style={[
                      styles.chargeText,
                      isFreeRule ? styles.chargeTextFree : styles.chargeTextPaid,
                    ]}
                  >
                    {isFreeRule ? 'FREE' : `₹${rule.deliveryCharge}`}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteRuleBtn}
                  onPress={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 size={15} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Save to MySQL DB Button */}
        <TouchableOpacity
          style={styles.saveDbBtn}
          onPress={handleSaveToDatabase}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Save size={16} color="#fff" />
              <Text style={styles.saveDbText}>Save Changes to MySQL</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerBox: {
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
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  kpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f8fafc',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  chargeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  freeToggleText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  freeToggleActive: {
    color: '#10b981',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    color: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  textInputDisabled: {
    opacity: 0.6,
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    borderRadius: 8,
    height: 38,
    marginTop: 10,
  },
  addRuleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rulesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  resetBtnText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  ruleLeft: {
    flex: 1,
  },
  ruleMinOrder: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  ruleSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  ruleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chargeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chargeBadgeFree: {
    backgroundColor: '#064e3b',
  },
  chargeBadgePaid: {
    backgroundColor: '#1e293b',
  },
  chargeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chargeTextFree: {
    color: '#34d399',
  },
  chargeTextPaid: {
    color: '#f8fafc',
  },
  deleteRuleBtn: {
    padding: 6,
  },
  saveDbBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 10,
    height: 44,
    marginTop: 14,
  },
  saveDbText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
