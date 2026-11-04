import React, { useState, useMemo } from 'react';
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
  UserCheck,
  UserPlus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Key,
  X,
  Check,
  Phone,
  Mail,
  Lock,
  User,
} from 'lucide-react-native';
import { AuthorizedEmployee } from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface EmployeeManagementSectionProps {
  employees: AuthorizedEmployee[];
  adminToken: string | null;
  onRefresh: () => void;
}

export const EmployeeManagementSection: React.FC<EmployeeManagementSectionProps> = ({
  employees,
  adminToken,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addMobile, setAddMobile] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState<AuthorizedEmployee | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Reset Password Modal
  const [resettingEmployee, setResettingEmployee] = useState<AuthorizedEmployee | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSavingReset, setIsSavingReset] = useState(false);

  const activeCount = useMemo(
    () => employees.filter((e) => e.status === 'active').length,
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.fullName?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.mobile?.toLowerCase().includes(q) ||
        emp.username?.toLowerCase().includes(q) ||
        emp.employeeId?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'active' && emp.status !== 'active') return false;
      if (statusFilter === 'inactive' && emp.status !== 'inactive') return false;

      return true;
    });
  }, [employees, searchQuery, statusFilter]);

  const handleCreateEmployee = async () => {
    if (!adminToken) return;
    if (!addFullName.trim() || !addEmail.trim() || !addPassword.trim()) {
      Alert.alert('Validation Error', 'Full Name, Email, and Password are required.');
      return;
    }

    setIsSavingAdd(true);
    try {
      const res = await adminApi.addEmployee(adminToken, {
        fullName: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        mobile: addMobile.trim() || undefined,
        username: addUsername.trim() || undefined,
        password: addPassword.trim(),
      });

      if (res.success) {
        Alert.alert('Employee Created', `Staff account created for "${addFullName}".`);
        setIsAddModalOpen(false);
        setAddFullName('');
        setAddEmail('');
        setAddMobile('');
        setAddUsername('');
        setAddPassword('');
        onRefresh();
      } else {
        Alert.alert('Create Failed', res.error || 'Failed to create employee.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error while adding employee.');
    } finally {
      setIsSavingAdd(false);
    }
  };

  const handleOpenEdit = (emp: AuthorizedEmployee) => {
    setEditingEmployee(emp);
    setEditFullName(emp.fullName || '');
    setEditEmail(emp.email || '');
    setEditMobile(emp.mobile || '');
    setEditUsername(emp.username || '');
  };

  const handleUpdateEmployee = async () => {
    if (!adminToken || !editingEmployee) return;
    if (!editFullName.trim() || !editEmail.trim()) {
      Alert.alert('Validation Error', 'Full Name and Email are required.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await adminApi.updateEmployee(adminToken, editingEmployee.employeeId, {
        fullName: editFullName.trim(),
        email: editEmail.trim().toLowerCase(),
        mobile: editMobile.trim() || undefined,
        username: editUsername.trim() || undefined,
      });

      if (res.success) {
        Alert.alert('Updated', 'Employee details updated.');
        setEditingEmployee(null);
        onRefresh();
      } else {
        Alert.alert('Update Failed', res.error || 'Failed to update employee.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error updating employee.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!adminToken || !resettingEmployee) return;
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setIsSavingReset(true);
    try {
      const res = await adminApi.resetEmployeePassword(
        adminToken,
        resettingEmployee.employeeId,
        newPassword.trim()
      );

      if (res.success) {
        Alert.alert('Password Reset', 'New credentials saved.');
        setResettingEmployee(null);
        setNewPassword('');
      } else {
        Alert.alert('Reset Failed', res.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error resetting password.');
    } finally {
      setIsSavingReset(false);
    }
  };

  const handleToggleStatus = async (emp: AuthorizedEmployee) => {
    if (!adminToken) return;
    const nextStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await adminApi.toggleEmployeeStatus(adminToken, emp.employeeId, nextStatus);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update employee status.');
    }
  };

  const handleDeleteEmployee = (emp: AuthorizedEmployee) => {
    if (!adminToken) return;
    Alert.alert(
      'Delete Employee',
      `Permanently remove "${emp.fullName}" (${emp.employeeId}) from staff database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteEmployee(adminToken, emp.employeeId);
              Alert.alert('Deleted', 'Employee removed.');
              onRefresh();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete employee.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.title}>Employee Management</Text>
          <Text style={styles.subtitle}>
            {activeCount} active · {employees.length} total staff members
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsAddModalOpen(true)}
        >
          <UserPlus size={15} color="#fff" />
          <Text style={styles.addBtnText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, phone, ID..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter === 'all'
                ? `All (${employees.length})`
                : filter === 'active'
                ? `Active (${activeCount})`
                : `Inactive (${employees.length - activeCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Employees List */}
      {filteredEmployees.length === 0 ? (
        <View style={styles.emptyCard}>
          <UserCheck size={40} color="#64748b" />
          <Text style={styles.emptyTitle}>No employees found</Text>
          <Text style={styles.emptySubtitle}>
            Add delivery partners and operations staff to manage orders.
          </Text>
        </View>
      ) : (
        <View style={styles.employeesList}>
          {filteredEmployees.map((emp) => {
            const isActive = emp.status === 'active';
            return (
              <View key={emp.employeeId} style={styles.empCard}>
                <View style={styles.empHeader}>
                  <View>
                    <Text style={styles.empName}>{emp.fullName}</Text>
                    <Text style={styles.empEmail}>{emp.email}</Text>
                    <Text style={styles.empIdText}>ID: {emp.employeeId}</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.statusToggle,
                      isActive ? styles.statusActive : styles.statusInactive,
                    ]}
                    onPress={() => handleToggleStatus(emp)}
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
                </View>

                {emp.mobile ? (
                  <View style={styles.phoneRow}>
                    <Phone size={12} color="#94a3b8" />
                    <Text style={styles.phoneText}>{emp.mobile}</Text>
                  </View>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.actionsFooter}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleOpenEdit(emp)}
                  >
                    <Edit2 size={13} color="#10b981" />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setResettingEmployee(emp)}
                  >
                    <Key size={13} color="#f59e0b" />
                    <Text style={[styles.actionText, { color: '#f59e0b' }]}>
                      Reset Pass
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { marginLeft: 'auto' }]}
                    onPress={() => handleDeleteEmployee(emp)}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Employee Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Staff Member</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={addFullName}
                onChangeText={setAddFullName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                value={addEmail}
                onChangeText={setAddEmail}
                placeholder="ramesh@freshcart.ops"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                value={addMobile}
                onChangeText={setAddMobile}
                placeholder="+91 9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Username (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={addUsername}
                onChangeText={setAddUsername}
                placeholder="ramesh_ops"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Initial Password *</Text>
              <TextInput
                style={styles.modalInput}
                value={addPassword}
                onChangeText={setAddPassword}
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
                disabled={isSavingAdd}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateEmployee}
                disabled={isSavingAdd}
              >
                {isSavingAdd ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Create Employee</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal visible={!!editingEmployee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit Employee: {editingEmployee?.fullName}
              </Text>
              <TouchableOpacity onPress={() => setEditingEmployee(null)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={editFullName}
                onChangeText={setEditFullName}
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Mobile Phone</Text>
              <TextInput
                style={styles.modalInput}
                value={editMobile}
                onChangeText={setEditMobile}
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.modalInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditingEmployee(null)}
                disabled={isSavingEdit}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleUpdateEmployee}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Updates</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal visible={!!resettingEmployee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reset Password: {resettingEmployee?.fullName}
              </Text>
              <TouchableOpacity onPress={() => setResettingEmployee(null)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>New Password *</Text>
              <TextInput
                style={styles.modalInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter at least 6 characters"
                placeholderTextColor="#64748b"
                secureTextEntry
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setResettingEmployee(null)}
                disabled={isSavingReset}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleResetPassword}
                disabled={isSavingReset}
              >
                {isSavingReset ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Key size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Update Password</Text>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  filterChipActive: {
    backgroundColor: '#006b2c',
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  employeesList: {
    gap: 12,
    paddingBottom: 24,
  },
  empCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  empHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  empName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  empEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  empIdText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  statusToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#064e3b',
  },
  statusInactive: {
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  phoneText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
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
