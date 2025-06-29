import React from 'react';

export function LoadingSpinner() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait while we set up your session</p>
      </div>
    </div>
  );
}