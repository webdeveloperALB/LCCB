import { ArrowLeft, Copy, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, FundAccount, CryptoWallet } from '../../lib/supabase';

interface CryptoFundingFormProps {
  onBack: () => void;
}

type CryptoType = 'btc' | 'eth' | 'usdt-erc' | 'usdt-trc';

interface WalletData {
  address: string;
  label: string;
  symbol: string;
  uri: string;
}

type WalletsMap = Record<CryptoType, WalletData>;

export default function CryptoFundingForm({ onBack }: CryptoFundingFormProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>('btc');
  const [currentStep, setCurrentStep] = useState(2);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    amount: '',
    termsAccepted: false,
    blockchainAware: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<FundAccount[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);
  const [wallets, setWallets] = useState<WalletsMap>({
    btc: { address: '', label: 'Bitcoin (BTC)', symbol: 'BTC', uri: '' },
    eth: { address: '', label: 'Ethereum (ETH)', symbol: 'ETH', uri: '' },
    'usdt-erc': { address: '', label: 'USDT/USDC (ERC-20)', symbol: 'USDT', uri: '' },
    'usdt-trc': { address: '', label: 'USDT (TRC-20)', symbol: 'USDT', uri: '' },
  });
  const [isLoadingWallets, setIsLoadingWallets] = useState(true);

  useEffect(() => {
    fetchPendingRequests();
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setIsLoadingWallets(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: fetchError } = await supabase
        .from('crypto_wallets')
        .select('*')
        .eq('is_active', true);

      if (!fetchError && data) {
        const walletsData: WalletsMap = {
          btc: { address: '', label: 'Bitcoin (BTC)', symbol: 'BTC', uri: '' },
          eth: { address: '', label: 'Ethereum (ETH)', symbol: 'ETH', uri: '' },
          'usdt-erc': { address: '', label: 'USDT/USDC (ERC-20)', symbol: 'USDT', uri: '' },
          'usdt-trc': { address: '', label: 'USDT (TRC-20)', symbol: 'USDT', uri: '' },
        };

        const userSpecificWallets = data.filter((w: CryptoWallet) => w.user_id === user?.id);
        const defaultWallets = data.filter((w: CryptoWallet) => w.user_id === null);

        const walletsToUse = userSpecificWallets.length > 0 ? userSpecificWallets : defaultWallets;

        walletsToUse.forEach((wallet: CryptoWallet) => {
          if (wallet.crypto_type === 'bitcoin') {
            walletsData.btc = {
              address: wallet.wallet_address,
              label: wallet.label,
              symbol: wallet.symbol,
              uri: `bitcoin:${wallet.wallet_address}`
            };
          } else if (wallet.crypto_type === 'ethereum') {
            walletsData.eth = {
              address: wallet.wallet_address,
              label: wallet.label,
              symbol: wallet.symbol,
              uri: `ethereum:${wallet.wallet_address}`
            };
          } else if (wallet.crypto_type === 'usdt_erc20') {
            walletsData['usdt-erc'] = {
              address: wallet.wallet_address,
              label: wallet.label,
              symbol: wallet.symbol,
              uri: `ethereum:${wallet.wallet_address}`
            };
          } else if (wallet.crypto_type === 'usdt_trc20') {
            walletsData['usdt-trc'] = {
              address: wallet.wallet_address,
              label: wallet.label,
              symbol: wallet.symbol,
              uri: `tron:${wallet.wallet_address}`
            };
          }
        });

        setWallets(walletsData);
      }
    } catch (err) {
      console.error('Error fetching wallets:', err);
    } finally {
      setIsLoadingWallets(false);
    }
  };

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
        .eq('funding_method', 'crypto')
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

  const currentWallet = wallets[selectedCrypto];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentWallet.address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.email || !formData.amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.termsAccepted || !formData.blockchainAware) {
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

      let cryptoType: 'bitcoin' | 'ethereum' | 'tron';
      if (selectedCrypto === 'btc') cryptoType = 'bitcoin';
      else if (selectedCrypto === 'eth' || selectedCrypto === 'usdt-erc') cryptoType = 'ethereum';
      else cryptoType = 'tron';

      const { error: insertError } = await supabase
        .from('fund_accounts')
        .insert({
          user_id: user.id,
          funding_method: 'crypto',
          status: 'pending',
          amount: parseFloat(formData.amount) || 0,
          currency: currentWallet.symbol,
          user_name: formData.name,
          user_email: formData.email,
          crypto_type: cryptoType,
          crypto_address: currentWallet.address,
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
                  You have {pendingRequests.length} pending crypto funding {pendingRequests.length === 1 ? 'request' : 'requests'}
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
                          <span className="text-xs text-gray-500">
                            ({request.crypto_type})
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Pending
                        </span>
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
                Transaction Pending
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Your deposit request has been received and is currently being processed. This typically takes between 15-30 minutes depending on network confirmation times.
              </p>
              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>Your transaction will be confirmed on the blockchain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0A7F8D] mt-1">•</span>
                    <span>You will receive an email notification once the funds are credited</span>
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

              {/* Blockchain Awareness Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="blockchain"
                  checked={formData.blockchainAware}
                  onChange={(e) => setFormData({ ...formData, blockchainAware: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-[#0A7F8D] focus:ring-[#0A7F8D]"
                />
                <label htmlFor="blockchain" className="text-sm text-gray-700">
                  I am aware that transactions on the blockchain can not be reversed, and I am responsible for using the correct information.
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
                disabled={isSubmitting}
                className="w-full md:w-auto px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Continue'}
              </button>
            </form>
          </div>

          {/* Right Side - QR Code */}
          <div className="bg-white rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
              {/* Crypto Selection Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setSelectedCrypto('btc')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedCrypto === 'btc'
                      ? 'bg-[#0A7F8D] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Bitcoin
                </button>
                <button
                  onClick={() => setSelectedCrypto('eth')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedCrypto === 'eth'
                      ? 'bg-[#0A7F8D] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Ethereum
                </button>
                <button
                  onClick={() => setSelectedCrypto('usdt-erc')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedCrypto === 'usdt-erc'
                      ? 'bg-[#0A7F8D] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  USDT ERC-20
                </button>
                <button
                  onClick={() => setSelectedCrypto('usdt-trc')}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    selectedCrypto === 'usdt-trc'
                      ? 'bg-[#0A7F8D] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  USDT TRC-20
                </button>
              </div>

              {/* QR Code */}
              <div className="bg-white p-8 rounded-xl mb-6 flex justify-center">
                {isLoadingWallets ? (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A7F8D]"></div>
                  </div>
                ) : currentWallet.address ? (
                  <QRCodeSVG
                    value={currentWallet.uri}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-gray-500">
                    <p>Wallet not configured</p>
                  </div>
                )}
              </div>

              {/* Wallet Address */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2 text-center">{currentWallet.label}</p>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <input
                    type="text"
                    value={currentWallet.address}
                    readOnly
                    className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                    aria-label="Wallet Address"
                  />
                  <button
                    onClick={handleCopyAddress}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Amount Display */}
              <div className="flex items-center justify-center gap-2">
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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${currentStep >= 3 ? 'bg-[#0A7F8D-]' : 'bg-gray-300'}`}>
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
