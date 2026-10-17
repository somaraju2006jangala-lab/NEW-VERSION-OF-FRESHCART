import React, { useState, useEffect, useMemo } from 'react';
import {
  AuthorizedEmployee,
  fetchRegisteredEmployees,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  resetEmployeePassword,
  deleteEmployee,
} from '../services/employeeService';
import { AuthorizedAdmin } from '../services/adminService';
import {
  UserCheck,
  UserPlus,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Mail,
  Phone,
  Shield,
  Key,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  User,
  Hash,
  X,
} from 'lucide-react';
import { formatOrderDateTime } from '../utils/date';

interface AdminEmployeeManagementProps {
  currentAdmin?: AuthorizedAdmin | null;
}

export const AdminEmployeeManagement: React.FC<AdminEmployeeManagementProps> = ({ currentAdmin }) => {
  const [employees, setEmployees] = useState<AuthorizedEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addFullName, setAddFullName] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addMobile, setAddMobile] = useState<string>('');
  const [addUsername, setAddUsername] = useState<string>('');
  const [addEmployeeId, setAddEmployeeId] = useState<string>('');
  const [addPassword, setAddPassword] = useState<string>('');
  const [showAddPassword, setShowAddPassword] = useState<boolean>(false);
  const [addStatus, setAddStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState<AuthorizedEmployee | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editMobile, setEditMobile] = useState<string>('');
  const [editUsername, setEditUsername] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Reset Password Modal
  const [resettingEmployee, setResettingEmployee] = useState<AuthorizedEmployee | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState<boolean>(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deletingEmployee, setDeletingEmployee] = useState<AuthorizedEmployee | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Status toggle in-progress ID
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load employee directory from backend
  const loadEmployees = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchRegisteredEmployees();
      if (res.success) {
        setEmployees(res.employees);
      } else {
        setErrorMessage(res.error || 'Failed to load employees.');
      }
    } catch {
      setErrorMessage('Network error while retrieving employees.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4500);
  };

  // Auto-generate employee ID helper
  const handleAutoGenerateId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setAddEmployeeId(`EMP-${randomNum}`);
  };

  // Submit Add Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddModalError(null);

    const name = addFullName.trim();
    const email = addEmail.trim().toLowerCase();
    const pass = addPassword;
    const mobile = addMobile.trim();
    const user = addUsername.trim();
    const empId = addEmployeeId.trim();

    if (!name) {
      setAddModalError('Please enter the employee full name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setAddModalError('Please enter a valid email address.');
      return;
    }
    if (!pass || pass.length < 6) {
      setAddModalError('Assigned password must be at least 6 characters long.');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await createEmployee({
        fullName: name,
        email,
        mobile: mobile || undefined,
        username: user || undefined,
        password: pass,
        employeeId: empId || undefined,
        status: addStatus,
      });

      if (res.success && res.employee) {
        setShowAddModal(false);
        setAddFullName('');
        setAddEmail('');
        setAddMobile('');
        setAddUsername('');
        setAddEmployeeId('');
        setAddPassword('');
        setAddStatus('active');
        showNotification(`Employee ${res.employee.fullName} (${res.employee.employeeId}) registered successfully.`);
        await loadEmployees();
      } else {
        setAddModalError(res.error || 'Failed to create employee account.');
      }
    } catch {
      setAddModalError('Unexpected error occurred creating employee account.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (emp: AuthorizedEmployee) => {
    setEditingEmployee(emp);
    setEditFullName(emp.fullName);
    setEditEmail(emp.email);
    setEditMobile(emp.mobile || '');
    setEditUsername(emp.username || '');
    setEditStatus(emp.status);
    setEditModalError(null);
  };

  // Submit Edit Employee
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setEditModalError(null);

    const name = editFullName.trim();
    const email = editEmail.trim().toLowerCase();
    const mobile = editMobile.trim();
    const user = editUsername.trim();

    if (!name) {
      setEditModalError('Full name cannot be empty.');
      return;
    }
    if (!email || !email.includes('@')) {
      setEditModalError('Valid email address is required.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await updateEmployee(editingEmployee.employeeId, {
        fullName: name,
        email,
        mobile: mobile || '',
        username: user || '',
        status: editStatus,
      });

      if (res.success && res.employee) {
        setEditingEmployee(null);
        showNotification(`Employee details for ${res.employee.fullName} updated successfully.`);
        await loadEmployees();
      } else {
        setEditModalError(res.error || 'Failed to update employee details.');
      }
    } catch {
      setEditModalError('Unexpected error occurred updating employee.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Toggle Active / Inactive
  const handleToggleStatus = async (emp: AuthorizedEmployee) => {
    const nextStatus = emp.status === 'active' ? 'inactive' : 'active';
    setTogglingId(emp.employeeId);
    setErrorMessage(null);
    try {
      const res = await toggleEmployeeStatus(emp.employeeId, nextStatus);
      if (res.success) {
        showNotification(`Employee ${emp.fullName} account has been ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
        await loadEmployees();
      } else {
        setErrorMessage(res.error || 'Failed to update employee status.');
      }
    } catch {
      setErrorMessage('Network error updating employee status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (emp: AuthorizedEmployee) => {
    setResettingEmployee(emp);
    setResetPasswordVal('');
    setShowResetPassword(false);
    setResetModalError(null);
  };

  // Submit Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingEmployee) return;
    setResetModalError(null);

    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      setResetModalError('New password must be at least 6 characters long.');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await resetEmployeePassword(resettingEmployee.employeeId, resetPasswordVal);
      if (res.success) {
        setResettingEmployee(null);
        showNotification(`Password for ${resettingEmployee.fullName} (${resettingEmployee.employeeId}) has been reset securely.`);
      } else {
        setResetModalError(res.error || 'Failed to reset employee password.');
      }
    } catch {
      setResetModalError('Unexpected error resetting employee password.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Delete Employee Confirmation
  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setIsSubmittingDelete(true);
    setErrorMessage(null);
    try {
      const res = await deleteEmployee(deletingEmployee.employeeId);
      if (res.success) {
        showNotification(`Employee ${deletingEmployee.fullName} (${deletingEmployee.employeeId}) permanently deleted.`);
        setDeletingEmployee(null);
        await loadEmployees();
      } else {
        setErrorMessage(res.error || 'Failed to delete employee account.');
      }
    } catch {
      setErrorMessage('Unexpected error deleting employee account.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.fullName.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.mobile && emp.mobile.includes(q)) ||
        (emp.username && emp.username.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' || emp.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.filter((e) => e.status === 'inactive').length;

  return (
    <div className="space-y-6">
      {/* Header & Controls Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
          <div>
            <h3 className="text-[18px] font-bold text-[#0b1c30] font-display flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#006b2c]" />
              <span>Employee Management</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Operations Team
              </span>
            </h3>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Provision, monitor, edit, and manage authorized employee accounts for the FreshCart Customer Orders Ledger.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-refresh-employees"
              onClick={loadEmployees}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e8f0] text-[#0b1c30] hover:bg-[#f8fafc] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh employee directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${isLoading ? 'animate-spin text-[#006b2c]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              id="btn-add-employee"
              onClick={() => {
                setAddModalError(null);
                setAddFullName('');
                setAddEmail('');
                setAddMobile('');
                setAddUsername('');
                setAddEmployeeId('');
                setAddPassword('');
                setAddStatus('active');
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[12px] font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 cursor-pointer"
              title="Register a new employee"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-[#64748b] font-medium block">Total Employees</span>
                <span className="text-[16px] font-bold text-[#0b1c30]">{employees.length}</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#64748b] bg-white px-2 py-0.5 rounded-md border border-[#e2e8f0]">
              Staff
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-[#64748b] font-medium block">Active Accounts</span>
                <span className="text-[16px] font-bold text-emerald-700">{activeCount}</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Authorized
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-[#64748b] font-medium block">Inactive / Deactivated</span>
                <span className="text-[16px] font-bold text-amber-700">{inactiveCount}</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              Restricted
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              id="employee-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, employee ID, username, or phone..."
              className="w-full pl-9 pr-3 py-2 text-[12px] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:outline-hidden focus:border-[#006b2c] focus:bg-white text-[#0b1c30] placeholder-[#94a3b8] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#64748b] font-medium">Status:</span>
            <div className="inline-flex rounded-xl p-1 bg-[#f1f5f9] border border-[#e2e8f0]">
              {(['all', 'active', 'inactive'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                    statusFilter === filter
                      ? 'bg-white text-[#006b2c] shadow-xs'
                      : 'text-[#64748b] hover:text-[#0b1c30]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-[12px] flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#059669] shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-[#059669] hover:text-[#047857] cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[12px] flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-[#dc2626] hover:text-[#b91c1c] cursor-pointer">
              &times;
            </button>
          </div>
        )}

        {/* Employees Directory Table */}
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Employee Personnel</th>
                <th className="py-3 px-4">Account Identifiers</th>
                <th className="py-3 px-4">Access Scope</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] bg-white">
              {isLoading && employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#64748b]">
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-5 h-5 border-2 border-[#006b2c]/30 border-t-[#006b2c] rounded-full animate-spin" />
                      <span>Loading registered employees from MySQL database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#64748b]">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No employees match the applied filter criteria.'
                      : 'No employees registered yet. Click "Add Employee" to register staff.'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isToggling = togglingId === emp.employeeId;
                  return (
                    <tr
                      key={emp.employeeId}
                      id={`employee-row-${emp.employeeId}`}
                      className="hover:bg-[#f8fafc]/80 transition-colors"
                    >
                      {/* Personnel Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-[12px] shrink-0">
                            {emp.fullName ? emp.fullName.charAt(0).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                              <span>{emp.fullName}</span>
                              {emp.username && (
                                <span className="text-[10px] font-mono text-[#006b2c] bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  @{emp.username}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#64748b]">FreshCart Operations Staff</div>
                          </div>
                        </div>
                      </td>

                      {/* Identifiers: Email, Mobile, Employee ID */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-[#0b1c30] flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#94a3b8] shrink-0" />
                            <span>{emp.email}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-[#006b2c] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              ID: {emp.employeeId}
                            </span>
                            {emp.mobile && (
                              <span className="text-[10px] font-mono text-[#64748b] flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-[#94a3b8]" />
                                {emp.mobile}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Access Scope */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Shield className="w-2.5 h-2.5 text-blue-600" />
                            <span>Employee Role</span>
                          </span>
                          <span className="text-[10px] text-[#64748b] block">Customer Orders Ledger Only</span>
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        {emp.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-[#64748b] text-[11px]">
                        {emp.createdAt ? formatOrderDateTime(emp.createdAt) : 'Initial Setup'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details */}
                          <button
                            type="button"
                            id={`btn-edit-employee-${emp.employeeId}`}
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-[#006b2c] hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors cursor-pointer"
                            title="Edit employee details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            id={`btn-reset-password-${emp.employeeId}`}
                            onClick={() => openResetPasswordModal(emp)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 transition-colors cursor-pointer"
                            title="Reset employee password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Activate / Deactivate Toggle */}
                          <button
                            type="button"
                            id={`btn-toggle-employee-${emp.employeeId}`}
                            disabled={isToggling}
                            onClick={() => handleToggleStatus(emp)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              emp.status === 'active'
                                ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                            title={
                              emp.status === 'active'
                                ? 'Deactivate employee account (blocks login & revokes active sessions)'
                                : 'Activate employee account'
                            }
                          >
                            {isToggling ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                            ) : emp.status === 'active' ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            id={`btn-delete-employee-${emp.employeeId}`}
                            onClick={() => setDeletingEmployee(emp)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Permanently remove employee"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD EMPLOYEE MODAL (Black Liquid-Glass Opaque Theme) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div
            className="relative rounded-2xl border border-white/15 max-w-lg w-full overflow-hidden animate-in zoom-in-95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_1px_1px_rgba(255,255,255,0.08),inset_0_1px_1px_0_rgba(255,255,255,0.14)]"
            style={{
              background: 'linear-gradient(165deg, #0e131d 0%, #080b11 50%, #030508 100%)',
            }}
          >
            {/* Top liquid specular highlight hairline */}
            <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

            {/* Modal Header */}
            <div
              className="p-5 border-b border-white/10 flex items-center justify-between relative"
              style={{
                background: 'linear-gradient(180deg, rgba(19, 26, 38, 0.95) 0%, rgba(12, 16, 23, 0.98) 100%)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-950/70 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-white tracking-tight">Add New Employee</h4>
                  <p className="text-[11px] text-slate-400">Create an operations account for the Customer Orders Ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 active:bg-white/15 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-5 space-y-4">
              {addModalError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-200 text-[12px] flex items-center gap-2 backdrop-blur-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{addModalError}</span>
                </div>
              )}

              {/* Employee ID with Auto-generate option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="add-employee-id" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span>Employee ID (Optional / Auto-generated)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateId}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-emerald-950/40 border border-emerald-500/20 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto Generate</span>
                  </button>
                </div>
                <input
                  id="add-employee-id"
                  type="text"
                  value={addEmployeeId}
                  onChange={(e) => setAddEmployeeId(e.target.value)}
                  placeholder="e.g. EMP-1042 (leave blank to auto-generate)"
                  className="w-full px-3 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden font-mono shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                />
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="add-employee-name" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name *</span>
                </label>
                <input
                  id="add-employee-name"
                  type="text"
                  required
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                />
              </div>

              {/* Email & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="add-employee-email" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email Address *</span>
                  </label>
                  <input
                    id="add-employee-email"
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="priya@freshcart.com"
                    className="w-full px-3 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="add-employee-mobile" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mobile Number</span>
                  </label>
                  <input
                    id="add-employee-mobile"
                    type="tel"
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                  />
                </div>
              </div>

              {/* Username (Optional for Login) */}
              <div>
                <label htmlFor="add-employee-username" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <span>Username (Optional Login Handle)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[12px]">@</span>
                  <input
                    id="add-employee-username"
                    type="text"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    placeholder="priya_ops (optional login username)"
                    className="w-full pl-7 pr-3 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden font-mono shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="add-employee-password" className="text-[12px] font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assigned Password * (min. 6 characters)</span>
                </label>
                <div className="relative">
                  <input
                    id="add-employee-password"
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Enter secure initial password"
                    className="w-full pl-3 pr-10 py-2 text-[12px] rounded-xl bg-[#070a0f] text-white placeholder:text-slate-500 border border-white/12 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 focus:outline-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    title={showAddPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Initial Status */}
              <div>
                <span className="text-[12px] font-semibold text-slate-300 block mb-1.5">Initial Account Status</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      addStatus === 'active'
                        ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
                        : 'bg-[#070a0f] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="add-status"
                      checked={addStatus === 'active'}
                      onChange={() => setAddStatus('active')}
                      className="accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-emerald-300 text-[12px] block">Active</span>
                      <span className="text-[10px] text-slate-400 block">Can sign in immediately</span>
                    </div>
                  </label>
                  <label
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      addStatus === 'inactive'
                        ? 'bg-rose-950/30 border-rose-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]'
                        : 'bg-[#070a0f] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="add-status"
                      checked={addStatus === 'inactive'}
                      onChange={() => setAddStatus('inactive')}
                      className="accent-rose-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-rose-300 text-[12px] block">Inactive</span>
                      <span className="text-[10px] text-slate-400 block">Deactivated by default</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-add-employee"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-bold transition-all shadow-[0_2px_10px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingAdd ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT EMPLOYEE MODAL */}
      {/* ========================================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#0b1c30]">Edit Employee Details</h4>
                  <p className="text-[11px] text-[#64748b]">ID: {editingEmployee.employeeId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="text-[#94a3b8] hover:text-[#0b1c30] p-1 rounded-lg hover:bg-[#e2e8f0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="p-5 space-y-4">
              {editModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[12px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editModalError}</span>
                </div>
              )}

              <div>
                <label htmlFor="edit-employee-name" className="text-[12px] font-bold text-[#0b1c30] block mb-1">
                  Full Name *
                </label>
                <input
                  id="edit-employee-name"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#cbd5e1] focus:border-[#006b2c] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-employee-email" className="text-[12px] font-bold text-[#0b1c30] block mb-1">
                    Email Address *
                  </label>
                  <input
                    id="edit-employee-email"
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#cbd5e1] focus:border-[#006b2c] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor="edit-employee-mobile" className="text-[12px] font-bold text-[#0b1c30] block mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="edit-employee-mobile"
                    type="tel"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-[12px] rounded-xl border border-[#cbd5e1] focus:border-[#006b2c] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-employee-username" className="text-[12px] font-bold text-[#0b1c30] block mb-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] font-mono text-[12px]">@</span>
                  <input
                    id="edit-employee-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-2 text-[12px] rounded-xl border border-[#cbd5e1] focus:border-[#006b2c] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <span className="text-[12px] font-bold text-[#0b1c30] block mb-1.5">Account Status</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={editStatus === 'active'}
                      onChange={() => setEditStatus('active')}
                      className="text-[#006b2c] focus:ring-[#006b2c]"
                    />
                    <span className="font-semibold text-emerald-800">Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input
                      type="radio"
                      name="edit-status"
                      checked={editStatus === 'inactive'}
                      onChange={() => setEditStatus('inactive')}
                      className="text-[#006b2c] focus:ring-[#006b2c]"
                    />
                    <span className="font-semibold text-rose-800">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-edit-employee"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[12px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      {resettingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-[#0b1c30]">Reset Employee Password</h4>
                  <p className="text-[11px] text-[#64748b]">{resettingEmployee.fullName} ({resettingEmployee.employeeId})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResettingEmployee(null)}
                className="text-[#94a3b8] hover:text-[#0b1c30] p-1 rounded-lg hover:bg-[#e2e8f0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              {resetModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[12px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{resetModalError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  Security Invalidation Notice
                </p>
                <p>
                  Resetting the password will hash the new credential securely and immediately revoke any existing active login sessions for this employee.
                </p>
              </div>

              <div>
                <label htmlFor="reset-employee-password" className="text-[12px] font-bold text-[#0b1c30] block mb-1">
                  New Password * (min. 6 characters)
                </label>
                <div className="relative">
                  <input
                    id="reset-employee-password"
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    placeholder="Enter new secure password"
                    className="w-full pl-3 pr-10 py-2 text-[12px] rounded-xl border border-[#cbd5e1] focus:border-[#006b2c] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0b1c30] cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setResettingEmployee(null)}
                  className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-reset-password"
                  disabled={isSubmittingReset}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReset ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE EMPLOYEE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-[#0b1c30]">Remove Employee Account</h4>
                <p className="text-[12px] text-[#64748b]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-[12px] text-[#334155]">
              Are you sure you want to permanently delete the employee account for{' '}
              <strong className="text-[#0b1c30]">{deletingEmployee.fullName}</strong> ({deletingEmployee.employeeId})?
              They will no longer be able to log in or access the Employee Portal.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-employee"
                disabled={isSubmittingDelete}
                onClick={handleDeleteEmployee}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDelete ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
