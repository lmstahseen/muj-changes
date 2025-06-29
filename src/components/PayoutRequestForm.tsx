import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import walletService, { PayoutDetails } from '../services/walletService';

interface PayoutRequestFormProps {
  availableBalance: number;
  onSuccess: () => void;
  className?: string;
}

export function PayoutRequestForm({ availableBalance, onSuccess, className = '' }: PayoutRequestFormProps) {
  const { user } = useAuth();
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [formData, setFormData] = useState({
    preferred_method: 'bank_transfer',
    bank_account_number: '',
    bank_routing_number: '',
    bank_account_holder: '',
    paypal_email: '',
    crypto_wallet_address: '',
    crypto_currency: 'BTC',
    minimum_payout_threshold: 25,
    auto_payout_enabled: false
  });

  useEffect(() => {
    if (user) {
      loadPayoutDetails();
    }
  }, [user]);

  useEffect(() => {
    // Set default payout amount to available balance
    if (availableBalance > 0) {
      setPayoutAmount(availableBalance);
    }
  }, [availableBalance]);

  const loadPayoutDetails = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await walletService.getPayoutDetails(user.id);
      if (result.success && result.details) {
        setPayoutDetails(result.details);
        setFormData({
          preferred_method: result.details.preferred_method,
          bank_account_number: result.details.bank_account_number || '',
          bank_routing_number: result.details.bank_routing_number || '',
          bank_account_holder: result.details.bank_account_holder || '',
          paypal_email: result.details.paypal_email || '',
          crypto_wallet_address: result.details.crypto_wallet_address || '',
          crypto_currency: result.details.crypto_currency || 'BTC',
          minimum_payout_threshold: result.details.minimum_payout_threshold,
          auto_payout_enabled: result.details.auto_payout_enabled
        });
      }
    } catch (err) {
      setError('Failed to load payout details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : name === 'minimum_payout_threshold' 
          ? parseFloat(value) 
          : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await walletService.updatePayoutDetails(user.id, {
        ...formData,
        user_id: user.id,
        verification_status: 'pending'
      });
      
      if (result.success) {
        setSuccess('Payout details updated successfully!');
        loadPayoutDetails();
        onSuccess();
      } else {
        setError(result.error || 'Failed to update payout details');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user || !payoutDetails) return;
    
    // Show confirmation modal
    setShowConfirmation(true);
  };

  const confirmPayout = async () => {
    if (!user || !payoutDetails) return;
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const result = await walletService.requestPayout(
        user.id,
        payoutAmount,
        payoutDetails.preferred_method
      );
      
      if (result.success) {
        setSuccess(`Payout request submitted! Request ID: ${result.requestId}. Estimated processing time: ${result.estimatedProcessingDays} days.`);
        onSuccess();
        setShowConfirmation(false);
      } else {
        setError(result.error || 'Failed to submit payout request');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isPayoutMethodConfigured = () => {
    if (!payoutDetails) return false;
    
    switch (payoutDetails.preferred_method) {
      case 'bank_transfer':
        return !!payoutDetails.bank_account_number && 
               !!payoutDetails.bank_routing_number && 
               !!payoutDetails.bank_account_holder;
      case 'paypal':
        return !!payoutDetails.paypal_email;
      case 'crypto':
        return !!payoutDetails.crypto_wallet_address && 
               !!payoutDetails.crypto_currency;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading payout details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <Icon icon="solar:card-bold-duotone" width={20} className="text-primary-600" />
          <span>Payout Settings</span>
        </h3>

        {/* Simulation Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Icon icon="solar:info-circle-bold-duotone" width={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-800 mb-1">Simulation Mode</h4>
              <p className="text-sm text-yellow-700">
                This is a simulation of the payout system. No real money will be transferred. In a production environment, 
                you would be able to withdraw your earnings to your preferred payment method.
              </p>
              <p className="text-sm font-medium text-yellow-800 mt-2">
                IMPORTANT: During the MVP phase, all payouts are manually processed and may take 5-7 business days to complete.
              </p>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
            <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
            <Icon icon="solar:check-circle-bold-duotone" width={20} className="text-green-600 flex-shrink-0" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {/* Available Balance */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Available Balance</h4>
              <p className="text-sm text-gray-600">Amount available for withdrawal</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(availableBalance)}
              </div>
              <div className="text-sm text-gray-600">
                Min: {formatCurrency(formData.minimum_payout_threshold)}
              </div>
            </div>
          </div>
        </div>

        {/* Payout Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Preferred Payout Method
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'bank_transfer', label: 'Bank Transfer', icon: 'solar:buildings-2-bold-duotone' },
                { id: 'paypal', label: 'PayPal', icon: 'solar:smartphone-bold-duotone' },
                { id: 'crypto', label: 'Cryptocurrency', icon: 'solar:card-bold-duotone' }
              ].map((method) => (
                <label
                  key={method.id}
                  className={`flex flex-col items-center p-4 border-2 rounded-xl cursor-pointer transition-colors ${
                    formData.preferred_method === method.id
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="preferred_method"
                    value={method.id}
                    checked={formData.preferred_method === method.id}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <Icon icon={method.icon} width={24} className={`mb-2 ${
                    formData.preferred_method === method.id ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    formData.preferred_method === method.id ? 'text-primary-900' : 'text-gray-700'
                  }`}>
                    {method.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Bank Transfer Details */}
          {formData.preferred_method === 'bank_transfer' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  name="bank_account_holder"
                  value={formData.bank_account_holder}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  name="bank_account_number"
                  value={formData.bank_account_number}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="XXXXXXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Routing Number
                </label>
                <input
                  type="text"
                  name="bank_routing_number"
                  value={formData.bank_routing_number}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="XXXXXXXXX"
                />
              </div>
            </div>
          )}

          {/* PayPal Details */}
          {formData.preferred_method === 'paypal' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PayPal Email
                </label>
                <input
                  type="email"
                  name="paypal_email"
                  value={formData.paypal_email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>
            </div>
          )}

          {/* Crypto Details */}
          {formData.preferred_method === 'crypto' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wallet Address
                </label>
                <input
                  type="text"
                  name="crypto_wallet_address"
                  value={formData.crypto_wallet_address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your wallet address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cryptocurrency
                </label>
                <select
                  name="crypto_currency"
                  value={formData.crypto_currency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH)</option>
                  <option value="USDC">USD Coin (USDC)</option>
                  <option value="USDT">Tether (USDT)</option>
                </select>
              </div>
            </div>
          )}

          {/* Payout Preferences */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Payout Threshold
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  name="minimum_payout_threshold"
                  value={formData.minimum_payout_threshold}
                  onChange={handleInputChange}
                  min="10"
                  step="5"
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum amount required to request a payout
              </p>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="auto_payout"
                name="auto_payout_enabled"
                checked={formData.auto_payout_enabled}
                onChange={handleInputChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="auto_payout" className="ml-2 block text-sm text-gray-700">
                Automatically process payouts when threshold is reached
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Payout Settings'}
            </button>
            
            {payoutDetails && isPayoutMethodConfigured() && availableBalance >= formData.minimum_payout_threshold && (
              <button
                type="button"
                onClick={handleRequestPayout}
                disabled={saving}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Processing...' : `Request Payout (${formatCurrency(availableBalance)})`}
              </button>
            )}
          </div>
        </form>

        {/* Payout Status */}
        {payoutDetails && payoutDetails.verification_status && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Verification Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  payoutDetails.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                  payoutDetails.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  payoutDetails.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {payoutDetails.verification_status.charAt(0).toUpperCase() + payoutDetails.verification_status.slice(1)}
                </span>
              </div>
              
              <div className="text-sm text-gray-600">
                Last Updated: {new Date(payoutDetails.updated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payout Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Confirm Payout Request</h3>
              <button
                onClick={() => setShowConfirmation(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon icon="solar:close-circle-bold-duotone" width={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  You are about to request a payout of <span className="font-bold text-gray-900">{formatCurrency(payoutAmount)}</span> to your {formData.preferred_method.replace('_', ' ')}.
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Icon icon="solar:info-circle-bold-duotone" width={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-800">Important Information</h4>
                      <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                        <li>• Payouts are manually processed during the MVP phase</li>
                        <li>• Processing typically takes 5-7 business days</li>
                        <li>• You will receive a confirmation email when your payout is processed</li>
                        <li>• Minimum payout amount is {formatCurrency(formData.minimum_payout_threshold)}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Payout Amount Adjustment */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(Math.min(availableBalance, Math.max(formData.minimum_payout_threshold, parseFloat(e.target.value) || 0)))}
                    min={formData.minimum_payout_threshold}
                    max={availableBalance}
                    step="0.01"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Min: {formatCurrency(formData.minimum_payout_threshold)}</span>
                  <span>Max: {formatCurrency(availableBalance)}</span>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPayout}
                  disabled={saving || payoutAmount < formData.minimum_payout_threshold}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}