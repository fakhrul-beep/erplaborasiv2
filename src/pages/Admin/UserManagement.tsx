import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { Check, X, Search, Plus, Trash2, Edit, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

// Helper for audit logging
const logAudit = async (action: string, entity: string, entityId: string, details: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action,
      entity,
      entity_id: entityId,
      details
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sales'
  });

  useEffect(() => {
    fetchUsers();
  }, [page, sortColumn, sortOrder, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      // Search
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Sort
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (isEdit = false) => {
    if (!formData.name.trim()) return 'Name is required';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) return 'Valid email is required';
    
    if (!isEdit || formData.password) {
      if (!formData.password || formData.password.length < 8) return 'Password must be at least 8 characters';
      if (!/[A-Z]/.test(formData.password)) return 'Password must contain uppercase letter';
      if (!/[a-z]/.test(formData.password)) return 'Password must contain lowercase letter';
      if (!/[0-9]/.test(formData.password)) return 'Password must contain number';
    }
    
    return null;
  };

  const handleCreateUser = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_create_user', {
        new_email: formData.email,
        new_password: formData.password,
        new_role: formData.role,
        new_name: formData.name
      });

      if (error) throw error;

      await logAudit('create', 'user', data as string, { name: formData.name, email: formData.email, role: formData.role });
      
      toast.success('User created successfully');
      setIsAddModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    const error = validateForm(true);
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setLoading(true);
      const updateData: any = {
        target_user_id: selectedUser.id,
        new_email: formData.email !== selectedUser.email ? formData.email : null,
        new_name: formData.name !== selectedUser.name ? formData.name : null,
        new_role: formData.role !== selectedUser.role ? formData.role : null,
        new_password: formData.password || null
      };

      // Filter out nulls if RPC doesn't like them, but our RPC handles NULL defaults.
      // However, undefined vs null matters for JSON, but here we pass params.
      // RPC defined as DEFAULT NULL, so we pass null explicitly if no change.

      const { error } = await supabase.rpc('admin_update_user', updateData);

      if (error) throw error;

      await logAudit('update', 'user', selectedUser.id, { 
        changes: updateData
      });

      toast.success('User updated successfully');
      setIsEditModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      const { error } = await supabase.rpc('admin_delete_user', {
        target_user_id: selectedUser.id
      });

      if (error) throw error;

      await logAudit('delete', 'user', selectedUser.id, { email: selectedUser.email });

      toast.success('User deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_approved: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      await logAudit('update_status', 'user', userId, { is_approved: !currentStatus });

      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_approved: !currentStatus } : u
      ));
      toast.success(`User ${!currentStatus ? 'approved' : 'disapproved'} successfully`);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user status');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'sales' });
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '' // Don't fill password
    });
    setIsEditModalOpen(true);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <div className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const roles = [
    { value: 'superadmin', label: 'Superadmin' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'sales', label: 'Sales (General)' },
    { value: 'sales_equipment', label: 'Sales (Equipment)' },
    { value: 'sales_raw_material', label: 'Sales (Raw Material)' },
    { value: 'purchasing', label: 'Purchasing' },
    { value: 'finance', label: 'Finance' },
    { value: 'warehouse', label: 'Warehouse' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'logistik', label: 'Logistik' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        <button
          onClick={() => { resetForm(); setIsAddModalOpen(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add User
        </button>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        {/* Search */}
        <div className="mb-6 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        {/* Table */}
        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                        <div className="flex items-center">User <SortIcon column="name" /></div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('role')}>
                         <div className="flex items-center">Role <SortIcon column="role" /></div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('is_approved')}>
                         <div className="flex items-center">Status <SortIcon column="is_approved" /></div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created_at')}>
                         <div className="flex items-center">Joined <SortIcon column="created_at" /></div>
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading users...</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No users found.</td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                  <span className="text-primary font-medium text-lg">
                                    {user.name?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                               {user.role?.replace('_', ' ')}
                             </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.is_approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.is_approved ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(user.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                             <button
                               onClick={() => handleApprove(user.id, user.is_approved)}
                               className={`text-xs ${user.is_approved ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                             >
                               {user.is_approved ? 'Deactivate' : 'Activate'}
                             </button>
                             <button
                               onClick={() => openEditModal(user)}
                               className="text-primary hover:text-primary-hover"
                             >
                               <Edit className="h-4 w-4" />
                             </button>
                             <button
                               onClick={() => { setSelectedUser(user); setIsDeleteModalOpen(true); }}
                               className="text-red-600 hover:text-red-900"
                             >
                               <Trash2 className="h-4 w-4" />
                             </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
           <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> of <span className="font-medium">{totalCount}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage(p => (p * pageSize < totalCount ? p + 1 : p))}
                    disabled={page * pageSize >= totalCount}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
           </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isAddModalOpen ? "Add New User" : "Edit User"}
      >
         <div className="space-y-4">
            <div>
               <label className="block text-sm font-medium text-gray-700">Full Name</label>
               <input
                 type="text"
                 value={formData.name}
                 onChange={(e) => setFormData({...formData, name: e.target.value})}
                 className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2 px-3"
               />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700">Email Address</label>
               <input
                 type="email"
                 value={formData.email}
                 onChange={(e) => setFormData({...formData, email: e.target.value})}
                 className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2 px-3"
               />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700">
                  Password {isEditModalOpen && <span className="text-gray-500 text-xs">(Leave blank to keep unchanged)</span>}
               </label>
               <input
                 type="password"
                 value={formData.password}
                 onChange={(e) => setFormData({...formData, password: e.target.value})}
                 className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2 px-3"
                 placeholder={isAddModalOpen ? "Min 8 chars, A-Z, a-z, 0-9" : ""}
               />
               {isAddModalOpen && <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters with uppercase, lowercase, and number.</p>}
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700">Role</label>
               <select
                 value={formData.role}
                 onChange={(e) => setFormData({...formData, role: e.target.value})}
                 className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
               >
                 {roles.map(role => (
                   <option key={role.value} value={role.value}>{role.label}</option>
                 ))}
               </select>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
               <button
                 type="button"
                 onClick={isAddModalOpen ? handleCreateUser : handleUpdateUser}
                 disabled={loading}
                 className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary-hover focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
               >
                 {loading ? 'Saving...' : 'Save'}
               </button>
               <button
                 type="button"
                 onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                 className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
               >
                 Cancel
               </button>
            </div>
         </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
           <p className="text-sm text-gray-500">
             Are you sure you want to delete user <strong>{selectedUser?.name}</strong>? This action cannot be undone and might affect existing orders.
           </p>
           <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
             <button
               type="button"
               onClick={handleDeleteUser}
               className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
             >
               Delete
             </button>
             <button
               type="button"
               onClick={() => setIsDeleteModalOpen(false)}
               className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
             >
               Cancel
             </button>
           </div>
        </div>
      </Modal>
    </div>
  );
}
