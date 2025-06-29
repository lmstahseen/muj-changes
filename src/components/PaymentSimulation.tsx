import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import walletService, { PaymentSimulation as PaymentSimulationResult } from '../services/walletService';

interface PaymentSimulationProps {
  amount: number;
  description: string;
  onSuccess: (result: PaymentSimulationResult) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function PaymentSimulation({ amount, description, onSuccess, onCancel, isOpen }: PaymentSimulationProps) {
  const [selectedMethod, setSelectedMethod] = useState<'credit_card' | 'paypal' | 'bank_transfer'>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'method' | 'details' | 'processing' | 'result'>('method');
  const [result, setResult] = useState<PaymentSimulationResult | null>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('Initializing payment...');
  const [transactionStatus, setTransactionStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');

  const paymentMethods = [
    {
      id: 'credit_card' as const,
      name: 'Credit/Debit Card',
      icon: 'solar:card-bold-duotone',
      description: 'Visa, Mastercard, American Express',
      processingTime: 'Instant'
    },
    {
      id: 'paypal' as const,
      name: 'PayPal',
      icon: 'solar:smartphone-bold-duotone',
      description: 'Pay with your PayPal account',
      processingTime: 'Instant'
    },
    {
      id: 'bank_transfer' as const,
      name: 'Bank Transfer',
      icon: 'solar:buildings-2-bold-duotone',
      description: 'Direct bank account transfer',
      processingTime: '1-2 business days'
    }
  ];

  const handleMethodSelect = (method: typeof selectedMethod) => {
    setSelectedMethod(method);
    setStep('details');
  };

  const handlePaymentSubmit = async () => {
    setIsProcessing(true);
    setStep('processing');
    setProcessingProgress(0);
    setTransactionStatus('processing');
    setProcessingStatus('Initializing payment...');

    // Simulate processing steps
    const simulateProcessing = async () => {
      // Step 1: Validating payment details
      setProcessingStatus('Validating payment details...');
      setProcessingProgress(20);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 2: Processing payment
      setProcessingStatus('Processing payment...');
      setProcessingProgress(50);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Confirming transaction
      setProcessingStatus('Confirming transaction...');
      setProcessingProgress(80);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Step 4: Finalizing
      setProcessingStatus('Finalizing transaction...');
      setProcessingProgress(95);
      await new Promise(resolve => setTimeout(resolve, 500));
    };

    try {
      // Run the visual processing simulation
      await simulateProcessing();
      
      // Make the actual API call
      const response = await walletService.simulateStakePayment(
        'demo-user-id', // This would be the actual user ID
        'demo-community-id', // This would be the actual community ID
        amount * 100, // Convert to cents
        description,
        selectedMethod
      );

      setProcessingProgress(100);
      
      if (response.success && response.result) {
        setResult(response.result);
        setTransactionStatus(response.result.success ? 'completed' : 'failed');
        setStep('result');
        
        if (response.result.success) {
          setTimeout(() => {
            onSuccess(response.result!);
          }, 2000);
        }
      } else {
        setResult({
          success: false,
          error: response.error || 'Payment failed',
          retry_allowed: true
        });
        setTransactionStatus('failed');
        setStep('result');
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'An unexpected error occurred',
        retry_allowed: true
      });
      setTransactionStatus('failed');
      setStep('result');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setStep('method');
    setResult(null);
    setTransactionStatus('pending');
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Payment Simulation</h2>
            <div className="flex items-center space-x-2 text-green-600">
              <Icon icon="solar:shield-check-bold-duotone" width={16} />
              <span className="text-sm font-medium">Secure</span>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-gray-900">${amount.toFixed(2)}</p>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Payment Method Selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Payment Method</h3>
              
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-primary-300 transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icon icon={method.icon} width={24} className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{method.name}</div>
                      <div className="text-sm text-gray-600">{method.description}</div>
                      <div className="text-xs text-green-600 font-medium">{method.processingTime}</div>
                    </div>
                  </div>
                </button>
              ))}
              
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Simulation Mode</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      This is a payment simulation for testing purposes. No real money will be charged.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Payment Details</h3>
                <button
                  onClick={() => setStep('method')}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Change Method
                </button>
              </div>

              {selectedMethod === 'credit_card' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent pl-10"
                      maxLength={19}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={cardDetails.expiry}
                        onChange={(e) => setCardDetails(prev => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        value={cardDetails.cvv}
                        onChange={(e) => setCardDetails(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '') }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        maxLength={4}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'paypal' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:smartphone-bold-duotone" width={32} className="text-blue-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">PayPal Payment</h4>
                  <p className="text-gray-600">You'll be redirected to PayPal to complete your payment securely.</p>
                </div>
              )}

              {selectedMethod === 'bank_transfer' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:buildings-2-bold-duotone" width={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Bank Transfer</h4>
                  <p className="text-gray-600">Your payment will be processed via secure bank transfer. Processing time: 1-2 business days.</p>
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 text-gray-700">
                  <Icon icon="solar:lock-bold-duotone" width={16} />
                  <span className="text-sm">Your payment information is encrypted and secure</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:refresh-bold-duotone" width={32} className="text-primary-600 animate-spin" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Processing Payment</h4>
              <p className="text-gray-600 mb-4">{processingStatus}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Initializing</span>
                <span>Validating</span>
                <span>Processing</span>
                <span>Completing</span>
              </div>
              
              <div className="mt-6 flex items-center justify-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  transactionStatus === 'pending' ? 'bg-yellow-500' :
                  transactionStatus === 'processing' ? 'bg-blue-500 animate-pulse' :
                  transactionStatus === 'completed' ? 'bg-green-500' :
                  'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600 capitalize">{transactionStatus}</span>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && result && (
            <div className="text-center py-8">
              {result.success ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:check-circle-bold-duotone" width={32} className="text-green-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h4>
                  <p className="text-gray-600 mb-4">Your stake payment has been processed successfully.</p>
                  
                  <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction ID:</span>
                        <span className="font-mono text-gray-900">{result.transaction_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-medium text-gray-900">${(result.amount! / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Receipt:</span>
                        <span className="font-mono text-gray-900">{result.receipt_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium text-green-600">Completed</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:danger-triangle-bold-duotone" width={32} className="text-red-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Payment Failed</h4>
                  <p className="text-gray-600 mb-4">{result.error}</p>
                  
                  <div className="bg-red-50 rounded-lg p-4 text-left mb-4">
                    <div className="flex items-start space-x-3">
                      <Icon icon="solar:danger-triangle-bold-duotone" width={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-medium text-red-800">Transaction Status: Failed</h5>
                        <p className="text-sm text-red-700 mt-1">
                          Your payment could not be processed. Please check your payment details and try again.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {result.retry_allowed && (
                    <button
                      onClick={handleRetry}
                      className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {step === 'details' && (
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                Pay ${amount.toFixed(2)}
              </button>
            </div>
          )}
          
          {(step === 'method' || (step === 'result' && result?.success)) && (
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {step === 'result' && result?.success ? 'Close' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}