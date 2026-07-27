import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { NavBar } from '../components/NavBar';
import { SmartDropdown } from '../components/SmartDropdown';
import { useAuth } from '../context/AuthContext';
import type { User } from '../services/api';

interface UserManagementProps {
  onBack: () => void;
  onLogout: () => void;
}

export default function UserManagement({ onBack, onLogout }: UserManagementProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'confirm';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createUser(newEmail, newRole);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewRole('admin');
      fetchUsers();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Error Adding User',
        message: err.message || 'Failed to add user',
        type: 'error'
      });
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiService.updateUser(user.id, { is_active: !user.is_active });
      fetchUsers();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Update Failed',
        message: err.message || 'Failed to update user status',
        type: 'error'
      });
    }
  };

  const handleRoleChange = async (user: User, newRole: 'admin' | 'super_admin') => {
    try {
      await apiService.updateUser(user.id, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Update Failed',
        message: err.message || 'Failed to update user role',
        type: 'error'
      });
    }
  };

  const handleDeleteUser = (user: User) => {
    setModalConfig({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete ${user.email}? This action cannot be undone.`,
      type: 'confirm',
      onConfirm: async () => {
        try {
          await apiService.deleteUser(user.id);
          if (currentUser && currentUser.email === user.email) {
            onLogout();
          } else {
            fetchUsers();
          }
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            title: 'Deletion Failed',
            message: err.message || 'Failed to delete user',
            type: 'error'
          });
        }
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans relative overflow-x-hidden">
      {/* Light-theme ambient decorative elements */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[550px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Navigation Bar */}
      <NavBar
        onLogoClick={onBack}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8 relative z-10 w-full">
        <div className="animate-fadeIn">
          {/* Header Block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <button
              onClick={onBack}
              className="hover:text-emerald-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-slate-700">User Management</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display mt-2">
            User Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage who has access to the application
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/10 transition-all hover:scale-[1.01] cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add User
        </button>
      </div>

      {error && <div className="text-red-600 bg-red-50 p-4 rounded-lg mb-6">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No users found.</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                        {user.first_name ? user.first_name[0].toUpperCase() : user.email[0].toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}` : 'Pending Login'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SmartDropdown
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'super_admin', label: 'Super Admin' }
                      ]}
                      value={user.role}
                      onChange={(value) => handleRoleChange(user, value as 'admin' | 'super_admin')}
                      placeholder="Select Role"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="text-rose-600 hover:text-rose-800 font-semibold bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </div>
      </main>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed z-[60] inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity backdrop-blur-sm bg-slate-900/50" aria-hidden="true" onClick={() => setIsAddModalOpen(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-100">
              <form onSubmit={handleAddUser}>
                <div className="bg-white px-6 pt-6 pb-6">
                  <h3 className="text-xl leading-6 font-semibold text-slate-900 mb-6 font-display">Add New Authorized User</h3>
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Google Email Address</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="block w-full border border-slate-200 rounded-xl shadow-sm py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-shadow"
                      placeholder="user@gmail.com"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                    <SmartDropdown
                      options={[
                        { value: 'admin', label: 'Admin' },
                        { value: 'super_admin', label: 'Super Admin' }
                      ]}
                      value={newRole}
                      onChange={(value) => setNewRole(value as 'admin' | 'super_admin')}
                      placeholder="Select Role"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-4 sm:px-6 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-5 py-2.5 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center rounded-xl shadow-sm px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                  >
                    Add User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* General Modal (Info, Error, Confirm) */}
      {modalConfig.isOpen && (
        <div className="fixed z-[70] inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity backdrop-blur-sm bg-slate-900/50" aria-hidden="true" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full border border-slate-100">
              <div className="bg-white px-6 pt-6 pb-6">
                <div className="sm:flex sm:items-start">
                  <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${
                    modalConfig.type === 'error' ? 'bg-rose-100 text-rose-600' :
                    modalConfig.type === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {modalConfig.type === 'error' && (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {modalConfig.type === 'confirm' && (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    {modalConfig.type === 'info' && (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-semibold text-slate-900">
                      {modalConfig.title}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        {modalConfig.message}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 flex justify-end gap-3 rounded-b-2xl">
                {modalConfig.type === 'confirm' && (
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className={`inline-flex justify-center rounded-xl shadow-sm px-4 py-2 text-sm font-semibold text-white transition-colors ${
                    modalConfig.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                    modalConfig.type === 'confirm' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                  onClick={() => {
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                    setModalConfig({ ...modalConfig, isOpen: false });
                  }}
                >
                  {modalConfig.type === 'confirm' ? 'Yes, Delete' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
