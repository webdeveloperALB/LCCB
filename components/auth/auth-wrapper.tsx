"use client";
import { useKYCStatus } from "@/hooks/use-kyc-status";
import { useSessionManager } from "@/hooks/use-session-manager";
import KYCVerification from "./kyc-verification";
import AuthForm from "./auth-form";

// This would be your dashboard component
function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to Digital Chain Bank
        </h1>
        <p className="text-gray-600">
          Your dashboard is ready! KYC verification completed.
        </p>
      </div>
    </div>
  );
}

export default function AuthWrapper() {
  const {
    user,
    session,
    loading: sessionLoading,
    error: sessionError,
    isRefreshing,
    refreshSession,
    signOut,
    updateActivity,
  } = useSessionManager();

  // Only call useKYCStatus when user is available and has an ID
  const shouldFetchKYC = user?.id != null;
  const {
    kycStatus,
    loading: kycLoading,
    refreshKYCStatus,
  } = useKYCStatus(shouldFetchKYC ? user.id : null);

  // Show loading only when actually loading session, not when refreshing
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show session error if present
  if (sessionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Session Expired
          </h1>
          <p className="text-gray-600 mb-4">{sessionError}</p>
          <div className="space-y-2">
            <button
              onClick={async () => {
                await refreshSession();
              }}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Retry Connection
            </button>
            <button
              onClick={signOut}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show auth form
  if (!user || !session) {
    return <AuthForm />;
  }

  // Show session refreshing indicator (non-blocking)
  const SessionRefreshIndicator = () => {
    if (!isRefreshing) return null;

    return (
      <div className="fixed top-4 right-4 z-50 bg-blue-100 border border-blue-200 rounded-lg p-3 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-800">Refreshing session...</span>
        </div>
      </div>
    );
  };

  // Show KYC loading state only when we're actually fetching KYC status
  if (shouldFetchKYC && kycLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SessionRefreshIndicator />
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F26623] mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking verification status...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but needs KYC verification
  if (kycStatus === "not_started" || kycStatus === null) {
    return (
      <div className="relative">
        <SessionRefreshIndicator />
        <KYCVerification
          userId={user.id}
          onKYCComplete={async () => {
            // Refetch KYC status before redirecting
            console.log("KYC completed, refetching status...");
            updateActivity(); // Mark user as active
            if (refreshKYCStatus) {
              await refreshKYCStatus();
            }
            // Small delay to ensure state updates
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }}
        />
      </div>
    );
  }

  // If KYC is pending
  if (kycStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SessionRefreshIndicator />
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Under Review
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC documents are being reviewed. This usually takes 1-3
            business days.
          </p>
          <button
            onClick={signOut}
            className="text-[#F26623] hover:text-[#E55A1F] font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If KYC is rejected
  if (kycStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SessionRefreshIndicator />
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            KYC Verification Failed
          </h1>
          <p className="text-gray-600 mb-4">
            Your KYC verification was not approved. Please contact support or
            try again with different documents.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                updateActivity();
                window.location.reload();
              }}
              className="block w-full bg-[#F26623] hover:bg-[#E55A1F] text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={signOut}
              className="block w-full text-[#F26623] hover:text-[#E55A1F] font-medium py-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If KYC is approved, show dashboard
  return (
    <div className="relative">
      <SessionRefreshIndicator />
      <Dashboard />
    </div>
  );
}
