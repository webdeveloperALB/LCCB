import { Bitcoin, Building2 } from 'lucide-react';
import { useState } from 'react';
import CryptoFundingForm from './CryptoFundingForm';
import BankTransferForm from './BankTransferForm';

export default function FundAccount() {
  const [selectedMethod, setSelectedMethod] = useState<'crypto' | 'bank' | null>(null);

  if (selectedMethod === 'crypto') {
    return <CryptoFundingForm onBack={() => setSelectedMethod(null)} />;
  }

  if (selectedMethod === 'bank') {
    return <BankTransferForm onBack={() => setSelectedMethod(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-12">
          Fund Account
        </h1>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
              Please choose the preferred method for your account
            </h2>
            <p className="text-gray-600">
              Every payment is processed with 256 Bit Encryption.{' '}
              <span className="text-gray-400 italic">Additional Information</span>
            </p>
          </div>

          {/* Payment Options Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Crypto Option */}
            <button
              onClick={() => setSelectedMethod('crypto')}
              className="group bg-white border-2 border-gray-200 rounded-xl p-8 text-left transition-all hover:border-[#0A7F8D] hover:shadow-md focus:outline-none focus:border-[#0A7F8D] focus:shadow-md"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                  <Bitcoin className="w-8 h-8 text-gray-600 group-hover:text-[#0A7F8D] transition-colors" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Crypto
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Fund through your crypto wallet with no fees and fast transactions
                  </p>
                </div>
              </div>
            </button>

            {/* Bank Transfer Option */}
            <button
              onClick={() => setSelectedMethod('bank')}
              className="group bg-white border-2 border-gray-200 rounded-xl p-8 text-left transition-all hover:border-[#0A7F8D] hover:shadow-md focus:outline-none focus:border-[#0A7F8D] focus:shadow-md"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                  <Building2 className="w-8 h-8 text-gray-600 group-hover:text-[#0A7F8D] transition-colors" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Bank Transfer
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Fund through SEPA standard Bank Transfer, directly from your bank
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mt-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0A7F8D] rounded-full flex items-center justify-center text-white text-sm font-semibold">
            1
          </div>
          <span className="text-gray-400 text-sm">Select funding method</span>
        </div>
      </div>
    </div>
  );
}
