import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Tag, Plus, Edit2, Trash2, CheckCircle2, XCircle, X, Check } from 'lucide-react-native';
import { Coupon } from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface CouponsSectionProps {
  coupons: Coupon[];
  adminToken: string | null;
  onRefresh: () => void;
}

export const CouponsSection: React.FC<CouponsSectionProps> = ({
  coupons,
  adminToken,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const activeCount = coupons.filter((c) => c.isActive !== false).length;

  const handleOpenAdd = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountPercentage('');
    setMinOrderAmount('');
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDiscountPercentage(String(c.discountPercentage || ''));
    setMinOrderAmount(String(c.minOrderAmount || ''));
    setDescription(c.description || '');
    setIsActive(c.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async () => {
    if (!adminToken) {
      Alert.alert('Authentication Error', 'Admin token missing. Please sign in again.');
      return;
    }
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      Alert.alert('Validation Error', 'Coupon code is required.');
      return;
    }
    const discount = parseFloat(discountPercentage);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      Alert.alert('Validation Error', 'Discount percentage must be between 1 and 100.');
      return;
    }
    const minOrder = parseFloat(minOrderAmount) || 0;

    setIsSaving(true);
    try {
      const couponPayload: Partial<Coupon> = {
        code: cleanCode,
        discountPercentage: discount,
        minOrderAmount: minOrder,
        description: description.trim(),
        isActive,
      };

      if (editingCoupon) {
        await adminApi.updateCoupon(adminToken, editingCoupon.code, couponPayload);
        Alert.alert('Success', `Coupon "${cleanCode}" updated.`);
      } else {
        await adminApi.addCoupon(adminToken, couponPayload);
        Alert.alert('Success', `Coupon "${cleanCode}" created.`);
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save coupon.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (c: Coupon) => {
    if (!adminToken) return;
    const nextState = !c.isActive;
    try {
      await adminApi.updateCoupon(adminToken, c.code, { isActive: nextState });
      onRefresh();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not toggle coupon status.');
    }
  };

  const handleDelete = (c: Coupon) => {
    if (!adminToken) return;
    Alert.alert(
      'Delete Coupon',
      `Permanently delete coupon "${c.code}"? Customers will no longer be able to use it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteCoupon(adminToken, c.code);
              Alert.alert('Deleted', `Coupon "${c.code}" removed.`);
              onRefresh();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete coupon.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Coupons Management</Text>
          <Text style={styles.subtitle}>
            {activeCount} active · {coupons.length} total coupons configured
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>New Coupon</Text>
        </TouchableOpacity>
      </View>

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <View style={styles.emptyCard}>
          <Tag size={36} color="#64748b" />
          <Text style={styles.emptyTitle}>No coupons created yet</Text>
          <Text style={styles.emptySubtitle}>
            Create promotional discount codes for your customers.
          </Text>
        </View>
      ) : (
        <View style={styles.couponsList}>
          {coupons.map((c) => {
            const isCouponActive = c.isActive !== false;
            return (
              <View key={c.id || c.code} style={styles.couponCard}>
                <View style={styles.couponTop}>
                  <View style={styles.couponCodePill}>
                    <Tag size={14} color="#10b981" />
                    <Text style={styles.couponCodeText}>{c.code}</Text>
                  </View>

                  <View style={styles.rightHeader}>
                    <Text style={styles.discountBadge}>{c.discountPercentage}% OFF</Text>
                    <TouchableOpacity
                      style={[
                        styles.statusPill,
                        isCouponActive ? styles.statusPillActive : styles.statusPillInactive,
                      ]}
                      onPress={() => handleToggleActive(c)}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isCouponActive ? styles.statusTextActive : styles.statusTextInactive,
                        ]}
                      >
                        {isCouponActive ? 'Active' : 'Disabled'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {c.description ? (
                  <Text style={styles.couponDesc}>{c.description}</Text>
                ) : null}

                <View style={styles.couponFooter}>
                  <Text style={styles.minOrderText}>
                    Min Order: <Text style={styles.minOrderVal}>₹{c.minOrderAmount || 0}</Text>
                  </Text>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => handleOpenEdit(c)}
                    >
                      <Edit2 size={15} color="#10b981" />
                      <Text style={styles.actionBtnEditText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(c)}
                    >
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Coupon Code *</Text>
              <TextInput
                style={styles.modalInput}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="e.g. FESTIVE25"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                editable={!editingCoupon}
              />

              <View style={styles.twoColRow}>
                <View style={styles.colHalf}>
                  <Text style={styles.inputLabel}>Discount (%) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={discountPercentage}
                    onChangeText={setDiscountPercentage}
                    placeholder="e.g. 20"
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
                <View style={styles.colHalf}>
                  <Text style={styles.inputLabel}>Min Order (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={minOrderAmount}
                    onChangeText={setMinOrderAmount}
                    placeholder="e.g. 499"
                    keyboardType="numeric"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Description / Terms</Text>
              <TextInput
                style={[styles.modalInput, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. 20% off on all organic vegetables and fruits above ₹499"
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Active Status</Text>
                  <Text style={styles.switchSub}>Allow customers to redeem this coupon</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#334155', true: '#006b2c' }}
                  thumbColor={isActive ? '#10b981' : '#94a3b8'}
                />
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveCoupon}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>
                      {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  couponsList: {
    gap: 12,
    paddingBottom: 24,
  },
  couponCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  couponTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  couponCodeText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10b981',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillActive: {
    backgroundColor: '#064e3b',
  },
  statusPillInactive: {
    backgroundColor: '#1e293b',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#34d399',
  },
  statusTextInactive: {
    color: '#94a3b8',
  },
  couponDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    lineHeight: 16,
  },
  couponFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  minOrderText: {
    fontSize: 11,
    color: '#64748b',
  },
  minOrderVal: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#064e3b',
  },
  actionBtnEditText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnDelete: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#7f1d1d',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  switchSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
