import { ArrowLeft, Copy, Building2, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, FundAccount } from '../../lib/supabase';

interface BankTransferFormProps {
  onBack: () => void;
}


export default function BankTransferForm({ onBack }: BankTransferFormProps) {
  const [currentStep, setCurrentStep] = useState(2);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    amount: '',
    termsAccepted: false,
    bankTransferAware: false,
  });
  const [bankDetails, setBankDetails] = useState({
    beneficiary: '',
    iban: '',
    bic: '',
    bank: '',
    reference: 'REF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<FundAccount[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  useEffect(() => {
    const fetchUserBankDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: bankData, error: bankError } = await supabase
            .from('user_bank_details')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (bankData) {
            setBankDetails(prev => ({
              ...prev,
              beneficiary: bankData.beneficiary,
              iban: bankData.iban,
              bic: bankData.bic,
              bank: bankData.bank_name,
            }));
          }
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserBankDetails();
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setIsLoadingPending(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoadingPending(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('fund_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('funding_method', 'bank')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!fetchError && data) {
        setPendingRequests(data);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    } finally {
      setIsLoadingPending(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.email || !formData.amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.termsAccepted || !formData.bankTransferAware) {
      setError('Please accept both terms and conditions');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be logged in to fund your account');
        setIsSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('fund_accounts')
        .insert({
          user_id: user.id,
          funding_method: 'bank',
          status: 'pending',
          amount: parseFloat(formData.amount) || 0,
          currency: 'EUR',
          user_name: formData.name,
          user_email: formData.email,
          bank_beneficiary: bankDetails.beneficiary,
          bank_iban: bankDetails.iban,
          bank_bic: bankDetails.bic,
          bank_name: bankDetails.bank,
          reference_number: bankDetails.reference,
        });

      if (insertError) {
        setError('Failed to submit funding request: ' + insertError.message);
        setIsSubmitting(false);
        return;
      }

      setCurrentStep(3);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Fund Account
          </h1>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 bg-[#0A7F8D] text-white rounded-lg hover:bg-[#0A7F8D] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
        </div>

        {/* Pending Requests Alert */}
        {!isLoadingPending && pendingRequests.length > 0 && currentStep !== 3 && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-6 mb-8 rounded-r-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  You have {pendingRequests.length} pending bank transfer {pendingRequests.length === 1 ? 'request' : 'requests'}
                </h3>
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="bg-white rounded-lg p-4 border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {request.amount} {request.currency}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        Reference: <span className="font-mono font-semibold">{request.reference_number}</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Submitted on {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-amber-800 mt-3">
                  Your previous requests are being processed. You can submit a new request if needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Transfer Pending
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Your bank transfer request has been received. Please complete the bank transfer using the provided details. Processing typically takes 1-3 business days.
              </p>
              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>Initiate the bank transfer from your bank account using the provided details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>Include the reference number to ensure proper crediting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>You will receive an email notification once funds are received and credited</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>Your account balance will be updated automatically</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={onBack}
                className="px-8 py-3 bg-[#0A7F8D] text-white rounded-lg hover:bg-[#0A7F8D] transition-colors font-medium"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Main Content */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Side - Form */}
              <div className="bg-gray-100 rounded-2xl p-8 md:p-12">
                <h2 className="text-2xl font-semibold text-gray-900 mb-8">
                  Please fill out the fields below
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Your Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      placeholder="john@mail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                      Amount
                    </label>
                    <input
                      type="text"
                      id="amount"
                      placeholder="EUR"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A7F8D] focus:border-transparent"
                    />
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={formData.termsAccepted}
                      onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-[#0A7F8D] focus:ring-[#0A7F8D]"
                    />
                    <label htmlFor="terms" className="text-sm text-gray-700">
                      I am 18 years of age or older and agree to the{' '}
                      <a href="#" className="text-[#0A7F8D] hover:underline">
                        Terms and Conditions
                      </a>
                      .
                    </label>
                  </div>

                  {/* Bank Transfer Awareness Checkbox */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="bankTransfer"
                      checked={formData.bankTransferAware}
                      onChange={(e) => setFormData({ ...formData, bankTransferAware: e.target.checked })}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-[#0A7F8D] focus:ring-[#0A7F8D]"
                    />
                    <label htmlFor="bankTransfer" className="text-sm text-gray-700">
                      I understand that bank transfers may take 1-3 business days to process and I am responsible for using the correct reference number.
                    </label>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Continue Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoading}
                    className="w-full md:w-auto px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Processing...' : isLoading ? 'Loading...' : 'Continue'}
                  </button>
                </form>
              </div>

              {/* Right Side - Bank Details */}
              <div className="bg-white rounded-2xl p-8 md:p-12">
                <div className="w-full max-w-md mx-auto">
                  {/* Bank Icon */}
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                      <Building2 className="w-10 h-10 text-gray-600" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                    Bank Transfer Details
                  </h3>

                  <div className="space-y-4">
                    {/* Beneficiary */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Beneficiary
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-900 font-medium">{bankDetails.beneficiary}</span>
                        <button
                          onClick={() => handleCopy(bankDetails.beneficiary)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Copy beneficiary"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* IBAN */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        IBAN
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-900 font-medium font-mono text-sm">{bankDetails.iban}</span>
                        <button
                          onClick={() => handleCopy(bankDetails.iban.replace(/\s/g, ''))}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Copy IBAN"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* BIC/SWIFT */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        BIC/SWIFT
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-900 font-medium font-mono">{bankDetails.bic}</span>
                        <button
                          onClick={() => handleCopy(bankDetails.bic)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Copy BIC"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* Bank Name */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Bank Name
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-900 font-medium">{bankDetails.bank}</span>
                        <button
                          onClick={() => handleCopy(bankDetails.bank)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Copy bank name"
                        >
                          <Copy className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Amount Display */}
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <button className="px-4 py-2 bg-[#0A7F8D] text-white rounded-lg text-sm font-medium">
                      Amount
                    </button>
                    <span className="text-lg font-semibold">
                      {formData.amount || '0'} EUR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="mt-8 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0A7F8D] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  1
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${currentStep >= 2 ? 'bg-[#0A7F8D]' : 'bg-gray-300'}`}>
                  2
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${currentStep >= 3 ? 'bg-[#0A7F8D]' : 'bg-gray-300'}`}>
                  3
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
