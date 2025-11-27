import { useEffect, useState } from 'react';
import { supabase, FundAccount, User } from '../../lib/supabase';
import { Check, Clock, Edit2, X } from 'lucide-react';

export default function ManageFundRequests() {
  const [fundRequests, setFundRequests] = useState<FundAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingBankDetails, setEditingBankDetails] = useState<{ [key: string]: boolean }>({});
  const [bankDetailsForm, setBankDetailsForm] = useState<{ [key: string]: { beneficiary: string; iban: string; bic: string; bank: string } }>({});

  useEffect(() => {
    checkAdminStatus();
    fetchFundRequests();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

  const fetchFundRequests = async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('fund_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError('Failed to fetch fund requests: ' + fetchError.message);
        return;
      }

      setFundRequests(data || []);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'pending' | 'success') => {
    try {
      const { error: updateError } = await supabase
        .from('fund_accounts')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) {
        alert('Failed to update status: ' + updateError.message);
        return;
      }

      fetchFundRequests();
    } catch (err) {
      alert('An unexpected error occurred');
      console.error(err);
    }
  };

  const toggleEditBankDetails = (id: string, request: FundAccount) => {
    if (editingBankDetails[id]) {
      setEditingBankDetails({ ...editingBankDetails, [id]: false });
    } else {
      setEditingBankDetails({ ...editingBankDetails, [id]: true });
      setBankDetailsForm({
        ...bankDetailsForm,
        [id]: {
          beneficiary: request.bank_beneficiary || '',
          iban: request.bank_iban || '',
          bic: request.bank_bic || '',
          bank: request.bank_name || '',
        },
      });
    }
  };

  const saveBankDetails = async (id: string) => {
    try {
      const details = bankDetailsForm[id];
      const { error: updateError } = await supabase
        .from('fund_accounts')
        .update({
          bank_beneficiary: details.beneficiary,
          bank_iban: details.iban,
          bank_bic: details.bic,
          bank_name: details.bank,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        alert('Failed to update bank details: ' + updateError.message);
        return;
      }

      setEditingBankDetails({ ...editingBankDetails, [id]: false });
      fetchFundRequests();
    } catch (err) {
      alert('An unexpected error occurred');
      console.error(err);
    }
  };

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
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-12">
          Manage Fund Requests
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Method</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Details</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fundRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No fund requests found
                    </td>
                  </tr>
                ) : (
                  fundRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{request.user_name}</div>
                        <div className="text-sm text-gray-500">{request.user_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {request.funding_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {request.amount} {request.currency}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {request.status === 'success' ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {request.funding_method === 'crypto' ? (
                          <div>
                            <div className="font-medium text-gray-900">{request.crypto_type}</div>
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {request.crypto_address}
                            </div>
                          </div>
                        ) : (
                          <div>
                            {editingBankDetails[request.id] ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Beneficiary"
                                  value={bankDetailsForm[request.id]?.beneficiary || ''}
                                  onChange={(e) =>
                                    setBankDetailsForm({
                                      ...bankDetailsForm,
                                      [request.id]: {
                                        ...bankDetailsForm[request.id],
                                        beneficiary: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="IBAN"
                                  value={bankDetailsForm[request.id]?.iban || ''}
                                  onChange={(e) =>
                                    setBankDetailsForm({
                                      ...bankDetailsForm,
                                      [request.id]: {
                                        ...bankDetailsForm[request.id],
                                        iban: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="BIC"
                                  value={bankDetailsForm[request.id]?.bic || ''}
                                  onChange={(e) =>
                                    setBankDetailsForm({
                                      ...bankDetailsForm,
                                      [request.id]: {
                                        ...bankDetailsForm[request.id],
                                        bic: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                                <input
                                  type="text"
                                  placeholder="Bank Name"
                                  value={bankDetailsForm[request.id]?.bank || ''}
                                  onChange={(e) =>
                                    setBankDetailsForm({
                                      ...bankDetailsForm,
                                      [request.id]: {
                                        ...bankDetailsForm[request.id],
                                        bank: e.target.value,
                                      },
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium text-gray-900">
                                  {request.bank_beneficiary || 'Not set'}
                                </div>
                                <div className="text-xs text-gray-500">{request.bank_iban || 'No IBAN'}</div>
                                <div className="text-xs text-gray-500">{request.bank_name || 'No bank'}</div>
                                <div className="text-xs font-mono text-gray-600">Ref: {request.reference_number}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {request.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(request.id, 'success')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                          )}
                          {request.status === 'success' && (
                            <button
                              onClick={() => updateStatus(request.id, 'pending')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 transition-colors"
                            >
                              <Clock className="w-3 h-3" />
                              Set Pending
                            </button>
                          )}
                          {request.funding_method === 'bank' && (
                            <button
                              onClick={() =>
                                editingBankDetails[request.id]
                                  ? saveBankDetails(request.id)
                                  : toggleEditBankDetails(request.id, request)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                            >
                              {editingBankDetails[request.id] ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Save
                                </>
                              ) : (
                                <>
                                  <Edit2 className="w-3 h-3" />
                                  Edit Bank
                                </>
                              )}
                            </button>
                          )}
                          {editingBankDetails[request.id] && (
                            <button
                              onClick={() => toggleEditBankDetails(request.id, request)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Cancel
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
