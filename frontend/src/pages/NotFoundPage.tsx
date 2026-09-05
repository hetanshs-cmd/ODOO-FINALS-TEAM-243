import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FileQuestion, ArrowLeft, LayoutDashboard, Shield } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCustomer = user?.role?.toLowerCase() === 'customer';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="max-w-md w-full text-center bg-white rounded-[8px] border border-[#E5E7EB] p-8 shadow-xs">
        <div className="w-12 h-12 rounded-[6px] bg-[#F4EEF3] text-[#714B67] flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[#1F2937] tracking-tight">Page not found</h1>
        <p className="text-sm text-[#6B7280] mt-2 mb-6">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-[#4B5563] bg-white border border-[#D1D5DB] rounded-[6px] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate(isCustomer ? '/portal/quotation' : '/dashboard')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#714B67] hover:bg-[#62415A] rounded-[6px] transition-colors cursor-pointer"
          >
            {isCustomer ? (
              <>
                <Shield className="w-3.5 h-3.5" />
                Back to Portal
              </>
            ) : (
              <>
                <LayoutDashboard className="w-3.5 h-3.5" />
                Back to Dashboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
