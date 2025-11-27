import { useEffect, useState } from 'react';
import { supabase, UserBankDetails } from '../../lib/supabase';
import { Edit2, Save, X, Plus, Search } from 'lucide-react';

interface UserWithBankDetails {
  id: string;
  email: string;
  full_name?: string;
  bankDetails?: UserBankDetails;
}

export default function ManageUserBankDetails() {
  const [users, setUsers] = useState<UserWithBankDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankDetailsForm, setBankDetailsForm] = useState<{
    beneficiary: string;
    iban: string;
    bic: string;
    bank_name: string;
  }>({
    beneficiary: '',
    iban: '',
    bic: '',
    bank_name: '',
  });

  useEffect(() => {
    checkAdminStatus();
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('is_admin, is_manager, is_superiormanager')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (userData && (userData.is_admin || userData.is_manager || userData.is_superiormanager)) {
        setIsAdmin(true);
      }
    } catch (err) {
      console.error('Error checking admin status:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);

      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error('Auth error:', authError);
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) {
        console.error('Users error:', usersError);
      }

      const { data: bankDetailsData, error: bankError } = await supabase
        .from('user_bank_details')
        .select('*');

      if (bankError) {
        console.error('Bank details error:', bankError);
      }

      const combinedUsers: UserWithBankDetails[] = [];

      if (authUsers?.users) {
        authUsers.users.forEach((authUser) => {
          const userData = usersData?.find((u) => u.auth_user_id === authUser.id || u.id === authUser.id);
          const bankData = bankDetailsData?.find((b) => b.user_id === authUser.id);

          combinedUsers.push({
            id: authUser.id,
            email: authUser.email || '',
            full_name: userData?.full_name || authUser.user_metadata?.full_name,
            bankDetails: bankData,
          });
        });
      }

      setUsers(combinedUsers);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (user: UserWithBankDetails) => {
    setEditingUserId(user.id);
    setBankDetailsForm({
      beneficiary: user.bankDetails?.beneficiary || '',
      iban: user.bankDetails?.iban || '',
      bic: user.bankDetails?.bic || '',
      bank_name: user.bankDetails?.bank_name || '',
    });
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setBankDetailsForm({
      beneficiary: '',
      iban: '',
      bic: '',
      bank_name: '',
    });
  };

  const saveBankDetails = async (userId: string) => {
    try {
      const user = users.find((u) => u.id === userId);

      if (user?.bankDetails) {
        const { error: updateError } = await supabase
          .from('user_bank_details')
          .update({
            beneficiary: bankDetailsForm.beneficiary,
            iban: bankDetailsForm.iban,
            bic: bankDetailsForm.bic,
            bank_name: bankDetailsForm.bank_name,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          alert('Failed to update bank details: ' + updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_bank_details')
          .insert({
            user_id: userId,
            beneficiary: bankDetailsForm.beneficiary,
            iban: bankDetailsForm.iban,
            bic: bankDetailsForm.bic,
            bank_name: bankDetailsForm.bank_name,
          });

        if (insertError) {
          alert('Failed to create bank details: ' + insertError.message);
          return;
        }
      }

      cancelEditing();
      fetchUsers();
    } catch (err) {
      alert('An unexpected error occurred');
      console.error(err);
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query)
    );
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-12 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-12 flex items-center justify-center">
        <div className="text-gray-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Manage User Bank Details
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26623] focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Bank Details</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <div className="space-y-2 max-w-md">
                            <input
                              type="text"
                              placeholder="Beneficiary"
                              value={bankDetailsForm.beneficiary}
                              onChange={(e) =>
                                setBankDetailsForm({ ...bankDetailsForm, beneficiary: e.target.value })
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26623]"
                            />
                            <input
                              type="text"
                              placeholder="IBAN"
                              value={bankDetailsForm.iban}
                              onChange={(e) =>
                                setBankDetailsForm({ ...bankDetailsForm, iban: e.target.value })
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26623]"
                            />
                            <input
                              type="text"
                              placeholder="BIC/SWIFT"
                              value={bankDetailsForm.bic}
                              onChange={(e) =>
                                setBankDetailsForm({ ...bankDetailsForm, bic: e.target.value })
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26623]"
                            />
                            <input
                              type="text"
                              placeholder="Bank Name"
                              value={bankDetailsForm.bank_name}
                              onChange={(e) =>
                                setBankDetailsForm({ ...bankDetailsForm, bank_name: e.target.value })
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F26623]"
                            />
                          </div>
                        ) : user.bankDetails ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{user.bankDetails.beneficiary}</div>
                            <div className="text-gray-600">IBAN: {user.bankDetails.iban}</div>
                            <div className="text-gray-600">BIC: {user.bankDetails.bic}</div>
                            <div className="text-gray-600">Bank: {user.bankDetails.bank_name}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">No bank details set</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {editingUserId === user.id ? (
                            <>
                              <button
                                onClick={() => saveBankDetails(user.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEditing(user)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F26623] text-white text-xs font-medium rounded hover:bg-[#D94F0F] transition-colors"
                            >
                              {user.bankDetails ? (
                                <>
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  Add Details
                                </>
                              )}
                            </button>
                          )}
                        </div>
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
  );
}
