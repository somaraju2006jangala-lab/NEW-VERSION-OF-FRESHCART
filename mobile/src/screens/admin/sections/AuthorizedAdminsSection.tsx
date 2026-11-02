import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import {
  ShieldCheck,
  Shield,
  UserPlus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Lock,
  Mail,
  User,
} from 'lucide-react-native';
import { AuthorizedAdmin } from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface AuthorizedAdminsSectionProps {
  currentAdmin: AuthorizedAdmin | null;
  adminToken: string | null;
}

export const AuthorizedAdminsSection: React.FC<AuthorizedAdminsSectionProps> = ({
  currentAdmin,
  adminToken,
}) => {
  const [admins, setAdmins] = useState<AuthorizedAdmin[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [maxLimit, setMaxLimit] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [customId, setCustomId] = useState('');
  const [password, setPassword] = useState('');

  const isOwner = currentAdmin?.role === 'owner';

  const loadAdmins = async () => {
    if (!adminToken) return;
    setIsLoading(true);
    try {
      const res = await adminApi.getAuthorizedAdmins(adminToken);
      if (res.success) {
        setAdmins(res.admins || []);
        setActiveCount(res.activeCount || 0);
        setMaxLimit(res.maxLimit || 5);
      }
    } catch (err: any) {
      console.warn('Could not load admins:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [adminToken]);

  const handleOpenAdd = () => {
    if (activeCount >= maxLimit) {
      Alert.alert(
        'Quota Reached',
        `Maximum quota of ${maxLimit} active administrators has been reached. Deactivate an existing admin before adding another.`
      );
      return;
    }
    setFullName('');
    setEmail('');
    setCustomId('');
    setPassword('');
    setIsAddModalOpen(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminToken) return;
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Full Name, Email, and Password are required.');
      return;
    }
    if (password.trim().length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await adminApi.createAuthorizedAdmin(adminToken, {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        adminId: customId.trim() || undefined,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Administrator "${fullName}" created successfully!`,
        });
        setIsAddModalOpen(false);
        loadAdmins();
      } else {
        Alert.alert('Create Failed', res.error || 'Failed to create administrator.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error while creating admin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (admin: AuthorizedAdmin) => {
    if (!adminToken || !isOwner) return;
    if (admin.adminId === currentAdmin?.adminId) {
      Alert.alert('Action Blocked', 'You cannot change the status of your own account.');
      return;
    }

    const nextStatus = admin.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await adminApi.toggleAdminStatus(adminToken, admin.adminId, nextStatus);
      if (res.success) {
        loadAdmins();
      } else {
        Alert.alert('Update Failed', res.error || 'Failed to change admin status.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error toggling status.');
    }
  };

  const handleDeleteAdmin = (admin: AuthorizedAdmin) => {
    if (!adminToken || !isOwner) return;
    if (admin.role === 'owner') {
      Alert.alert('Protected Account', 'The Project Owner account cannot be deleted.');
      return;
    }
    if (admin.adminId === currentAdmin?.adminId) {
      Alert.alert('Action Blocked', 'You cannot delete your own account.');
      return;
    }

    Alert.alert(
      'Remove Administrator',
      `Permanently delete admin "${admin.fullName}" (${admin.email}) from MySQL database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await adminApi.deleteAuthorizedAdmin(adminToken, admin.adminId);
              if (res.success) {
                Alert.alert('Deleted', `Admin "${admin.fullName}" removed.`);
                loadAdmins();
              } else {
                Alert.alert('Delete Failed', res.error || 'Failed to delete admin.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Network error deleting admin.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.titleRow}>
              <ShieldCheck size={18} color="#10b981" />
              <Text style={styles.heading}>Authorized Administrator Management</Text>
            </View>
            <Text style={styles.subheading}>
              Enforce role-based access control and manage authorized operations administrators.
            </Text>
          </View>

          <View style={styles.quotaPill}>
            <Text style={styles.quotaText}>
              {activeCount}/{maxLimit} Active
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadAdmins}
            disabled={isLoading}
          >
            <RefreshCw size={13} color="#f8fafc" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>

          {isOwner ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleOpenAdd}
              disabled={activeCount >= maxLimit}
            >
              <UserPlus size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add Admin</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.readOnlyNotice}>Admin Mode (View Only)</Text>
          )}
        </View>
      </View>

      {/* Feedback Banner */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <CheckCircle2 size={16} color="#34d399" />
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      )}

      {/* Admins List */}
      <View style={styles.adminsList}>
        {admins.map((adm) => {
          const isActive = adm.status === 'active';
          const isAdmOwner = adm.role === 'owner';
          const isSelf = adm.adminId === currentAdmin?.adminId;

          return (
            <View key={adm.adminId} style={styles.adminCard}>
              <View style={styles.adminHeader}>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.adminName}>{adm.fullName}</Text>
                    {isAdmOwner && (
                      <View style={styles.ownerBadge}>
                        <Shield size={10} color="#34d399" />
                        <Text style={styles.ownerBadgeText}>Owner</Text>
                      </View>
                    )}
                    {isSelf && (
                      <View style={styles.selfBadge}>
                        <Text style={styles.selfBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.adminEmail}>{adm.email}</Text>
                  <Text style={styles.adminIdText}>ID: {adm.adminId}</Text>
                </View>

                {isOwner && !isAdmOwner && !isSelf ? (
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      isActive ? styles.statusBtnActive : styles.statusBtnInactive,
                    ]}
                    onPress={() => handleToggleStatus(adm)}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        isActive ? styles.statusTextActive : styles.statusTextInactive,
                      ]}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.statusToggleBtn,
                      isActive ? styles.statusBtnActive : styles.statusBtnInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        isActive ? styles.statusTextActive : styles.statusTextInactive,
                      ]}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions Footer */}
              {isOwner && !isAdmOwner && !isSelf && (
                <View style={styles.adminFooter}>
                  <Text style={styles.joinedText}>
                    Registered in MySQL database
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteAdmin(adm)}
                  >
                    <Trash2 size={14} color="#ef4444" />
                    <Text style={styles.deleteBtnText}>Remove Admin</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Add Admin Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Authorized Administrator</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Alex Sharma"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="alex.ops@freshcart.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Custom Admin ID (Optional)</Text>
              <TextInput
                style={styles.input}
                value={customId}
                onChangeText={setCustomId}
                placeholder="e.g. ADM-105"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Password *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#64748b"
                secureTextEntry
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddModalOpen(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmAddBtn}
                onPress={handleCreateAdmin}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.confirmAddBtnText}>Create Admin</Text>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
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
  quotaPill: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  quotaText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  readOnlyNotice: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 'auto',
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
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  adminsList: {
    gap: 12,
    paddingBottom: 24,
  },
  adminCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#064e3b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ownerBadgeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '800',
  },
  selfBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selfBadgeText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
  },
  adminEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  adminIdText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  statusToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBtnActive: {
    backgroundColor: '#064e3b',
  },
  statusBtnInactive: {
    backgroundColor: '#1e293b',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#34d399',
  },
  statusTextInactive: {
    color: '#94a3b8',
  },
  adminFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  joinedText: {
    fontSize: 10,
    color: '#64748b',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  confirmAddBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  confirmAddBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
